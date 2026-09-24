import { and, eq, gte, lte, sql } from "drizzle-orm";
import { Router } from "express";

import { accessLog, vehicle } from "@oau-vehicle-pass/db/schema/vehicles";
import { user } from "@oau-vehicle-pass/db/schema/auth";

import { requireRole } from "../middleware/roles";
import { db } from "../services";

const router = Router();

const adminOrOfficer = requireRole("admin", "gate_officer");

// ─── Access Log ───────────────────────────────────────────────────────────────

/**
 * GET /api/reports/access-log?from=ISO&to=ISO&page=1&limit=20&decision=granted&channel=qr
 * Returns paginated access log entries with vehicle info.
 */
router.get("/access-log", adminOrOfficer, async (req, res) => {
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1"));
  const limit = Math.min(100, parseInt((req.query.limit as string) ?? "20"));
  const offset = (page - 1) * limit;

  const conditions = [];
  if (req.query.from) {
    conditions.push(
      gte(accessLog.timestamp, new Date(req.query.from as string)),
    );
  }
  if (req.query.to) {
    conditions.push(lte(accessLog.timestamp, new Date(req.query.to as string)));
  }
  if (req.query.decision) {
    conditions.push(
      eq(accessLog.decision, req.query.decision as "granted" | "denied"),
    );
  }
  if (req.query.channel) {
    conditions.push(
      eq(accessLog.channel, req.query.channel as "qr" | "anpr" | "manual"),
    );
  }

  const [{ total = 0 } = {}] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(accessLog)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  // Use select() API which fully supports arbitrary where conditions
  const logs = await db
    .select({
      log: accessLog,
      vehicle: vehicle,
      officerName: user.name,
    })
    .from(accessLog)
    .leftJoin(vehicle, eq(accessLog.vehicleId, vehicle.id))
    .leftJoin(user, eq(accessLog.gateOfficerId, user.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${accessLog.timestamp} DESC`)
    .limit(limit)
    .offset(offset);

  res.json({ data: logs, total, page, limit });
});

// ─── Peak Hours ───────────────────────────────────────────────────────────────

/**
 * GET /api/reports/peak-hours?from=ISO&to=ISO
 * Returns hourly access counts for charting.
 */
router.get("/peak-hours", adminOrOfficer, async (req, res) => {
  const conditions = [];
  if (req.query.from) {
    conditions.push(
      gte(accessLog.timestamp, new Date(req.query.from as string)),
    );
  }
  if (req.query.to) {
    conditions.push(lte(accessLog.timestamp, new Date(req.query.to as string)));
  }

  const rows = await db
    .select({
      hour: sql<number>`EXTRACT(HOUR FROM ${accessLog.timestamp})::int`,
      total: sql<number>`COUNT(*)::int`,
      granted: sql<number>`SUM(CASE WHEN ${accessLog.decision} = 'granted' THEN 1 ELSE 0 END)::int`,
      denied: sql<number>`SUM(CASE WHEN ${accessLog.decision} = 'denied' THEN 1 ELSE 0 END)::int`,
      qr: sql<number>`SUM(CASE WHEN ${accessLog.channel} = 'qr' THEN 1 ELSE 0 END)::int`,
      anpr: sql<number>`SUM(CASE WHEN ${accessLog.channel} = 'anpr' THEN 1 ELSE 0 END)::int`,
      manual: sql<number>`SUM(CASE WHEN ${accessLog.channel} = 'manual' THEN 1 ELSE 0 END)::int`,
    })
    .from(accessLog)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(sql`EXTRACT(HOUR FROM ${accessLog.timestamp})`)
    .orderBy(sql`EXTRACT(HOUR FROM ${accessLog.timestamp})`);

  res.json(rows);
});

// ─── Daily Trends ─────────────────────────────────────────────────────────────

/**
 * GET /api/reports/daily-trends?from=ISO&to=ISO
 * Returns day-by-day access counts for trending analysis.
 */
router.get("/daily-trends", adminOrOfficer, async (req, res) => {
  const conditions = [];
  if (req.query.from) {
    conditions.push(
      gte(accessLog.timestamp, new Date(req.query.from as string)),
    );
  }
  if (req.query.to) {
    conditions.push(lte(accessLog.timestamp, new Date(req.query.to as string)));
  }

  const rows = await db
    .select({
      date: sql<string>`TO_CHAR(${accessLog.timestamp}, 'YYYY-MM-DD')`,
      total: sql<number>`COUNT(*)::int`,
      granted: sql<number>`SUM(CASE WHEN ${accessLog.decision} = 'granted' THEN 1 ELSE 0 END)::int`,
      denied: sql<number>`SUM(CASE WHEN ${accessLog.decision} = 'denied' THEN 1 ELSE 0 END)::int`,
      qr: sql<number>`SUM(CASE WHEN ${accessLog.channel} = 'qr' THEN 1 ELSE 0 END)::int`,
      anpr: sql<number>`SUM(CASE WHEN ${accessLog.channel} = 'anpr' THEN 1 ELSE 0 END)::int`,
      manual: sql<number>`SUM(CASE WHEN ${accessLog.channel} = 'manual' THEN 1 ELSE 0 END)::int`,
    })
    .from(accessLog)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(sql`TO_CHAR(${accessLog.timestamp}, 'YYYY-MM-DD')`)
    .orderBy(sql`TO_CHAR(${accessLog.timestamp}, 'YYYY-MM-DD') ASC`);

  res.json(rows);
});

// ─── Unauthorized Attempts Audit ──────────────────────────────────────────────

/**
 * GET /api/reports/unauthorized?from=ISO&to=ISO
 * Returns distribution of security rejections / unauthorized attempts.
 */
router.get("/unauthorized", adminOrOfficer, async (req, res) => {
  const conditions = [eq(accessLog.decision, "denied")];
  if (req.query.from) {
    conditions.push(
      gte(accessLog.timestamp, new Date(req.query.from as string)),
    );
  }
  if (req.query.to) {
    conditions.push(lte(accessLog.timestamp, new Date(req.query.to as string)));
  }

  const rows = await db
    .select({
      reason: sql<string>`COALESCE(${accessLog.overrideReason}, 'Unspecified denial')`,
      channel: accessLog.channel,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(accessLog)
    .where(and(...conditions))
    .groupBy(
      sql`COALESCE(${accessLog.overrideReason}, 'Unspecified denial')`,
      accessLog.channel,
    )
    .orderBy(sql`COUNT(*) DESC`);

  res.json(rows);
});

// ─── Summary Stats ────────────────────────────────────────────────────────────

/** GET /api/reports/summary — quick stats for the dashboard */
router.get("/summary", adminOrOfficer, async (req, res) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const from = req.query.from ? new Date(req.query.from as string) : todayStart;
  const toValue = req.query.to as string | undefined;
  const to = toValue
    ? new Date(
        /^\d{4}-\d{2}-\d{2}$/.test(toValue)
          ? `${toValue}T23:59:59.999Z`
          : toValue,
      )
    : undefined;
  const summaryConditions = [gte(accessLog.timestamp, from)];
  if (to) summaryConditions.push(lte(accessLog.timestamp, to));

  const [todayStats] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      granted: sql<number>`SUM(CASE WHEN ${accessLog.decision} = 'granted' THEN 1 ELSE 0 END)::int`,
      denied: sql<number>`SUM(CASE WHEN ${accessLog.decision} = 'denied' THEN 1 ELSE 0 END)::int`,
      qr: sql<number>`SUM(CASE WHEN ${accessLog.channel} = 'qr' THEN 1 ELSE 0 END)::int`,
      anpr: sql<number>`SUM(CASE WHEN ${accessLog.channel} = 'anpr' THEN 1 ELSE 0 END)::int`,
      manual: sql<number>`SUM(CASE WHEN ${accessLog.channel} = 'manual' THEN 1 ELSE 0 END)::int`,
    })
    .from(accessLog)
    .where(and(...summaryConditions));

  const [peakHour] = await db
    .select({
      hour: sql<number>`EXTRACT(HOUR FROM ${accessLog.timestamp})::int`,
      total: sql<number>`COUNT(*)::int`,
    })
    .from(accessLog)
    .where(and(...summaryConditions))
    .groupBy(sql`EXTRACT(HOUR FROM ${accessLog.timestamp})`)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(1);

  res.json({
    today: {
      total: todayStats?.total ?? 0,
      granted: todayStats?.granted ?? 0,
      denied: todayStats?.denied ?? 0,
      qr: todayStats?.qr ?? 0,
      anpr: todayStats?.anpr ?? 0,
      manual: todayStats?.manual ?? 0,
      peakHour: peakHour?.hour ?? null,
      peakHourCount: peakHour?.total ?? 0,
    },
  });
});

export default router;
