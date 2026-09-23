import type { NextFunction, Request, Response } from "express";

import { auth } from "../services";

type UserRole = "driver" | "gate_officer" | "admin";

// Extend Express Request with our typed user/session
declare global {
  namespace Express {
    interface Request {
      currentUser?: {
        id: string;
        name: string;
        email: string;
        role: UserRole;
      };
    }
  }
}

async function resolveSession(req: Request) {
  return auth.api.getSession({
    headers: new Headers(req.headers as Record<string, string>),
  });
}

/** Requires a valid session. Attaches `req.currentUser`. */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const session = await resolveSession(req);
  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.currentUser = session.user as typeof req.currentUser;
  next();
}

/** Requires a valid session AND one of the specified roles. */
export function requireRole(...roles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const session = await resolveSession(req);
    if (!session?.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const user = session.user as { id: string; name: string; email: string; role: UserRole };
    if (!roles.includes(user.role)) {
      res.status(403).json({ error: "Forbidden — insufficient role" });
      return;
    }
    req.currentUser = user;
    next();
  };
}
