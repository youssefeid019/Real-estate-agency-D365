"use client";

import Link from "next/link";
import { useState } from "react";
import type { CaseReport } from "@/lib/cycles";
import { api, errorMessage } from "@/lib/client";
import { CaseProgress } from "../components/case-progress";
import { SearchIcon } from "../components/icons";

// Look up a report's progress
export function TrackReport({ initialCase }: { initialCase: string }) {
  const [caseNumber, setCaseNumber] = useState(initialCase);
  const [email, setEmail] = useState("");
  const [report, setReport] = useState<CaseReport>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  // Fetch the report
  async function load() {
    setPending(true);
    setError(undefined);
    try {
      setReport(
        await api<CaseReport>(`/api/cases/${encodeURIComponent(caseNumber.trim().toUpperCase())}`, {
          headers: { "X-Customer-Email": email.trim() },
        }),
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (report)
    return (
      <div className="manage-layout">
        <CaseProgress report={report} />
        <div className="button-row center">
          <button type="button" className="button ghost" onClick={load} disabled={pending}>
            {pending ? "Refreshing…" : "Refresh"}
          </button>
          <button type="button" className="button ghost" onClick={() => setReport(undefined)}>
            Track another
          </button>
        </div>
      </div>
    );

  return (
    <form
      className="lookup-card"
      onSubmit={(e) => {
        e.preventDefault();
        load();
      }}
    >
      <span className="lookup-icon">
        <SearchIcon size={22} />
      </span>
      <h2>Find your report</h2>
      <p className="muted">Use the case number from your confirmation and the email you reported with.</p>
      <div className="form-grid">
        <label>
          Case number
          <input
            required
            className="mono"
            placeholder="CAS-01234-ABC123"
            spellCheck={false}
            value={caseNumber}
            onChange={(e) => setCaseNumber(e.target.value)}
          />
        </label>
        <label>
          Email
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
      </div>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <button className="button lg block" type="submit" disabled={pending}>
        {pending ? "Looking up…" : "Track report"}
      </button>
      <p className="hint">
        Need to report something? <Link href="/report">Report a problem</Link>
      </p>
    </form>
  );
}
