// ── CSV export ──────────────────────────────────────────────────
// JSON (db.ts buildExport) is for backup/restore. CSV is for opening a
// clean, single-entity table in a spreadsheet — kept as separate per-entity
// files rather than one mixed-schema file, since that's what's actually
// useful to open and graph.
function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV<T extends object>(rows: T[], columns: (keyof T & string)[]): string {
  const header = columns.join(",");
  const body = rows.map((r) => columns.map((c) => csvEscape(r[c])).join(","));
  return [header, ...body].join("\n");
}

export function downloadCSV(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
