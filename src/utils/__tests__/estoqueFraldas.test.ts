import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
import { chaveEstoqueFralda, mensagemEntradaEstoque, adicionarEstoqueFralda } from "../estoqueFraldas";

describe("estoqueFraldas", () => {
  it("normaliza marca na chave", () => {
    const a = chaveEstoqueFralda({ residente_id: "r", tipo_fralda: "Convencional", marca: " tena ", tamanho: "G" });
    const b = chaveEstoqueFralda({ residente_id: "r", tipo_fralda: "Convencional", marca: "TENA", tamanho: "G" });
    expect(a).toBe(b);
  });
  it("diferencia tamanho", () => {
    expect(chaveEstoqueFralda({ tipo_fralda: "X", tamanho: "G" })).not.toBe(chaveEstoqueFralda({ tipo_fralda: "X", tamanho: "M" }));
  });
  it("mensagem indica soma", () => {
    expect(mensagemEntradaEstoque({ id: "1", quantidade_atual: 30, somado: true }, 10)).toContain("total: 30");
  });
  it("recusa quantidade inválida", async () => {
    await expect(adicionarEstoqueFralda({ tenant_id: "t", residente_id: null, tipo_fralda: "X", tamanho: "G", quantidade: 0 })).rejects.toThrow();
  });
});
