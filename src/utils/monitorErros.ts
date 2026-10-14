/**
 * Monitor de erros do SenexCare: identifica o módulo pelo endereço da tela,
 * filtra ruídos e evita repetir o mesmo aviso. Regras puras (testáveis);
 * o envio fica em `reportarErro`, que chama o agente de IA de suporte.
 */
import { supabase } from "@/integrations/supabase/client";

/** Prefixo de rota → nome do módulo (mais específico primeiro). */
const MODULOS: [string, string][] = [
  ["/funcionario-access", "Portal do colaborador"],
  ["/meus-", "Portal do colaborador"],
  ["/minha", "Portal do colaborador"],
  ["/funcionarios", "Funcionários"], ["/novo-funcionario", "Funcionários"],
  ["/editar-funcionario", "Funcionários"], ["/ficha-funcionario", "Funcionários"],
  ["/cargos", "Cargos e funções"],
  ["/registro-ponto", "Registro de ponto"], ["/apropriacao", "Apropriação de horas"],
  ["/escalas", "Escalas"], ["/faltas", "Faltas e afastamentos"],
  ["/advertencias", "Advertências e suspensões"], ["/analise-condutas", "Análise de condutas"],
  ["/contracheques", "Contracheques"], ["/financeiro", "Financeiro"],
  ["/residentes", "Residentes e contratos"], ["/contrato", "Residentes e contratos"],
  ["/ficha-acolhimento", "Residentes e contratos"],
  ["/prontuario", "Prontuário"], ["/supervisor-prontuarios", "Prontuário"],
  ["/controle-prontuarios", "Prontuário"],
  ["/controle-fraldas", "Fraldas"], ["/controle-medicamentos", "Medicamentos"],
  ["/administracao-medicamentos", "Medicamentos"],
  ["/controle-temperatura", "Temperatura"], ["/controle-vacinas", "Vacinas"],
  ["/intercorrencias", "Intercorrências"], ["/gestao-intercorrencias", "Intercorrências"],
  ["/painel-intercorrencias", "Intercorrências"],
  ["/historico-erros", "Histórico de erros"], ["/controle-assinaturas", "Controle de assinaturas"], ["/assinatura", "Assinaturas eletrônicas"], ["/documentos-internos", "Documentos internos"],
  ["/verificar-documento", "Verificação de documentos"],
  ["/relatorios-ia", "Relatórios com IA"], ["/relatorios", "Relatórios"],
  ["/whatsapp", "WhatsApp"], ["/notificacoes-whatsapp", "WhatsApp"],
  ["/gamificacao", "Gamificação"], ["/gestao-gamificacao", "Gamificação"],
  ["/configuracoes", "Configurações"], ["/feedback", "Feedback"],
  ["/admin-saas", "Administração SaaS"], ["/auth", "Login"],
  ["/dashboard", "Painel"],
];

export function moduloDaRota(caminho: string): string {
  const p = (caminho || "/").toLowerCase();
  const achado = MODULOS.find(([prefixo]) => p.startsWith(prefixo));
  return achado ? achado[1] : p === "/" ? "Painel" : "Geral";
}

/** Erros sem valor para o suporte (extensões, rede caída, cancelamentos, atualização de versão). */
const RUIDOS = [
  /ResizeObserver loop/i, /chrome-extension:/i, /moz-extension:/i,
  /AbortError/i, /The user aborted/i, /Script error\.?$/i,
  /Loading chunk \d+ failed/i, /Failed to fetch dynamically imported module/i,
  /NetworkError when attempting/i, /^Load failed$/i,
];

export function ehRuido(mensagem: string): boolean {
  const m = (mensagem || "").trim();
  return !m || RUIDOS.some((r) => r.test(m));
}

/** Assinatura usada para não reenviar o mesmo erro (remove números variáveis). */
export function assinaturaErro(modulo: string, mensagem: string): string {
  return `${modulo}|${mensagem.replace(/\d+/g, "#").slice(0, 200)}`;
}

const JANELA_MS = 10 * 60 * 1000;
const MAX_POR_SESSAO = 15;
const enviados = new Map<string, number>();
let total = 0;

/** Decide se o erro deve ser enviado agora (sem repetir em 10 min, máx. 15 por sessão). */
export function deveReportar(chave: string, agora = Date.now(), mapa = enviados): boolean {
  const ultimo = mapa.get(chave);
  if (ultimo !== undefined && agora - ultimo < JANELA_MS) return false;
  if (mapa.size >= MAX_POR_SESSAO && ultimo === undefined) return false;
  mapa.set(chave, agora);
  return true;
}

export interface ResultadoDiagnostico { diagnostico: string; sugestao: string; gravidade: string }

/** Envia o erro ao agente de suporte. Nunca lança exceção. */
export async function reportarErro(
  erro: unknown,
  extra: { tipo?: string; modulo?: string; contexto?: Record<string, unknown> } = {},
): Promise<ResultadoDiagnostico | null> {
  try {
    const e = erro instanceof Error ? erro : new Error(typeof erro === "string" ? erro : JSON.stringify(erro));
    const mensagem = e.message || String(erro);
    if (ehRuido(mensagem)) return null;
    const modulo = extra.modulo || moduloDaRota(window.location.pathname);
    if (!deveReportar(assinaturaErro(modulo, mensagem)) || total >= MAX_POR_SESSAO) return null;
    total++;
    const { data } = await supabase.functions.invoke("diagnosticar-erro", {
      body: {
        modulo, tipo: extra.tipo || "tela", mensagem: mensagem.slice(0, 2000),
        pilha: (e.stack || "").slice(0, 3000), rota: window.location.pathname,
        navegador: navigator.userAgent.slice(0, 300), contexto: extra.contexto ?? {},
      },
    });
    return (data as ResultadoDiagnostico) ?? null;
  } catch {
    return null;
  }
}

let instalado = false;
/** Captura erros não tratados de qualquer tela. Chamado uma vez na inicialização. */
export function instalarMonitorErros() {
  if (instalado || typeof window === "undefined") return;
  instalado = true;
  window.addEventListener("error", (ev) => {
    reportarErro(ev.error ?? ev.message, { tipo: "erro não tratado", contexto: { arquivo: ev.filename, linha: ev.lineno } });
  });
  window.addEventListener("unhandledrejection", (ev) => {
    reportarErro(ev.reason, { tipo: "falha assíncrona" });
  });
}
