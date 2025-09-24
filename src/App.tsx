
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

import Index from "./pages/Index";
import FuncionarioAccess from "./pages/FuncionarioAccess";
import RegistroPonto from "./pages/RegistroPonto";
import Escalas from "./pages/Escalas";
import Relatorios from "./pages/Relatorios";
import Faltas from "./pages/Faltas";
import ApropriacaoHoras from "./pages/ApropriacaoHoras";
import Configuracoes from "./pages/Configuracoes";
import Prontuario from "./pages/Prontuario";
import NotFound from "./pages/NotFound";
import Funcionarios from "./pages/Funcionarios";
import NovoFuncionario from "./pages/NovoFuncionario";
import EditarFuncionario from "./pages/EditarFuncionario";
import Residentes from "./pages/Residentes";
import ControleProntuarios from "./pages/ControleProntuarios";
import ConfiguracaoFormulario from "./pages/ConfiguracaoFormulario";
import ControleMedicamentos from "./pages/ControleMedicamentos";
import ControleTemperatura from "./pages/ControleTemperatura";
import ControleTemperaturaPublico from "./pages/ControleTemperaturaPublico";
import NotificacoesWhatsApp from "./pages/NotificacoesWhatsApp";
import GerenciamentoWhatsApp from "./pages/GerenciamentoWhatsApp";
import { useAuthSession } from "@/hooks/useAuthSession";
import Auth from "./pages/Auth";
import { AppSidebar } from "./components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuthSession();
  if (loading) return <div className="flex justify-center items-center min-h-screen">Carregando...</div>;
  if (!user) {
    // Not authenticated, redirect to /auth
    window.location.href = "/auth";
    return null;
  }
  return <>{children}</>;
};

const AppContent = () => {
  const location = useLocation();
  const isPublicRoute = (pathname: string) => {
    const publicRoutes = ['/auth', '/', '/funcionario-access', '/registro-ponto', '/prontuario', '/temperatura-medicamentos'];
    return publicRoutes.includes(pathname);
  };

  const isAdminRoute = (pathname: string) => {
    return !isPublicRoute(pathname);
  };

  return (
    <>
      {isAdminRoute(location.pathname) ? (
        // Layout com Sidebar para rotas administrativas
        <SidebarProvider>
          <div className="min-h-screen flex w-full">
            <AppSidebar />
            <main className="flex-1">
              {/* Header com trigger da sidebar */}
              <header className="h-12 flex items-center border-b bg-white px-4">
                <SidebarTrigger />
              </header>
              <div className="bg-background min-h-[calc(100vh-48px)]">
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  {/* Página inicial: Acesso unificado ao sistema */}
                  <Route path="/" element={<FuncionarioAccess />} />
                  <Route path="/funcionario-access" element={<FuncionarioAccess />} />
                  {/* Registro de Ponto (recebe dados via URL) */}
                  <Route path="/registro-ponto" element={<RegistroPonto />} />
                  {/* Prontuário eletrônico (recebe dados via URL) */}
                  <Route path="/prontuario" element={<Prontuario />} />
                  {/* Dashboard protegido */}
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <Index />
                      </ProtectedRoute>
                    }
                  />
                  {/* Outras rotas protegidas */}
                  <Route
                    path="/funcionarios"
                    element={
                      <ProtectedRoute>
                        <Funcionarios />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/funcionarios/novo"
                    element={
                      <ProtectedRoute>
                        <NovoFuncionario />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/funcionarios/:id/editar"
                    element={
                      <ProtectedRoute>
                        <EditarFuncionario />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/escalas"
                    element={
                      <ProtectedRoute>
                        <Escalas />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/apropriacao"
                    element={
                      <ProtectedRoute>
                        <ApropriacaoHoras />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/relatorios"
                    element={
                      <ProtectedRoute>
                        <Relatorios />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/faltas"
                    element={
                      <ProtectedRoute>
                        <Faltas />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/configuracoes"
                    element={
                      <ProtectedRoute>
                        <Configuracoes />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/residentes"
                    element={
                      <ProtectedRoute>
                        <Residentes />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/controle-prontuarios"
                    element={
                      <ProtectedRoute>
                        <ControleProntuarios />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/configuracao-formulario"
                    element={
                      <ProtectedRoute>
                        <ConfiguracaoFormulario />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/controle-medicamentos"
                    element={
                      <ProtectedRoute>
                        <ControleMedicamentos />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/controle-temperatura"
                    element={
                      <ProtectedRoute>
                        <ControleTemperatura />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/notificacoes-whatsapp"
                    element={
                      <ProtectedRoute>
                        <NotificacoesWhatsApp />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/gerenciamento-whatsapp"
                    element={
                      <ProtectedRoute>
                        <GerenciamentoWhatsApp />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </div>
            </main>
          </div>
        </SidebarProvider>
      ) : (
        // Layout simples para rotas públicas
        <div className="min-h-screen bg-background">
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<FuncionarioAccess />} />
            <Route path="/funcionario-access" element={<FuncionarioAccess />} />
            <Route path="/registro-ponto" element={<RegistroPonto />} />
            <Route path="/prontuario" element={<Prontuario />} />
            <Route path="/temperatura-medicamentos" element={<ControleTemperaturaPublico />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      )}
    </>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
