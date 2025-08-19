
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import RegistroPonto from "./pages/RegistroPonto";
import Escalas from "./pages/Escalas";
import Relatorios from "./pages/Relatorios";
import Faltas from "./pages/Faltas";
import ApropriacaoHoras from "./pages/ApropriacaoHoras";
import Configuracoes from "./pages/Configuracoes";
import Prontuario from "./pages/Prontuario";
import NotFound from "./pages/NotFound";
import Navbar from "./components/Navbar";
import Funcionarios from "./pages/Funcionarios";
import NovoFuncionario from "./pages/NovoFuncionario";
import EditarFuncionario from "./pages/EditarFuncionario";
import Residentes from "./pages/Residentes";
import ControleProntuarios from "./pages/ControleProntuarios";
import ConfiguracaoFormulario from "./pages/ConfiguracaoFormulario";
import ControleMedicamentos from "./pages/ControleMedicamentos";
import { useAuthSession } from "@/hooks/useAuthSession";
import Auth from "./pages/Auth";

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Navbar />
        <div className="bg-background min-h-[calc(100vh-60px)]">
          <Routes>
            <Route path="/auth" element={<Auth />} />
            {/* Página inicial: Registro de Ponto (sem proteção) */}
            <Route path="/" element={<RegistroPonto />} />
            {/* Prontuário eletrônico (sem proteção - usa código de 4 dígitos) */}
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
