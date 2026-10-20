import { readFileSync, writeFileSync, existsSync } from "node:fs";

/**
 * The scheduled job runs from a GitHub Actions cron, and Actions cron is
 * always UTC with no timezone support. So a user picking "09:00 in Tokyo" has
 * to be converted to a fixed UTC time, which is what actually gets written.
 */

export const DEFAULT_WORKFLOW = ".github/workflows/linkedin-post.yml";

/** Day-of-week, in the order cron numbers them. */
export const DAYS = [
  { value: 1, label: "Mon", short: "M" },
  { value: 2, label: "Tue", short: "T" },
  { value: 3, label: "Wed", short: "W" },
  { value: 4, label: "Thu", short: "T" },
  { value: 5, label: "Fri", short: "F" },
  { value: 6, label: "Sat", short: "S" },
  { value: 0, label: "Sun", short: "S" },
];

/**
 * Cities offered up front, the way a clock app would. The full IANA list is
 * still available through search; these are just the ones people usually mean.
 */
const FAVOURITE_CITIES = [
  { zone: "Europe/London", city: "London" },
  { zone: "Europe/Dublin", city: "Dublin" },
  { zone: "Europe/Lisbon", city: "Lisbon" },
  { zone: "Europe/Madrid", city: "Madrid" },
  { zone: "Europe/Paris", city: "Paris" },
  { zone: "Europe/Berlin", city: "Berlin" },
  { zone: "Europe/Amsterdam", city: "Amsterdam" },
  { zone: "Europe/Rome", city: "Rome" },
  { zone: "Europe/Warsaw", city: "Warsaw" },
  { zone: "Europe/Athens", city: "Athens" },
  { zone: "Europe/Kyiv", city: "Kyiv" },
  { zone: "Europe/Istanbul", city: "Istanbul" },
  { zone: "Europe/Moscow", city: "Moscow" },

  { zone: "America/New_York", city: "New York" },
  { zone: "America/Chicago", city: "Chicago" },
  { zone: "America/Denver", city: "Denver" },
  { zone: "America/Los_Angeles", city: "Los Angeles" },
  { zone: "America/Anchorage", city: "Anchorage" },
  { zone: "America/Toronto", city: "Toronto" },
  { zone: "America/Vancouver", city: "Vancouver" },
  { zone: "America/Mexico_City", city: "Mexico City" },
  { zone: "America/Bogota", city: "Bogota" },
  { zone: "America/Sao_Paulo", city: "Sao Paulo" },
  { zone: "America/Argentina/Buenos_Aires", city: "Buenos Aires" },
  { zone: "America/Santiago", city: "Santiago" },

  { zone: "Africa/Lagos", city: "Lagos" },
  { zone: "Africa/Cairo", city: "Cairo" },
  { zone: "Africa/Johannesburg", city: "Johannesburg" },
  { zone: "Africa/Nairobi", city: "Nairobi" },

  { zone: "Asia/Jerusalem", city: "Jerusalem" },
  { zone: "Asia/Dubai", city: "Dubai" },
  { zone: "Asia/Karachi", city: "Karachi" },
  { zone: "Asia/Kolkata", city: "Kolkata" },
  { zone: "Asia/Dhaka", city: "Dhaka" },
  { zone: "Asia/Bangkok", city: "Bangkok" },
  { zone: "Asia/Jakarta", city: "Jakarta" },
  { zone: "Asia/Singapore", city: "Singapore" },
  { zone: "Asia/Hong_Kong", city: "Hong Kong" },
  { zone: "Asia/Shanghai", city: "Shanghai" },
  { zone: "Asia/Taipei", city: "Taipei" },
  { zone: "Asia/Seoul", city: "Seoul" },
  { zone: "Asia/Tokyo", city: "Tokyo" },

  { zone: "Australia/Perth", city: "Perth" },
  { zone: "Australia/Adelaide", city: "Adelaide" },
  { zone: "Australia/Brisbane", city: "Brisbane" },
  { zone: "Australia/Sydney", city: "Sydney" },
  { zone: "Pacific/Auckland", city: "Auckland" },
  { zone: "Pacific/Honolulu", city: "Honolulu" },
];

export function isValidTimeZone(zone) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** Favourite cities plus every IANA zone, each with a friendly label. */
export function listTimeZones() {
  const all =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : [];

  const extras = [...new Set([...all, ...FAVOURITE_CITIES.map((c) => c.zone)])].sort();

  const cities = FAVOURITE_CITIES.map(({ zone, city }) => ({
    zone,
    city,
    label: `${city} (${zone})`,
  }));

  return {
    cities,
    zones: extras.map((zone) => ({ zone, label: zone })),
  };
}

/** "UTC+01:00" for the given zone at the given instant. */
export function offsetLabel(timeZone, at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);

  const get = (type) => parts.find((p) => p.type === type)?.value;
  const asUtc = Date.UTC(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    Number(get("hour")) % 24,
    Number(get("minute")),
    Number(get("second"))
  );

  const minutes = Math.round((asUtc - at.getTime()) / 60000);
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");

  return `UTC${sign}${hh}:${mm}`;
}

/** How far the zone's offset shifts over the next year, i.e. does it use DST. */
function observesDaylightSaving(timeZone, from = new Date()) {
  const sample = (date) => offsetLabel(timeZone, date).slice(4);

  const start = new Date(from);
  const end = new Date(from);
  end.setUTCFullYear(end.getUTCFullYear() + 1);

  // A few probes are enough: DST moves in March/April and October/November.
  for (let i = 0; i <= 12; i++) {
    const probe = new Date(start);
    probe.setUTCMonth(start.getUTCMonth() + i);
    if (sample(probe) !== sample(from)) return true;
  }
  void end;
  return false;
}

/**
 * Turn a wall-clock time in a named zone into the UTC time it corresponds to.
 *
 * Returns the UTC hour/minute on the same calendar day, so a caller can build a
 * cron. The offset used is the one in effect today: a cron cannot follow
 * daylight saving, which is why `warnings` says so when the zone observes it.
 */
export function toUtcTime({ timeZone, hour, minute = 0, at = new Date() }) {
  if (!isValidTimeZone(timeZone)) throw new Error(`Unknown time zone: ${timeZone}`);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error(`Hour must be 0-23, got ${hour}`);
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error(`Minute must be 0-59, got ${minute}`);
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);

  const get = (type) => parts.find((p) => p.type === type)?.value;
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));

  // What UTC instant does this wall-clock time fall on?
  const guess = Date.UTC(year, month - 1, day, hour, minute);

  // Two passes converge: the first guess is off by the offset, the second uses
  // the offset that actually applies on that date.
  let instant = guess;
  for (let i = 0; i < 2; i++) {
    const offset = zoneOffsetMinutes(timeZone, new Date(instant));
    instant = guess - offset * 60000;
  }

  const utc = new Date(instant);
  const warnings = [];

  if (observesDaylightSaving(timeZone)) {
    warnings.push(
      `${timeZone} observes daylight saving. GitHub cron cannot follow it, so the post will be an hour out for part of the year — re-run this step after the clocks change.`
    );
  }

  return {
    utcHour: utc.getUTCHours(),
    utcMinute: utc.getUTCMinutes(),
    utcDate: utc.toISOString(),
    offsetLabel: offsetLabel(timeZone, at),
    warnings,
  };
}

/** Minutes to add to UTC to get the zone's wall clock (east of Greenwich is +). */
function zoneOffsetMinutes(timeZone, at) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);

  const get = (type) => parts.find((p) => p.type === type)?.value;
  const asUtc = Date.UTC(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    Number(get("hour")) % 24,
    Number(get("minute")),
    Number(get("second"))
  );

  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

/**
 * Build the GitHub Actions cron string.
 *
 * Day-of-month is always `*` on purpose: Actions treats day-of-month and
 * day-of-week as an OR, so "1-5" plus a specific date would fire on the date
 * too. Only one of the two may ever be constrained.
 */
export function buildCron({ hour, minute = 0, days = [] }) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error(`Hour must be 0-23, got ${hour}`);
  }

  const wanted = [...new Set(days)].filter((d) => DAYS.some((x) => x.value === d));

  let dayField = "*";
  if (wanted.length > 0 && wanted.length < DAYS.length) {
    dayField = formatDayField(wanted);
  }

  return `${Number(minute)} ${Number(hour)} * * ${dayField}`;
}

/** Turn [1,2,3,4,5] into the compact "1-5" a human would write. */
function formatDayField(days) {
  // Plain numeric order, so the same set always produces the same string.
  const sorted = [...days].sort((a, b) => a - b);
  const runs = [];

  for (const day of sorted) {
    const last = runs.at(-1);
    if (last && day === last[1] + 1) last[1] = day;
    else runs.push([day, day]);
  }

  return runs
    .map(([start, end]) => (start === end ? `${start}` : `${start}-${end}`))
    .join(",");
}

/** Parse "0 18 * * 1-5" back into the pieces the wizard edits. */
export function parseCron(cron) {
  const parts = String(cron ?? "").trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minute, hour, dom, month, dow] = parts;
  // Only the shapes this step can produce are understood.
  if (dom !== "*" || month !== "*") return null;

  const days =
    dow === "*"
      ? []
      : dow
          .split(",")
          .flatMap((part) =>
            part.includes("-")
              ? range(parseInt(part.split("-")[0], 10), parseInt(part.split("-")[1], 10))
              : [parseInt(part, 10)]
          )
          .filter((n) => Number.isInteger(n));

  return {
    minute: parseInt(minute, 10),
    hour: parseInt(hour, 10),
    days: [...new Set(days)].sort((a, b) => a - b),
  };
}

function range(start, end) {
  const out = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

const CRON_LINE = /(\bcron:\s*)(["']?)([^"'\r\n]*)\2/;

/** The cron currently committed in the workflow, if there is one. */
export function readWorkflowCron(workflowPath) {
  if (!existsSync(workflowPath)) return null;

  const source = readFileSync(workflowPath, "utf8");
  const match = source.match(CRON_LINE);
  return match ? match[3].trim() : null;
}

/**
 * Replace the cron line, touching nothing else in the file. Refuses to guess if
 * the shape is not what it expects.
 * @returns {{ok: boolean, previous: string|null, cron: string, reason?: string}}
 */
export function writeWorkflowCron(workflowPath, cron) {
  if (!existsSync(workflowPath)) {
    return { ok: false, reason: `Not found: ${workflowPath}` };
  }

  const source = readFileSync(workflowPath, "utf8");
  const matches = source.match(new RegExp(CRON_LINE.source, "g")) ?? [];

  if (matches.length === 0) {
    return { ok: false, reason: "No cron: line found in the workflow." };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      reason: `Found ${matches.length} cron: lines. Edit the workflow by hand.`,
    };
  }

  const previous = source.match(CRON_LINE)[3].trim();
  const next = source.replace(CRON_LINE, `$1"${cron}"`);

  writeFileSync(workflowPath, next, "utf8");
  return { ok: true, previous, cron };
}

/** The next few times the job will actually run, in both zones. */
export function nextRuns({ cron, timeZone, count = 5, from = new Date() }) {
  const parsed = parseCron(cron);
  if (!parsed) return [];

  const allowed = new Set(
    parsed.days.length > 0
      ? parsed.days
      : DAYS.map((d) => d.value)
  );

  const runs = [];
  const cursor = new Date(from.getTime());
  cursor.setUTCMinutes(
    Math.floor(cursor.getUTCMinutes() / 5) * 5 // Actions ignores anything under 5 minutes
  );
  cursor.setUTCSeconds(0, 0);

  // A year of minutes is plenty; stop as soon as enough have been collected.
  for (let i = 0; i < 366 * 288 && runs.length < count; i++) {
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 5);

    if (cursor.getUTCMinutes() !== parsed.minute) continue;
    if (cursor.getUTCHours() !== parsed.hour) continue;
    if (!allowed.has(cursor.getUTCDay())) continue;

    runs.push({
      utc: cursor.toISOString(),
      local: new Intl.DateTimeFormat("en-US", {
        timeZone,
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(cursor),
    });
  }

  return runs;
}