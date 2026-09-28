import { describe, expect, it } from "vitest";
import { childEnv } from "./env.js";

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
