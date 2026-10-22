import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";
import { splitRun, zoneOptions } from "../../lib/timezones.js";
import CopyBlock from "../copyBlock.jsx";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { msg } from "@lingui/core/macro";

const DEFAULT_TIME_ZONE = "UTC";

const LANGUAGE_NAMES = {
  en: msg`English`,
  es: msg`Spanish`,
  pt: msg`Portuguese`,
  fr: msg`French`,
};

export default function StepSchedule() {
  const { _ } = useLingui();
  const [meta, setMeta] = useState(null);
  const [timeZone, setTimeZone] = useState(DEFAULT_TIME_ZONE);
  const [times, setTimes] = useState({ en: "13:00" });
  const [days, setDays] = useState([1, 2, 3, 4, 5]);
  const [gapMinutes, setGapMinutes] = useState(5);
  const [query, setQuery] = useState("");

  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [applied, setApplied] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .schedule()
      .then((result) => {
        const config = result.config ?? {};
        setMeta(result);
        setTimeZone(config.timezone ?? DEFAULT_TIME_ZONE);
        setTimes(config.times ?? { en: "13:00" });
        setDays(config.days ?? [1, 2, 3, 4, 5]);
        setGapMinutes(config.gapMinutes ?? 5);
      })
      .catch((err) => setPreviewError(err.message));
  }, []);

  // Reconvert whenever anything the crons depend on changes.
  useEffect(() => {
    if (!meta) return undefined;
    let cancelled = false;

    api
      .previewSchedule({ times, timeZone, days, gapMinutes })
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
  }, [meta, times, timeZone, days, gapMinutes]);

  const languages = meta?.config?.languages ?? ["en"];

  const toggleDay = (value) =>
    setDays((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]
    );

  const setTime = (code, value) => {
    setTimes((prev) => ({ ...prev, [code]: value }));
  };

  const apply = async () => {
    setBusy(true);
    try {
      setApplied(
        await api.applySchedule({ times, timeZone, days, gapMinutes })
      );
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
        <Trans>
          Pick a time for each language. GitHub runs scheduled jobs on UTC and has
          no timezone setting, so the wizard converts each time and shows you the
          exact crons that get written.
        </Trans>
      </p>

      {/* �� Per-language times �� */}
      <div className="mb-6 max-w-2xl">
        <span className="ff-mono mb-2 block text-[11px] uppercase tracking-[0.2em] text-bone">
          <Trans>post times</Trans>
        </span>
        <div className="grid gap-3">
          {languages.map((code) => (
            <label
              key={code}
              className="flex flex-wrap items-center justify-between gap-3 border-2 border-edge p-3"
            >
              <span className="font-mono text-sm text-bone">
                {LANGUAGE_NAMES[code] ? _(LANGUAGE_NAMES[code]) : code}
              </span>
              <span className="flex items-center gap-3">
                <input
                  type="time"
                  value={times[code] ?? "13:00"}
                  onChange={(e) => setTime(code, e.target.value)}
                  className="ff-input w-36 font-mono"
                  aria-label={_(msg`post time for ${code}`, { code })}
                />
                <span className="ff-mono text-[11px] text-ash">
                  {timeZone}
                </span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-sm text-ash">
          <Trans>
            Change the languages in the previous step. Each selected language gets
            its own run and its own cron.
          </Trans>
        </p>
      </div>

      {/* �� Timezone �� */}
      <div className="mb-6 max-w-2xl">
        <label className="ff-mono mb-2 block text-[11px] uppercase tracking-[0.2em] text-bone">
          <Trans>city or timezone</Trans>
        </label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={_(msg`Search cities or type a timezone.`)}
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
                  {z.city
                    ? z.zone
                    : z.group === "city"
                      ? _(msg`favourite city`)
                      : _(msg`timezone`)}
                </span>
              </button>
            );
          })}

          {options.length === 0 && (
            <p className="text-sm text-ash">
              <Trans>No match. Try a city name or an IANA zone.</Trans>
            </p>
          )}
        </div>
      </div>

      {/* ── Days ── */}
      <div className="mb-6 max-w-2xl">
        <label className="ff-mono mb-2 block text-[11px] uppercase tracking-[0.2em] text-bone">
          <Trans>days</Trans>
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
            ? _(msg`Every day.`)
            : days.length === 5 && days.every((d) => d >= 1 && d <= 5)
              ? _(msg`Every weekday you ticked.`)
              : _(msg`Every day you ticked.`)}
        </p>
      </div>

      {/* ── Gap ── */}
      <div className="mb-6 max-w-2xl">
        <label
          htmlFor="post-gap"
          className="ff-mono mb-2 block text-[11px] uppercase tracking-[0.2em] text-bone"
        >
          <Trans>minutes between posts</Trans>
        </label>
        <input
          id="post-gap"
          type="number"
          min="1"
          max="60"
          value={gapMinutes}
          onChange={(e) => setGapMinutes(e.target.value)}
          className="ff-input max-w-32"
        />
        <p className="mt-2 text-sm text-ash">
          <Trans>Only used when both languages are set to the same time.</Trans>
        </p>
      </div>

      {previewError && (
        <div className="panel mb-6 border-crimson p-4 text-crimson">{previewError}</div>
      )}

      {/* ── Result ── */}
      {preview && (
        <div className="panel mb-6 border-acid p-4">
          <p className="ff-mono text-[11px] uppercase tracking-[0.2em] text-acid">
            <Trans>the bot will post at</Trans>
          </p>

          <div className="mt-3 space-y-4">
            {preview.languages.map((code) => {
              const runs = preview.runs.filter((run) => run.language === code);
              return (
                <div key={code}>
                  <p className="font-mono text-sm text-bone">
                    {LANGUAGE_NAMES[code]
                      ? _(LANGUAGE_NAMES[code])
                      : (runs[0]?.languageName ?? code)}{" "}
                    <span className="text-ash">
                      <Trans>at {times[code]}</Trans>
                    </span>
                  </p>
                  <ul className="mt-1 space-y-1">
                    {runs.map((run) => {
                      const { day, time } = splitRun(run.local);
                      return (
                        <li key={run.utc} className="font-mono text-sm text-ash">
                          <span className="text-ash">{day},</span> {time}
                          <span className="ml-2 text-[11px]">
                            ({run.cron} UTC)
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          {preview.warnings.map((warning) => (
            <p key={warning} className="mt-3 text-sm text-cyan">
              {warning}
            </p>
          ))}

          <p className="mt-3 text-sm text-ash">
            <Trans>
              GitHub can delay a scheduled run by a few minutes under load, so treat
              these as the earliest they post rather than exact minutes.
            </Trans>
          </p>
        </div>
      )}

      {/* Bonus: industry consensus on good posting times (2026) */}
      <div className="mb-6 panel border-edge p-4">
        <p className="ff-mono mb-2 text-[11px] uppercase tracking-[0.2em] text-primary">
          <Trans>good posting times (2026 consensus)</Trans>
        </p>
        <ul className="space-y-1 text-sm text-ash">
          <li>
            <Trans>
              <span className="font-mono text-acid">Best days:</span> Tuesday,
              Wednesday and Thursday - Wednesday often ranks highest. Weekends are
              usually weakest for professional content.
            </Trans>
          </li>
          <li>
            <Trans>
              <span className="font-mono text-acid">Best hours:</span> broadly 9
              AM-5 PM in your audience's local time. Studies cluster around
              mid-to-late morning (9-11/12 AM or 10 AM-2 PM), with strong
              late-afternoon/early-evening performance (3-8 PM) too.
            </Trans>
          </li>
          <li>
            <Trans>
              <span className="font-mono text-acid">Note:</span> exact peaks vary
              by study and audience - treat this as a starting point and test it.
            </Trans>
          </li>
        </ul>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={apply}
          disabled={busy || !preview}
          className="btn btn-acid"
        >
          {busy ? <Trans>Working…</Trans> : <Trans>Update the workflow</Trans>}
        </button>
      </div>

      {applied && (
        <div className="panel mb-6 border-acid p-4 text-acid">
          {applied.message}
          <p className="mt-2 text-sm text-ash">
            <Trans>
              The change is in your working copy. Commit and push it for the new
              schedule to take effect:
            </Trans>
          </p>
          <div className="mt-3">
            <CopyBlock code={`git add ${meta?.workflowPath ?? ".github/workflows/linkedin-post.yml"} post.config.json\ngit commit -m "chore: change the post schedule"\ngit push`} />
          </div>
        </div>
      )}

      {meta?.current?.length > 0 && (
        <div className="text-sm text-ash">
          <Trans>Currently committed as</Trans>{" "}
          {meta.current.map((cron) => (
            <code key={cron} className="mr-2 font-mono text-primary">
              cron: "{cron}"
            </code>
          ))}
          {preview &&
            preview.languages.every((code) =>
              meta.current.includes(preview.crons[code])
            ) &&
            <Trans> — that matches what you picked.</Trans>}
        </div>
      )}
    </section>
  );
}
