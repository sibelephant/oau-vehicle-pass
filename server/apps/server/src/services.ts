import { createAuth } from "@oau-vehicle-pass/auth";
import { createDb } from "@oau-vehicle-pass/db";

import { ENV } from "./env.server";

export const db = createDb(ENV);
export const auth = createAuth(ENV, db);
