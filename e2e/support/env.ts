import { existsSync } from "node:fs";
import { resolve } from "node:path";

/** Loads .env.local into process.env (Playwright doesn't do this; Next does it only for the server). */
export function loadEnvLocal(): void {
  const path = resolve(process.cwd(), ".env.local");
  if (existsSync(path)) process.loadEnvFile(path);
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} (set it in .env.local)`);
  return value;
}
