/**
 * Building the timezone list the schedule step renders.
 *
 * Kept out of the component so it can be tested against the real API shape:
 * the endpoint returns `zones: { cities, zones }`, and reading `meta.zones` as
 * if it were the array is exactly the mistake this module now prevents.
 */

/**
 * How well an entry matches what was typed. Higher is better; 0 means no match.
 * An exact city name has to outrank a loose substring hit somewhere in the
 * middle of the IANA list, or searching a city buries it.
 */
function score(entry, query) {
  const city = (entry.city ?? "").toLowerCase();
  const zone = entry.zone.toLowerCase();
  const label = entry.label.toLowerCase();

  if (zone === query) return 100; // typed the full IANA name
  if (city && city === query) return 95; // typed the city name exactly
  if (city.startsWith(query)) return 80;
  if (zone.startsWith(query)) return 70;
  if (label.startsWith(query)) return 60;
  if (label.includes(query)) return 40;
  if (zone.includes(query)) return 30;
  return 0;
}

/**
 * One entry per zone, so a city that also appears in the IANA list cannot show
 * up two or three times. The friendly city label wins where both exist.
 */
function entriesFor(meta) {
  const cities = meta?.zones?.cities ?? [];
  const zones = meta?.zones?.zones ?? [];
  const byZone = new Map();

  for (const c of cities) {
    byZone.set(c.zone, { zone: c.zone, city: c.city, label: c.label, group: "city" });
  }
  for (const z of zones) {
    if (!byZone.has(z.zone)) {
      byZone.set(z.zone, { zone: z.zone, label: z.label, group: "zone" });
    }
  }

  return [...byZone.values()];
}

/**
 * @param {{zones?: {cities?: Array, zones?: Array}}|null} meta
 * @param {string} query free-text search
 * @param {string} timeZone currently selected zone, so it stays visible
 * @returns {Array<{zone: string, label: string, city?: string, group: string}>}
 */
export function zoneOptions(meta, query = "", timeZone = "") {
  const all = entriesFor(meta);
  const q = query.trim().toLowerCase();

  if (q) {
    return all
      .map((entry) => ({ entry, rank: score(entry, q) }))
      .filter((hit) => hit.rank > 0)
      // Ties break alphabetically so the order never shuffles between renders.
      .sort((a, b) => b.rank - a.rank || a.entry.zone.localeCompare(b.entry.zone))
      .map((hit) => hit.entry);
  }

  const favourites = all.filter((entry) => entry.group === "city");
  const selected = all.find((entry) => entry.zone === timeZone);

  // A zone that is not a favourite would otherwise vanish from the list and
  // stop showing as selected once the search box is cleared.
  if (selected && selected.group !== "city") {
    return [selected, ...favourites];
  }

  return favourites;
}

/** Split "Tue, Oct 20, 2026, 09:00" so the day and time can be styled apart. */
export function splitRun(local) {
  const match = String(local).match(/^(.*?),\s*(\d{2}:\d{2})$/);
  return match ? { day: match[1], time: match[2] } : { day: local, time: "" };
}