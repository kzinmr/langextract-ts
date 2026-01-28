import os from "node:os";
import path from "node:path";

export interface GoogleAuthOptionsLike {
  keyFilename?: string;
  credentials?: Record<string, unknown>;
  scopes?: string[] | string;
}

function expandHome(filePath: string): string {
  if (filePath.startsWith("~/")) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

export function googleAuthOptionsFromEnv(
  envVar = "GOOGLE_APPLICATION_CREDENTIALS"
): GoogleAuthOptionsLike | null {
  const raw = process.env[envVar];
  if (!raw) return null;

  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { credentials: parsed as Record<string, unknown> };
      }
      return null;
    } catch (err) {
      throw new Error(
        `GOOGLE_APPLICATION_CREDENTIALS appears to be JSON but failed to parse: ${(err as Error).message}`
      );
    }
  }

  return { keyFilename: expandHome(trimmed) };
}
