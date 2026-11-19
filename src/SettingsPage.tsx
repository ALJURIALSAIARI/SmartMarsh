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
import {
  ARRIVALS,
  SERVICE_DURATIONS,
  INITIAL_RELEASES,
  DEFAULTS,
  LIMITS,
  validSettings,
  type Settings,
} from "./simulation";

const fields = [
  {
    key: "speed",
    label: "Playback speed",
    unit: "×",
    step: 0.5,
    help: "1× = 1 simulated minute per real second. Results unchanged.",
  },
  {
    key: "idleRate",
    label: "Diesel idle consumption",
    unit: "L/h",
    step: 0.1,
    help: "Applied only to stationary engine-on minutes.",
  },
  {
    key: "co2Factor",
    label: "Diesel CO₂ factor",
    unit: "kg/L",
    step: 0.01,
    help: "Tank-to-wheel CO₂ for stationary idling only.",
  },
] as const;

export default function SettingsPage({
  settings,
  onApply,
}: {
  settings: Settings;
  onApply: (s: Settings) => void;
}) {
  const [draft, setDraft] = useState(() => ({
    speed: String(settings.speed),
    idleRate: String(settings.idleRate),
    co2Factor: String(settings.co2Factor),
  }));
  const [submitted, setSubmitted] = useState(false);
  const errors = Object.fromEntries(
    fields.map((f) => {
      const n = Number(draft[f.key]),
        [min, max] = LIMITS[f.key];
      return [
        f.key,
        !draft[f.key].trim() || !Number.isFinite(n) || n < min || n > max
          ? `Enter a number from ${min} to ${max}.`
          : "",
      ];
    }),
  );
  const changed = fields.some((f) => Number(draft[f.key]) !== settings[f.key]);
  const input = (keys: string[]) => (
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
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
        if (Object.values(errors).some(Boolean)) return;
        onApply(
          validSettings(Object.fromEntries(fields.map((f) => [f.key, Number(draft[f.key])]))),
        );
        setSubmitted(false);
      }}
    >
      <div className="settings-top">
        <div>
          <Badge tone={changed ? "amber" : "green"}>
            {changed ? "UNSAVED CHANGES" : "CONFIGURATION SAVED"}
          </Badge>
          <p>Fixed appendix model. Two policies. One reproducible comparison.</p>
        </div>
        <Button
          icon={RotateCcw}
          type="button"
          onClick={() => {
            setDraft({
              speed: String(DEFAULTS.speed),
              idleRate: String(DEFAULTS.idleRate),
              co2Factor: String(DEFAULTS.co2Factor),
            });
            setSubmitted(false);
          }}
        >
          Restore defaults
        </Button>
      </div>
      <div className="settings-layout">
        <div className="settings-panels">
          <Panel
            title="Terminal & demand"
            subtitle="Fixed model inputs · unchanged by saved browser settings or Reset."
            action={<Truck size={18} className="teal-text" />}
          >
            <div className="settings-fields">
              {[
                ["Number of trucks", "8", "T1–T8 only; earlier traffic is not a tracked truck."],
                ["Service gates", "2", "G1 and G2 only."],
                [
                  "Arrival times (min)",
                  ARRIVALS.join(", "),
                  "Identical fixed arrivals in both modes.",
                ],
                [
                  "Service durations (min)",
                  SERVICE_DURATIONS.join(", "),
                  "Identical truck-specific durations in both modes.",
                ],
              ].map(([label, value, help]) => (
                <label className="setting-field" key={label}>
                  <span>{label}</span>
                  <div className="number-input">
                    <input aria-label={label} value={value} readOnly />
                  </div>
                  <small>{help}</small>
                </label>
              ))}
            </div>
          </Panel>
          <Panel
            title="Movement & playback"
            subtitle="Model timing is fixed; speed affects playback only."
            action={<SlidersHorizontal size={18} className="teal-text" />}
          >
            {input(["speed"])}
            <div className="data-equations">
              <p>
                Initial gate release: G1 at {INITIAL_RELEASES[0]} min; G2 at {INITIAL_RELEASES[1]}{" "}
                min. Both gates begin Busy with earlier traffic.
              </p>
              <p>
                Traditional: eligible at arrival; stationary engine-on wait until call; 1 min travel
                to the gate.
              </p>
              <p>
                SmartMarsh: 1 min moving to staging; engine-off wait; 0.5 min engine-off
                acknowledgement; 0.5 min stationary engine-on preparation; 2 min travel.
              </p>
            </div>
          </Panel>
          <Panel
            title="Environmental factors"
            subtitle="These assumptions change fuel and CO₂, never the truck schedule."
            action={<Fuel size={18} className="teal-text" />}
          >
            {input(["idleRate", "co2Factor"])}
          </Panel>
        </div>
        <aside className="settings-aside">
          <div className="configuration-note">
            <FlaskConical size={25} />
            <span className="eyebrow">EXPERIMENT DESIGN</span>
            <h3>One fixed model, a fair comparison.</h3>
            <p>
              All arrivals, services and policy timings come from the appendix. Reset always replays
              the same eight journeys per mode.
            </p>
          </div>
          <div className="assumption-card">
            <ShieldCheck size={21} />
            <h3>Comparison integrity</h3>
            <ul>
              {[
                "Identical arrivals and service durations",
                "Eight trucks and two gates",
                "FCFS; input order breaks truck ties",
                "G1 wins when both gates are free",
                "Exclusive reservation until completion",
                "Shared utilization window includes initial service",
              ].map((s) => (
                <li key={s}>
                  <Check size={10} />
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="settings-info">
            <Info size={17} />
            <p>
              Stationary engine-on time excludes staging travel, gate travel, engine-off waiting,
              acknowledgement and service. Only preparation counts for SmartMarsh.
            </p>
          </div>
        </aside>
      </div>
      <div className="settings-save">
        <div>
          <ShieldCheck size={18} />
          <span>
            Playback and environmental factors saved locally.
            <small>Applying changes resets playback; the appendix schedule never changes.</small>
          </span>
        </div>
        <Button variant="primary" icon={Save} type="submit">
          Save & apply settings
        </Button>
      </div>
    </form>
  );
}
