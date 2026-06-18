import { describe, it, expect } from "vitest";
import {
  oilShockCompute, fedRateCompute, droughtSahelCompute, type CountryBase,
} from "@/lib/scenarios";

const exporter: CountryBase = {
  name: "Nigeria", flag: "🇳🇬", region: "Ouest",
  growth: 3, inflation: 20, debt: 46, oil_exporter: true, agri_pct: 24, ext_debt_usd: 42,
};
const importer: CountryBase = {
  ...exporter, name: "Kenya", oil_exporter: false, agri_pct: 22, ext_debt_usd: 39,
};

describe("oilShockCompute", () => {
  it("hausse du brut : positif pour exportateur, negatif pour importateur", () => {
    const exp = oilShockCompute(exporter, { oil_pct: 20 });
    const imp = oilShockCompute(importer, { oil_pct: 20 });
    expect(exp.growthDelta).toBeGreaterThan(0);
    expect(imp.growthDelta).toBeLessThan(0);
    expect(exp.inflationDelta).toBeLessThan(0);
    expect(imp.inflationDelta).toBeGreaterThan(0);
    expect(exp.debtDelta).toBe(0);
  });

  it("un choc nul ne bouge pas la croissance", () => {
    expect(oilShockCompute(importer, { oil_pct: 0 }).growthDelta).toBe(0);
  });
});

describe("fedRateCompute", () => {
  it("hausse des taux : croissance en baisse, dette externe en hausse", () => {
    const r = fedRateCompute(importer, { bps: 100 });
    expect(r.growthDelta).toBeLessThan(0);
    expect(r.inflationDelta).toBeGreaterThan(0);
    expect(r.debtDelta).toBeGreaterThan(0);
  });

  it("l'impact dette croit avec la dette externe", () => {
    const low = fedRateCompute({ ...importer, ext_debt_usd: 10 }, { bps: 100 });
    const high = fedRateCompute({ ...importer, ext_debt_usd: 200 }, { bps: 100 });
    expect(high.debtDelta).toBeGreaterThan(low.debtDelta);
  });
});

describe("droughtSahelCompute", () => {
  it("secheresse : croissance en baisse, inflation et dette en hausse", () => {
    const r = droughtSahelCompute(importer, { agri_loss_pct: 20 });
    expect(r.growthDelta).toBeLessThan(0);
    expect(r.inflationDelta).toBeGreaterThan(0);
    expect(r.debtDelta).toBeGreaterThan(0);
  });

  it("aucun effet sans agriculture (agri_pct = 0)", () => {
    const r = droughtSahelCompute({ ...importer, agri_pct: 0 }, { agri_loss_pct: 50 });
    expect(r.growthDelta).toBe(0);
    expect(r.inflationDelta).toBe(0);
    expect(r.debtDelta).toBe(0);
  });

  it("l'impact croit avec la dependance agricole", () => {
    const lo = droughtSahelCompute({ ...importer, agri_pct: 10 }, { agri_loss_pct: 20 });
    const hi = droughtSahelCompute({ ...importer, agri_pct: 40 }, { agri_loss_pct: 20 });
    expect(Math.abs(hi.growthDelta)).toBeGreaterThan(Math.abs(lo.growthDelta));
  });
});
