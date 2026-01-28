import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { googleAuthOptionsFromEnv } from "../src/providers/gemini/credentials.js";

const ENV_KEY = "GOOGLE_APPLICATION_CREDENTIALS";

function createTempCredFile(): string {
  const p = path.join(os.tmpdir(), `langextract-test-${Date.now()}.json`);
  fs.writeFileSync(p, JSON.stringify({ type: "service_account" }), { mode: 0o600 });
  return p;
}

describe("googleAuthOptionsFromEnv", () => {
  const original = process.env[ENV_KEY];

  beforeEach(() => {
    delete process.env[ENV_KEY];
  });

  afterEach(() => {
    if (process.env[ENV_KEY] && fs.existsSync(process.env[ENV_KEY]!)) {
      try {
        fs.unlinkSync(process.env[ENV_KEY]!);
      } catch {
        // ignore
      }
    }
    if (original) process.env[ENV_KEY] = original;
    else delete process.env[ENV_KEY];
  });

  it("accepts JSON string and returns credentials", () => {
    const json = JSON.stringify({ type: "service_account", client_email: "x@y" });
    process.env[ENV_KEY] = json;
    const result = googleAuthOptionsFromEnv();
    expect(result?.credentials).toBeTruthy();
    expect((result?.credentials as any)?.client_email).toBe("x@y");
  });

  it("returns keyFilename for file path", () => {
    const credPath = createTempCredFile();
    process.env[ENV_KEY] = credPath;
    const result = googleAuthOptionsFromEnv();
    expect(result?.keyFilename).toBe(credPath);
  });
});
