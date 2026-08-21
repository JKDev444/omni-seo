"use client";

import { useState, type ReactNode } from "react";

export interface FilterableRow {
  key: string;
  cells: ReactNode[];
  // Plain string to match search against — computed by the caller
  // (a Server Component) since functions can't cross the server/client
  // boundary, only data and already-rendered JSX can.
  searchText: string;
  numericCols?: number[]; // column indexes that should get the "num" (right-aligned) class
}

/**
 * Client-side search/filter for the biggest tables in the app (backlink
 * gap: 150 rows, keywords: 117, all-inspected-pages: 182+) — scrolling
 * through that many rows to find one thing was the single most obvious
 * usability gap. Filters client-side against already-fetched data, no
 * extra round-trip.
 *
 * Takes pre-rendered cells and a precomputed search string per row,
 * rather than accessor functions — Server Components can pass data and
 * JSX to a Client Component, but not functions (confirmed by actually
 * running the first version of this against real data, not caught by
 * typecheck).
 */
export function FilterableTable({
  headers,
  rows,
  searchPlaceholder = "Search…",
}: {
  headers: string[];
  rows: FilterableRow[];
  searchPlaceholder?: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const filtered = q ? rows.filter((row) => row.searchText.toLowerCase().includes(q)) : rows;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="table-search-input"
        />
        <span style={{ fontSize: "var(--text-sm)", color: "var(--color-ink-muted)" }}>
          {filtered.length} of {rows.length}
        </span>
      </div>
      <table className="table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr key={row.key}>
              {row.cells.map((cell, i) => (
                <td key={i} className={row.numericCols?.includes(i) ? "num" : undefined}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && <p className="empty-state">No rows match &quot;{query}&quot;.</p>}
    </div>
  );
}
