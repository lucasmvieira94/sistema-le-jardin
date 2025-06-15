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
import NotFound from "./pages/NotFound";
import Navbar from "./components/Navbar";
import Funcionarios from "./pages/Funcionarios";
import NovoFuncionario from "./pages/NovoFuncionario";
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
            {/* Public: home e auth */}
            <Route path="/" element={<Index />} />
            {/* Protegidas */}
            <Route
              path="/registro"
              element={
                <ProtectedRoute>
                  <RegistroPonto />
                </ProtectedRoute>
              }
            />
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
            {/* A rota de edição não está implementada ainda */}
            <Route
              path="/escalas"
              element={
                <ProtectedRoute>
                  <Escalas />
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
