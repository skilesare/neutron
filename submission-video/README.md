# Calendar submission video

This Remotion composition renders a captioned 60-second product video from the
real Playwright captures in `submission-assets/calendar/`. It contains only the
standalone Calendar app and does not use mock UI.

```sh
npm --prefix submission-video run studio
npm --prefix submission-video run render
```

The render is written to `submission-assets/calendar-demo.mp4`. Regenerate the
screenshots before the final render whenever product UI changes.
