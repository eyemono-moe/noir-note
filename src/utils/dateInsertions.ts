/**
 * Pure helpers for date/time insertion candidates surfaced by the editor's
 * `@today` / `@now` / `@yesterday` / `@tomorrow` / `@time` inline completion.
 *
 * Kept Date-injectable so unit tests don't need to mock the global clock.
 */

type DateInsertion = {
  /** Trigger token shown in the popover (e.g. `@today`). */
  trigger: string;
  /** Concrete text that replaces the trigger when accepted. */
  value: string;
  /** Short human description used as the completion detail. */
  description: string;
};

const pad2 = (n: number): string => n.toString().padStart(2, "0");

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}

/**
 * Build the ordered list of date/time completion candidates for `now`.
 *
 * The order is intentional — popover ordering matches this array unless the
 * caller filters/re-ranks it.
 */
export function buildDateInsertions(now: Date): DateInsertion[] {
  const today = formatDate(now);
  const yesterday = formatDate(addDays(now, -1));
  const tomorrow = formatDate(addDays(now, 1));
  const nowStamp = `${today} ${formatTime(now)}`;
  const time = formatTime(now);

  return [
    { trigger: "@today", value: today, description: "Today's date" },
    { trigger: "@yesterday", value: yesterday, description: "Yesterday's date" },
    { trigger: "@tomorrow", value: tomorrow, description: "Tomorrow's date" },
    { trigger: "@now", value: nowStamp, description: "Current date and time" },
    { trigger: "@time", value: time, description: "Current time" },
  ];
}
