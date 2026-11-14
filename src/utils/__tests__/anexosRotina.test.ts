import { describe, expect, it } from "vitest";
import { dimensoesReduzidas, validarAnexo } from "../anexosRotina";
describe("anexos de rotina", () => {
  it("aceita foto e PDF até 10 MB", () => {
    expect(validarAnexo({ type: "image/jpeg", size: 1000 })).toBeNull();
    expect(validarAnexo({ type: "application/pdf", size: 10 * 1024 * 1024 })).toBeNull();
    expect(validarAnexo({ type: "application/pdf", size: 10 * 1024 * 1024 + 1 })).toBe("Arquivo acima de 10 MB");
    expect(validarAnexo({ type: "application/msword", size: 10 })).toBe("Use foto (JPG, PNG, WEBP) ou PDF");
  });
  it("reduz foto grande para 2000 px no maior lado", () => {
    expect(dimensoesReduzidas(4000, 3000)).toEqual({ w: 2000, h: 1500 });
    expect(dimensoesReduzidas(800, 600)).toEqual({ w: 800, h: 600 });
  });
});
