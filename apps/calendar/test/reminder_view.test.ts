import { expect, test } from "bun:test";
import { encodeReminderTileView, parseReminderTileView } from "../src/reminder_view";

test("encodes a Kernel-compatible exact reminder route", () => {
  expect(encodeReminderTileView({ seriesId: "12", occurrenceId: "34" })).toBe("reminder/12/34");
  expect(parseReminderTileView("reminder/12/34")).toEqual({ seriesId: "12", occurrenceId: "34" });
});

test("accepts bounded Nat64 identifiers and rejects malformed views", () => {
  const maximum = "18446744073709551615";
  expect(parseReminderTileView(encodeReminderTileView({ seriesId: maximum, occurrenceId: maximum }))).toEqual({ seriesId: maximum, occurrenceId: maximum });
  for (const value of ["", "reminder/-1/2", "reminder/01/2", "reminder/1", "reminder/1/2/3", "Reminder/1/2", `reminder/${"1".repeat(21)}/2`]) expect(parseReminderTileView(value)).toBeNull();
});
