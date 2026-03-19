/**
 * Custom NextAuth v5 MySQL2 adapter.
 * Uses the existing mysql2 pool — no additional packages needed.
 *
 * MIGRATIONS REQUIRED (run once in Railway):
 *   ALTER TABLE users
 *     ADD COLUMN IF NOT EXISTS emailVerified TIMESTAMP NULL,
 *     ADD COLUMN IF NOT EXISTS image TEXT NULL;
 *
 *   CREATE TABLE IF NOT EXISTS accounts (
 *     id                VARCHAR(255)  NOT NULL PRIMARY KEY,
 *     userId            VARCHAR(255)  NOT NULL,
 *     type              VARCHAR(255)  NOT NULL,
 *     provider          VARCHAR(255)  NOT NULL,
 *     providerAccountId VARCHAR(255)  NOT NULL,
 *     refresh_token     TEXT          NULL,
 *     access_token      TEXT          NULL,
 *     expires_at        INT           NULL,
 *     token_type        VARCHAR(255)  NULL,
 *     scope             VARCHAR(255)  NULL,
 *     id_token          TEXT          NULL,
 *     session_state     VARCHAR(255)  NULL,
 *     UNIQUE KEY provider_account (provider, providerAccountId),
 *     INDEX idx_accounts_userId (userId)
 *   );
 */

import type { Adapter, AdapterUser, AdapterAccount } from "next-auth/adapters";
import { pool } from "@/lib/db";

function toAdapterUser(row: Record<string, unknown>): AdapterUser {
  return {
    id: String(row.id),
    name: (row.name as string) ?? null,
    email: String(row.email),
    emailVerified: row.emailVerified ? new Date(row.emailVerified as string) : null,
    image: (row.image as string) ?? null,
  };
}

export function MySQLAdapter(): Adapter {
  return {
    async createUser(user) {
      const id = crypto.randomUUID();
      await pool.execute(
        `INSERT INTO users (id, name, email, emailVerified, image) VALUES (?, ?, ?, ?, ?)`,
        [id, user.name ?? null, user.email, user.emailVerified ?? null, user.image ?? null]
      );
      const [rows] = await pool.execute(`SELECT * FROM users WHERE id = ? LIMIT 1`, [id]);
      return toAdapterUser((rows as Record<string, unknown>[])[0]);
    },

    async getUser(id) {
      const [rows] = await pool.execute(`SELECT * FROM users WHERE id = ? LIMIT 1`, [id]);
      const row = (rows as Record<string, unknown>[])[0];
      return row ? toAdapterUser(row) : null;
    },

    async getUserByEmail(email) {
      const [rows] = await pool.execute(`SELECT * FROM users WHERE email = ? LIMIT 1`, [email]);
      const row = (rows as Record<string, unknown>[])[0];
      return row ? toAdapterUser(row) : null;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const [rows] = await pool.execute(
        `SELECT u.* FROM users u
         JOIN accounts a ON a.userId = u.id
         WHERE a.provider = ? AND a.providerAccountId = ?
         LIMIT 1`,
        [provider, providerAccountId]
      );
      const row = (rows as Record<string, unknown>[])[0];
      return row ? toAdapterUser(row) : null;
    },

    async updateUser(user) {
      await pool.execute(
        `UPDATE users SET name = ?, email = ?, emailVerified = ?, image = ? WHERE id = ?`,
        [user.name ?? null, user.email, user.emailVerified ?? null, user.image ?? null, user.id]
      );
      const [rows] = await pool.execute(`SELECT * FROM users WHERE id = ? LIMIT 1`, [user.id]);
      return toAdapterUser((rows as Record<string, unknown>[])[0]);
    },

    async linkAccount(account: AdapterAccount) {
      await pool.execute(
        `INSERT INTO accounts
           (id, userId, type, provider, providerAccountId, refresh_token, access_token,
            expires_at, token_type, scope, id_token, session_state)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           access_token   = VALUES(access_token),
           refresh_token  = VALUES(refresh_token),
           expires_at     = VALUES(expires_at),
           id_token       = VALUES(id_token)`,
        [
          crypto.randomUUID(),
          account.userId,
          account.type,
          account.provider,
          account.providerAccountId,
          account.refresh_token ?? null,
          account.access_token ?? null,
          account.expires_at ?? null,
          account.token_type ?? null,
          account.scope ?? null,
          account.id_token ?? null,
          account.session_state ?? null,
        ]
      );
      return account;
    },

    // ── JWT mode stubs — these are never called when session strategy is "jwt" ──

    async createSession(session) {
      return session;
    },
    async getSessionAndUser() {
      return null;
    },
    async updateSession(_session) {
      return null;
    },
    async deleteSession() {},
  };
}
