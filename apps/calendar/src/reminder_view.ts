const reminderViewPattern = /^reminder\/(0|[1-9][0-9]{0,19})\/(0|[1-9][0-9]{0,19})$/u;

export type ReminderTileView = { seriesId: string; occurrenceId: string };

export function encodeReminderTileView(value: ReminderTileView): string {
  const view = `reminder/${value.seriesId}/${value.occurrenceId}`;
  if (view.length > 64 || !reminderViewPattern.test(view)) throw new Error("Invalid reminder tile view");
  return view;
}

export function parseReminderTileView(view: string): ReminderTileView | null {
  if (view.length > 64) return null;
  const match = reminderViewPattern.exec(view);
  return match ? { seriesId: match[1], occurrenceId: match[2] } : null;
}
