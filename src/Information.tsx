import {
  ArrowRight,
  Leaf,
  Timer,
  ShieldCheck,
  Printer,
  GitCompareArrows,
  CircleCheck,
  FlaskConical,
  Cpu,
  Route,
  GraduationCap,
  Info,
} from "lucide-react";
import { Badge, Button, Delta, Panel } from "./components";
import { ComparisonTable, ScopeNote, type PairProps } from "./Analytics";
import { fixed, metrics } from "./simulation";

export function Equations() {
  return (
    <div className="equation-grid">
      <div>
        <span>TURNAROUND</span>
        <code>service end − arrival</code>
        <p>Mean over completed trucks, in minutes.</p>
      </div>
      <div>
        <span>STATIONARY ENGINE-ON IDLE</span>
        <code>Traditional: call − arrival; SmartMarsh: depart − acknowledgement</code>
        <p>
          Traditional: stationary queue waiting. SmartMarsh: 0.5 min stationary preparation per
          truck. Travel, engine-off waiting, acknowledgement and service are excluded.
        </p>
      </div>
      <div>
        <span>IDLING DIESEL</span>
        <code>(idle minutes / 60) × L/h</code>
        <p>Sum over all trucks up to the snapshot.</p>
      </div>
      <div>
        <span>IDLING CO₂</span>
        <code>diesel liters × kg CO₂/L</code>
        <p>Idling tank-to-wheel CO₂ only, not whole-trip emissions.</p>
      </div>
      <div>
        <span>GATE UTILIZATION</span>
        <code>Σ service minutes / (gates × horizon) × 100</code>
        <p>
          Includes earlier traffic (4 + 6 gate-min). Both policies share the later completion
          window. Reservations and travel are not service.
        </p>
      </div>
      <div>
        <span>THROUGHPUT</span>
        <code>completed trucks / (horizon / 60)</code>
        <p>Horizon starts at first arrival (t = 0) and ends at the snapshot or final completion.</p>
      </div>
    </div>
  );
}
export function Results(p: PairProps) {
  const complete = p.time >= Math.max(p.smart.duration, p.traditional.duration);
  const a = metrics(p.traditional),
    b = metrics(p.smart);
  const saved = a.idle - b.idle;
  const reduction = a.idle > 0 ? (saved / a.idle) * 100 : 0;
  const turnaroundDelta = b.turnaround - a.turnaround;
  return (
    <>
      <ScopeNote {...p} />
      {!complete ? (
        <div className="results-empty">
          <div className="results-empty-icon">
            <FlaskConical size={32} />
          </div>
          <span className="eyebrow">EVIDENCE BEFORE CONCLUSIONS</span>
          <h2>Your experiment is ready.</h2>
          <p>
            Complete both modes with the same fixed inputs to generate a defensible environmental
            and operational assessment. No performance outcomes are assumed in advance.
          </p>
          <Button variant="primary" icon={GitCompareArrows} onClick={p.onCompare}>
            Run paired comparison
          </Button>
        </div>
      ) : (
        <>
          <div className="results-hero">
            <div>
              <Badge tone="green">SIMULATED · FIXED APPENDIX INPUTS</Badge>
              <h2>
                {saved > 0
                  ? `${fixed(reduction)}% Reduction in stationary engine-on time`
                  : "No idling reduction in this scenario."}
                <br />
                <span>A calculated model outcome, not measured port performance.</span>
              </h2>
              <p>
                {p.smart.settings.trucks} trucks · {p.smart.settings.gates} service gates ·
                identical fixed arrivals and service durations
              </p>
            </div>
            <Button icon={Printer} onClick={() => window.print()}>
              Print / save report
            </Button>
          </div>
          <div className="conclusion-grid">
            <div className="conclusion-card positive">
              <div className="conclusion-icon">
                <Leaf size={23} />
              </div>
              <span className="eyebrow">ENVIRONMENTAL OUTCOME</span>
              <h3>
                {fixed(a.co2 - b.co2, 2)} kg CO₂ {a.co2 >= b.co2 ? "avoided" : "additional"}
              </h3>
              <p>
                Engine-off staging {saved > 0 ? "removed" : "did not reduce"} {fixed(saved)}{" "}
                stationary idling minutes, equivalent to {fixed(a.fuel - b.fuel, 2)} liters of
                diesel under the configured idle assumptions.
              </p>
              <Delta before={a.idle} after={b.idle} />
            </div>
            <div className="conclusion-card tradeoff">
              <div className="conclusion-icon">
                <Timer size={23} />
              </div>
              <span className="eyebrow">OPERATIONAL TRADE-OFF</span>
              <h3>
                {turnaroundDelta >= 0 ? "+" : ""}
                {fixed(turnaroundDelta, 2)} min mean turnaround
              </h3>
              <p>
                {turnaroundDelta > 0.00001
                  ? "SmartMarsh is slower in this model. Staging travel, engine-off acknowledgement, preparation and the longer gate route delay service starts; reservations remain exclusive throughout."
                  : turnaroundDelta < -0.00001
                    ? "The modeled dispatch schedule produced a shorter mean turnaround in this scenario."
                    : "No difference in mean turnaround occurred in this scenario."}{" "}
                Waiting changed by {fixed(b.waiting - a.waiting, 2)} min.
              </p>
              <Delta before={a.turnaround} after={b.turnaround} />
            </div>
            <div className="conclusion-card">
              <div className="conclusion-icon">
                <ShieldCheck size={23} />
              </div>
              <span className="eyebrow">COMPARISON INTEGRITY</span>
              <h3>
                {a.completed} / {b.completed} trucks completed
              </h3>
              <p>
                Both experiments use the exact same fixed arrival times and service durations. No
                duplicate gate assignments. Driving time contributes zero idle minutes.
              </p>
              <span className="verified">
                <CircleCheck size={14} />
                Deterministic, reproducible results
              </span>
            </div>
          </div>
          <Panel
            title="What the results actually tell us"
            subtitle="Automatically generated from this completed paired experiment"
          >
            <div className="findings">
              <div>
                <span>01</span>
                <p>
                  <b>Idling is shifted, not waiting eliminated.</b> SmartMarsh trucks wait with
                  engines off. Mean waiting is {fixed(b.waiting)} min, compared with{" "}
                  {fixed(a.waiting)} min in Traditional. A reduction in idling does not imply a
                  reduction in waiting.
                </p>
              </div>
              <div>
                <span>02</span>
                <p>
                  <b>Gate readiness remains the dispatch constraint.</b> Gates are reserved only
                  when free. SmartMarsh service utilization is {fixed(b.utilization)}%, versus{" "}
                  {fixed(a.utilization)}% in Traditional; throughput is {fixed(b.throughput)} vs.{" "}
                  {fixed(a.throughput)} trucks/h. SmartMarsh does not create additional gate
                  capacity.
                </p>
              </div>
              <div>
                <span>03</span>
                <p>
                  <b>Environmental benefits are assumption-dependent.</b> At{" "}
                  {p.smart.settings.idleRate} L/h and {p.smart.settings.co2Factor} kg CO₂/L, this
                  run’s SmartMarsh idling emissions total {fixed(b.co2, 2)} kg. Changing fuel or
                  emission factors changes environmental estimates, never the fixed schedule.
                </p>
              </div>
            </div>
          </Panel>
          <Panel
            title="Final paired experiment results"
            subtitle="Both modes use the same window ending at the later completion; initial service is included."
          >
            <ComparisonTable {...p} />
            <div className="table-footnote">
              Eligible queue time excludes staging travel, acknowledgement, preparation, gate travel
              and service. Pre-service time ends at service start; turnaround ends at completion.
            </div>
          </Panel>
        </>
      )}
      <Panel
        title="Transparent calculations"
        subtitle="No static performance numbers. Every indicator traces back to event timestamps."
      >
        <Equations />
      </Panel>
      <div className="limitations">
        <Info size={20} />
        <div>
          <h3>Scope & limitations</h3>
          <p>
            This is a simplified finite-demand, parallel-gate model. It assumes unlimited staging,
            no overtaking, no breakdowns, engines off during service, 1 minute Traditional gate
            travel, and SmartMarsh timing of 1 minute to staging, 0.5 minute acknowledgement, 0.5
            minute preparation and 2 minutes gate travel. Road blocking, gate specialties,
            acceleration fuel, driving emissions, service emissions, real driver response and real
            port arrival patterns are not modeled. Savings are limited to stationary idling; they
            are not whole-port or whole-trip carbon savings.
          </p>
        </div>
      </div>
    </>
  );
}
export function About({ onSimulation }: { onSimulation: () => void }) {
  return (
    <>
      <section className="about-hero">
        <div className="about-copy">
          <span className="eyebrow">INDUSTRIAL ENGINEERING · DISCRETE-EVENT SIMULATION</span>
          <h2>
            Smarter staging.
            <br />
            <span>A clearer view of the impact.</span>
          </h2>
          <p>
            SmartMarsh explores a simple logistics question: what changes when port trucks wait in
            an engine-off staging area instead of an engine-on queue?
          </p>
          <Button variant="primary" icon={ArrowRight} onClick={onSimulation}>
            Explore the simulation
          </Button>
        </div>
        <div className="about-graphic" aria-hidden="true">
          <div className="graphic-ring ring-1" />
          <div className="graphic-ring ring-2" />
          <div className="graphic-center">
            <Route size={58} strokeWidth={1.2} />
          </div>
          <div className="graphic-chip chip-a">
            <Leaf size={19} />
            Engine-off staging
          </div>
          <div className="graphic-chip chip-b">
            <ShieldCheck size={19} />
            Exclusive dispatch
          </div>
          <div className="graphic-chip chip-c">
            <Cpu size={19} />
            Deterministic engine
          </div>
        </div>
      </section>
      <div className="about-cards">
        <div>
          <FlaskConical size={23} />
          <h3>A controlled experiment</h3>
          <p>
            Identical fixed arrivals and truck-specific service durations for eight trucks at two
            gates isolate the effects of policy-specific waiting, acknowledgement, preparation and
            travel.
          </p>
        </div>
        <div>
          <Cpu size={23} />
          <h3>A real event engine</h3>
          <p>
            A deterministic FCFS schedule records eligibility, calls, acknowledgements, movement and
            service. Dispatch atomically reserves gates until each service ends.
          </p>
        </div>
        <div>
          <GraduationCap size={23} />
          <h3>Built for engineering</h3>
          <p>
            Traceable metrics, exportable timestamps and truthful conclusions support a professional
            university presentation—not an unverified business case.
          </p>
        </div>
      </div>
      <div className="about-process">
        <span className="eyebrow">THE SMARTMARSH JOURNEY</span>
        <h2>From arrival to completion, every step is accounted for.</h2>
        <div className="process-steps">
          {[
            { label: "Arrive & check in", desc: "One minute travel to staging" },
            { label: "Stage & switch off", desc: "FCFS engine-off wait" },
            { label: "Reserve & notify", desc: "Free gate exclusively assigned" },
            { label: "Move & service", desc: "Travel excluded from idle" },
            { label: "Complete & release", desc: "Gate becomes available" },
          ].map((s, i) => (
            <div key={s.label}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <h3>{s.label}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
      <Panel
        title="The model, without the mystery"
        subtitle="Explicit assumptions make the comparison meaningful."
      >
        <div className="methodology">
          <div>
            <h3>Demand & service</h3>
            <p>
              T1–T8 arrive at [0, 1, 2, 4, 7, 8, 11, 14] minutes, with service durations [5, 6, 4,
              7, 5, 6, 4, 5]. Both modes reuse those exact inputs. G1 is initially busy until minute
              4 and G2 until minute 6; this earlier traffic counts toward utilization, not tracked
              truck totals.
            </p>
          </div>
          <div>
            <h3>Dispatch & engine policy</h3>
            <p>
              FCFS uses eligibility and input order; G1 wins gate ties. Traditional trucks are
              eligible at arrival, idle until called and travel 1 minute. SmartMarsh trucks travel 1
              minute to staging, wait with engines off, acknowledge 0.5 minute after the call,
              prepare stationary with engines on for 0.5 minute, then travel 2 minutes. A called
              gate remains reserved until service ends. Engines are off during service.
            </p>
          </div>
          <div>
            <h3>Local, reproducible, private</h3>
            <p>
              React, TypeScript, Tailwind CSS and Recharts run entirely in your browser. Only
              playback and environmental factors are persisted in localStorage. Fixed model inputs
              never change. Simulation records are held in memory and can be exported as CSV or
              native XLSX. No accounts, remote data or external services are required.
            </p>
          </div>
        </div>
      </Panel>
      <Panel
        title="Engineering definitions"
        subtitle="The equations used throughout the application"
      >
        <Equations />
      </Panel>
      <div className="limitations">
        <Info size={20} />
        <div>
          <h3>A simulation is not measured evidence</h3>
          <p>
            All arrival, service, fuel and emissions inputs are hypothetical assumptions. The
            terminal visualization is schematic and does not model physical traffic interactions.
            Real-world validation would require observed arrival patterns, measured engine
            consumption, driver behavior and site-specific gate operations.
          </p>
        </div>
      </div>
    </>
  );
}
