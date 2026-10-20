import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  buildCron,
  parseCron,
  toUtcTime,
  nextRuns,
  listTimeZones,
  offsetLabel,
  readWorkflowCron,
  writeWorkflowCron,
  isValidTimeZone,
  DAYS,
} from "../scripts/schedule.js";
import { zoneOptions, splitRun } from "../web/src/lib/timezones.js";

/** A fixed instant, so conversion results do not depend on when tests run. */
const WINTER = new Date("2026-01-15T12:00:00Z");
const SUMMER = new Date("2026-07-15T12:00:00Z");

describe("buildCron", () => {
  it("writes a plain daily cron when no days are chosen", () => {
    expect(buildCron({ hour: 18, minute: 0 })).toBe("0 18 * * *");
  });

  it("compresses a weekday run into a range", () => {
    expect(buildCron({ hour: 9, minute: 30, days: [1, 2, 3, 4, 5] })).toBe("30 9 * * 1-5");
  });

  it("keeps days in ascending numeric order", () => {
    // 0 is Sunday; sorting numerically is predictable rather than Mon-first.
    expect(buildCron({ hour: 8, days: [0, 6, 1] })).toBe("0 8 * * 0-1,6");
  });

  it("never constrains the day-of-month", () => {
    // Actions ORs day-of-month with day-of-week, so pinning one would make the
    // schedule fire on that date too, whatever the weekday.
    for (const days of [[], [1], [0, 6], [1, 2, 3, 4, 5, 6, 0]]) {
      expect(buildCron({ hour: 9, days }).split(" ")[2]).toBe("*");
    }
  });

  it("treats every day selected as no day filter at all", () => {
    expect(buildCron({ hour: 9, days: [1, 2, 3, 4, 5, 6, 0] })).toBe("0 9 * * *");
  });

  it("ignores values that are not real days", () => {
    expect(buildCron({ hour: 9, days: [1, 99, "x"] })).toBe("0 9 * * 1");
  });

  it("rejects an impossible hour", () => {
    expect(() => buildCron({ hour: 24 })).toThrow(/0-23/);
    expect(() => buildCron({ hour: -1 })).toThrow(/0-23/);
  });
});

describe("parseCron", () => {
  it("round trips a weekday schedule", () => {
    const cron = buildCron({ hour: 9, minute: 30, days: [1, 2, 3, 4, 5] });
    expect(parseCron(cron)).toEqual({ hour: 9, minute: 30, days: [1, 2, 3, 4, 5] });
  });

  it("round trips a daily schedule", () => {
    expect(parseCron("0 18 * * *")).toEqual({ hour: 18, minute: 0, days: [] });
  });

  it("refuses crons it did not produce", () => {
    // A pinned day-of-month would silently OR with the weekday.
    expect(parseCron("0 9 15 * 1-5")).toBeNull();
    expect(parseCron("0 9 * *")).toBeNull();
    expect(parseCron("nonsense")).toBeNull();
  });
});

describe("toUtcTime", () => {
  it("shifts a UTC zone not at all", () => {
    const r = toUtcTime({ timeZone: "UTC", hour: 18, at: WINTER });
    expect(r.utcHour).toBe(18);
    expect(r.utcMinute).toBe(0);
  });

  it("converts Tokyo, which is a whole day ahead in UTC terms", () => {
    // 09:00 in Tokyo is 00:00 UTC the same calendar day.
    const r = toUtcTime({ timeZone: "Asia/Tokyo", hour: 9, at: WINTER });
    expect(r.utcHour).toBe(0);
    expect(r.offsetLabel).toBe("UTC+09:00");
  });

  it("handles New York in winter and summer separately", () => {
    // EST is UTC-5, EDT is UTC-4, so the same wall-clock time maps differently.
    expect(toUtcTime({ timeZone: "America/New_York", hour: 9, at: WINTER }).utcHour).toBe(14);
    expect(toUtcTime({ timeZone: "America/New_York", hour: 9, at: SUMMER }).utcHour).toBe(13);
  });

  it("handles a zone with a half-hour offset", () => {
    const r = toUtcTime({ timeZone: "Asia/Kolkata", hour: 9, at: WINTER });
    expect(r.utcHour).toBe(3);
    expect(r.offsetLabel).toBe("UTC+05:30");
  });

  it("warns when the zone observes daylight saving", () => {
    const dst = toUtcTime({ timeZone: "Europe/Madrid", hour: 9, at: WINTER });
    expect(dst.warnings.join(" ")).toMatch(/daylight saving/i);

    const noDst = toUtcTime({ timeZone: "Asia/Tokyo", hour: 9, at: WINTER });
    expect(noDst.warnings).toEqual([]);
  });

  it("rejects a bad zone or time", () => {
    expect(() => toUtcTime({ timeZone: "Mars/Olympus", hour: 9 })).toThrow(/Unknown time zone/);
    expect(() => toUtcTime({ timeZone: "UTC", hour: 25 })).toThrow(/0-23/);
    expect(() => toUtcTime({ timeZone: "UTC", hour: 9, minute: 60 })).toThrow(/0-59/);
  });
});

describe("offsetLabel", () => {
  it("formats east and west of Greenwich", () => {
    expect(offsetLabel("Asia/Tokyo", WINTER)).toBe("UTC+09:00");
    expect(offsetLabel("America/Los_Angeles", WINTER)).toBe("UTC-08:00");
    expect(offsetLabel("UTC", WINTER)).toBe("UTC+00:00");
  });

  it("reports the summer offset, not the standard one", () => {
    expect(offsetLabel("America/New_York", SUMMER)).toBe("UTC-04:00");
  });
});

describe("nextRuns", () => {
  it("lists upcoming runs on the chosen weekdays only", () => {
    const runs = nextRuns({
      cron: "0 9 * * 1-5",
      timeZone: "Europe/London",
      count: 5,
      from: new Date("2026-01-03T00:00:00Z"), // a Saturday
    });

    expect(runs).toHaveLength(5);
    for (const run of runs) {
      const day = new Date(run.utc).getUTCDay();
      expect(day, run.utc).toBeGreaterThanOrEqual(1);
      expect(day, run.utc).toBeLessThanOrEqual(5);
    }
    // Monday the 5th is the first weekday after the Saturday.
    expect(runs[0].utc).toBe("2026-01-05T09:00:00.000Z");
  });

  it("shows the local time alongside UTC", () => {
    const runs = nextRuns({
      cron: "0 9 * * *",
      timeZone: "Asia/Tokyo",
      count: 1,
      from: WINTER,
    });
    // 09:00 UTC is 18:00 the same day in Tokyo.
    expect(runs[0].local).toContain("18:00");
  });

  it("returns nothing for a cron it cannot parse", () => {
    expect(nextRuns({ cron: "garbage", timeZone: "UTC" })).toEqual([]);
  });
});

describe("listTimeZones", () => {
  it("offers familiar cities first", () => {
    const { cities } = listTimeZones();
    expect(cities.length).toBeGreaterThan(20);
    expect(cities.some((c) => c.zone === "Asia/Tokyo")).toBe(true);
    expect(cities[0].label).toMatch(/\(.+\)/);
  });

  it("includes every city zone in the searchable list", () => {
    const { cities, zones } = listTimeZones();
    for (const city of cities) {
      expect(zones.some((z) => z.zone === city.zone)).toBe(true);
    }
  });

  it("only lists zones the runtime actually understands", () => {
    for (const { zone } of listTimeZones().zones) {
      expect(isValidTimeZone(zone), zone).toBe(true);
    }
  });
});

describe("workflow editing", () => {
  let dir;
  let file;

  const WORKFLOW = `name: Daily

on:
  schedule:
    - cron: "0 18 * * *"
  workflow_dispatch:

jobs:
  post:
    runs-on: ubuntu-latest
`;

  function setup() {
    dir = mkdtempSync(path.join(tmpdir(), "sched-"));
    file = path.join(dir, "linkedin-post.yml");
    writeFileSync(file, WORKFLOW, "utf8");
  }

  it("reads the committed cron", () => {
    setup();
    expect(readWorkflowCron(file)).toBe("0 18 * * *");
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns null when the workflow is missing", () => {
    expect(readWorkflowCron(path.join(tmpdir(), "nope-does-not-exist.yml"))).toBeNull();
  });

  it("rewrites only the cron and leaves the rest alone", () => {
    setup();
    const result = writeWorkflowCron(file, "30 9 * * 1-5");

    expect(result.ok).toBe(true);
    expect(result.previous).toBe("0 18 * * *");

    const after = readFileSync(file, "utf8");
    expect(after).toContain('- cron: "30 9 * * 1-5"');
    expect(after).toContain("workflow_dispatch:");
    expect(after).toContain("runs-on: ubuntu-latest");
    expect(after).not.toContain('- cron: "0 18 * * *"');
    rmSync(dir, { recursive: true, force: true });
  });

  it("refuses to guess when there are several crons", () => {
    setup();
    writeFileSync(file, WORKFLOW.replace("runs-on", '- cron: "5 5 * * *"\n    runs-on'), "utf8");

    const result = writeWorkflowCron(file, "30 9 * * *");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/2 cron/);
    rmSync(dir, { recursive: true, force: true });
  });

  it("reports a missing cron line instead of writing a new one", () => {
    setup();
    writeFileSync(file, "name: Daily\non:\n  workflow_dispatch:\n", "utf8");

    expect(writeWorkflowCron(file, "30 9 * * *").ok).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("zoneOptions (schedule step)", () => {
  // The shape the endpoint actually returns. The component used to read
  // meta.zones as if it were the array, crashing on every render after load.
  const META = {
    zones: {
      cities: [
        { zone: "Asia/Tokyo", city: "Tokyo", label: "Tokyo (Asia/Tokyo)" },
        { zone: "Europe/Madrid", city: "Madrid", label: "Madrid (Europe/Madrid)" },
      ],
      zones: [
        { zone: "Asia/Tokyo", label: "Asia/Tokyo" },
        { zone: "Europe/Madrid", label: "Europe/Madrid" },
        { zone: "America/New_York", label: "America/New_York" },
        { zone: "Europe/London", label: "Europe/London" },
      ],
    },
  };

  it("reads the zones from their real place, meta.zones.zones", () => {
    const options = zoneOptions(META, "", "America/New_York");
    expect(Array.isArray(options)).toBe(true);
    expect(options.map((o) => o.zone)).toContain("America/New_York");
  });

  it("survives being called before the request resolves", () => {
    expect(zoneOptions(null, "", "UTC")).toEqual([]);
    expect(zoneOptions(undefined, "tokyo", "UTC")).toEqual([]);
    expect(zoneOptions({}, "", "UTC")).toEqual([]);
  });

  it("never lists the same zone twice", () => {
    // The city list and the IANA list overlap, and used to render 3-4 rows for
    // one city depending on how many lists happened to contain it.
    for (const query of ["", "tokyo", "madrid", "new_york", "a", "zone"]) {
      const zones = zoneOptions(META, query, "Europe/Madrid").map((o) => o.zone);
      expect(new Set(zones).size, `duplicates for "${query}"`).toBe(zones.length);
    }
  });

  it("puts an exact city name first", () => {
    // Previously any loose substring hit could outrank the city itself.
    expect(zoneOptions(META, "tokyo", "")[0].zone).toBe("Asia/Tokyo");
    expect(zoneOptions(META, "madrid", "")[0].zone).toBe("Europe/Madrid");
  });

  it("ranks a prefix above a substring buried further down the list", () => {
    const zones = zoneOptions(META, "tok", "").map((o) => o.zone);
    expect(zones[0]).toBe("Asia/Tokyo");
  });

  it("keeps the selected zone listed when it is not a favourite", () => {
    // Selecting it and clearing the search must not make it disappear, or it
    // stops reading as the current choice.
    const options = zoneOptions(META, "", "America/New_York");
    expect(options[0].zone).toBe("America/New_York");
    expect(options.filter((o) => o.zone === "America/New_York")).toHaveLength(1);
  });

  it("keeps a selected favourite in its usual place", () => {
    const zones = zoneOptions(META, "", "Asia/Tokyo").map((o) => o.zone);
    expect(zones).toEqual(["Asia/Tokyo", "Europe/Madrid"]);
  });

  it("searches cities and zones together", () => {
    expect(zoneOptions(META, "new_york", "").map((o) => o.zone)).toEqual([
      "America/New_York",
    ]);
  });

  it("returns nothing for a query that matches nothing", () => {
    expect(zoneOptions(META, "atlantis", "")).toEqual([]);
  });

  it("orders equal matches consistently", () => {
    const a = zoneOptions(META, "zone", "").map((o) => o.zone);
    const b = zoneOptions(META, "zone", "").map((o) => o.zone);
    expect(a).toEqual(b);
  });
});

describe("splitRun", () => {
  it("separates the day from the time", () => {
    expect(splitRun("Tue, Oct 20, 2026, 09:00")).toEqual({
      day: "Tue, Oct 20, 2026",
      time: "09:00",
    });
  });

  it("passes through anything it cannot parse", () => {
    expect(splitRun("whenever")).toEqual({ day: "whenever", time: "" });
  });
});

describe("DAYS", () => {
  it("covers the week in cron order, Sunday last", () => {
    expect(DAYS.map((d) => d.value)).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });
});