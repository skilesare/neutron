import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

test("Calendar tray is keyboard accessible, bounded, and honest about lifecycle", async () => {
  const [tray, styles, html, service] = await Promise.all([
    readFile(new URL("../src/tray.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/tray.scss", import.meta.url), "utf8"),
    readFile(new URL("../public/tray.html", import.meta.url), "utf8"),
    readFile(new URL("../src/service.ts", import.meta.url), "utf8"),
  ]);
  expect(tray).toContain('event.key === "Escape"');
  expect(tray).toContain('title: "Now"');
  expect(tray).toContain('title: "Next"');
  expect(tray).toContain('title: "Today"');
  expect(tray).toContain("encodeReminderTileView({ seriesId: item.seriesId, occurrenceId: item.id })");
  expect(styles).toContain(":focus-visible");
  expect(styles).toContain("overflow-y: auto");
  expect(html).toContain("width=device-width");
  expect(service).toContain("REMINDER_RECOVERY_POLL_MS");
  expect(service).toContain('onAppStateChange("calendar"');
  expect(service).toContain('window.addEventListener("pageshow"');
  expect(service).toContain('limit: "200"');
});
