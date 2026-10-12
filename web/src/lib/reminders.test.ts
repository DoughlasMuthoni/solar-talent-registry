import { describe, expect, it } from "vitest";
import { reminderMilestone } from "./reminders";

describe("reminderMilestone", () => {
  it.each([
    [91, null],
    [90, 90],
    [45, 90],
    [31, 90],
    [30, 30],
    [20, 30],
    [8, 30],
    [7, 7],
    [1, 7],
    [0, 0],
    [-1, null],
    [null, null],
  ] as const)("daysLeft %s → %s", (days, expected) => expect(reminderMilestone(days)).toBe(expected));
});
