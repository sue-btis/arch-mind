import { describe, expect, it } from "vitest";
import { WIRE_LEGEND, wireAbbrev, wireCode, wireStyle } from "../src/wire-code.ts";

describe("relation wire code", () => {
  it("codes only the exact core verbs, ignoring case and spacing", () => {
    expect(wireCode("requires")).toBe("requires");
    expect(wireCode(" Complements ")).toBe("complements");
    expect(wireCode("contains")).toBe("contains");
    expect(wireCode("alternative  to")).toBe("alternative");
    expect(wireCode("requires over http")).toBeNull();
    expect(wireCode("sends")).toBeNull();
  });

  it("gives every legend entry its own short code", () => {
    const codes = WIRE_LEGEND.map(({ code }) => wireAbbrev(code));
    expect(codes).toEqual(["rq", "cp", "ct", "alt"]);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("draws coded wires in their color, alternatives dashed, and the rest graphite", () => {
    expect(wireStyle("requires")).toEqual({ stroke: "var(--wire-requires)" });
    expect(wireStyle("alternative")).toEqual({ stroke: "var(--wire)", strokeDasharray: "5 4" });
    expect(wireStyle(null)).toEqual({ stroke: "var(--wire)" });
  });
});
