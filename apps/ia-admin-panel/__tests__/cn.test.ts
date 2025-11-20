import { describe, expect, it } from "vitest";
import { cn } from "@/lib/ui/cn";

describe("cn helper", () => {
  it("merges class names and removes duplicates", () => {
    expect(cn("px-4", false && "hidden", ["px-4", "py-2"])).toBe("px-4 py-2");
  });
});

