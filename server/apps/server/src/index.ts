import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express from "express";
import morgan from "morgan";

import { ENV } from "./env.server";
import { auth } from "./services";
import vehiclesRouter from "./routes/vehicles";
import passesRouter from "./routes/passes";
import gateRouter from "./routes/gate";
import reportsRouter from "./routes/reports";

const app = express();

app.use(morgan("dev"));

// CORS_ORIGIN may be a single URL or a comma-separated list of URLs
const corsOriginEnv = ENV.CORS_ORIGIN || process.env.CORS_ORIGIN || "";
const allowedCorsOrigins = [
  ...corsOriginEnv.split(",").map((o) => o.trim()),
  // Production origins — always trusted regardless of env var
  "https://oau-vehicle-pass.vercel.app",
  // Local development
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  "http://localhost:8081",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3002",
  "http://127.0.0.1:8081",
  "http://10.0.2.2:3000",
  "http://10.0.2.2:8081",
].filter(Boolean);

const isAllowedOrigin = (origin: string | undefined): boolean => {
  // Native mobile apps, curl, and tools do not send an Origin header
  if (!origin) return true;

  // Exact whitelist match
  if (allowedCorsOrigins.includes(origin)) return true;

  // Mobile custom URL schemes (Expo Go and native app schemes)
  if (origin.startsWith("exp://") || origin.startsWith("oauvehiclepass://")) {
    return true;
  }

  // In development, allow localhost on any port and local network IPs (for physical device testing)
  if (process.env.NODE_ENV !== "production") {
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
    if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return true;
    if (/^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin)) return true;
    if (/^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/.test(origin)) return true;
  }

  return false;
};

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      // Reject disallowed origins cleanly without throwing a 500 error
      callback(null, false);
    }
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "expo-origin", "Cookie"],
  credentials: true,
};

app.use(cors(corsOptions));
app.options("/{*splat}", cors(corsOptions));

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

// ─── Global Error Handler ───────────────────────────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled Server Error:", err);
  res.status(err?.status || 500).json({
    error: err?.message || "Internal Server Error",
    code: err?.code,
  });
});

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
