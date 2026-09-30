/**
 * Catálogo dos quadros do painel. O id é estável: é usado nas preferências
 * de cada usuário e nas sugestões do agente de IA.
 */
import type { ComponentType } from "react";
import RegistrosHoje from "./RegistrosHoje";
import AlertasEscalas from "./AlertasEscalas";
import AlertasProntuarios from "./AlertasProntuarios";
import AlertasProntuariosAtraso from "./AlertasProntuariosAtraso";
import AlertasMedicamentos from "./AlertasMedicamentos";
import { AlertasFraldas } from "./AlertasFraldas";
import AlertasContasPagar from "./AlertasContasPagar";
import AlertasContratosResidentes from "./AlertasContratosResidentes";
import MonitoramentoPonto from "./MonitoramentoPonto";

export type GrupoQuadro = "critico" | "operacao" | "gestao";

export interface QuadroPainel {
  id: string;
  titulo: string;
  grupo: GrupoQuadro;
  /** Ocupa a linha inteira (listas longas). */
  largo?: boolean;
  Componente: ComponentType;
}

export const GRUPOS: Record<GrupoQuadro, string> = {
  critico: "Pendências que exigem ação",
  operacao: "Operação do dia",
  gestao: "Gestão",
};

export const QUADROS: QuadroPainel[] = [
  { id: "ponto", titulo: "Monitoramento do ponto", grupo: "critico", largo: true, Componente: MonitoramentoPonto },
  { id: "prontuarios_pendencias", titulo: "Pendências do prontuário", grupo: "critico", largo: true, Componente: AlertasProntuariosAtraso as ComponentType },
  { id: "medicamentos", titulo: "Medicamentos", grupo: "critico", Componente: AlertasMedicamentos },
  { id: "prontuarios_hoje", titulo: "Prontuários de hoje", grupo: "operacao", Componente: AlertasProntuarios },
  { id: "registros_hoje", titulo: "Registros de ponto de hoje", grupo: "operacao", Componente: RegistrosHoje },
  { id: "fraldas", titulo: "Estoque de fraldas", grupo: "operacao", Componente: AlertasFraldas },
  { id: "escalas", titulo: "Escalas", grupo: "operacao", Componente: AlertasEscalas },
  { id: "contas_pagar", titulo: "Contas a pagar", grupo: "gestao", Componente: AlertasContasPagar },
  { id: "contratos", titulo: "Contratos de residentes", grupo: "gestao", Componente: AlertasContratosResidentes },
];

export const IDS_QUADROS = QUADROS.map((q) => q.id);

export interface PreferenciasPainel {
  ordem: string[];
  ocultos: string[];
}

/**
 * Aplica as preferências: ordem salva primeiro, quadros novos ao final,
 * ids desconhecidos descartados e ocultos removidos.
 */
export function aplicarPreferencias(pref: PreferenciasPainel | null, catalogo = QUADROS): QuadroPainel[] {
  const porId = new Map(catalogo.map((q) => [q.id, q]));
  const ordem = [...(pref?.ordem || []).filter((id) => porId.has(id)), ...catalogo.map((q) => q.id)];
  const unicos = [...new Set(ordem)];
  const ocultos = new Set(pref?.ocultos || []);
  return unicos.filter((id) => !ocultos.has(id)).map((id) => porId.get(id)!);
}

/** Aplica uma sugestão do agente sobre as preferências atuais. */
export function aplicarSugestao(
  pref: PreferenciasPainel,
  s: { tipo: "adicionar" | "remover" | "reordenar"; quadro: string; posicao?: number | null },
): PreferenciasPainel {
  if (!IDS_QUADROS.includes(s.quadro)) return pref;
  const ordemBase = aplicarPreferencias({ ordem: pref.ordem, ocultos: [] }).map((q) => q.id);
  if (s.tipo === "remover") return { ordem: ordemBase, ocultos: [...new Set([...pref.ocultos, s.quadro])] };
  const ocultos = pref.ocultos.filter((id) => id !== s.quadro);
  if (s.tipo === "adicionar" && s.posicao == null) return { ordem: ordemBase, ocultos };
  const sem = ordemBase.filter((id) => id !== s.quadro);
  const pos = Math.max(0, Math.min(sem.length, s.posicao ?? 0));
  sem.splice(pos, 0, s.quadro);
  return { ordem: sem, ocultos };
}
