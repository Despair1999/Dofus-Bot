import { useEffect, useState, useRef } from "react";
import { Hammer, Sparkles, Sprout, BookOpen } from "lucide-react";
import { api, type Config } from "../client";
import { request, message } from "../v2/shared/request";
export const professionGroup = (id: number) =>
  [2, 24, 26, 28, 36, 41].includes(id)
    ? "Sammelberufe"
    : [44, 48, 62, 63, 64, 74, 75].includes(id)
      ? "Magierberufe"
      : [78, 79].includes(id)
        ? "Weitere Berufe"
        : "Handwerksberufe";
export default function ProfessionLevels({
  config,
  characterId,
  revision = 0,
  onChange,
}: {
  config: Config;
  characterId: string;
  revision?: number;
  onChange?: () => void;
}) {
  const generation = useRef(0);
  const [jobs, setJobs] = useState<{ id: number; name: string }[]>([]),
    [levels, setLevels] = useState<{ jobId: number; level: number }[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    generation.current++;
    setBusy(false);
    setLevels([]);
    setError("");
    const c = new AbortController();
    void Promise.all([
      request<typeof jobs>("/api/professions", config, c.signal),
      request<{ levels: typeof levels }>(
        `/api/profession-personal/${characterId}`,
        config,
        c.signal,
      ),
    ])
      .then(([j, p]) => {
        if (!c.signal.aborted) {
          setJobs(j.data);
          setLevels(p.data.levels);
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(message(e));
      });
    return () => c.abort();
  }, [config, characterId, revision]);
  async function save(jobId: number, value: string) {
    const revision = generation.current;
    const level = value === "" ? null : Number(value);
    if (
      level !== null &&
      (!Number.isInteger(level) || level < 1 || level > 200)
    ) {
      setError("Berufsstufen müssen ganze Zahlen von 1 bis 200 sein.");
      return;
    }
    setBusy(true);
    try {
      await api(
        `/api/profession-personal/${characterId}/levels`,
        config,
        { jobId, level },
        "PUT",
      );
      if (revision !== generation.current) return;
      setLevels((p) => [
        ...p.filter((x) => x.jobId !== jobId),
        ...(level === null ? [] : [{ jobId, level }]),
      ]);
      setError("");
      onChange?.();
    } catch (e) {
      if (revision === generation.current) setError(message(e));
    } finally {
      if (revision === generation.current) setBusy(false);
    }
  }
  return (
    <details className="panel profession-manager">
      <summary>
        Alle Berufe verwalten <span>{levels.length} erfasst</span>
      </summary>
      {error && <p role="alert">{error}</p>}
      {[
        "Sammelberufe",
        "Handwerksberufe",
        "Magierberufe",
        "Weitere Berufe",
      ].map((group) => (
        <section key={group}>
          <h3>{group}</h3>
          <div className="profession-editor-grid">
            {jobs
              .filter((j) => professionGroup(j.id) === group)
              .map((j) => {
                const Icon =
                  group === "Sammelberufe"
                    ? Sprout
                    : group === "Magierberufe"
                      ? Sparkles
                      : group === "Handwerksberufe"
                        ? Hammer
                        : BookOpen;
                return (
                  <label
                    key={`${characterId}-${j.id}-${levels.find((l) => l.jobId === j.id)?.level}`}
                  >
                    <span>
                      <Icon size={17} />
                      {j.name}
                    </span>
                    <input
                      aria-label={`${j.name} Berufslevel`}
                      type="number"
                      min={1}
                      max={200}
                      step={1}
                      disabled={busy}
                      placeholder="Unbekannt"
                      defaultValue={
                        levels.find((l) => l.jobId === j.id)?.level ?? ""
                      }
                      onBlur={(e) => {
                        if (
                          e.target.value !==
                          String(
                            levels.find((l) => l.jobId === j.id)?.level ?? "",
                          )
                        )
                          void save(j.id, e.target.value);
                      }}
                    />
                  </label>
                );
              })}
          </div>
        </section>
      ))}
    </details>
  );
}
