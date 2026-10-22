import { describe, expect, it } from "vitest";
import { AppError } from "@zimo/domain";

import {
  getNextAutomationRunAt,
  isInsideAutomationTimeWindow,
  validateAutomationSchedule,
} from "./automation-schedule";

describe("automation schedule", () => {
  it("starts an interval from the current save or execution time", () => {
    const next = getNextAutomationRunAt(
      { kind: "interval", everyMinutes: 30 },
      { startTime: "00:00", endTime: "23:59" },
      new Date("2026-09-15T02:12:00.000Z"),
    );
    expect(next?.toISOString()).toBe("2026-09-15T02:42:00.000Z");
  });

  it("calculates daily and weekly runs in the computer local timezone", () => {
    const after = new Date(2026, 8, 14, 10, 0, 0);
    const window = { startTime: "00:00", endTime: "23:59" };
    const daily = getNextAutomationRunAt({ kind: "daily", time: "09:00" }, window, after);
    expect(daily).toMatchObject({});
    expect(daily?.getDate()).toBe(15);
    expect(daily?.getHours()).toBe(9);

    const weekly = getNextAutomationRunAt(
      { kind: "weekly", time: "08:30", weekdays: [3] },
      window,
      after,
    );
    expect(weekly?.getDay()).toBe(3);
    expect(weekly?.getHours()).toBe(8);
    expect(weekly?.getMinutes()).toBe(30);
  });

  it("supports inclusive normal and overnight daily windows", () => {
    expect(
      isInsideAutomationTimeWindow(new Date(2026, 8, 15, 9, 0), {
        startTime: "09:00",
        endTime: "18:00",
      }),
    ).toBe(true);
    expect(
      isInsideAutomationTimeWindow(new Date(2026, 8, 15, 23, 0), {
        startTime: "22:00",
        endTime: "06:00",
      }),
    ).toBe(true);
    expect(
      isInsideAutomationTimeWindow(new Date(2026, 8, 15, 12, 0), {
        startTime: "22:00",
        endTime: "06:00",
      }),
    ).toBe(false);
  });

  it("pauses interval schedules until the next window and rejects conflicting times", () => {
    const next = getNextAutomationRunAt(
      { kind: "interval", everyMinutes: 60 },
      { startTime: "09:00", endTime: "18:00" },
      new Date(2026, 8, 15, 18, 30),
    );
    expect(next?.getDate()).toBe(16);
    expect(next?.getHours()).toBe(9);
    expect(() =>
      validateAutomationSchedule(
        { kind: "interval", everyMinutes: 1 },
        { startTime: "09:00", endTime: "18:00" },
      ),
    ).toThrowError(AppError);
    expect(() =>
      validateAutomationSchedule(
        { kind: "daily", time: "08:00" },
        { startTime: "09:00", endTime: "18:00" },
      ),
    ).toThrowError(AppError);
  });
});
