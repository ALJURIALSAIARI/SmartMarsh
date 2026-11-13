import { useEffect, useState } from "react";
import { ArrowDownToLine, ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Panel } from "./components";
import { downloadCsv } from "./csv";
import { clock, type DriverAcknowledgment, type Run } from "./simulation";

const PAGE_SIZE = 20;
const categories: Record<string, readonly string[]> = {
  arrivals: ["ARRIVED"],
  waiting: ["CHECKED IN", "WAIT ENGINE OFF", "WAIT ENGINE ON"],
  dispatch: ["CALLED FORWARD", "MOVING"],
  service: ["AT GATE", "SERVICE"],
  completed: ["COMPLETED"],
  acknowledged: ["ACKNOWLEDGED"],
};

export default function EventLog({
  run,
  time,
  selected,
  onSelect,
  acknowledgments,
  notify,
}: {
  run: Run;
  time: number;
  selected: number;
  onSelect: (truck: number) => void;
  acknowledgments: readonly DriverAcknowledgment[];
  notify: (message: string) => void;
}) {
  const [scope, setScope] = useState("all");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(0);
  const recorded = [
    ...run.events
      .filter((e) => e.time <= time)
      .map((e) => ({
        ...e,
        key: `simulation-${e.seq}`,
        source: "SIMULATION" as const,
      })),
    ...acknowledgments
      .filter((a) => a.mode === run.mode && a.time <= time)
      .map((a, index) => ({
        time: a.time,
        truck: a.truck,
        gate: a.gate,
        state: "ACKNOWLEDGED",
        message: `Driver acknowledged GO TO GATE G${a.gate + 1} · preview only`,
        seq: run.events.length + index,
        key: `acknowledgment-${a.mode}-${a.truck}`,
        source: "DRIVER PREVIEW" as const,
      })),
  ].sort((a, b) => b.time - a.time || b.seq - a.seq);
  const filtered = recorded.filter(
    (e) =>
      (scope === "all" || e.truck === selected) &&
      (category === "all" || categories[category].includes(e.state)),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  useEffect(() => {
    setPage(0);
  }, [scope, category, scope === "selected" ? selected : null]);

  function exportEvents() {
    try {
      downloadCsv(
        `SmartMarsh-${run.mode}-events-seed${run.settings.seed}.csv`,
        ["time_min", "timestamp", "mode", "truck", "gate", "state", "event", "seed", "source"],
        filtered.map((e) => [
          e.time,
          clock(e.time),
          run.mode === "smart" ? "SmartMarsh" : "Traditional",
          `T${e.truck}`,
          e.gate === undefined ? "" : `G${e.gate + 1}`,
          e.state,
          e.message,
          run.settings.seed,
          e.source,
        ]),
      );
      notify(`Event CSV exported · ${filtered.length} records`);
    } catch {
      notify("Event export could not be created. Please try again.");
    }
  }

  return (
    <Panel
      title="Live event log"
      subtitle={`${recorded.length} records · full history · newest first`}
      className="event-panel"
      action={
        <div className="event-actions">
          <select
            aria-label="Filter event log"
            className="small-select"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="all">All trucks</option>
            <option value="selected">Selected T{selected}</option>
          </select>
          <select
            aria-label="Filter event category"
            className="small-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">All events</option>
            <option value="arrivals">Arrivals</option>
            <option value="waiting">Check-in & waiting</option>
            <option value="dispatch">Dispatch & movement</option>
            <option value="service">At gate & service</option>
            <option value="completed">Completed</option>
            <option value="acknowledged">Driver acknowledgment</option>
          </select>
          <Button
            icon={ArrowDownToLine}
            onClick={exportEvents}
            disabled={!filtered.length}
            aria-label="Export event log CSV"
          >
            CSV
          </Button>
        </div>
      }
    >
      <div className="event-table">
        <div className="event-header">
          <span>TIME</span>
          <span>TRUCK</span>
          <span>EVENT</span>
        </div>
        {filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map((e) => (
          <div className="event-row" key={e.key} data-event-state={e.state}>
            <span className="mono">{clock(e.time)}</span>
            <button onClick={() => onSelect(e.truck)}>T{e.truck}</button>
            <span>
              <i
                className={`event-dot ${e.state === "COMPLETED" ? "green" : e.state === "CALLED FORWARD" ? "amber" : e.state === "ACKNOWLEDGED" ? "blue" : ""}`}
              />
              {e.message}
            </span>
          </div>
        ))}
        {!filtered.length && (
          <div className="empty-state">
            No recorded events match these filters at this timestamp.
          </div>
        )}
      </div>
      <div className="pagination event-pagination">
        <span>
          {filtered.length
            ? `${currentPage * PAGE_SIZE + 1}–${Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)}`
            : "0"}{" "}
          of {filtered.length} records
        </span>
        <div>
          <button
            aria-label="Previous event page"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            <ChevronLeft size={14} />
          </button>
          <span>
            {currentPage + 1} / {pages}
          </span>
          <button
            aria-label="Next event page"
            disabled={currentPage === pages - 1}
            onClick={() => setPage(currentPage + 1)}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </Panel>
  );
}
