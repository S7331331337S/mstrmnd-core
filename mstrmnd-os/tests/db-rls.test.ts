/**
 * Row-level security for the app tables (db/migrations/0001_rls.sql).
 *
 * Unit part (always runs): workspace resolution fails closed in production.
 *
 * Database part (runs only when TEST_DATABASE_URL is set, so CI stays green
 * without DB credentials): connect as the database OWNER of a throwaway
 * database / Neon branch that already has 0001_rls.sql applied, then
 * `SET LOCAL ROLE mstrmnd_app` inside one transaction and prove the policies
 * hold for the real app role (NOSUPERUSER, NOBYPASSRLS, not the owner).
 * Everything, including seed rows and the temporary role membership, runs in
 * a single transaction that is ROLLED BACK at the end: nothing persists.
 *
 *   TEST_DATABASE_URL=<owner url of a TEST branch> pnpm test:tools
 *
 * Never point TEST_DATABASE_URL at production.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { Client } from "pg";

import { DEV_WORKSPACE, resolveWorkspaceId } from "../lib/db";

describe("resolveWorkspaceId", () => {
  it("passes a real workspace through", () => {
    assert.equal(resolveWorkspaceId("ws_abc", { NODE_ENV: "production" }), "ws_abc");
  });
  it("falls back to the shared dev scope outside production only", () => {
    assert.equal(resolveWorkspaceId(undefined, { NODE_ENV: "development" }), DEV_WORKSPACE);
    assert.equal(resolveWorkspaceId("  ", {}), DEV_WORKSPACE);
  });
  it("throws in production when there is no workspace", () => {
    assert.throws(() => resolveWorkspaceId(undefined, { NODE_ENV: "production" }), /No workspace/);
    assert.throws(() => resolveWorkspaceId("", { NODE_ENV: "production" }), /No workspace/);
  });
});

const url = process.env.TEST_DATABASE_URL;

describe("RLS as mstrmnd_app (TEST_DATABASE_URL)", { skip: url ? false : "TEST_DATABASE_URL not set" }, () => {
  let db: Client;
  const tag = randomUUID().slice(0, 8);
  const wsA = `ws_rlstest_a_${tag}`;
  const wsB = `ws_rlstest_b_${tag}`;
  const userA = randomUUID();
  const emailA = `rls-a-${tag}@mstrmnd.test`;

  const setWs = (ws: string) => db.query("select set_config('app.workspace_id', $1, true)", [ws]);
  const count = async (sql: string, params: unknown[] = []) =>
    Number((await db.query<{ n: string }>(sql, params)).rows[0].n);
  /** Run a statement expected to fail, inside a savepoint so the tx survives. */
  const expectReject = async (sql: string, params: unknown[], code: string) => {
    await db.query("savepoint expect_reject");
    await assert.rejects(db.query(sql, params), (err: { code?: string }) => {
      assert.equal(err.code, code);
      return true;
    });
    await db.query("rollback to savepoint expect_reject");
  };

  before(async () => {
    const needsSsl = /sslmode=require|neon\.tech/i.test(url!);
    db = new Client({ connectionString: url, ssl: needsSsl ? { rejectUnauthorized: false } : undefined });
    await db.connect();
    await db.query("begin");
    // Seed as owner (BYPASSRLS) — rolled back at the end.
    await db.query(
      `insert into users (id, email, name, password_hash, workspace_id)
       values ($1, $2, 'RLS A', 'salt:hash', $3)`,
      [userA, emailA, wsA],
    );
    await db.query(
      `insert into observations (id, scope, key, content, agent)
       values ($1, $2, 'k', 'secret of A', 'test'), ($3, $4, 'k', 'secret of B', 'test')`,
      [randomUUID(), wsA, randomUUID(), wsB],
    );
    // Allow the owner to SET ROLE to the app role for this transaction only.
    await db.query("grant mstrmnd_app to current_user with inherit false, set true");
    await db.query("set local role mstrmnd_app");
  });

  after(async () => {
    if (!db) return;
    await db.query("rollback");
    await db.end();
  });

  it("runs as mstrmnd_app: not superuser, no BYPASSRLS, owns neither table", async () => {
    const { rows } = await db.query<{
      who: string;
      rolsuper: boolean;
      rolbypassrls: boolean;
      owns: string;
    }>(
      `select current_user as who, r.rolsuper, r.rolbypassrls,
              (select count(*) from pg_class c
                where c.relname in ('users','observations')
                  and c.relowner = r.oid)::text as owns
         from pg_roles r where r.rolname = current_user`,
    );
    assert.deepEqual(rows[0], { who: "mstrmnd_app", rolsuper: false, rolbypassrls: false, owns: "0" });
  });

  it("no app.workspace_id set: observations and users return 0 rows", async () => {
    assert.equal(await count("select count(*) n from observations where scope in ($1,$2)", [wsA, wsB]), 0);
    assert.equal(await count("select count(*) n from users where id = $1", [userA]), 0);
  });

  it("same-workspace read works", async () => {
    await setWs(wsA);
    const { rows } = await db.query("select content from observations where scope = $1", [wsA]);
    assert.deepEqual(rows.map((r) => r.content), ["secret of A"]);
    assert.equal(await count("select count(*) n from users where id = $1", [userA]), 1);
  });

  it("cross-workspace SELECT returns 0 rows (even with no WHERE)", async () => {
    await setWs(wsA);
    assert.equal(await count("select count(*) n from observations where scope = $1", [wsB]), 0);
    assert.equal(await count("select count(*) n from observations where scope like 'ws_rlstest_%'"), 1);
    await setWs(wsB);
    assert.equal(await count("select count(*) n from users where id = $1", [userA]), 0);
  });

  it("cross-workspace INSERT is rejected (42501)", async () => {
    await setWs(wsA);
    await expectReject(
      `insert into observations (id, scope, key, content, agent) values ($1, $2, 'x', 'y', 'test')`,
      [randomUUID(), wsB],
      "42501",
    );
    await expectReject(
      `insert into users (id, email, name, password_hash, workspace_id) values ($1, $2, 'x', 'x', $3)`,
      [randomUUID(), `rls-x-${tag}@mstrmnd.test`, wsB],
      "42501",
    );
  });

  it("cross-workspace UPDATE touches 0 rows; moving a row out of the workspace is rejected", async () => {
    await setWs(wsA);
    const upd = await db.query("update observations set content = 'pwned' where scope = $1", [wsB]);
    assert.equal(upd.rowCount, 0);
    await expectReject("update observations set scope = $1 where scope = $2", [wsB, wsA], "42501");
  });

  it("same-workspace upsert (the app's write path) works", async () => {
    await setWs(wsA);
    const { rows } = await db.query(
      `insert into observations (id, scope, key, content, agent) values ($1, $2, 'k', 'updated', 'test')
       on conflict (scope, key) do update set content = excluded.content returning content`,
      [randomUUID(), wsA],
    );
    assert.equal(rows[0].content, "updated");
  });

  it("grants are minimal: no DELETE, no template tables", async () => {
    await setWs(wsA);
    await expectReject("delete from observations where scope = $1", [wsA], "42501");
    await expectReject(`select count(*) from "User"`, [], "42501");
  });

  it("mstrmnd_auth_lookup finds a user by email without a workspace", async () => {
    await setWs("");
    const { rows } = await db.query(
      "select id, email, workspace_id, password_hash from mstrmnd_auth_lookup($1)",
      [`  ${emailA.toUpperCase()} `],
    );
    assert.equal(rows.length, 1);
    assert.deepEqual(
      { id: rows[0].id, email: rows[0].email, ws: rows[0].workspace_id },
      { id: userA, email: emailA, ws: wsA },
    );
    const none = await db.query("select * from mstrmnd_auth_lookup($1)", [`nobody-${tag}@mstrmnd.test`]);
    assert.equal(none.rows.length, 0);
  });
});
