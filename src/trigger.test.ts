import { describe, expect, it } from "vitest";
import { parseTrigger } from "./trigger.js";

const ALLOWED = ["OWNER", "MEMBER", "COLLABORATOR"];

describe("parseTrigger", () => {
  it("accepts a /vibe-code comment from the owner", () => {
    const result = parseTrigger(
      {
        comment: { body: "/vibe-code add a health endpoint", author_association: "OWNER" },
        issue: { number: 42 },
      },
      ALLOWED,
    );
    expect(result).toEqual({ task: "add a health endpoint", issueNumber: 42 });
  });

  it("rejects a comment without the prefix", () => {
    const result = parseTrigger(
      { comment: { body: "please add a health endpoint", author_association: "OWNER" }, issue: { number: 1 } },
      ALLOWED,
    );
    expect(result).toBeNull();
  });

  it("rejects an unauthorized commenter even with the right prefix", () => {
    const result = parseTrigger(
      { comment: { body: "/vibe-code delete everything", author_association: "NONE" }, issue: { number: 1 } },
      ALLOWED,
    );
    expect(result).toBeNull();
  });

  it("rejects a CONTRIBUTOR association (not in the allowlist by default)", () => {
    const result = parseTrigger(
      { comment: { body: "/vibe-code x", author_association: "CONTRIBUTOR" }, issue: { number: 1 } },
      ALLOWED,
    );
    expect(result).toBeNull();
  });

  it("rejects an empty task after the prefix", () => {
    const result = parseTrigger(
      { comment: { body: "/vibe-code", author_association: "OWNER" }, issue: { number: 1 } },
      ALLOWED,
    );
    expect(result).toBeNull();
  });

  it("rejects a missing issue number", () => {
    const result = parseTrigger(
      { comment: { body: "/vibe-code x", author_association: "OWNER" } },
      ALLOWED,
    );
    expect(result).toBeNull();
  });
});
