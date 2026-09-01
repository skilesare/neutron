import type { IcsImportParseResult } from "./ics_import";

export function parseIcsFileInWorker(file: File, defaultTimeZone: string, timeoutMs = 10_000): Promise<IcsImportParseResult> {
  if (file.size > 1_048_576) return Promise.reject(new Error("iCalendar file exceeds 1,048,576 bytes."));
  return file.text().then((text) => new Promise<IcsImportParseResult>((resolve, reject) => {
    const worker = new Worker(new URL("./ics_import_worker.js", window.location.href), { type: "module", name: "calendar-ics-import" });
    const id = Date.now();
    const timer = window.setTimeout(() => {
      worker.terminate();
      reject(new Error("iCalendar parsing exceeded the 10 second safety limit."));
    }, timeoutMs);
    worker.addEventListener("message", (event: MessageEvent<{ id: number; ok: boolean; result?: IcsImportParseResult; error?: string }>) => {
      if (event.data.id !== id) return;
      window.clearTimeout(timer);
      worker.terminate();
      if (event.data.ok && event.data.result) resolve(event.data.result);
      else reject(new Error(event.data.error || "iCalendar parsing failed."));
    });
    worker.addEventListener("error", () => {
      window.clearTimeout(timer);
      worker.terminate();
      reject(new Error("The isolated iCalendar parser stopped unexpectedly."));
    });
    worker.postMessage({ id, text, defaultTimeZone });
  }));
}
