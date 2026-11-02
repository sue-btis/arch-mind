import { describe, expect, it } from "vitest";
import { searchValues } from "../src/facet-search.ts";

const values = ["Billing", "Identity", "Messaging", "Search"];

describe("facet group search (TST-042, AC-048)", () => {
  it("narrows to values containing the text, ignoring case", () => {
    expect(searchValues(values, [], "ING")).toEqual(["Billing", "Messaging"]);
  });

  it("keeps chosen values whatever is typed", () => {
    expect(searchValues(values, ["Identity"], "bill")).toEqual(["Billing", "Identity"]);
  });

  it("shows every value for an empty or blank query", () => {
    expect(searchValues(values, [], "")).toBe(values);
    expect(searchValues(values, [], "  ")).toBe(values);
  });
});
