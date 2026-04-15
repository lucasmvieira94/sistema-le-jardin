import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { TenantProvider } from "@/contexts/TenantContext";
import { AdminLayout } from "@/layouts/AdminLayout";
import { PublicLayout } from "@/layouts/PublicLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { useVersionCheck } from "@/hooks/useVersionCheck";

// Páginas públicas
import Auth from "./pages/Auth";
import FuncionarioAccess from "./pages/FuncionarioAccess";
import RegistroPonto from "./pages/RegistroPonto";
import Prontuario from "./pages/Prontuario";
import ControleTemperaturaPublico from "./pages/ControleTemperaturaPublico";
import ControleFraldasPublico from "./pages/ControleFraldasPublico";
import MinhaEscala from "./pages/MinhaEscala";
import MeusPontos from "./pages/MeusPontos";
import FeedbackSistema from "./pages/FeedbackSistema";
import SupervisorProntuarios from "./pages/SupervisorProntuarios";
import MeusProntuarios from "./pages/MeusProntuarios";
import IntercorrenciasPublico from "./pages/IntercorrenciasPublico";
import PainelIntercorrencias from "./pages/PainelIntercorrencias";
import ContratoTemporarioPublico from "./pages/ContratoTemporarioPublico";
import AdministracaoMedicamentosPublico from "./pages/AdministracaoMedicamentosPublico";
import NotFound from "./pages/NotFound";

// Páginas protegidas (admin)
import Index from "./pages/Index";
import Funcionarios from "./pages/Funcionarios";
import NovoFuncionario from "./pages/NovoFuncionario";
import EditarFuncionario from "./pages/EditarFuncionario";
import Escalas from "./pages/Escalas";
import ApropriacaoHoras from "./pages/ApropriacaoHoras";
import Relatorios from "./pages/Relatorios";
import Faltas from "./pages/Faltas";
import Configuracoes from "./pages/Configuracoes";
import ConfiguracoesAlertas from "./pages/ConfiguracoesAlertas";
import RelatoriosIA from "./pages/RelatoriosIA";
import Residentes from "./pages/Residentes";
import ControleProntuarios from "./pages/ControleProntuarios";
import ConfiguracaoFormulario from "./pages/ConfiguracaoFormulario";
import ControleMedicamentos from "./pages/ControleMedicamentos";
import ControleTemperatura from "./pages/ControleTemperatura";
import ControleFraldas from "./pages/ControleFraldas";
import NotificacoesWhatsApp from "./pages/NotificacoesWhatsApp";
import GerenciamentoWhatsApp from "./pages/GerenciamentoWhatsApp";
import AnaliseFeedback from "./pages/AnaliseFeedback";
import AdvertenciasSuspensoes from "./pages/AdvertenciasSuspensoes";
import GestaoIntercorrencias from "./pages/GestaoIntercorrencias";
import Gamificacao from "./pages/Gamificacao";
import GestaoGamificacao from "./pages/GestaoGamificacao";

const queryClient = new QueryClient();

const App = () => {
  useVersionCheck();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <PWAInstallPrompt />
        <BrowserRouter>
        <TenantProvider>
          <Routes>
            {/* Rotas públicas - layout simples sem sidebar */}
            <Route element={<PublicLayout />}>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<FuncionarioAccess />} />
              <Route path="/funcionario-access" element={<FuncionarioAccess />} />
              <Route path="/registro-ponto" element={<RegistroPonto />} />
              <Route path="/prontuario" element={<Prontuario />} />
              <Route path="/temperatura-medicamentos" element={<ControleTemperaturaPublico />} />
              <Route path="/controle-fraldas-publico" element={<ControleFraldasPublico />} />
              <Route path="/minha-escala" element={<MinhaEscala />} />
              <Route path="/meus-pontos" element={<MeusPontos />} />
              <Route path="/feedback-sistema" element={<FeedbackSistema />} />
              <Route path="/supervisor-prontuarios" element={<SupervisorProntuarios />} />
              <Route path="/meus-prontuarios" element={<MeusProntuarios />} />
              <Route path="/intercorrencias" element={<IntercorrenciasPublico />} />
              <Route path="/painel-intercorrencias" element={<PainelIntercorrencias />} />
              <Route path="/contrato-temporario/:token" element={<ContratoTemporarioPublico />} />
              <Route path="/administracao-medicamentos" element={<AdministracaoMedicamentosPublico />} />
              <Route path="/gamificacao" element={<Gamificacao />} />
            </Route>

            {/* Rotas protegidas - layout com sidebar */}
            <Route element={<AdminLayout />}>
              <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/funcionarios" element={<ProtectedRoute><Funcionarios /></ProtectedRoute>} />
              <Route path="/funcionarios/novo" element={<ProtectedRoute><NovoFuncionario /></ProtectedRoute>} />
              <Route path="/funcionarios/:id/editar" element={<ProtectedRoute><EditarFuncionario /></ProtectedRoute>} />
              <Route path="/escalas" element={<ProtectedRoute><Escalas /></ProtectedRoute>} />
              <Route path="/apropriacao" element={<ProtectedRoute><ApropriacaoHoras /></ProtectedRoute>} />
              <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
              <Route path="/faltas" element={<ProtectedRoute><Faltas /></ProtectedRoute>} />
              <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
              <Route path="/configuracoes-alertas" element={<ProtectedRoute><ConfiguracoesAlertas /></ProtectedRoute>} />
              <Route path="/relatorios-ia" element={<ProtectedRoute><RelatoriosIA /></ProtectedRoute>} />
              <Route path="/residentes" element={<ProtectedRoute><Residentes /></ProtectedRoute>} />
              <Route path="/controle-prontuarios" element={<ProtectedRoute><ControleProntuarios /></ProtectedRoute>} />
              <Route path="/configuracao-formulario" element={<ProtectedRoute><ConfiguracaoFormulario /></ProtectedRoute>} />
              <Route path="/controle-medicamentos" element={<ProtectedRoute><ControleMedicamentos /></ProtectedRoute>} />
              <Route path="/controle-temperatura" element={<ProtectedRoute><ControleTemperatura /></ProtectedRoute>} />
              <Route path="/controle-fraldas" element={<ProtectedRoute><ControleFraldas /></ProtectedRoute>} />
              <Route path="/notificacoes-whatsapp" element={<ProtectedRoute><NotificacoesWhatsApp /></ProtectedRoute>} />
              <Route path="/gerenciamento-whatsapp" element={<ProtectedRoute><GerenciamentoWhatsApp /></ProtectedRoute>} />
              <Route path="/analise-feedback" element={<ProtectedRoute><AnaliseFeedback /></ProtectedRoute>} />
              <Route path="/advertencias-suspensoes" element={<ProtectedRoute><AdvertenciasSuspensoes /></ProtectedRoute>} />
              <Route path="/gestao-intercorrencias" element={<ProtectedRoute><GestaoIntercorrencias /></ProtectedRoute>} />
              <Route path="/gestao-gamificacao" element={<ProtectedRoute><GestaoGamificacao /></ProtectedRoute>} />
            </Route>

            {/* Fallback 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TenantProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
