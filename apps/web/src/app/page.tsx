"use client";

import { MacroTable } from "@/components/macro-table/MacroTable";

export default function DashboardPage() {
  return (
    <div className="space-y-5 animate-fade-in">
      {/* En-tête de page */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Dashboard macroéconomique
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Analyse des 54 économies africaines · FMI World Economic Outlook · Banque Mondiale WDI
        </p>
      </div>

      {/* Module Macroeconomic Table — vue unique du dashboard */}
      <MacroTable />
    </div>
  );
}
