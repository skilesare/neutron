import { expect, test } from "bun:test";
import ICAL from "ical.js";
import { buildProviderFixture, validateProviderFixture } from "./generate-calendar-provider-fixture";

test("provider acceptance fixture is deterministic and independently parseable", () => {
  const first = buildProviderFixture();
  const second = buildProviderFixture();
  expect(second).toBe(first);

  const report = validateProviderFixture(first);
  expect(report).toMatchObject({
    sha256: "10355253e74efc593587394abee4ee6bc2ead046e860412f1612a5ae531f6dc9",
    bytes: 1463,
    eventCount: 4,
    busyCount: 3,
    freeCount: 1,
    excludedStatusesAbsent: true,
    crlfOnly: true,
    maxPhysicalLineBytes: 74,
  });
  expect(new ICAL.Component(ICAL.parse(first)).getAllSubcomponents("vevent")).toHaveLength(4);
});
