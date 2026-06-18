import { describe, it, expect } from "vitest";
import {
  alertToSignal, eventToSignal, API_SEVERITY,
  type MacroAlert, type ConflictEvent,
} from "@/lib/signals-data";

const alert = (over: Partial<MacroAlert> = {}): MacroAlert => ({
  id: "x1", country_name: "Nigeria", flag: "🇳🇬",
  indicator_label: "Inflation", value: 32.5, unit: "%",
  severity: "critical", message: "Inflation tres elevee", period: "2024", ...over,
});

const event = (over: Partial<ConflictEvent> = {}): ConflictEvent => ({
  country_id: "SDN", name: "Soudan", flag: "🇸🇩", region: "East Africa",
  events_2024: 14820, fatalities_2024: 18500, trend: "increasing",
  risk_level: "critical", ...over,
});

describe("alertToSignal", () => {
  it("mappe les champs et prefixe l'id", () => {
    const s = alertToSignal(alert());
    expect(s.id).toBe("macro-x1");
    expect(s.type).toBe("economic");
    expect(s.country).toBe("Nigeria");
    expect(s.value).toBe("32.5 %");
    expect(s.date).toBe("2024");
  });

  it("formate la valeur sans unite quand unit est vide", () => {
    expect(alertToSignal(alert({ unit: "" })).value).toBe("32.5");
  });

  it("applique le repli drapeau quand flag manque", () => {
    expect(alertToSignal(alert({ flag: "" })).flag).toBe("🌍");
  });

  it("traduit la severite API (critical->high, high->medium, medium->low)", () => {
    expect(alertToSignal(alert({ severity: "critical" })).severity).toBe("high");
    expect(alertToSignal(alert({ severity: "high" })).severity).toBe("medium");
    expect(alertToSignal(alert({ severity: "medium" })).severity).toBe("low");
    expect(alertToSignal(alert({ severity: "inconnu" })).severity).toBe("low");
  });
});

describe("eventToSignal", () => {
  it("deduit le signe du changement a partir de la tendance", () => {
    expect(eventToSignal(event({ trend: "increasing" })).change).toBe(1);
    expect(eventToSignal(event({ trend: "decreasing" })).change).toBe(-1);
    expect(eventToSignal(event({ trend: "stable" })).change).toBe(0);
  });

  it("formate la valeur avec le nombre d'evenements et prefixe acled", () => {
    const s = eventToSignal(event());
    expect(s.id).toBe("acled-SDN");
    expect(s.type).toBe("conflict");
    expect(s.value.replace(/\D/g, "")).toBe("14820");
    expect(s.value.trimEnd().endsWith(".")).toBe(true);
  });

  it("genere une description de repli quand notes est absent", () => {
    const s = eventToSignal(event({ notes: undefined }));
    expect(s.desc).toMatch(/violents/);
    expect(s.desc).toMatch(/\(2024\)/);
  });

  it("utilise notes comme description quand fournie", () => {
    expect(eventToSignal(event({ notes: "Guerre civile" })).desc).toBe("Guerre civile");
  });
});

describe("API_SEVERITY", () => {
  it("couvre les 4 niveaux API", () => {
    expect(API_SEVERITY).toMatchObject({
      critical: "high", high: "medium", medium: "low", low: "low",
    });
  });
});
