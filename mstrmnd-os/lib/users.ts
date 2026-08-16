import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, isAbsolute } from "node:path";
import { randomUUID, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);

/**
 * User store. Slice: file-backed for local dev / CI (zero external services);
 * the production adapter (Neon/Postgres) is a drop-in behind this interface.
 * Passwords are hashed with scrypt (Node stdlib, no native deps).
 */

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string; // scrypt-derived, "salt:hash" hex
  workspaceId: string;
  createdAt: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  workspaceId: string;
}

export function toPublic(u: UserRecord): PublicUser {
  return { id: u.id, email: u.email, name: u.name, workspaceId: u.workspaceId };
}

function storePath(): string {
  const configured = process.env.USERS_PATH;
  if (configured) {
    return isAbsolute(configured) ? configured : join(process.cwd(), configured);
  }
  return join(process.cwd(), ".mstrmnd", "users.json");
}

function loadAll(path: string): UserRecord[] {
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(parsed) ? (parsed as UserRecord[]) : [];
  } catch {
    return [];
  }
}

function saveAll(path: string, rows: UserRecord[]): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(rows, null, 2), "utf8");
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hashHex, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

const path = storePath();

export function findByEmail(email: string): UserRecord | null {
  const normalized = email.trim().toLowerCase();
  return loadAll(path).find((u) => u.email === normalized) ?? null;
}

export function findById(id: string): UserRecord | null {
  return loadAll(path).find((u) => u.id === id) ?? null;
}

export async function createUser(input: {
  email: string;
  name: string;
  password: string;
}): Promise<PublicUser> {
  const email = input.email.trim().toLowerCase();
  const rows = loadAll(path);
  if (rows.some((u) => u.email === email)) {
    throw new Error("An account with that email already exists.");
  }
  const id = randomUUID();
  const record: UserRecord = {
    id,
    email,
    name: input.name.trim() || email.split("@")[0],
    passwordHash: await hashPassword(input.password),
    // One personal workspace per user for now; org/workspace switching is a
    // later slice. Third-Mind scopes to this workspaceId.
    workspaceId: `ws_${id}`,
    createdAt: new Date().toISOString(),
  };
  rows.push(record);
  saveAll(path, rows);
  return toPublic(record);
}

export async function authenticate(
  email: string,
  password: string,
): Promise<PublicUser | null> {
  const user = findByEmail(email);
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  return ok ? toPublic(user) : null;
}
