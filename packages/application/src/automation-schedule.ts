import type { AutomationSchedule, AutomationTimeWindow } from "@zimo/domain";
import { AppError } from "@zimo/domain";

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function validateAutomationSchedule(
  schedule: AutomationSchedule,
  timeWindow: AutomationTimeWindow,
): void {
  if (!TIME_PATTERN.test(timeWindow.startTime) || !TIME_PATTERN.test(timeWindow.endTime)) {
    throw scheduleError("执行时间范围格式无效。");
  }
  if (schedule.kind === "interval") {
    if (
      !Number.isInteger(schedule.everyMinutes) ||
      schedule.everyMinutes < 5 ||
      schedule.everyMinutes > 43_200
    ) {
      throw scheduleError("执行间隔必须在 5 分钟到 30 天之间。");
    }
  }
  if (schedule.kind === "daily" || schedule.kind === "weekly") {
    if (!TIME_PATTERN.test(schedule.time)) throw scheduleError("执行时刻格式无效。");
  }
  if (schedule.kind === "weekly") {
    const weekdays = [...new Set(schedule.weekdays)];
    if (
      weekdays.length === 0 ||
      weekdays.length !== schedule.weekdays.length ||
      weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
    ) {
      throw scheduleError("每周计划至少选择一个有效星期。");
    }
  }
  if (schedule.kind === "once" && !isInsideAutomationTimeWindow(schedule.runAt, timeWindow)) {
    throw scheduleError("单次执行时间不在每天允许执行的时间范围内。");
  }
  if (
    (schedule.kind === "daily" || schedule.kind === "weekly") &&
    !isTimeInsideWindow(schedule.time, timeWindow)
  ) {
    throw scheduleError("执行时刻不在每天允许执行的时间范围内。");
  }
}

export function isInsideAutomationTimeWindow(now: Date, window: AutomationTimeWindow): boolean {
  return isMinuteInsideWindow(now.getHours() * 60 + now.getMinutes(), window);
}

export function getNextAutomationRunAt(
  schedule: AutomationSchedule,
  timeWindow: AutomationTimeWindow,
  after: Date,
): Date | undefined {
  const candidate = getNextScheduleOccurrence(schedule, after);
  if (!candidate) return undefined;
  if (schedule.kind === "interval") return alignIntervalToWindow(candidate, timeWindow);
  return isInsideAutomationTimeWindow(candidate, timeWindow) ? candidate : undefined;
}

function getNextScheduleOccurrence(schedule: AutomationSchedule, after: Date): Date | undefined {
  if (schedule.kind === "once") return schedule.runAt > after ? schedule.runAt : undefined;
  if (schedule.kind === "interval") {
    return new Date(after.getTime() + schedule.everyMinutes * 60_000);
  }

  const [hours, minutes] = schedule.time.split(":").map(Number) as [number, number];
  const candidate = new Date(after);
  candidate.setSeconds(0, 0);
  candidate.setHours(hours, minutes, 0, 0);
  if (candidate <= after) candidate.setDate(candidate.getDate() + 1);
  if (schedule.kind === "daily") return candidate;

  for (let offset = 0; offset < 7; offset += 1) {
    if (schedule.weekdays.includes(candidate.getDay())) return candidate;
    candidate.setDate(candidate.getDate() + 1);
  }
  return undefined;
}

function alignIntervalToWindow(candidate: Date, window: AutomationTimeWindow): Date {
  if (isInsideAutomationTimeWindow(candidate, window)) return candidate;
  const start = parseMinute(window.startTime);
  const current = candidate.getHours() * 60 + candidate.getMinutes();
  const result = new Date(candidate);
  result.setSeconds(0, 0);
  if (parseMinute(window.startTime) <= parseMinute(window.endTime) && current > start) {
    result.setDate(result.getDate() + 1);
  }
  result.setHours(Math.floor(start / 60), start % 60, 0, 0);
  return result;
}

function isTimeInsideWindow(time: string, window: AutomationTimeWindow): boolean {
  return isMinuteInsideWindow(parseMinute(time), window);
}

function isMinuteInsideWindow(minute: number, window: AutomationTimeWindow): boolean {
  const start = parseMinute(window.startTime);
  const end = parseMinute(window.endTime);
  return start <= end ? minute >= start && minute <= end : minute >= start || minute <= end;
}

function parseMinute(value: string): number {
  const [hours, minutes] = value.split(":").map(Number) as [number, number];
  return hours * 60 + minutes;
}

function scheduleError(userMessage: string): AppError {
  return new AppError({ code: "AUTOMATION_SCHEDULE_INVALID", category: "user", userMessage });
}
