const express = require("express");
const { Pool } = require("pg");
const { createClient } = require("redis");

const app = express();

/* =========================
   CONFIG
========================= */

const PORT = Number(process.env.PORT || 3000);

const DB_HOST = process.env.DB_HOST || "postgres";
const DB_PORT = Number(process.env.DB_PORT || 5432);
const DB_NAME = process.env.DB_NAME || "cloudshop";
const DB_USER = process.env.DB_USER || "clouduser";
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_SSL = process.env.DB_SSL === "true";

const REDIS_HOST = process.env.REDIS_HOST || "redis";
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);
const REDIS_TLS = process.env.REDIS_TLS === "true";

const PRODUCTS_CACHE_KEY = "cloudshop:products";
const PRODUCTS_CACHE_TTL = 60;
if (!DB_PASSWORD) {
  throw new Error("DB_PASSWORD environment variable is required");
}

app.use(express.json());

/* =========================
   POSTGRESQL
========================= */

const pool = new Pool({
  host: DB_HOST,
  port: DB_PORT,
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,

  ssl: DB_SSL
    ? {
        rejectUnauthorized: false,
      }
    : false,

  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 10,
});

pool.on("error", (error) => {
  console.error("PostgreSQL pool error:", error.message);
});

async function initializeProductsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      price NUMERIC(10,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/* =========================
   REDIS
========================= */

const redisClient = createClient({
  socket: {
    host: REDIS_HOST,
    port: REDIS_PORT,
    tls: REDIS_TLS,
    connectTimeout: 10000,

    reconnectStrategy: (retries) => {
      if (retries > 10) {
        return new Error("Redis reconnect attempts exceeded");
      }

      return Math.min(retries * 500, 5000);
    },
  },
});

redisClient.on("connect", () => {
  console.log("Redis socket connected");
});

redisClient.on("ready", () => {
  console.log("Redis ready");
});

redisClient.on("error", (error) => {
  console.error("Redis error:", error.message);
});

/* =========================
   ROUTES
========================= */

app.get("/", (req, res) => {
  res.status(200).json({
    service: "CloudShop Product API",
    version: "1.0.0",
    status: "running",
  });
});

/*
 * Liveness:
 * Chỉ kiểm tra API process còn sống.
 * ALB dùng endpoint này.
 */
app.get("/health/live", (req, res) => {
  res.status(200).json({
    status: "alive",
    service: "cloudshop-api",
    timestamp: new Date().toISOString(),
  });
});

/*
 * Readiness:
 * PostgreSQL + Redis đều phải hoạt động.
 */
app.get("/health/ready", async (req, res) => {
  const health = {
    api: "healthy",
    postgres: "unknown",
    redis: "unknown",
    timestamp: new Date().toISOString(),
  };

  let ready = true;

  try {
    await pool.query("SELECT 1");
    health.postgres = "healthy";
  } catch (error) {
    ready = false;
    health.postgres = "unhealthy";

    console.error(
      "PostgreSQL health check failed:",
      error.message
    );
  }

  try {
    if (!redisClient.isOpen) {
      throw new Error("Redis connection is not open");
    }

    const response = await redisClient.ping();

    if (response !== "PONG") {
      throw new Error(`Unexpected Redis response: ${response}`);
    }

    health.redis = "healthy";
  } catch (error) {
    ready = false;
    health.redis = "unhealthy";

    console.error(
      "Redis health check failed:",
      error.message
    );
  }

  return res.status(ready ? 200 : 503).json(health);
});

/* =========================
   GET PRODUCTS
========================= */

app.get("/products", async (req, res) => {
  try {
    /*
     * 1. Check Redis trước.
     */
    if (redisClient.isOpen) {
      const cached = await redisClient.get(PRODUCTS_CACHE_KEY);

      if (cached) {
        return res.status(200).json({
          source: "redis",
          products: JSON.parse(cached),
        });
      }
    }

    /*
     * 2. Cache miss -> query RDS.
     */
    const result = await pool.query(`
      SELECT id, name, price, created_at
      FROM products
      ORDER BY id
    `);

    const products = result.rows;

    /*
     * 3. Cache dữ liệu trong Redis 60 giây.
     */
    if (redisClient.isOpen) {
      await redisClient.setEx(
        PRODUCTS_CACHE_KEY,
        PRODUCTS_CACHE_TTL,
        JSON.stringify(products)
      );
    }

    return res.status(200).json({
      source: "database",
      products,
    });
  } catch (error) {
    console.error("Get products failed:", error.message);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

/* =========================
   CREATE PRODUCT
========================= */

app.post("/products", async (req, res) => {
  try {
    const { name, price } = req.body;

    if (!name || price == null) {
      return res.status(400).json({
        error: "name and price are required",
      });
    }

    const numericPrice = Number(price);

    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return res.status(400).json({
        error: "price must be a valid non-negative number",
      });
    }

    /*
     * Ghi dữ liệu thật vào PostgreSQL RDS.
     */
    const result = await pool.query(
      `
      INSERT INTO products (name, price)
      VALUES ($1, $2)
      RETURNING id, name, price, created_at
      `,
      [name, numericPrice]
    );

    /*
     * Database đã thay đổi -> cache cũ không còn hợp lệ.
     */
    if (redisClient.isOpen) {
      await redisClient.del(PRODUCTS_CACHE_KEY);
    }

    return res.status(201).json({
      message: "Product created",
      product: result.rows[0],
    });
  } catch (error) {
    console.error("Create product failed:", error.message);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

/* =========================
   404 + ERROR HANDLER
========================= */

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
  });
});

app.use((error, req, res, next) => {
  console.error("Unhandled application error:", error);

  return res.status(500).json({
    error: "Internal server error",
  });
});

/* =========================
   STARTUP
========================= */

let server;

async function startApplication() {
  try {
    console.log("========================================");
    console.log("Starting CloudShop API");
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`PostgreSQL: ${DB_HOST}:${DB_PORT}`);
    console.log(`PostgreSQL SSL: ${DB_SSL}`);
    console.log(`Redis: ${REDIS_HOST}:${REDIS_PORT}`);
    console.log(`Redis TLS: ${REDIS_TLS}`);
    console.log("========================================");

    /*
     * Redis connect.
     */
    console.log("Connecting to Redis...");

    await redisClient.connect();

    console.log("Redis connected");

    /*
     * PostgreSQL check + initialize table.
     *
     * Nếu DB lỗi, API vẫn start để:
     * /health/live = 200
     * /health/ready = 503
     */
    try {
      await pool.query("SELECT 1");

      console.log("PostgreSQL connected");

      await initializeProductsTable();

      console.log("Products table ready");
    } catch (error) {
      console.error(
        "Initial PostgreSQL connection failed:",
        error.message
      );
    }

    server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error(
      "Application startup failed:",
      error.message
    );

    process.exit(1);
  }
}

/* =========================
   GRACEFUL SHUTDOWN
========================= */

async function shutdown(signal) {
  console.log(
    `${signal} received. Shutting down gracefully...`
  );

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            return reject(error);
          }

          resolve();
        });
      });

      console.log("HTTP server closed");
    }

    if (redisClient.isOpen) {
      await redisClient.quit();

      console.log("Redis connection closed");
    }

    await pool.end();

    console.log("PostgreSQL pool closed");
    console.log("Application stopped");

    process.exit(0);
  } catch (error) {
    console.error(
      "Graceful shutdown failed:",
      error.message
    );

    process.exit(1);
  }
}

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

startApplication();