
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Navbar />
        <div className="bg-background min-h-[calc(100vh-60px)]">
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/registro" element={<RegistroPonto />} />
            <Route path="/escalas" element={<Escalas />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/faltas" element={<Faltas />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
