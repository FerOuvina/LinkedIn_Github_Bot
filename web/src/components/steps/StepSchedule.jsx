import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";
import { splitRun, zoneOptions } from "../../lib/timezones.js";
import CopyBlock from "../copyBlock.jsx";

const DEFAULT_TIME_ZONE = "Europe/Madrid";

export default function StepSchedule() {
  const [meta, setMeta] = useState(null);
  const [timeZone, setTimeZone] = useState(DEFAULT_TIME_ZONE);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [days, setDays] = useState([1, 2, 3, 4, 5]);
  const [query, setQuery] = useState("");

  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [applied, setApplied] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.schedule().then(setMeta).catch((err) => setPreviewError(err.message));
  }, []);

  // Reconvert whenever anything the cron depends on changes.
  useEffect(() => {
    let cancelled = false;

    api
      .previewSchedule({ timeZone, hour, minute, days })
      .then((result) => {
        if (!cancelled) {
          setPreview(result);
          setPreviewError("");
        }
      })
      .catch((err) => {
        if (!cancelled) setPreviewError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [timeZone, hour, minute, days]);

  const toggleDay = (value) =>
    setDays((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]
    );

  const apply = async () => {
    setBusy(true);
    try {
      setApplied(await api.applySchedule(preview.cron));
    } catch (err) {
      setPreviewError(err.message);
    } finally {
      setBusy(false);
    }
  };

  /**
   * With no query, show the familiar cities plus the currently selected zone if
   * it is not one of them. Searching falls back to the full IANA list.
   */
  const options = useMemo(() => zoneOptions(meta, query, timeZone), [meta, query, timeZone]);

  return (
    <section>
      <p className="mb-8 max-w-2xl text-lg text-ash">
        Pick a city and a time. GitHub runs scheduled jobs on UTC and has no
        timezone setting, so the wizard converts it and shows you exactly what
        gets written.
      </p>

      {/* ── Timezone ── */}
      <div className="mb-6 max-w-2xl">
        <label className="ff-mono mb-2 block text-[11px] uppercase tracking-[0.2em] text-bone">
          city or timezone
        </label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cities or type a timezone…"
          className="ff-input"
        />

        <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto">
          {options.map((z) => {
            const selected = timeZone === z.zone;
            return (
              <button
                key={z.zone}
                onClick={() => {
                  setTimeZone(z.zone);
                  setQuery("");
                }}
                aria-pressed={selected}
                className={`flex items-center justify-between gap-3 border-2 p-3 text-left transition ${
                  selected
                    ? "border-acid bg-acid/10"
                    : "border-edge hover:border-primary"
                }`}
              >
                <span className="font-mono text-sm">{z.city ?? z.zone}</span>
                {/* The right column is only useful when it says something else. */}
                <span className="font-mono text-[11px] text-ash">
                  {selected && <span className="text-acid">● </span>}
                  {z.city ? z.zone : z.group === "city" ? "favourite city" : "timezone"}
                </span>
              </button>
            );
          })}

          {options.length === 0 && (
            <p className="text-sm text-ash">No match. Try a city name or an IANA zone.</p>
          )}
        </div>
      </div>

      {/* ── Time ── */}
      <div className="mb-6 max-w-2xl">
        <label className="ff-mono mb-2 block text-[11px] uppercase tracking-[0.2em] text-bone">
          time of day
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="0"
            max="23"
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
            className="ff-input w-24"
            aria-label="hour"
          />
          <span className="font-mono text-acid">:</span>
          <input
            type="number"
            min="0"
            max="59"
            value={minute}
            onChange={(e) => setMinute(Number(e.target.value))}
            className="ff-input w-24"
            aria-label="minute"
          />
          <span className="ff-mono text-[11px] text-ash">
            your local time in {timeZone}
          </span>
        </div>
      </div>

      {/* ── Days ── */}
      <div className="mb-8 max-w-2xl">
        <label className="ff-mono mb-2 block text-[11px] uppercase tracking-[0.2em] text-bone">
          days
        </label>
        <div className="flex flex-wrap gap-2">
          {(meta?.days ?? []).map((day) => {
            const on = days.includes(day.value);
            return (
              <button
                key={day.value}
                onClick={() => toggleDay(day.value)}
                aria-pressed={on}
                className={`size-11 border-2 font-mono text-sm transition ${
                  on
                    ? "border-acid bg-acid/10 text-acid"
                    : "border-edge text-ash hover:border-primary"
                }`}
              >
                {day.short}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-sm text-ash">
          {days.length === 0 || days.length === 7
            ? "Every day."
            : `Every ${days.length === 5 && days.every((d) => d >= 1 && d <= 5) ? "weekday" : "day"} you ticked.`}
        </p>
      </div>

      {previewError && (
        <div className="panel mb-6 border-crimson p-4 text-crimson">{previewError}</div>
      )}

      {/* ── Result ── */}
      {preview && (
        <div className="panel mb-6 border-acid p-4">
          <p className="ff-mono text-[11px] uppercase tracking-[0.2em] text-acid">
            the bot will post at
          </p>

          <ul className="mt-3 space-y-2">
            {preview.runs.map((run) => {
              const { day, time } = splitRun(run.local);
              return (
                <li key={run.utc} className="font-mono text-sm text-bone">
                  <span className="text-ash">{day},</span> {time}
                </li>
              );
            })}
          </ul>

          <div className="mt-4 border-t border-edge pt-4 text-sm text-ash">
            Written to the workflow as{" "}
            <code className="font-mono text-primary">cron: "{preview.cron}"</code> —{" "}
            {preview.utcTime} UTC ({preview.offsetLabel}).
          </div>

          {preview.warnings.map((warning) => (
            <p key={warning} className="mt-3 text-sm text-cyan">
              {warning}
            </p>
          ))}

          <p className="mt-3 text-sm text-ash">
            GitHub can delay a scheduled run by a few minutes under load, so treat
            this as the earliest it posts rather than an exact minute.
          </p>
        </div>
      )}

      {/* Bonus: industry consensus on good posting times (2026) */}
      <div className="mb-6 panel border-edge p-4">
        <p className="ff-mono mb-2 text-[11px] uppercase tracking-[0.2em] text-primary">
          good posting times (2026 consensus)
        </p>
        <ul className="space-y-1 text-sm text-ash">
          <li>
            <span className="font-mono text-acid">Best days:</span>{" "}
            Tuesday, Wednesday and Thursday — Wednesday often ranks highest.
            Weekends are usually weakest for professional content.
          </li>
          <li>
            <span className="font-mono text-acid">Best hours:</span> broadly 9 AM–5 PM in your
            audience's local time. Studies cluster around mid-to-late morning (9–11/12 AM or
            10 AM–2 PM), with strong late-afternoon/early-evening performance (3–8 PM) too.
          </li>
          <li>
            <span className="font-mono text-acid">Note:</span> exact peaks vary by study and
            audience — treat this as a starting point and test it.
          </li>
        </ul>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={apply}
          disabled={busy || !preview}
          className="btn btn-acid"
        >
          {busy ? "Working…" : "Update the workflow"}
        </button>
      </div>

      {applied && (
        <div className="panel mb-6 border-acid p-4 text-acid">
          {applied.message}
          <p className="mt-2 text-sm text-ash">
            The change is in your working copy. Commit and push it for the new
            schedule to take effect:
          </p>
          <div className="mt-3">
            <CopyBlock code={`git add ${meta?.workflowPath ?? ".github/workflows/linkedin-post.yml"}\ngit commit -m "chore: change the post schedule"\ngit push`} />
          </div>
        </div>
      )}

      {meta?.current && (
        <p className="text-sm text-ash">
          Currently committed as{" "}
          <code className="font-mono text-primary">cron: "{meta.current}"</code>
          {preview && preview.cron === meta.current && " — that matches what you picked."}
        </p>
      )}
    </section>
  );
}