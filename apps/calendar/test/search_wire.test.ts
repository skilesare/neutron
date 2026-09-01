import { expect, test } from "bun:test";
import { decodeCalendarSearchWire, encodeCalendarSearchWire } from "../src/search_wire";

test("search wire round-trips Unicode and empty option fields", () => {
  const fields = decodeCalendarSearchWire(encodeCalendarSearchWire({
    queryText: "旅行 | focus 📅",
    startNs: null,
    endNs: "18446744073709551615",
    source: "owner",
    availability: "free",
    status: null,
    recurring: false,
    expectedRevision: "42",
    offset: "2000",
    limit: "50",
  }));
  expect(fields).toEqual(["旅行 | focus 📅", "", "18446744073709551615", "owner", "free", "", "false", "42", "2000", "50"]);
});

test("search wire decoder rejects truncation and extra fields", () => {
  expect(() => decodeCalendarSearchWire("f|".repeat(9))).toThrow();
  expect(() => decodeCalendarSearchWire("|".repeat(10))).toThrow();
});
