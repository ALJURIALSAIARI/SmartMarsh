import { useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  GitCompareArrows,
  Truck as TruckIcon,
  CircleCheck,
  Leaf,
  Clock3,
  Radio,
  Smartphone,
  ArrowRight,
  Check,
  BellRing,
  Power,
  Maximize2,
  Minimize2,
  Activity,
  ChevronDown,
} from "lucide-react";
import { Badge, Button, Kpi, Panel } from "./components";
import PortScene from "./PortScene";
import smartMarshLogo from "./assets/smartmarsh-logo.jpg";
import EventLog from "./EventLog";
import {
  clock,
  fixed,
  gateAt,
  metrics,
  stateAt,
  type DriverAcknowledgment,
  type Run,
  type Mode,
} from "./simulation";

interface Props {
  run: Run;
  traditional: Run;
  time: number;
  running: boolean;
  started: boolean;
  mode: Mode;
  onMode: (mode: Mode) => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onCompare: () => void;
  onSpeed: (speed: number) => void;
  onSettings: () => void;
  onSeek: (time: number) => void;
  acknowledgments: readonly DriverAcknowledgment[];
  onAcknowledge: (truck: number) => void;
  notify: (message: string) => void;
}
export default function SimulationView(p: Props) {
  const [selected, setSelected] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const m = metrics(p.run, p.time);
  const baseline = metrics(p.traditional, p.time);
  const truck = p.run.trucks.find((t) => t.id === selected) ?? p.run.trucks[0];
  const state = stateAt(truck, p.time, p.mode);
  const ack = p.acknowledgments.find(
    (a) => a.mode === p.mode && a.truck === truck.id && a.time <= p.time,
  );
  const dispatched = ["CALLED FORWARD", "MOVING"].includes(state);
  const notified = dispatched || state === "SERVICE";
  const finished = p.time >= p.run.duration;
  return (
    <>
      <div className="simulation-toolbar">
        <div className="mode-toggle" aria-label="Operating mode">
          <button className={p.mode === "smart" ? "active" : ""} onClick={() => p.onMode("smart")}>
            <img
              className="mode-logo"
              src={smartMarshLogo}
              alt=""
              aria-hidden="true"
              width={18}
              height={18}
            />
            SmartMarsh
          </button>
          <button
            className={p.mode === "traditional" ? "active" : ""}
            onClick={() => p.onMode("traditional")}
          >
            Traditional
          </button>
        </div>
        <div className="toolbar-context">
          <span>
            Seed <b>{p.run.settings.seed}</b>
          </span>
          <i />
          <span>{p.run.settings.trucks} trucks</span>
          <i />
          <span>{p.run.settings.gates} gates</span>
          <button onClick={p.onSettings}>
            Configure <ChevronDown size={12} />
          </button>
        </div>
        <Button icon={GitCompareArrows} onClick={p.onCompare}>
          Run paired comparison
        </Button>
      </div>
      <div className="kpi-grid simulation-kpis">
        <Kpi
          title="Trucks arrived"
          value={m.arrived}
          unit={`/ ${p.run.settings.trucks}`}
          icon={TruckIcon}
          detail="Seeded terminal arrivals"
          accent="blue"
        />
        <Kpi
          title="Completed trips"
          value={m.completed}
          unit="trucks"
          icon={CircleCheck}
          detail={
            m.horizon > 0
              ? `${fixed(m.throughput)} trucks / hour`
              : "Throughput available after clock starts"
          }
          accent="green"
        />
        <Kpi
          title="Engine-on idling"
          value={fixed(m.idle)}
          unit="min"
          icon={Clock3}
          detail="Stationary time only · travel excluded"
          accent="amber"
        />
        <Kpi
          title="CO₂ avoided"
          value={fixed(Math.max(0, baseline.co2 - m.co2), 2)}
          unit="kg"
          icon={Leaf}
          detail="Against Traditional at this timestamp"
          accent="teal"
        />
      </div>
      <div className={`simulation-layout ${expanded ? "expanded-scene" : ""}`}>
        <Panel
          title="Live terminal simulation"
          subtitle="Event-driven movement. Every truck, every gate, in sync."
          className="scene-panel"
          action={
            <div className="scene-heading-actions">
              <Badge tone={p.running ? "green" : "gray"}>
                {p.running ? "LIVE" : finished ? "COMPLETE" : p.started ? "PAUSED" : "READY"}
              </Badge>
              <button
                className="icon-button"
                aria-label={expanded ? "Collapse terminal" : "Expand terminal"}
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            </div>
          }
        >
          <div className="scene-wrap">
            <PortScene run={p.run} time={p.time} selected={truck.id} onSelect={setSelected} />
            <div className="scene-time">
              <span className={p.running ? "live-dot" : "paused-dot"} />
              <span>SIMULATION TIME</span>
              <strong>{clock(p.time)}</strong>
            </div>
            <div className="scene-mode">
              {p.mode === "smart" ? <Power size={12} /> : <Activity size={12} />}
              {p.mode === "smart" ? "Engine-off marshalling" : "Engine-on gate queue"}
            </div>
          </div>
          <div className="scene-legend">
            <span>
              <i style={{ background: "#009c9a" }} />
              Staged / engine off
            </span>
            <span>
              <i style={{ background: "#d49a52" }} />
              Engine on
            </span>
            <span>
              <i style={{ background: "#3389c0" }} />
              Called / moving
            </span>
            <span>
              <i style={{ background: "#537d91" }} />
              In service
            </span>
            <span className="legend-hint">Select a truck to inspect</span>
          </div>
          <div className="playback">
            <Button
              variant="primary"
              icon={p.running ? Pause : Play}
              onClick={p.running ? p.onPause : p.onStart}
            >
              {p.running
                ? "Pause"
                : finished
                  ? "Run again"
                  : p.started
                    ? "Resume"
                    : "Start simulation"}
            </Button>
            <button
              className="icon-button reset-button"
              aria-label="Reset simulation"
              title="Reset simulation"
              onClick={p.onReset}
            >
              <RotateCcw size={17} />
            </button>
            <div className="timeline">
              <input
                aria-label="Simulation timeline"
                type="range"
                min="0"
                max={p.run.duration}
                step="any"
                value={Math.min(p.time, p.run.duration)}
                onChange={(e) => p.onSeek(Number(e.target.value))}
                style={
                  {
                    "--progress": `${Math.min(100, (p.time / p.run.duration) * 100)}%`,
                  } as React.CSSProperties
                }
              />
              <div>
                <span>{clock(p.time)}</span>
                <span>{clock(p.run.duration)}</span>
              </div>
            </div>
            <label className="speed-select">
              <span>Speed</span>
              <select
                aria-label="Playback speed"
                value={p.run.settings.speed}
                onChange={(e) => p.onSpeed(Number(e.target.value))}
              >
                {[
                  0.5,
                  1,
                  2,
                  5,
                  10,
                  20,
                  ...(![0.5, 1, 2, 5, 10, 20].includes(p.run.settings.speed)
                    ? [p.run.settings.speed]
                    : []),
                ].map((s) => (
                  <option key={s} value={s}>
                    {s}×
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Panel>
        <div className="simulation-rail">
          <Panel
            title="Gate monitor"
            subtitle="Supervisor view"
            action={<Radio size={16} className="teal-text" />}
            className="gate-panel"
          >
            <div className="gate-list">
              {Array.from({ length: p.run.settings.gates }, (_, gate) => {
                const g = gateAt(p.run, gate, p.time);
                return (
                  <div className="gate-row" key={gate}>
                    <div className={`gate-symbol ${g.status.toLowerCase()}`}>
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className="gate-name">
                      <strong>Gate {String(gate + 1).padStart(2, "0")}</strong>
                      <small>
                        {g.truck
                          ? `T${g.truck.id} · ${g.status === "BUSY" ? `${fixed(g.truck.serviceEnd - p.time)} min left` : "En route to gate"}`
                          : "Ready for next truck"}
                      </small>
                    </div>
                    <Badge
                      tone={
                        g.status === "BUSY" ? "teal" : g.status === "RESERVED" ? "amber" : "green"
                      }
                    >
                      {g.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
            <div className="gate-summary">
              <span>
                <i />
                Exclusive gate reservation
              </span>
              <Check size={13} />
            </div>
          </Panel>
          <Panel
            title="Driver mobile preview"
            action={<Smartphone size={16} className="muted" />}
            className="driver-panel"
          >
            <div className="driver-top">
              <div className="driver-truck-icon">
                <TruckIcon size={20} />
              </div>
              <div>
                <label htmlFor="driver-select">DRIVER ASSIGNMENT</label>
                <select
                  id="driver-select"
                  value={truck.id}
                  onChange={(e) => setSelected(Number(e.target.value))}
                >
                  {p.run.trucks.map((t) => (
                    <option value={t.id} key={t.id}>
                      Truck T{t.id}
                    </option>
                  ))}
                </select>
              </div>
              <span className="online-dot" />
            </div>
            <div className={`driver-message ${dispatched ? "dispatch" : ""}`}>
              {dispatched ? (
                <BellRing size={22} />
              ) : state === "COMPLETED" ? (
                <CircleCheck size={23} />
              ) : (
                <Power size={23} />
              )}
              <strong>
                {dispatched
                  ? `GO TO GATE ${truck.gate + 1}`
                  : state === "SERVICE"
                    ? "Service in progress"
                    : state === "COMPLETED"
                      ? "Trip completed"
                      : state === "NOT ARRIVED"
                        ? "Awaiting arrival"
                        : state === "ARRIVED"
                          ? "Check in at terminal"
                          : p.mode === "smart"
                            ? "Switch your engine off"
                            : "Remain in the gate queue"}
              </strong>
              <p>
                {dispatched
                  ? `Gate G${truck.gate + 1} is reserved exclusively for you. Follow the marked terminal route.`
                  : state === "SERVICE"
                    ? `You are at gate G${truck.gate + 1}. Keep your engine off while service is completed.`
                    : state === "COMPLETED"
                      ? "Service finished. Thank you for keeping the terminal moving."
                      : state === "NOT ARRIVED"
                        ? `Scheduled arrival at ${clock(truck.arrival)}. Your trip has not started.`
                        : state === "ARRIVED"
                          ? "Complete check-in. Staging instructions will follow."
                          : p.mode === "smart"
                            ? `Park in staging bay ${String(truck.id).padStart(2, "0")}. We’ll notify you when a gate is ready.`
                            : "Your engine remains on while waiting. Proceed when a gate is assigned."}
              </p>
            </div>
            <button
              className="driver-ack"
              disabled={!notified || Boolean(ack)}
              onClick={() => p.onAcknowledge(truck.id)}
            >
              {ack ? (
                <>
                  <Check size={14} />
                  Notification acknowledged
                </>
              ) : notified ? (
                <>
                  <Check size={14} />
                  Acknowledge notification
                </>
              ) : (
                <>
                  <Clock3 size={14} />
                  {state === "COMPLETED" ? "Journey finished" : "Waiting for dispatch"}
                </>
              )}
            </button>
            {ack && (
              <p className="driver-ack-time">
                Acknowledged at {clock(ack.time)} · G{ack.gate + 1}
              </p>
            )}
            <p className="driver-note">
              Preview acknowledgment only;{" "}
              {p.mode === "smart"
                ? "modeled response is 6 seconds."
                : "Traditional dispatch has no response delay."}
            </p>
          </Panel>
        </div>
      </div>
      <div className="bottom-grid">
        <EventLog
          run={p.run}
          time={p.time}
          selected={truck.id}
          onSelect={setSelected}
          acknowledgments={p.acknowledgments}
          notify={p.notify}
        />
        <div className="model-note">
          <div className="note-icon">
            <Leaf size={21} />
          </div>
          <span className="eyebrow">A SMARTER WAY TO WAIT</span>
          <h3>
            Less idling.
            <br />
            Same engineering rigor.
          </h3>
          <p>
            SmartMarsh replaces engine-on gate queues with engine-off staging and event-driven,
            first-come-first-served dispatch.
          </p>
          <button onClick={p.onCompare}>
            Explore the paired results <ArrowRight size={15} />
          </button>
          <div className="note-footer">
            <Check size={13} /> Identical arrivals & service requirements
          </div>
        </div>
      </div>
    </>
  );
}
