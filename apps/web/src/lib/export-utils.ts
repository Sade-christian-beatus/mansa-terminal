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

/**
 * Export PDF — Template branded MANSA avec mise en page professionnelle.
 * Ouvre une fenêtre dédiée optimisée pour l'impression / Save as PDF.
 * Supporte jusqu'à 500 lignes, headers lisibles, pied de page MANSA.
 */
export function exportPDF(
  title: string,
  subtitle: string,
  rows: ExportRow[],
  _filename: string
) {
  const headers   = rows.length ? Object.keys(rows[0]) : [];
  const exportDate = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  // Identifier les colonnes numériques pour l'alignement
  const numericCols = new Set<string>(
    headers.filter((h) => {
      const vals = rows.slice(0, 10).map((r) => r[h]);
      return vals.some((v) => v != null && !isNaN(Number(v)));
    })
  );

  const tableRows = rows
    .slice(0, 500)
    .map((r, i) =>
      `<tr class="${i % 2 === 0 ? "even" : ""}">
        ${headers.map((h) => {
          const v = r[h] ?? "";
          const isNum = numericCols.has(h) && v !== "" && !isNaN(Number(v));
          return `<td class="${isNum ? "num" : ""}">${isNum ? Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 4 }) : v}</td>`;
        }).join("")}
      </tr>`
    ).join("");

  const rowCount = rows.length;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${title} — MANSA Terminal</title>
  <style>
    @page { size: A4 landscape; margin: 12mm 14mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: "Helvetica Neue", Arial, sans-serif;
      font-size: 9px;
      color: #1a1a2e;
      background: #fff;
      padding: 0;
    }

    /* ── En-tête ── */
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      border-bottom: 2px solid #00D4AA;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .header-left { flex: 1; }
    .brand {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.05em;
      color: #00D4AA;
      text-transform: uppercase;
    }
    .brand span { color: #1a1a2e; }
    h1 {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 3px;
      line-height: 1.2;
    }
    .subtitle {
      font-size: 9px;
      color: #64748b;
      margin-top: 3px;
    }
    .header-right {
      text-align: right;
      font-size: 8px;
      color: #94a3b8;
      line-height: 1.6;
    }
    .header-right strong { color: #475569; font-size: 9px; }

    /* ── Badges méta ── */
    .meta-row {
      display: flex;
      gap: 8px;
      margin-bottom: 10px;
      flex-wrap: wrap;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 7px;
      border-radius: 20px;
      font-size: 8px;
      font-weight: 600;
      letter-spacing: 0.03em;
    }
    .badge-green  { background: #dcfdf7; color: #065f46; }
    .badge-blue   { background: #dbeafe; color: #1e40af; }
    .badge-gray   { background: #f1f5f9; color: #475569; }

    /* ── Tableau ── */
    table {
      border-collapse: collapse;
      width: 100%;
      table-layout: auto;
    }
    thead tr {
      background: #0f172a;
    }
    th {
      padding: 5px 6px;
      text-align: left;
      font-size: 7.5px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #e2e8f0;
      white-space: nowrap;
    }
    th.num { text-align: right; }
    td {
      padding: 4px 6px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    td.num { text-align: right; font-variant-numeric: tabular-nums; }
    tr.even td { background: #f8fafc; }
    tr:hover td { background: #f0fdf9; }

    /* ── Pied de page ── */
    .footer {
      margin-top: 14px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .footer-left { font-size: 7.5px; color: #94a3b8; line-height: 1.5; }
    .footer-right { font-size: 7.5px; color: #94a3b8; text-align: right; }
    .footer-right strong { color: #00D4AA; }

    /* ── Print media ── */
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }

    /* ── Bouton impression (non imprimé) ── */
    .print-btn {
      no-print: true;
      display: block;
      margin: 0 auto 14px;
      padding: 8px 24px;
      background: #00D4AA;
      color: #000;
      border: none;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      letter-spacing: 0.04em;
    }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">⬇ Imprimer / Enregistrer en PDF</button>

  <div class="header">
    <div class="header-left">
      <div class="brand">MANSA<span> Terminal</span></div>
      <h1>${title}</h1>
      <div class="subtitle">${subtitle}</div>
    </div>
    <div class="header-right">
      <strong>Exporté le</strong><br/>
      ${exportDate}<br/>
      <br/>
      <strong>${rowCount.toLocaleString("fr-FR")}</strong> lignes
    </div>
  </div>

  <div class="meta-row">
    <span class="badge badge-green">✓ MANSA Terminal</span>
    <span class="badge badge-blue">📊 ${rowCount.toLocaleString("fr-FR")} enregistrements</span>
    <span class="badge badge-gray">Sources : FMI WEO · Banque Mondiale WDI · ECB</span>
    <span class="badge badge-gray">Confidentiel — Usage interne</span>
  </div>

  <table>
    <thead>
      <tr>
        ${headers.map((h) => `<th class="${numericCols.has(h) ? "num" : ""}">${h.replace(/_/g, " ")}</th>`).join("")}
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  <div class="footer">
    <div class="footer-left">
      Sources des données : Fonds Monétaire International (WEO), Banque Mondiale (WDI),<br/>
      Banque Centrale Européenne (ECB via Frankfurter), FAO, ILO, EM-DAT, UN Comtrade, NASA VIIRS.<br/>
      Les données peuvent ne pas être à jour en temps réel. Vérifiez les sources officielles pour les décisions d'investissement.
    </div>
    <div class="footer-right">
      <strong>mansa.ai</strong><br/>
      Africa's AI-Powered Macro Intelligence<br/>
      © ${new Date().getFullYear()} MANSA Terminal
    </div>
  </div>
</body>
</html>`;

  const w = window.open("", "_blank", "width=1100,height=800");
  if (w) {
    w.document.write(html);
    w.document.close();
    w.focus();
    // Auto-print après chargement complet
    w.addEventListener("load", () => setTimeout(() => w.print(), 400));
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
