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

app.use(
  cors({
    origin: ENV.CORS_ORIGIN,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
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

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
