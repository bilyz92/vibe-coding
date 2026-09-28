import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { childEnv, isolationProblems, takeApiKeyFile } from "./env.js";

describe("childEnv", () => {
  it("withholds credentials from processes that run model-written code", () => {
    const env = childEnv({
      ANTHROPIC_API_KEY: "sk",
      GH_TOKEN: "gh",
      GITHUB_TOKEN: "gh",
      NPM_TOKEN: "npm",
      AWS_SECRET_ACCESS_KEY: "aws",
      DB_PASSWORD: "pw",
      PATH: "/usr/bin",
      HOME: "/home/x",
    });
    expect(env).toEqual({ PATH: "/usr/bin", HOME: "/home/x" });
  });
});

describe("takeApiKeyFile", () => {
  it("returns the key and deletes the file so no child can read it later", () => {
    const dir = mkdtempSync(join(tmpdir(), "vibe-coding-key-"));
    const file = join(dir, "key");
    writeFileSync(file, "sk-test\n");
    try {
      expect(takeApiKeyFile(file)).toBe("sk-test");
      expect(existsSync(file)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("isolationProblems", () => {
  const safe = {
    env: {},
    execArgv: ["--disable-sigusr1"],
    ptraceScope: "1",
    status: "NoNewPrivs:\t1\nCapEff:\t0000000000000000\n",
    dockerSocketWritable: false,
  };

  it("accepts a properly isolated harness process", () => {
    expect(isolationProblems(safe)).toEqual([]);
  });

  it("flags the API key sitting in the process environment", () => {
    expect(isolationProblems({ ...safe, env: { ANTHROPIC_API_KEY: "sk" } })).toHaveLength(1);
  });

  it("flags a Node process a child could open the inspector on via SIGUSR1", () => {
    expect(isolationProblems({ ...safe, execArgv: [] })).toHaveLength(1);
  });

  it("flags a process whose children could gain privileges (e.g. passwordless sudo)", () => {
    expect(isolationProblems({ ...safe, status: "NoNewPrivs:\t0\nCapEff:\t0000000000000000\n" })).toHaveLength(1);
  });

  it("flags a process holding capabilities", () => {
    expect(isolationProblems({ ...safe, status: "NoNewPrivs:\t1\nCapEff:\t00000000000800000\n" })).toHaveLength(1);
  });

  it("flags a reachable docker socket (docker access is root access)", () => {
    expect(isolationProblems({ ...safe, dockerSocketWritable: true })).toHaveLength(1);
  });

  it("flags a kernel that lets children read their parent's memory", () => {
    expect(isolationProblems({ ...safe, ptraceScope: "0" })).toHaveLength(1);
    expect(isolationProblems({ ...safe, ptraceScope: undefined })).toHaveLength(1);
  });
});
