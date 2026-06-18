import { describe, it, expect } from "vitest";
import { sparklineSeries, averageSeries } from "@/lib/sparklines";

// Code + pays volontairement absents de demo-data → force le repli synthétique.
const FAKE_CODE = "XX_TEST_CODE";

describe("sparklineSeries", () => {
  it("retombe sur une série synthétique de 7 points finissant à la valeur courante", () => {
    const s = sparklineSeries(FAKE_CODE, "ZZ", 42);
    expect(s).toHaveLength(7);
    expect(s[s.length - 1]).toEqual({ year: "2024", value: 42 });
    expect(s.every((p) => typeof p.value === "number" && !Number.isNaN(p.value))).toBe(true);
  });

  it("est déterministe (mêmes entrées → même sortie)", () => {
    expect(sparklineSeries(FAKE_CODE, "ZZ", 42)).toEqual(sparklineSeries(FAKE_CODE, "ZZ", 42));
  });

  it("renvoie une série vide sans données réelles ni valeur courante", () => {
    expect(sparklineSeries(FAKE_CODE, "ZZ", null)).toEqual([]);
    expect(sparklineSeries(FAKE_CODE, "ZZ", NaN)).toEqual([]);
  });
});

describe("averageSeries", () => {
  it("moyenne année par année la dernière valeur de chaque pays", () => {
    const avg = averageSeries(FAKE_CODE, [
      { id: "ZZ", values: { [FAKE_CODE]: 10 } },
      { id: "YY", values: { [FAKE_CODE]: 20 } },
    ]);
    expect(avg).toHaveLength(7);
    // années triées croissant
    expect(avg.map((p) => p.year)).toEqual([...avg.map((p) => p.year)].sort());
    // dernière année = moyenne des valeurs courantes (point synthétique final = value)
    expect(avg[avg.length - 1]).toEqual({ year: "2024", value: 15 });
  });

  it("ignore les pays sans valeur exploitable", () => {
    const avg = averageSeries(FAKE_CODE, [
      { id: "ZZ", values: { [FAKE_CODE]: 30 } },
      { id: "YY", values: {} }, // pas de valeur → série vide, ignorée
    ]);
    expect(avg[avg.length - 1]).toEqual({ year: "2024", value: 30 });
  });
});
