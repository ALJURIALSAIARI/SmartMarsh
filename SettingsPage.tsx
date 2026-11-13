import { useState } from "react";
import {
  SlidersHorizontal,
  Truck,
  Fuel,
  Save,
  RotateCcw,
  ShieldCheck,
  Info,
  FlaskConical,
  Check,
} from "lucide-react";
import { Badge, Button, Panel } from "./components";
import { DEFAULTS, LIMITS, type Settings } from "./simulation";

const fields: { key: keyof Settings; label: string; unit: string; help: string; step: number }[] = [
  {
    key: "trucks",
    label: "Number of trucks",
    unit: "trucks",
    help: "Total trucks in each paired experiment.",
    step: 1,
  },
  {
    key: "gates",
    label: "Service gates",
    unit: "gates",
    help: "Identical parallel gates in both modes.",
    step: 1,
  },
  {
    key: "serviceMean",
    label: "Mean service duration",
    unit: "min",
    help: "Seeded uniform sample: 60–140% of this mean.",
    step: 0.1,
  },
  {
    key: "arrivalInterval",
    label: "Mean arrival interval",
    unit: "min",
    help: "Seeded exponential interarrival times; first arrival at 0.",
    step: 0.05,
  },
  {
    key: "travelTime",
    label: "Travel time to gate",
    unit: "min",
    help: "Same in both modes. Moving time never counts as idle.",
    step: 0.05,
  },
  {
    key: "checkInTime",
    label: "Check-in duration",
    unit: "min",
    help: "Parallel check-in; engine remains on in both modes.",
    step: 0.1,
  },
  {
    key: "seed",
    label: "Random seed",
    unit: "integer",
    help: "Reproduce the exact same arrival and service samples.",
    step: 1,
  },
  {
    key: "speed",
    label: "Playback speed",
    unit: "×",
    help: "1× = 1 simulated minute per real second. Results unchanged.",
    step: 0.5,
  },
  {
    key: "idleRate",
    label: "Diesel idle consumption",
    unit: "L/h",
    help: "Applied only to stationary engine-on minutes.",
    step: 0.1,
  },
  {
    key: "co2Factor",
    label: "Diesel CO₂ factor",
    unit: "kg/L",
    help: "Tank-to-wheel CO₂ for idling diesel only.",
    step: 0.01,
  },
];
export default function SettingsPage({
  settings,
  onApply,
}: {
  settings: Settings;
  onApply: (s: Settings) => void;
}) {
  const [draft, setDraft] = useState(
    () =>
      Object.fromEntries(Object.entries(settings).map(([k, v]) => [k, String(v)])) as Record<
        keyof Settings,
        string
      >,
  );
  const [submitted, setSubmitted] = useState(false);
  const errors = Object.fromEntries(
    fields.map((f) => {
      const v = Number(draft[f.key]),
        [min, max] = LIMITS[f.key];
      return [
        f.key,
        draft[f.key].trim() === "" ||
        !Number.isFinite(v) ||
        v < min ||
        v > max ||
        (["trucks", "gates", "seed"].includes(f.key) && !Number.isInteger(v))
          ? `Enter ${f.step === 1 ? "a whole number" : "a number"} from ${min} to ${max}.`
          : "",
      ];
    }),
  ) as Record<keyof Settings, string>;
  const changed = fields.some((f) => Number(draft[f.key]) !== settings[f.key]);
  function save(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    onApply(
      Object.fromEntries(fields.map((f) => [f.key, Number(draft[f.key])])) as unknown as Settings,
    );
    setSubmitted(false);
  }
  const input = (keys: (keyof Settings)[]) => (
    <div className="settings-fields">
      {fields
        .filter((f) => keys.includes(f.key))
        .map((f) => (
          <label className="setting-field" key={f.key}>
            <span>{f.label}</span>
            <div className={`number-input ${submitted && errors[f.key] ? "invalid" : ""}`}>
              <input
                aria-label={f.label}
                type="number"
                min={LIMITS[f.key][0]}
                max={LIMITS[f.key][1]}
                step={f.step}
                value={draft[f.key]}
                onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
              />
              <span>{f.unit}</span>
            </div>
            <small className={submitted && errors[f.key] ? "error-text" : ""}>
              {submitted && errors[f.key] ? errors[f.key] : f.help}
            </small>
          </label>
        ))}
    </div>
  );
  const offered =
    Number(draft.arrivalInterval) > 0 && Number(draft.gates) > 0
      ? Number(draft.serviceMean) / (Number(draft.arrivalInterval) * Number(draft.gates))
      : 0;
  return (
    <form onSubmit={save} noValidate>
      <div className="settings-top">
        <div>
          <Badge tone={changed ? "amber" : "green"}>
            {changed ? "UNSAVED CHANGES" : "CONFIGURATION SAVED"}
          </Badge>
          <p>One configuration. Two operating modes. A fair, repeatable comparison.</p>
        </div>
        <Button
          icon={RotateCcw}
          onClick={() => {
            setDraft(
              Object.fromEntries(
                Object.entries(DEFAULTS).map(([k, v]) => [k, String(v)]),
              ) as Record<keyof Settings, string>,
            );
            setSubmitted(false);
          }}
          type="button"
        >
          Restore defaults
        </Button>
      </div>
      <div className="settings-layout">
        <div className="settings-panels">
          <Panel
            title="Terminal & demand"
            subtitle="Define the scale and congestion of your experiment."
            action={<Truck size={18} className="teal-text" />}
          >
            {input(["trucks", "gates", "serviceMean", "arrivalInterval"])}
          </Panel>
          <Panel
            title="Movement & reproducibility"
            subtitle="Shared assumptions for a controlled comparison."
            action={<SlidersHorizontal size={18} className="teal-text" />}
          >
            {input(["travelTime", "checkInTime", "seed", "speed"])}
          </Panel>
          <Panel
            title="Environmental factors"
            subtitle="Make every fuel and emissions calculation traceable."
            action={<Fuel size={18} className="teal-text" />}
          >
            {input(["idleRate", "co2Factor"])}
          </Panel>
        </div>
        <aside className="settings-aside">
          <div className="configuration-note">
            <FlaskConical size={25} />
            <span className="eyebrow">EXPERIMENT DESIGN</span>
            <h3>Congestion is where the difference becomes visible.</h3>
            <p>
              Offered service load is approximately{" "}
              <b>{Number.isFinite(offered) ? offered.toFixed(2) : "—"}×</b> capacity, before travel
              and notification delay.
            </p>
            <div className="load-meter">
              <div style={{ width: `${Math.min(100, offered * 50)}%` }} />
            </div>
            <small>
              {offered > 1
                ? "Demand exceeds service capacity; a waiting queue is expected."
                : "Demand is below service capacity; queues may still form due to randomness."}
            </small>
          </div>
          <div className="assumption-card">
            <ShieldCheck size={21} />
            <h3>Comparison integrity</h3>
            <ul>
              <li>
                <Check size={10} />
                Identical seeded arrival times
              </li>
              <li>
                <Check size={10} />
                Identical per-truck service durations
              </li>
              <li>
                <Check size={10} />
                Identical gate count & travel time
              </li>
              <li>
                <Check size={10} />
                Exclusive gate reservation
              </li>
              <li>
                <Check size={10} />
                Speed affects playback, never results
              </li>
            </ul>
          </div>
          <div className="settings-info">
            <Info size={17} />
            <p>
              SmartMarsh includes a fixed <b>6-second</b> call-forward reaction while the engine is
              off. Engines are off during service in both modes. No driving fuel is modeled.
            </p>
          </div>
        </aside>
      </div>
      <div className="settings-save">
        <div>
          <ShieldCheck size={18} />
          <span>
            Saved locally in this browser.
            <small>
              Applying changes resets both simulation timelines. No external data is sent.
            </small>
          </span>
        </div>
        <Button variant="primary" icon={Save} type="submit">
          Save & apply settings
        </Button>
      </div>
    </form>
  );
}
