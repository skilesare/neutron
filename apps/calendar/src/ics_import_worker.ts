import { parseIcsImport } from "./ics_import";

type ParseRequest = { id: number; text: string; defaultTimeZone: string };

self.addEventListener("message", (event: MessageEvent<ParseRequest>) => {
  const request = event.data;
  void parseIcsImport(request.text, { defaultTimeZone: request.defaultTimeZone })
    .then((result) => self.postMessage({ id: request.id, ok: true, result }))
    .catch((error) => self.postMessage({ id: request.id, ok: false, error: error instanceof Error ? error.message : String(error) }));
});
