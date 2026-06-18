import { describe, it, expect } from "vitest";
import { computeMeai, MEAI_COMPONENTS, type TableCountry } from "@/lib/meai";

const mk = (id: string, values: Record<string, number>): TableCountry =>
  ({ id, name: id, region: null, values });

describe("computeMeai — normalisation & pondération", () => {
  it("normalise la croissance dans le bon sens (haut = meilleur)", () => {
    const r = computeMeai([
      mk("HI", { NGDP_RPCH: 10 }),
      mk("LO", { NGDP_RPCH: 0 }),
    ]);
    expect(r.perCountry.get("HI")!.comps[0]).toBe(100);
    expect(r.perCountry.get("LO")!.comps[0]).toBe(0);
  });

  it("normalise l'inflation dans le bon sens (bas = meilleur)", () => {
    const r = computeMeai([
      mk("LOWINF", { PCPIPCH: 5 }),
      mk("HIGHINF", { PCPIPCH: 20 }),
    ]);
    expect(r.perCountry.get("LOWINF")!.comps[1]).toBe(100);
    expect(r.perCountry.get("HIGHINF")!.comps[1]).toBe(0);
  });

  it("attribue 50 (neutre) aux composantes sans indicateur disponible", () => {
    const r = computeMeai([mk("A", { NGDP_RPCH: 5 }), mk("B", { NGDP_RPCH: 1 })]);
    const govIdx = MEAI_COMPONENTS.findIndex((c) => c.subject === "Gouvernance");
    expect(r.perCountry.get("A")!.comps[govIdx]).toBe(50);
  });

  it("calcule un score pondéré et un global cohérents", () => {
    const r = computeMeai([
      mk("HI", { NGDP_RPCH: 10 }),
      mk("LO", { NGDP_RPCH: 0 }),
    ]);
    expect(r.perCountry.get("HI")!.score).toBeCloseTo(62.5, 5);
    expect(r.perCountry.get("LO")!.score).toBeCloseTo(37.5, 5);
    expect(r.global).toBeCloseTo(50, 5);
  });

  it("renvoie 50 (min==max -> t=0.5) quand un seul pays", () => {
    const r = computeMeai([mk("ONLY", { NGDP_RPCH: 7, PCPIPCH: 3 })]);
    expect(r.perCountry.get("ONLY")!.comps[0]).toBe(50);
    expect(r.global).toBeCloseTo(50, 5);
  });

  it("les poids des composantes somment a 1", () => {
    const total = MEAI_COMPONENTS.reduce((a, c) => a + c.weight, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});
