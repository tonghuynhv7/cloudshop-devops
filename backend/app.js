const express = require("express");

const app = express();

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.json({
    service: "CloudShop API",
    version: "1.0.0",
    status: "running",
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});