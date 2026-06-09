/**
 * MANSA Terminal — Export utilities
 * Supports CSV, JSON, XLSX (via SheetJS-style approach with raw CSV), PDF summary
 */

export type ExportFormat = "csv" | "json" | "xlsx" | "pdf";

export interface ExportRow {
  [key: string]: string | number | null | undefined;
}

/** Download a text file in the browser */
function downloadText(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Escape a CSV cell value */
function csvCell(val: string | number | null | undefined): string {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Export rows as CSV */
export function exportCSV(rows: ExportRow[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines   = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(",")),
  ];
  downloadText(lines.join("\n"), `${filename}.csv`, "text/csv;charset=utf-8;");
}

/** Export rows as JSON */
export function exportJSON(rows: ExportRow[], filename: string) {
  downloadText(
    JSON.stringify(rows, null, 2),
    `${filename}.json`,
    "application/json"
  );
}

/**
 * Export as XLSX — uses a simple CSV with .xlsx extension for basic Excel compat.
 * For full XLSX support, install xlsx package and replace this.
 */
export function exportXLSX(rows: ExportRow[], filename: string) {
  // If SheetJS (xlsx) is available, use it
  if (typeof window !== "undefined" && (window as unknown as Record<string, unknown>).XLSX) {
    const XLSX = (window as unknown as Record<string, unknown>).XLSX as {
      utils: { json_to_sheet: (r: ExportRow[]) => unknown; book_new: () => unknown; book_append_sheet: (wb: unknown, ws: unknown, name: string) => void };
      writeFile: (wb: unknown, name: string) => void;
    };
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${filename}.xlsx`);
    return;
  }
  // Fallback: CSV with .xlsx extension (opens fine in Excel)
  exportCSV(rows, filename);
}

/** Export as a simple text-based PDF summary via print dialog */
export function exportPDF(
  title: string,
  subtitle: string,
  rows: ExportRow[],
  _filename: string
) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const tableRows = rows
    .slice(0, 200)
    .map(
      (r) =>
        `<tr>${headers.map((h) => `<td>${r[h] ?? ""}</td>`).join("")}</tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11px; padding: 20px; }
    h1 { font-size: 16px; margin-bottom: 4px; }
    p  { color: #666; margin-bottom: 16px; font-size: 11px; }
    table { border-collapse: collapse; width: 100%; }
    th { background: #0A0E1A; color: white; padding: 6px 8px; text-align: left; font-size: 10px; }
    td { border-bottom: 1px solid #eee; padding: 5px 8px; }
    tr:nth-child(even) td { background: #f9f9f9; }
    .footer { margin-top: 24px; color: #999; font-size: 9px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>${subtitle} — Exporté le ${new Date().toLocaleDateString("fr-FR")}</p>
  <table>
    <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="footer">Source : MANSA Terminal · mansa.ai · Données : IMF, World Bank, WHO, ILO, FAO, EM-DAT, EIA, UN Comtrade, NASA VIIRS</div>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
  }
}

/** Master export dispatcher */
export function exportData(
  rows: ExportRow[],
  format: ExportFormat,
  filename: string,
  title = "MANSA Terminal Export",
  subtitle = "Macro-fiscal data for African economies"
) {
  switch (format) {
    case "csv":  return exportCSV(rows, filename);
    case "json": return exportJSON(rows, filename);
    case "xlsx": return exportXLSX(rows, filename);
    case "pdf":  return exportPDF(title, subtitle, rows, filename);
  }
}

/** Flatten macro indicator API response to exportable rows */
export function flattenIndicators(
  data: Array<{
    country_id?: string;
    indicator_code?: string;
    indicator_name?: string;
    value?: number | null;
    unit?: string;
    period?: string;
    source?: string;
  }>
): ExportRow[] {
  return data.map((d) => ({
    country: d.country_id ?? "",
    indicator_code: d.indicator_code ?? "",
    indicator_name: d.indicator_name ?? "",
    value: d.value ?? null,
    unit: d.unit ?? "",
    period: d.period ?? "",
    source: d.source ?? "",
  }));
}
