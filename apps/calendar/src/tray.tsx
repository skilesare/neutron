import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { callTool, dismissTray, onAppStateChange, openAppTile, type JsonValue } from "neutron-tools/app";
import { encodeReminderTileView } from "./reminder_view";
import { type ReminderItem, type ReminderSnapshot } from "./reminders";
import "./tray.scss";

const empty: ReminderSnapshot = {
  version: 1,
  revision: "0",
  generatedAt: new Date(0).toISOString(),
  timeZone: "UTC",
  badge: 0,
  now: [],
  next: [],
  today: [],
  truncated: false,
  lifecycle: "Reminders appear while this Neutron is open.",
};

function CalendarTray() {
  const [snapshot, setSnapshot] = useState<ReminderSnapshot>(empty);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const refresh = useCallback(async () => {
    try {
      const value = await callTool<JsonValue>({ target: "app:calendar:background", name: "reminder_snapshot", arguments: {} }, 15);
      setSnapshot(value as unknown as ReminderSnapshot);
      setState("ready");
    } catch { setState("error"); }
  }, []);

  useEffect(() => {
    void refresh();
    const unsubscribe = onAppStateChange("calendar", () => void refresh());
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") void dismissTray(); };
    window.addEventListener("keydown", onKey);
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => { unsubscribe(); window.removeEventListener("keydown", onKey); window.clearInterval(timer); };
  }, [refresh]);

  const open = async (item?: ReminderItem) => {
    await openAppTile({ appId: "calendar", tileId: "main", reuseExisting: true, ...(item ? { view: encodeReminderTileView({ seriesId: item.seriesId, occurrenceId: item.id }) } : {}) });
    await dismissTray();
  };
  const sections: Array<{ title: string; items: ReminderItem[] }> = [
    { title: "Now", items: snapshot.now },
    { title: "Next", items: snapshot.next },
    { title: "Today", items: snapshot.today },
  ];
  const hasItems = sections.some((section) => section.items.length > 0);
  const formatter = new Intl.DateTimeFormat(undefined, { timeZone: snapshot.timeZone, hour: "numeric", minute: "2-digit" });

  return <main className="calendar-tray">
    <header><div><span className="eyebrow">Calendar</span><h1>Reminders</h1></div><button type="button" onClick={() => void open()}>Open</button></header>
    {state === "loading" && <p className="tray-state" role="status">Checking your calendar…</p>}
    {state === "error" && <p className="tray-state tray-state--error" role="alert">Calendar is temporarily unavailable. The last reminder badge is preserved.</p>}
    {state === "ready" && !hasItems && <p className="tray-state">No reminders due or coming up in the next seven days.</p>}
    {state === "ready" && hasItems && <div className="tray-sections">{sections.map((section) => section.items.length > 0 && <section key={section.title} aria-labelledby={`tray-${section.title.toLowerCase()}`}><h2 id={`tray-${section.title.toLowerCase()}`}>{section.title}</h2><ol>{section.items.map((item) => <li key={`${section.title}:${item.id}:${item.dueAt}`}><button type="button" onClick={() => void open(item)}><span><strong>{item.title}</strong><small>{item.source === "rendezvous" ? "Rendezvous · " : ""}{item.offsetMinutes === 0 ? "At start" : `${item.offsetMinutes} min before`}</small></span><time dateTime={new Date(item.startAt).toISOString()}>{formatter.format(item.startAt)}</time></button></li>)}</ol></section>)}</div>}
    <footer>{snapshot.lifecycle}{snapshot.truncated ? " Showing the first 200 scheduled reminders." : ""}</footer>
  </main>;
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing Calendar tray root element");
createRoot(root).render(<CalendarTray />);
