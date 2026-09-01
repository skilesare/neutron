import Validation "../backend/Validation";

assert Validation.validTimeZone("UTC");
assert Validation.validTimeZone("America/Chicago");
assert Validation.validTimeZone("Etc/GMT+5");
assert not Validation.validTimeZone("");
assert not Validation.validTimeZone("Chicago");
assert not Validation.validTimeZone("/America/Chicago");
assert not Validation.validTimeZone("America//Chicago");
assert not Validation.validTimeZone("America/Chicago/");
assert not Validation.validTimeZone("America/Chi cago");
assert not Validation.validTimeZone("America/Chicago\nInjected");

assert Validation.validPreferences(480, 1_020, 62, 15, 0, 30, "Europe/London");
assert Validation.validPreferences(480, 1_020, 62, 5, 240, 240, "UTC");
assert Validation.validPreferences(480, 1_020, 62, 15, 0, 0, "UTC");
assert Validation.validPreferences(480, 1_020, 62, 30, 0, 0, "UTC");
assert Validation.validPreferences(480, 1_020, 62, 60, 0, 0, "UTC");
assert Validation.validPreferences(480, 1_020, 62, 120, 0, 0, "UTC");
assert not Validation.validPreferences(1_020, 480, 62, 15, 0, 30, "Europe/London");
assert not Validation.validPreferences(480, 1_020, 0, 15, 0, 30, "Europe/London");
assert not Validation.validPreferences(480, 1_020, 62, 4, 0, 30, "Europe/London");
assert not Validation.validPreferences(480, 1_020, 62, 121, 0, 30, "Europe/London");
assert not Validation.validPreferences(480, 1_020, 62, 15, 241, 30, "Europe/London");
assert not Validation.validPreferences(480, 1_020, 62, 15, 0, 30, "Invalid Zone");
