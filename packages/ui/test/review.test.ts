import { describe, expect, it } from "vitest";
import { boxLabel, dueHeading } from "../src/review.ts";

describe("review screen text", () => {
  it("counts the due questions and says so when nothing is due", () => {
    expect(dueHeading(0)).toBe("Nothing is due today.");
    expect(dueHeading(1)).toBe("1 question due");
    expect(dueHeading(12)).toBe("12 questions due");
  });

  it("shows the box and the due date the same way the concept detail does", () => {
    expect(boxLabel({ box: 2, due: "2026-11-04" })).toBe("Box 2 · due 2026-11-04");
  });
});
