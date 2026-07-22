const express = require("express");
const { Pool } = require("pg");
const { createClient } = require("redis");

const app = express();

const PORT = Number(process.env.PORT || 3000);

const pool = new Pool({
  host: process.env.DB_HOST || "postgres",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "clouduser",
  password: process.env.DB_PASSWORD || "cloudpass",
  database: process.env.DB_NAME || "cloudshop",
});

const redisClient = createClient({
  url: `redis://${process.env.REDIS_HOST || "redis"}:${
    process.env.REDIS_PORT || 6379
  }`,
});

redisClient.on("error", (error) => {
  console.error("Redis:", error.message);
});

app.get("/", (req, res) => {
  res.json({
    service: "CloudShop API",
    version: "1.0.0",
    status: "running",
  });
});

app.get("/health/live", (req, res) => {
  res.status(200).json({
    status: "alive",
  });
});

app.get("/health/ready", async (req, res) => {
  const health = {
    api: "healthy",
    postgres: "unknown",
    redis: "unknown",
  };

  let isReady = true;

  try {
    await pool.query("SELECT 1");
    health.postgres = "healthy";
  } catch (error) {
    health.postgres = "unhealthy";
    isReady = false;

    console.error("PostgreSQL health check failed:", error.message);
  }

  try {
    await redisClient.ping();
    health.redis = "healthy";
  } catch (error) {
    health.redis = "unhealthy";
    isReady = false;

    console.error("Redis health check failed:", error.message);
  }

  return res.status(isReady ? 200 : 503).json(health);
});

async function startServer() {
  try {
    await redisClient.connect();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Application startup failed:", error.message);
    process.exit(1);
  }
}

startServer();