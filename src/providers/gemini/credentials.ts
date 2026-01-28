import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

export interface CredentialFileResult {
  path: string;
  created: boolean;
}

function expandHome(filePath: string): string {
  if (filePath.startsWith("~/")) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

function parseJsonCredential(value: string): Record<string, unknown> | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch (err) {
    throw new Error(
      `GOOGLE_APPLICATION_CREDENTIALS appears to be JSON but failed to parse: ${(err as Error).message}`
    );
  }
}

export function ensureCredentialsFileFromEnv(
  envVar = "GOOGLE_APPLICATION_CREDENTIALS"
): CredentialFileResult | null {
  const raw = process.env[envVar];
  if (!raw) return null;

  const expanded = expandHome(raw.trim());
  if (fs.existsSync(expanded)) {
    if (expanded !== raw) {
      process.env[envVar] = expanded;
    }
    return { path: expanded, created: false };
  }

  const json = parseJsonCredential(raw);
  if (!json) {
    return { path: expanded, created: false };
  }

  const tmpPath = path.join(os.tmpdir(), `langextract-credentials-${randomUUID()}.json`);
  fs.writeFileSync(tmpPath, JSON.stringify(json, null, 2), { mode: 0o600 });
  process.env[envVar] = tmpPath;
  return { path: tmpPath, created: true };
}
