import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, isAbsolute } from "node:path";
import { randomUUID, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { hasDatabase, getPool, ensureSchema } from "./db";

const scrypt = promisify(scryptCb);

/**
 * User store with two interchangeable adapters behind one interface:
 * Postgres (Neon) when `DATABASE_URL` is set, else a file-backed dev store.
 * Passwords are hashed with scrypt (Node stdlib, no native deps).
 */

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  workspaceId: string;
}

interface UserStore {
  createUser(input: { email: string; name: string; password: string }): Promise<PublicUser>;
  authenticate(email: string, password: string): Promise<PublicUser | null>;
  findById(id: string): Promise<PublicUser | null>;
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

function newUser(email: string, name: string, passwordHash: string) {
  const id = randomUUID();
  return {
    id,
    email: email.trim().toLowerCase(),
    name: name.trim() || email.split("@")[0],
    passwordHash,
    // One personal workspace per user for now; org/workspace switching later.
    workspaceId: `ws_${id}`,
    createdAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// File-backed adapter (dev / CI)
// ---------------------------------------------------------------------------

interface FileUserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  workspaceId: string;
  createdAt: string;
}

function filePath(): string {
  const configured = process.env.USERS_PATH;
  if (configured) {
    return isAbsolute(configured) ? configured : join(process.cwd(), configured);
  }
  return join(process.cwd(), ".mstrmnd", "users.json");
}

class FileUserStore implements UserStore {
  private path = filePath();

  private load(): FileUserRecord[] {
    if (!existsSync(this.path)) return [];
    try {
      const parsed = JSON.parse(readFileSync(this.path, "utf8"));
      return Array.isArray(parsed) ? (parsed as FileUserRecord[]) : [];
    } catch {
      return [];
    }
  }

  private save(rows: FileUserRecord[]): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(rows, null, 2), "utf8");
  }

  async createUser(input: { email: string; name: string; password: string }) {
    const rows = this.load();
    const email = input.email.trim().toLowerCase();
    if (rows.some((u) => u.email === email)) {
      throw new Error("An account with that email already exists.");
    }
    const record = newUser(email, input.name, await hashPassword(input.password));
    rows.push(record);
    this.save(rows);
    return toPublic(record);
  }

  async authenticate(email: string, password: string) {
    const user = this.load().find((u) => u.email === email.trim().toLowerCase());
    if (!user) return null;
    return (await verifyPassword(password, user.passwordHash)) ? toPublic(user) : null;
  }

  async findById(id: string) {
    const user = this.load().find((u) => u.id === id);
    return user ? toPublic(user) : null;
  }
}

// ---------------------------------------------------------------------------
// Postgres adapter (Neon / any Postgres)
// ---------------------------------------------------------------------------

interface PgUserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  workspace_id: string;
}

class PostgresUserStore implements UserStore {
  async createUser(input: { email: string; name: string; password: string }) {
    await ensureSchema();
    const record = newUser(input.email, input.name, await hashPassword(input.password));
    try {
      await getPool().query(
        `insert into users (id, email, name, password_hash, workspace_id, created_at)
         values ($1, $2, $3, $4, $5, $6)`,
        [
          record.id,
          record.email,
          record.name,
          record.passwordHash,
          record.workspaceId,
          record.createdAt,
        ],
      );
    } catch (err) {
      if ((err as { code?: string }).code === "23505") {
        throw new Error("An account with that email already exists.");
      }
      throw err;
    }
    return toPublic(record);
  }

  async authenticate(email: string, password: string) {
    await ensureSchema();
    const { rows } = await getPool().query<PgUserRow>(
      `select id, email, name, password_hash, workspace_id
         from users where email = $1`,
      [email.trim().toLowerCase()],
    );
    const row = rows[0];
    if (!row) return null;
    return (await verifyPassword(password, row.password_hash)) ? rowToPublic(row) : null;
  }

  async findById(id: string) {
    await ensureSchema();
    const { rows } = await getPool().query<PgUserRow>(
      `select id, email, name, password_hash, workspace_id from users where id = $1`,
      [id],
    );
    return rows[0] ? rowToPublic(rows[0]) : null;
  }
}

function toPublic(u: {
  id: string;
  email: string;
  name: string;
  workspaceId: string;
}): PublicUser {
  return { id: u.id, email: u.email, name: u.name, workspaceId: u.workspaceId };
}

function rowToPublic(r: PgUserRow): PublicUser {
  return { id: r.id, email: r.email, name: r.name, workspaceId: r.workspace_id };
}

let store: UserStore | null = null;
function userStore(): UserStore {
  if (!store) store = hasDatabase() ? new PostgresUserStore() : new FileUserStore();
  return store;
}

export function createUser(input: { email: string; name: string; password: string }) {
  return userStore().createUser(input);
}
export function authenticate(email: string, password: string) {
  return userStore().authenticate(email, password);
}
export function findById(id: string) {
  return userStore().findById(id);
}
