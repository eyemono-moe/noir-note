import type { InsertionPickerItem } from "../insertion/types";
import type { Command } from "../types";

/**
 * Build the date/time format options shown in the insertion picker.
 *
 * Exported as a pure function to allow unit tests to verify the formats and
 * to keep the command definition free of `Date` mocking concerns.
 */
export function buildDateTimeInsertionItems(now: Date): InsertionPickerItem[] {
  const pad = (n: number, width = 2) => n.toString().padStart(width, "0");
  const yyyy = now.getFullYear().toString();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const mi = pad(now.getMinutes());
  const ss = pad(now.getSeconds());

  const isoDate = `${yyyy}-${mm}-${dd}`;
  const isoDateTime = `${isoDate} ${hh}:${mi}`;
  const isoFull = `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
  const time = `${hh}:${mi}`;

  return [
    {
      value: "iso-date",
      label: "Date (YYYY-MM-DD)",
      description: isoDate,
      icon: "i-material-symbols:calendar-today-outline-rounded",
      keywords: ["date", "today", "ymd"],
    },
    {
      value: "iso-datetime",
      label: "Date + Time (YYYY-MM-DD HH:MM)",
      description: isoDateTime,
      icon: "i-material-symbols:schedule-outline-rounded",
      keywords: ["datetime", "now"],
    },
    {
      value: "iso-full",
      label: "ISO 8601 (YYYY-MM-DDTHH:MM:SS)",
      description: isoFull,
      icon: "i-material-symbols:event-outline-rounded",
      keywords: ["iso", "timestamp"],
    },
    {
      value: "time",
      label: "Time (HH:MM)",
      description: time,
      icon: "i-material-symbols:nest-clock-farsight-analog-outline-rounded",
      keywords: ["clock"],
    },
  ];
}

const insertDateTimeCommand: Command = {
  id: "insert-date-time",
  label: "Insert: Date / Time",
  description: "Pick a date or time format and insert it at the cursor",
  category: "editor",
  execute: (context) => {
    const items = buildDateTimeInsertionItems(new Date());
    context.openInsertionPicker({
      title: "Insert Date / Time",
      placeholder: "Pick a format…",
      items,
      onAccept: (item) => {
        // The description is the formatted value for each item.
        const value = item.description ?? "";
        context.insertIntoEditor({ snippet: value });
      },
    });
  },
};

export const insertionCommands: Command[] = [insertDateTimeCommand];
