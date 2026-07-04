import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Users, ClipboardList, Pill, Thermometer, Baby, Syringe,
  ShieldCheck, Sparkles, BarChart3, Bell, FileSignature, Trophy,
  ArrowRight, CheckCircle2, HeartPulse, Building2
} from "lucide-react";

/**
 * Landing page do SENEXCARE.
 * Paleta: Emerald Prestige (#064e3b, #0d7a5f, #c9a84c, #f5f0e0)
 * Tipografia: Outfit (títulos) + Figtree (corpo)
 * Layout: Hero + Bento grid
 *
 * Estilo isolado nesta página (arbitrary values Tailwind) para não
 * impactar o design system existente do app administrativo.
 */
export default function Landing() {
  return (
    <div className="min-h-screen bg-[#f5f0e0] font-figtree text-[#0b2a20] antialiased">
      {/* NAV */}
      <header className="sticky top-0 z-50 backdrop-blur bg-[#f5f0e0]/80 border-b border-[#064e3b]/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/landing" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-[#064e3b] flex items-center justify-center">
              <HeartPulse className="w-5 h-5 text-[#c9a84c]" />
            </div>
            <span className="font-outfit font-semibold text-lg tracking-tight text-[#064e3b]">
              SENEX<span className="text-[#c9a84c]">CARE</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-[#064e3b]/80">
            <a href="#modulos" className="hover:text-[#064e3b]">Módulos</a>
            <a href="#beneficios" className="hover:text-[#064e3b]">Benefícios</a>
            <a href="#seguranca" className="hover:text-[#064e3b]">Segurança</a>
            <a href="#contato" className="hover:text-[#064e3b]">Contato</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden sm:inline-flex text-[#064e3b] hover:bg-[#064e3b]/5 hover:text-[#064e3b]">
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button asChild className="bg-[#064e3b] hover:bg-[#0d7a5f] text-[#f5f0e0]">
              <a href="#contato">Solicitar demo</a>
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #064e3b 1px, transparent 1px), radial-gradient(circle at 80% 60%, #c9a84c 1px, transparent 1px)",
            backgroundSize: "36px 36px, 48px 48px",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-16 md:pt-28 md:pb-24 grid md:grid-cols-12 gap-10 items-center">
          <div className="md:col-span-7">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#064e3b]/5 border border-[#064e3b]/10 text-xs uppercase tracking-wider text-[#064e3b]">
              <Sparkles className="w-3.5 h-3.5 text-[#c9a84c]" />
              Plataforma para ILPIs
            </span>
            <h1 className="font-outfit font-semibold text-4xl md:text-6xl leading-[1.05] tracking-tight text-[#064e3b] mt-5">
              Gestão completa e humana para{" "}
              <span className="italic text-[#0d7a5f]">instituições de idosos</span>
              <span className="text-[#c9a84c]">.</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-[#0b2a20]/70 max-w-xl">
              Digitalize prontuários, ponto, escalas, medicação e rotinas em uma
              só plataforma. Menos papel, mais tempo para o cuidado.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-[#064e3b] hover:bg-[#0d7a5f] text-[#f5f0e0] h-12 px-6">
                <a href="#contato">
                  Solicitar demonstração <ArrowRight className="ml-1 w-4 h-4" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6 border-[#064e3b]/20 text-[#064e3b] hover:bg-[#064e3b]/5 hover:text-[#064e3b]">
                <a href="#modulos">Conhecer módulos</a>
              </Button>
            </div>
            <div className="mt-10 flex items-center gap-6 text-sm text-[#0b2a20]/60">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#0d7a5f]" /> LGPD</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#0d7a5f]" /> Multi-tenant</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#0d7a5f]" /> PWA</div>
            </div>
          </div>

          {/* Hero visual card */}
          <div className="md:col-span-5">
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-br from-[#c9a84c]/30 to-[#0d7a5f]/20 blur-2xl rounded-3xl" />
              <div className="relative rounded-3xl bg-[#064e3b] text-[#f5f0e0] p-8 shadow-2xl shadow-[#064e3b]/20">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-widest text-[#c9a84c]">Painel de hoje</div>
                  <div className="w-2 h-2 rounded-full bg-[#c9a84c] animate-pulse" />
                </div>
                <div className="mt-6 grid grid-cols-2 gap-4">
                  {[
                    { k: "Residentes", v: "42" },
                    { k: "Cuidadores no turno", v: "9" },
                    { k: "Medicações do dia", v: "128" },
                    { k: "Prontuários OK", v: "97%" },
                  ].map((s) => (
                    <div key={s.k} className="rounded-xl bg-[#0d7a5f]/30 border border-[#c9a84c]/20 p-4">
                      <div className="text-[10px] uppercase tracking-wider text-[#f5f0e0]/70">{s.k}</div>
                      <div className="font-outfit text-2xl mt-1">{s.v}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-6 border-t border-[#f5f0e0]/10 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[#f5f0e0]/70">Alertas ativos</span>
                    <span className="text-[#c9a84c] font-medium">3 pendentes</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENTO MODULES */}
      <section id="modulos" className="max-w-7xl mx-auto px-6 py-20">
        <div className="max-w-2xl mb-12">
          <div className="text-xs uppercase tracking-widest text-[#0d7a5f] font-medium">Módulos</div>
          <h2 className="font-outfit text-3xl md:text-4xl text-[#064e3b] mt-2 tracking-tight">
            Tudo o que sua ILPI precisa em um só lugar
          </h2>
          <p className="mt-4 text-[#0b2a20]/70">
            Cada módulo foi desenhado com quem vive o dia a dia do cuidado
            — do porteiro ao supervisor clínico.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 auto-rows-[minmax(180px,auto)] gap-4">
          {/* Big card */}
          <BentoCard
            className="md:col-span-4 md:row-span-2 bg-[#064e3b] text-[#f5f0e0]"
            icon={<ClipboardList className="w-6 h-6 text-[#c9a84c]" />}
            title="Prontuário digital diário"
            desc="Ciclos por turno, salvamento automático, assistente de IA com contexto de 7 dias e finalização em massa com auditoria."
            large
          />
          <BentoCard
            className="md:col-span-2 bg-white"
            icon={<Users className="w-5 h-5 text-[#0d7a5f]" />}
            title="Gestão de funcionários"
            desc="Cadastro, escalas, folha ponto e advertências CLT."
          />
          <BentoCard
            className="md:col-span-2 bg-[#c9a84c]/15"
            icon={<Pill className="w-5 h-5 text-[#064e3b]" />}
            title="Controle de medicação"
            desc="Prescrição, estoque por residente e mapa diário."
          />
          <BentoCard
            className="md:col-span-2 bg-white"
            icon={<Thermometer className="w-5 h-5 text-[#0d7a5f]" />}
            title="Temperatura & rotinas"
            desc="Registro rápido por PIN, sem login."
          />
          <BentoCard
            className="md:col-span-2 bg-white"
            icon={<Baby className="w-5 h-5 text-[#0d7a5f]" />}
            title="Controle de fraldas"
            desc="Estoque individual, uso diário e alertas."
          />
          <BentoCard
            className="md:col-span-2 bg-[#0d7a5f] text-[#f5f0e0]"
            icon={<Syringe className="w-5 h-5 text-[#c9a84c]" />}
            title="Cartão vacinal"
            desc="Histórico completo por residente."
          />
          <BentoCard
            className="md:col-span-2 bg-white"
            icon={<FileSignature className="w-5 h-5 text-[#0d7a5f]" />}
            title="Contratos & documentos"
            desc="Geração em PDF, assinatura e verificação."
          />
          <BentoCard
            className="md:col-span-4 bg-[#f5f0e0] border border-[#064e3b]/10"
            icon={<Sparkles className="w-5 h-5 text-[#c9a84c]" />}
            title="Assistentes de IA"
            desc="Supervisora, RH e prontuário — com persona de cuidadora experiente para leitura fina de sinais."
          />
          <BentoCard
            className="md:col-span-2 bg-white"
            icon={<Trophy className="w-5 h-5 text-[#0d7a5f]" />}
            title="Gamificação"
            desc="XP, moedas e níveis para cuidadores."
          />
          <BentoCard
            className="md:col-span-2 bg-white"
            icon={<Bell className="w-5 h-5 text-[#0d7a5f]" />}
            title="Alertas WhatsApp"
            desc="Comunicação com familiares e equipe."
          />
          <BentoCard
            className="md:col-span-2 bg-white"
            icon={<BarChart3 className="w-5 h-5 text-[#0d7a5f]" />}
            title="Relatórios & IA"
            desc="Relatórios semanais automáticos por e-mail."
          />
        </div>
      </section>

      {/* BENEFITS */}
      <section id="beneficios" className="bg-[#064e3b] text-[#f5f0e0] py-20">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-12 gap-10">
          <div className="md:col-span-5">
            <div className="text-xs uppercase tracking-widest text-[#c9a84c]">Por que o SENEXCARE</div>
            <h2 className="font-outfit text-3xl md:text-4xl tracking-tight mt-2">
              Menos papel, mais cuidado.
            </h2>
            <p className="mt-4 text-[#f5f0e0]/70">
              Uma plataforma pensada para a realidade brasileira das ILPIs:
              simples nos dispositivos da equipe, poderosa no painel gerencial.
            </p>
          </div>
          <div className="md:col-span-7 grid sm:grid-cols-2 gap-5">
            {[
              { t: "Adoção rápida", d: "Cuidadores acessam por PIN de 4 dígitos, sem senhas." },
              { t: "Visão gerencial", d: "Dashboards, KPIs e alertas em tempo real." },
              { t: "Conformidade legal", d: "Contratos, advertências e documentos com integridade SHA-256." },
              { t: "Multi-tenant", d: "Uma plataforma, várias unidades — com isolamento por RLS." },
            ].map((b) => (
              <div key={b.t} className="rounded-2xl p-6 bg-[#0d7a5f]/25 border border-[#c9a84c]/10">
                <div className="font-outfit text-lg text-[#c9a84c]">{b.t}</div>
                <p className="mt-2 text-sm text-[#f5f0e0]/80">{b.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section id="seguranca" className="max-w-7xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <div className="text-xs uppercase tracking-widest text-[#0d7a5f] font-medium">Segurança & LGPD</div>
          <h2 className="font-outfit text-3xl md:text-4xl text-[#064e3b] mt-2 tracking-tight">
            Dados sensíveis merecem proteção séria.
          </h2>
          <ul className="mt-6 space-y-3 text-[#0b2a20]/80">
            {[
              "Row-Level Security em todas as tabelas do banco",
              "Autenticação por PIN, JWT e SERVICE_ROLE quando cabível",
              "Documentos com hash SHA-256 e página pública de verificação",
              "Sessões públicas com expiração automática de 2 horas",
            ].map((i) => (
              <li key={i} className="flex gap-3">
                <ShieldCheck className="w-5 h-5 text-[#0d7a5f] shrink-0 mt-0.5" />
                <span>{i}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl bg-gradient-to-br from-[#064e3b] to-[#0d7a5f] text-[#f5f0e0] p-8 md:p-10 shadow-xl">
          <Building2 className="w-8 h-8 text-[#c9a84c]" />
          <blockquote className="font-outfit text-2xl md:text-3xl leading-snug mt-6">
            “Ganhamos horas por dia em tarefas administrativas e conseguimos
            focar no que importa: o bem-estar dos residentes.”
          </blockquote>
          <div className="mt-6 text-sm text-[#f5f0e0]/70">
            Le Jardin Residencial Sênior — cliente âncora
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contato" className="max-w-5xl mx-auto px-6 pb-24">
        <div className="rounded-3xl bg-[#c9a84c]/15 border border-[#c9a84c]/30 p-10 md:p-14 text-center">
          <h2 className="font-outfit text-3xl md:text-4xl text-[#064e3b] tracking-tight">
            Pronto para transformar sua ILPI?
          </h2>
          <p className="mt-4 text-[#0b2a20]/70 max-w-xl mx-auto">
            Agende uma demonstração e veja o SENEXCARE funcionando com os
            fluxos reais da sua instituição.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Button asChild size="lg" className="bg-[#064e3b] hover:bg-[#0d7a5f] text-[#f5f0e0] h-12 px-6">
              <a href="mailto:contato@senexcare.com.br">Falar com especialista</a>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-6 border-[#064e3b]/20 text-[#064e3b] hover:bg-[#064e3b]/5 hover:text-[#064e3b]">
              <Link to="/auth">Já sou cliente</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#064e3b]/10 py-10 text-sm text-[#0b2a20]/60">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-[#064e3b] flex items-center justify-center">
              <HeartPulse className="w-4 h-4 text-[#c9a84c]" />
            </div>
            <span className="font-outfit text-[#064e3b] font-medium">SENEXCARE</span>
          </div>
          <div>© {new Date().getFullYear()} SENEXCARE. Todos os direitos reservados.</div>
        </div>
      </footer>
    </div>
  );
}

function BentoCard({
  icon, title, desc, className = "", large = false,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  className?: string;
  large?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-6 flex flex-col justify-between transition-transform duration-300 hover:-translate-y-0.5 ${className}`}
    >
      <div className="w-10 h-10 rounded-lg bg-black/5 flex items-center justify-center">
        {icon}
      </div>
      <div className="mt-6">
        <h3 className={`font-outfit tracking-tight ${large ? "text-2xl md:text-3xl" : "text-lg"}`}>
          {title}
        </h3>
        <p className={`mt-2 ${large ? "text-base opacity-80 max-w-md" : "text-sm opacity-75"}`}>
          {desc}
        </p>
      </div>
    </div>
  );
}