"use client";

import Link from "next/link";
import { useState } from "react";
import type { Facility } from "@/lib/bookings";
import { FacilityArt } from "./facility-art";
import { ArrowRightIcon, UsersIcon, WrenchIcon } from "./icons";

// Facility cards with a type filter
export function FacilityExplorer({ facilities }: { facilities: Facility[] }) {
  const types = Array.from(new Map(facilities.map((f) => [f.typeCode, f.type])).entries());
  const [filter, setFilter] = useState<number | "all">("all");
  const shown = filter === "all" ? facilities : facilities.filter((f) => f.typeCode === filter);

  return (
    <>
      <div className="chips filter" role="group" aria-label="Filter by type">
        <button type="button" className={`chip${filter === "all" ? " is-selected" : ""}`} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
          All <span className="count">{facilities.length}</span>
        </button>
        {types.map(([code, label]) => (
          <button
            key={code}
            type="button"
            className={`chip${filter === code ? " is-selected" : ""}`}
            aria-pressed={filter === code}
            onClick={() => setFilter(code)}
          >
            {label} <span className="count">{facilities.filter((f) => f.typeCode === code).length}</span>
          </button>
        ))}
      </div>

      <div className="facility-grid">
        {shown.map((f) => (
          <article key={f.code} className={`facility-card${f.bookable ? "" : " is-closed"}`}>
            <div className="facility-card-art">
              <FacilityArt typeCode={f.typeCode} muted={!f.bookable} />
              <span className={`pill ${f.bookable ? "ok" : "warn"}`}>
                {f.bookable ? "Available" : (
                  <>
                    <WrenchIcon size={12} /> {f.availability}
                  </>
                )}
              </span>
            </div>
            <div className="facility-card-body">
              <div className="eyebrow">{f.type}</div>
              <h3>{f.name}</h3>
              <div className="facility-meta">
                <span>
                  <UsersIcon size={15} /> Up to {f.capacity}
                </span>
              </div>
              <div className="facility-card-foot">
                <div className="price">
                  {f.hourlyRateFormatted}
                  <small>/hour</small>
                </div>
                {f.bookable ? (
                  <Link className="button sm" href={`/book?facility=${encodeURIComponent(f.code)}`} aria-label={`Book ${f.name}`}>
                    Book <ArrowRightIcon size={16} />
                  </Link>
                ) : (
                  <span className="muted small">Back soon</span>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
