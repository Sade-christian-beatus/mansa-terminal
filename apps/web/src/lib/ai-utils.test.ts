import { describe, it, expect } from "vitest";
import { getErrorMessage } from "@/lib/ai-utils";

describe("getErrorMessage", () => {
  it("mappe les codes HTTP connus vers un message FR + code", () => {
    expect(getErrorMessage(new Error("Request failed with status 401"))).toEqual({
      message: "Session expirée. Veuillez vous reconnecter.",
      code: 401,
    });
    expect(getErrorMessage(new Error("403 Forbidden")).code).toBe(403);
    expect(getErrorMessage(new Error("429 Too Many Requests")).code).toBe(429);
    expect(getErrorMessage(new Error("422 Unprocessable")).code).toBe(422);
    expect(getErrorMessage(new Error("500 Server Error")).code).toBe(500);
  });

  it("traite les erreurs réseau avec le code 0", () => {
    expect(getErrorMessage(new Error("Failed to fetch")).code).toBe(0);
    expect(getErrorMessage(new Error("NetworkError when attempting")).code).toBe(0);
    expect(getErrorMessage(new Error("connect ECONNREFUSED 127.0.0.1")).code).toBe(0);
  });

  it("retombe sur un message générique (sans code) pour l'inconnu", () => {
    const r = getErrorMessage(new Error("quelque chose d'imprévu"));
    expect(r.code).toBeUndefined();
    expect(r.message).toMatch(/erreur inattendue/i);
  });

  it("accepte une valeur non-Error (string)", () => {
    expect(getErrorMessage("401").code).toBe(401);
    expect(getErrorMessage(null).message).toMatch(/erreur inattendue/i);
  });
});
