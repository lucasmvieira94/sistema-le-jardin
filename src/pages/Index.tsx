/**
 * Painel principal, organizado por prioridade (pendências > operação > gestão).
 * Os quadros vêm do catálogo `registroQuadros` e seguem as preferências do usuário.
 */
import { useEffect, useRef } from "react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import AcoesRapidas from "@/components/dashboard/AcoesRapidas";
import AssistenteSupervisoraIA from "@/components/dashboard/AssistenteSupervisoraIA";
import PersonalizarPainel from "@/components/dashboard/PersonalizarPainel";
import SugestoesPainelIA from "@/components/dashboard/SugestoesPainelIA";
import { aplicarPreferencias, GRUPOS, type GrupoQuadro, type QuadroPainel } from "@/components/dashboard/registroQuadros";
import { usePreferenciasPainel } from "@/hooks/usePreferenciasPainel";
import { registrarUso } from "@/hooks/useRegistrarUso";

/** Envolve o quadro para registrar visualização e cliques (uso anônimo). */
function QuadroRastreado({ q }: { q: QuadroPainel }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { registrarUso("quadro_visto", q.id); obs.disconnect(); }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [q.id]);
  return (
    <div ref={ref} className={q.largo ? "md:col-span-2 xl:col-span-3" : ""}
      onClickCapture={(e) => { if ((e.target as HTMLElement).closest("button")) registrarUso("quadro_clique", q.id); }}>
      <q.Componente />
    </div>
  );
}

export default function Index() {
  const { pref, salvar } = usePreferenciasPainel();
  const quadros = aplicarPreferencias(pref);
  const grupos = (Object.keys(GRUPOS) as GrupoQuadro[])
    .map((g) => ({ g, itens: quadros.filter((q) => q.grupo === g) }))
    .filter((x) => x.itens.length > 0);

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      <DashboardHeader />
      <div className="flex justify-end">
        <PersonalizarPainel pref={pref} onSalvar={salvar} />
      </div>

      {grupos.map(({ g, itens }) => (
        <section key={g} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{GRUPOS[g]}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {itens.map((q) => <QuadroRastreado key={q.id} q={q} />)}
          </div>
        </section>
      ))}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <SugestoesPainelIA pref={pref} onSalvar={salvar} />
        <AcoesRapidas />
      </div>
      <AssistenteSupervisoraIA />
    </div>
  );
}
