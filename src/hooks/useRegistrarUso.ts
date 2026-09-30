/**
 * Registro leve e anônimo de uso do sistema (páginas e quadros), usado pelo
 * agente "Consultor do painel". Os eventos ficam num lote em memória e são
 * enviados a cada 30s ou ao sair da página. Nenhum conteúdo é registrado.
 */
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type TipoUso = "pagina" | "quadro_visto" | "quadro_clique";
const fila: { tipo: TipoUso; alvo: string }[] = [];
let timer: ReturnType<typeof setInterval> | null = null;

async function enviar() {
  if (fila.length === 0) return;
  const lote = fila.splice(0, 200);
  const { data } = await supabase.auth.getSession();
  if (!data.session) return; // só usuários autenticados
  const { error } = await (supabase as any).from("uso_sistema_eventos").insert(lote);
  if (error) console.warn("[uso] não registrado:", error.message);
}

export function registrarUso(tipo: TipoUso, alvo: string) {
  fila.push({ tipo, alvo: alvo.slice(0, 120) });
  if (!timer && typeof window !== "undefined") {
    timer = setInterval(enviar, 30_000);
    window.addEventListener("pagehide", () => { void enviar(); });
  }
}

/** Registra cada troca de página (sem parâmetros de consulta). */
export function useRegistrarPaginas() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Rotas públicas por PIN/token não são registradas
    if (/publico|assinatura-publica|verificar|anexo/.test(pathname)) return;
    registrarUso("pagina", pathname.replace(/[0-9a-f-]{16,}/gi, ":id"));
  }, [pathname]);
}
