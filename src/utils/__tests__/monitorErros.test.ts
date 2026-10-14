import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { moduloDaRota, ehRuido, deveReportar, assinaturaErro } from "../monitorErros";

describe("monitor de erros", () => {
  it("identifica o módulo pela tela", () => {
    expect(moduloDaRota("/financeiro")).toBe("Financeiro");
    expect(moduloDaRota("/prontuario/123")).toBe("Prontuário");
    expect(moduloDaRota("/relatorios-ia")).toBe("Relatórios com IA");
    expect(moduloDaRota("/relatorios")).toBe("Relatórios");
    expect(moduloDaRota("/qualquer")).toBe("Geral");
  });
  it("ignora ruídos de navegador", () => {
    expect(ehRuido("ResizeObserver loop limit exceeded")).toBe(true);
    expect(ehRuido("Cannot read properties of undefined")).toBe(false);
  });
  it("não repete o mesmo erro em 10 minutos", () => {
    const mapa = new Map<string, number>();
    const k = assinaturaErro("Financeiro", "Erro 500 no id 42");
    expect(assinaturaErro("Financeiro", "Erro 500 no id 77")).toBe(k);
    expect(deveReportar(k, 0, mapa)).toBe(true);
    expect(deveReportar(k, 5 * 60_000, mapa)).toBe(false);
    expect(deveReportar(k, 11 * 60_000, mapa)).toBe(true);
  });
});
