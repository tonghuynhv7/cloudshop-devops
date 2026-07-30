const express = require("express");
const { Pool } = require("pg");
const { createClient } = require("redis");

const app = express();

/* =========================================================
   APPLICATION CONFIGURATION
========================================================= */

const PORT = Number(process.env.PORT || 3000);

const DB_HOST = process.env.DB_HOST || "postgres";
const DB_PORT = Number(process.env.DB_PORT || 5432);
const DB_NAME = process.env.DB_NAME || "cloudshop";
const DB_USER = process.env.DB_USER || "clouduser";
const DB_PASSWORD = process.env.DB_PASSWORD || "cloudpass";
const DB_SSL = process.env.DB_SSL === "true";

const REDIS_HOST = process.env.REDIS_HOST || "redis";
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);
const REDIS_TLS = process.env.REDIS_TLS === "true";

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(express.json());

/* =========================================================
   POSTGRESQL CONNECTION
========================================================= */

const pool = new Pool({
  host: DB_HOST,
  port: DB_PORT,
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,

  // Docker Compose PostgreSQL:
  // DB_SSL=false
  //
  // AWS RDS PostgreSQL:
  // DB_SSL=true
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
  console.error("Unexpected PostgreSQL pool error:", error.message);
});

/* =========================================================
   REDIS CONNECTION
========================================================= */

const redisClient = createClient({
  socket: {
    host: REDIS_HOST,
    port: REDIS_PORT,

    // Docker Compose Redis:
    // REDIS_TLS=false
    //
    // AWS ElastiCache Serverless:
    // REDIS_TLS=true
    tls: REDIS_TLS,

    connectTimeout: 10000,

    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error("Redis reconnect attempts exceeded");
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

redisClient.on("reconnecting", () => {
  console.log("Redis reconnecting...");
});

redisClient.on("error", (error) => {
  console.error("Redis error:", error.message);
});

redisClient.on("end", () => {
  console.log("Redis connection closed");
});

/* =========================================================
   ROUTES
========================================================= */

/**
 * Root endpoint
 */
app.get("/", (req, res) => {
  res.status(200).json({
    service: "CloudShop Product API",
    version: "1.0.0",
    status: "running",
  });
});

/**
 * Liveness endpoint
 *
 * Chỉ kiểm tra Node.js API có đang chạy hay không.
 * Không kiểm tra PostgreSQL hoặc Redis.
 *
 * Có thể dùng endpoint này cho ALB Health Check:
 * /health/live
 */
app.get("/health/live", (req, res) => {
  res.status(200).json({
    status: "alive",
    service: "cloudshop-api",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Readiness endpoint
 *
 * Kiểm tra:
 * - PostgreSQL
 * - Redis
 *
 * Trả về:
 * - 200 khi tất cả dependency hoạt động
 * - 503 khi PostgreSQL hoặc Redis lỗi
 */
app.get("/health/ready", async (req, res) => {
  const health = {
    api: "healthy",
    postgres: "unknown",
    redis: "unknown",
    timestamp: new Date().toISOString(),
  };

  let isReady = true;

  /*
   * PostgreSQL health check
   */
  try {
    await pool.query("SELECT 1");
    health.postgres = "healthy";
  } catch (error) {
    isReady = false;
    health.postgres = "unhealthy";

    console.error(
      "PostgreSQL health check failed:",
      error.message
    );
  }

  /*
   * Redis health check
   */
  try {
    if (!redisClient.isOpen) {
      throw new Error("Redis connection is not open");
    }

    const redisResponse = await redisClient.ping();

    if (redisResponse !== "PONG") {
      throw new Error(`Unexpected Redis response: ${redisResponse}`);
    }

    health.redis = "healthy";
  } catch (error) {
    isReady = false;
    health.redis = "unhealthy";

    console.error(
      "Redis health check failed:",
      error.message
    );
  }

  if (!isReady) {
    return res.status(503).json(health);
  }

  return res.status(200).json(health);
});

/**
 * Endpoint cũ để tương thích nếu workflow đang dùng /health
 */
app.get("/health", async (req, res) => {
  const health = {
    api: "healthy",
    postgres: "unknown",
    redis: "unknown",
  };

  let isHealthy = true;

  try {
    await pool.query("SELECT 1");
    health.postgres = "healthy";
  } catch (error) {
    isHealthy = false;
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

    await redisClient.ping();
    health.redis = "healthy";
  } catch (error) {
    isHealthy = false;
    health.redis = "unhealthy";

    console.error(
      "Redis health check failed:",
      error.message
    );
  }

  return res.status(isHealthy ? 200 : 503).json(health);
});

/**
 * Products endpoint
 */
app.get("/products", async (req, res) => {
  try {
    const cacheKey = "cloudshop:products";

    /*
     * Kiểm tra Redis cache
     */
    if (redisClient.isOpen) {
      const cachedProducts = await redisClient.get(cacheKey);

      if (cachedProducts) {
        return res.status(200).json({
          source: "redis",
          products: JSON.parse(cachedProducts),
        });
      }
    }

    /*
     * Dữ liệu mẫu
     */
    const products = [
      {
        id: 1,
        name: "CloudShop Laptop",
        price: 1500,
      },
      {
        id: 2,
        name: "CloudShop Keyboard",
        price: 100,
      },
      {
        id: 3,
        name: "CloudShop Mouse",
        price: 50,
      },
    ];

    /*
     * Lưu cache trong 60 giây
     */
    if (redisClient.isOpen) {
      await redisClient.setEx(
        cacheKey,
        60,
        JSON.stringify(products)
      );
    }

    return res.status(200).json({
      source: "application",
      products,
    });
  } catch (error) {
    console.error("Get products failed:", error.message);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

/* =========================================================
   404 HANDLER
========================================================= */

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
  });
});

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use((error, req, res, next) => {
  console.error("Unhandled application error:", error);

  res.status(500).json({
    error: "Internal server error",
  });
});

/* =========================================================
   APPLICATION STARTUP
========================================================= */

let server;

async function startApplication() {
  try {
    console.log("========================================");
    console.log("Starting CloudShop API");
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`PostgreSQL host: ${DB_HOST}:${DB_PORT}`);
    console.log(`PostgreSQL SSL enabled: ${DB_SSL}`);
    console.log(`Redis host: ${REDIS_HOST}:${REDIS_PORT}`);
    console.log(`Redis TLS enabled: ${REDIS_TLS}`);
    console.log("========================================");

    /*
     * Kết nối Redis lúc application startup.
     *
     * Không in password hoặc secret ra log.
     */
    console.log("Connecting to Redis...");

    await redisClient.connect();

    console.log("Redis connected");

    /*
     * Kiểm tra PostgreSQL khi startup.
     *
     * Nếu DB tạm thời lỗi, API vẫn khởi động để:
     * - /health/live trả 200
     * - /health/ready trả 503
     *
     * Điều này giúp debug dễ hơn và tránh container crash loop.
     */
    try {
      await pool.query("SELECT 1");
      console.log("PostgreSQL connected");
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
    console.error("Application startup failed:", error.message);
    process.exit(1);
  }
}

/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down gracefully...`);

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
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

    process.exit(0);
  } catch (error) {
    console.error("Graceful shutdown failed:", error.message);
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