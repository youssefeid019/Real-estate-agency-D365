import type { CaseReport } from "@/lib/cycles";
import { FacilityArt } from "./facility-art";
import { CalendarIcon, CheckIcon, WrenchIcon } from "./icons";

// Stages shown to the customer
const STAGES = [
  { name: "Report", label: "Reported", hint: "We've received your report." },
  { name: "Triage", label: "Triage", hint: "Our team is assessing it and deciding whether the facility must close." },
  { name: "Repair", label: "Repair", hint: "The fix is being carried out." },
  { name: "Resolve", label: "Resolved", hint: "Checked and closed." },
];

// Report progress stepper
export function CaseProgress({ report }: { report: CaseReport }) {
  const closed = report.stage === "Resolved" || report.stage === "Cancelled";
  const current = closed ? STAGES.length : Math.max(0, STAGES.findIndex((s) => s.name === report.stage));
  const d = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "long", year: "numeric" });

  return (
    <article className="ticket">
      <div className="ticket-art">
        <FacilityArt typeCode={report.facility?.typeCode ?? 0} muted={closed} />
        <span className={`pill ${report.stage === "Resolved" ? "ok" : report.stage === "Cancelled" ? "muted" : "warn"}`}>
          {report.stage === "Resolved" ? "Resolved" : report.stage === "Cancelled" ? "Cancelled" : "In progress"}
        </span>
      </div>
      <div className="ticket-body">
        <div>
          <div className="eyebrow">Case number</div>
          <div className="reference">{report.caseNumber}</div>
        </div>
        <h2 className="ticket-title">{report.title}</h2>
        <ul className="ticket-facts">
          <li>
            <WrenchIcon /> {report.facility?.name ?? "Facility"}
            {report.bookingReference && <span className="muted"> · booking {report.bookingReference}</span>}
          </li>
          <li>
            <CalendarIcon /> Reported {d(report.reportedOn)}
          </li>
        </ul>

        {report.facilityClosed && (
          <p className="alert warn compact">
            This facility is closed for bookings while it&apos;s fixed
            {report.expectedBackInService ? `, expected back in service ${d(report.expectedBackInService)}` : ""}.
          </p>
        )}

        <ol className={`stepper${report.stage === "Cancelled" ? " is-cancelled" : ""}`} aria-label="Progress">
          {STAGES.map((s, i) => {
            const state = i < current ? "done" : i === current ? "current" : "todo";
            return (
              <li key={s.name} className={`is-${state}`} aria-current={state === "current" ? "step" : undefined}>
                <span className="stepper-dot">{state === "done" ? <CheckIcon size={14} /> : i + 1}</span>
                <span className="stepper-text">
                  <strong>{s.label}</strong>
                  {state === "current" && <span className="muted small">{s.hint}</span>}
                </span>
              </li>
            );
          })}
        </ol>
        {report.stage === "Cancelled" && <p className="muted small">This report was closed without further action.</p>}
      </div>
    </article>
  );
}
