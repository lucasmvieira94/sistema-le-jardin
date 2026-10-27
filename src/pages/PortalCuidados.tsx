import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { formatInTimeZone } from "date-fns-tz";
import { ArrowLeft, Baby, FileHeart, FileSearch, HeartPulse, Loader2, Pill, Search, Syringe, Thermometer, AlertTriangle, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { temPasseValido } from "@/utils/portalSessao";
import { atalhosLiberados, filtrarResidentes, idade, podeAcessarPortalCuidados, semCamposProibidos } from "@/utils/portalCuidados";
import FichaCuidadoResidente from "@/components/cuidados/FichaCuidadoResidente";

const ICONES: Record<string, typeof Pill> = {
  prontuario: FileHeart, medicamentos: Pill, fraldas: Baby, temperatura: Thermometer,
  vacinas: Syringe, intercorrencias: AlertTriangle, meus_prontuarios: FileSearch,
};

interface ResidenteResumo {
  id: string; nome_completo: string; quarto: string | null; data_nascimento: string;
  condicoes_medicas: string | null; responsavel_nome: string | null; responsavel_telefone: string | null;
}

/** Lê a sessão do PIN (mesma do portal do colaborador). */
function lerSessao(): { id: string; nome: string } | null {
  try {
    const s = JSON.parse(sessionStorage.getItem("funcionario_session") ?? "null");
    return s?.id && temPasseValido() ? s : null;
  } catch { return null; }
}

/** Portal de Cuidados: rotina assistencial e fichas dos residentes. */
export default function PortalCuidados() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const naHome = pathname.replace(/\/$/, "") === "/cuidados";
  const sessao = useMemo(lerSessao, []);
  const [modulos, setModulos] = useState<string[] | null>(null);
  const [residentes, setResidentes] = useState<ResidenteResumo[] | null>(null);
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const [agora, setAgora] = useState(new Date());

  useEffect(() => {
    if (!sessao) { navigate("/?destino=cuidados", { replace: true }); return; }
    supabase.rpc("modulos_funcionario" as any, { _funcionario_id: sessao.id }).then(({ data }) => {
      const m = (data as string[] | null) ?? [];
      setModulos(m);
      if (podeAcessarPortalCuidados(m)) {
        supabase.rpc("portal_cuidados_residentes" as any).then(({ data: r }) => setResidentes(semCamposProibidos((r as ResidenteResumo[]) ?? [])));
      }
    });
    const t = setInterval(() => setAgora(new Date()), 30000);
    return () => clearInterval(t);
  }, [sessao, navigate]);

  if (!sessao) return null;
  if (modulos === null) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!podeAcessarPortalCuidados(modulos)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md p-8 text-center space-y-4">
          <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Acesso exclusivo da equipe de cuidados</h1>
          <p className="text-sm text-muted-foreground">Seu cargo não tem o Portal de Cuidados liberado. Fale com a gestão se precisar.</p>
          <Button onClick={() => navigate("/")}>Voltar ao Meu RH</Button>
        </Card>
      </div>
    );
  }

  const q = `funcionario_id=${sessao.id}&funcionario_nome=${encodeURIComponent(sessao.nome)}`;
  const lista = filtrarResidentes(residentes ?? [], busca);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-primary text-primary-foreground">
        <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-6 w-6" />
            <div>
              <h1 className="font-bold leading-tight">Portal de Cuidados</h1>
              <p className="text-xs opacity-90">Olá, {sessao.nome.split(" ")[0]} · {formatInTimeZone(agora, "America/Sao_Paulo", "dd/MM/yyyy HH:mm")}</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate("/")}><ArrowLeft className="mr-1 h-4 w-4" />Meu RH</Button>
        </div>
        {/* Navegação fixa entre as tarefas, sem sair do portal */}
        <nav className="border-t border-primary-foreground/20">
          <div className="container mx-auto flex gap-1 overflow-x-auto px-2 py-1.5">
            {[{ id: "inicio", nome: "Residentes", icone: HeartPulse, to: `/cuidados?${q}`, end: true },
              ...atalhosLiberados(modulos).map((a) => ({ id: a.id, nome: a.nome, icone: ICONES[a.id], to: `/cuidados/${a.id}?${q}`, end: false }))]
              .map((t) => (
                <NavLink key={t.id} to={t.to} end={t.end}
                  className={({ isActive }) => `flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${isActive ? "bg-primary-foreground text-primary" : "hover:bg-primary-foreground/15"}`}>
                  <t.icone className="h-4 w-4" />{t.nome}
                </NavLink>
              ))}
          </div>
        </nav>
      </header>

      {!naHome ? <div className="animate-fade-in"><Outlet /></div> : (

      <main className="container mx-auto space-y-6 px-4 py-5">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Rotina</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {atalhosLiberados(modulos).map((a) => {
              const Icone = ICONES[a.id];
              return (
                <button key={a.id} onClick={() => navigate(`/cuidados/${a.id}?${q}`)}
                  className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center text-sm font-medium shadow-sm transition hover:border-primary hover:shadow-md active:scale-95">
                  <Icone className="h-7 w-7 text-primary" />{a.nome}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Residentes ({lista.length})</h2>
            <div className="relative sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por nome ou quarto" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
          {residentes === null ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lista.map((r) => (
                <Card key={r.id} className="cursor-pointer transition hover:border-primary hover:shadow-md" onClick={() => setAberto(r.id)}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                      {r.quarto ?? r.nome_completo.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{r.nome_completo}</p>
                      <p className="text-xs text-muted-foreground">{r.quarto ? `Quarto ${r.quarto} · ` : ""}{idade(r.data_nascimento)} anos</p>
                      {r.condicoes_medicas && <p className="truncate text-xs text-muted-foreground">{r.condicoes_medicas}</p>}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {!lista.length && <p className="text-sm text-muted-foreground">Nenhum residente encontrado.</p>}
            </div>
          )}
        </section>
      </main>
      )}
      <FichaCuidadoResidente residenteId={aberto} onClose={() => setAberto(null)} />
    </div>
  );
}
