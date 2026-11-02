import { describe, expect, it } from "vitest";
import { overWideConcepts, tst032Concepts } from "@arch-mind/rules/fixtures";
import { focusedConcepts } from "../src/focus.ts";
import { neighbourhood } from "../src/neighbourhood.ts";

const ids = (concepts: { id: string }[]) => concepts.map((c) => c.id).sort();
const byId = (id: string) => tst032Concepts.find((c) => c.id === id)!;

describe("focused set (TST-040, AC-046)", () => {
  it("is the selection plus the concepts its relations connect, across layers", () => {
    const hood = neighbourhood(tst032Concepts, "secure-context")!;
    const set = focusedConcepts(tst032Concepts, "secure-context");
    expect(ids(set)).toEqual([...hood.connected, "secure-context"].sort());
    expect(new Set(set.map((c) => c.layer)).size).toBeGreaterThan(1);
  });

  it("is only the concept itself when it has no relations in the shown set", () => {
    const alone = { ...byId("host-prefix"), relations: [] };
    const others = tst032Concepts.filter((c) => c.id !== "host-prefix").map((c) => ({ ...c, relations: c.relations.filter((r) => r.to !== "host-prefix") }));
    expect(ids(focusedConcepts([alone, ...others], "host-prefix"))).toEqual(["host-prefix"]);
  });

  it("holds a hub and all its spokes, and a spoke only with the hub", () => {
    expect(focusedConcepts(overWideConcepts, "wide-hub")).toHaveLength(overWideConcepts.length);
    expect(ids(focusedConcepts(overWideConcepts, "wide-1"))).toEqual(["wide-1", "wide-hub"]);
  });

  it("leaves out neighbours the filters hide and is empty for an id that is not shown", () => {
    const shown = tst032Concepts.filter((c) => c.layer === "client");
    expect(focusedConcepts(shown, "secure-context").every((c) => c.layer === "client")).toBe(true);
    const hidden = tst032Concepts.find((c) => c.layer !== "client")!;
    expect(focusedConcepts(shown, hidden.id)).toEqual([]);
    expect(focusedConcepts(tst032Concepts, "no-such-id")).toEqual([]);
  });

  it("keeps the order of the shown concepts", () => {
    const set = focusedConcepts(tst032Concepts, "secure-attr");
    expect(set.map((c) => c.id)).toEqual(tst032Concepts.filter((c) => set.includes(c)).map((c) => c.id));
  });
});
