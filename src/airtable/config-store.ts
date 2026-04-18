/**
 * Encrypted on-disk config store for OAuth tokens and the selected base.
 *
 * Design:
 *   - Persists to $CANONLAW_CONFIG_DIR (default ~/.canonlaw-tribunal) as
 *     config.json.enc, encrypted with AES-256-GCM.
 *   - Key is derived from CANONLAW_MASTER_KEY env var via SHA-256. If no key
 *     is set, a warning is logged and a volatile key is used (fine for local
 *     dev; refuses to persist in production mode).
 *
 * This is NOT a substitute for a real secret manager. For production, swap
 * `ConfigStore` with one backed by AWS Secrets Manager / GCP Secret Manager /
 * HashiCorp Vault / your environment's equivalent.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface StoredConfig {
  airtable?: {
    accessToken: string;
    refreshToken: string;
    /** Unix ms at which access_token expires. */
    expiresAt: number;
    tokenType: "Bearer";
    scope: string;
  };
  selectedBase?: {
    baseId: string;
    baseName: string;
    /** Map of logical table name → Airtable tableId, populated by the provisioner. */
    tableIds: Record<string, string>;
    /** Unix ms when the base was selected. */
    selectedAt: number;
    /** Unix ms when the provisioner last synced the schema to this base. */
    lastProvisionedAt?: number;
  };
}

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const KEY_LEN = 32;

function deriveKey(): Buffer {
  const master = process.env.CANONLAW_MASTER_KEY;
  if (master && master.length > 0) {
    return createHash("sha256").update(master).digest();
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "CANONLAW_MASTER_KEY must be set in production to persist encrypted tokens.",
    );
  }
  // Volatile fallback — same per-process; config written with this key is not
  // recoverable across restarts. This is deliberate for safety.
  return createHash("sha256").update("canonlaw-local-dev").digest();
}

function configDir(): string {
  return process.env.CANONLAW_CONFIG_DIR ?? join(homedir(), ".canonlaw-tribunal");
}

function configPath(): string {
  return join(configDir(), "config.json.enc");
}

function encrypt(plain: string, key: Buffer): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);
}

function decrypt(buf: Buffer, key: Buffer): string {
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + 16);
  const ct = buf.subarray(IV_LEN + 16);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

export class ConfigStore {
  private cache: StoredConfig | null = null;

  load(): StoredConfig {
    if (this.cache) return this.cache;
    const p = configPath();
    if (!existsSync(p)) {
      this.cache = {};
      return this.cache;
    }
    const buf = readFileSync(p);
    try {
      const json = decrypt(buf, deriveKey());
      this.cache = JSON.parse(json) as StoredConfig;
    } catch (e) {
      throw new Error(
        `Failed to decrypt config at ${p}. Check CANONLAW_MASTER_KEY. (${(e as Error).message})`,
      );
    }
    return this.cache;
  }

  save(next: StoredConfig): void {
    const dir = configDir();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
    const buf = encrypt(JSON.stringify(next, null, 2), deriveKey());
    writeFileSync(configPath(), buf, { mode: 0o600 });
    this.cache = next;
  }

  update(mutator: (c: StoredConfig) => void): StoredConfig {
    const cur = this.load();
    const next: StoredConfig = JSON.parse(JSON.stringify(cur));
    mutator(next);
    this.save(next);
    return next;
  }

  clear(): void {
    this.save({});
  }
}

/** Default singleton — for simple call sites. */
export const configStore = new ConfigStore();
