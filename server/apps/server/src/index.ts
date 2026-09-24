import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express from "express";

import { ENV } from "./env.server";
import { auth } from "./services";
import vehiclesRouter from "./routes/vehicles";
import passesRouter from "./routes/passes";
import gateRouter from "./routes/gate";
import reportsRouter from "./routes/reports";

const app = express();

const allowedCorsOrigins = [
  ENV.CORS_ORIGIN,
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:8081",
  "http://10.0.2.2:3000",
  "http://10.0.2.2:8081",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl)
      if (!origin) return callback(null, true);
      if (
        allowedCorsOrigins.includes(origin) ||
        origin.startsWith("exp://") ||
        origin.startsWith("oauvehiclepass://")
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "expo-origin"],
    credentials: true,
  }),
);

// Better-auth handles its own body parsing
app.all("/api/auth{/*path}", toNodeHandler(auth));

app.use(express.json({ limit: "10mb" })); // 10 MB for base64 photo uploads

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/vehicles", vehiclesRouter);
app.use("/api/passes", passesRouter);
app.use("/api/gate", gateRouter);
app.use("/api/reports", reportsRouter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.status(200).json({ status: "OK", service: "OAU Vehicle Pass API" });
});

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
