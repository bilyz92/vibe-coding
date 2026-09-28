import { describe, expect, it } from "vitest";
import { truncateMiddle } from "./truncate.js";

describe("truncateMiddle", () => {
  it("leaves short output alone", () => {
    expect(truncateMiddle("hello", 10)).toBe("hello");
  });

  it("keeps the head and tail of long output", () => {
    const result = truncateMiddle("HEAD" + "x".repeat(1000) + "TAIL", 100);
    expect(result.startsWith("HEAD")).toBe(true);
    expect(result.endsWith("TAIL")).toBe(true);
    expect(result).toContain("omitted");
    expect(result.length).toBeLessThan(200);
  });
});
