import React, { useState, useEffect } from "react";
import { Package, Droplets, ArrowLeft, Clock, CalendarRange } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatInTimeZone } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import careLogo from "@/assets/logo-senex-care-new.png";
import { RegistroUsoFraldaPublico } from "@/components/fraldas/RegistroUsoFraldaPublico";
import { CadastroEstoquePublico } from "@/components/fraldas/CadastroEstoquePublico";
import { toast } from "@/components/ui/sonner";

export default function ControleFraldasPublico() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const funcionarioId = searchParams.get("funcionario_id");
  const funcionarioNome = searchParams.get("funcionario_nome") || "";
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [companyName, setCompanyName] = useState<string>("Sistema de Gestão");
  const [companyLogo, setCompanyLogo] = useState<string>("");
  const [tenantId, setTenantId] = useState<string | null>(null);
  
  const [showRegistroUso, setShowRegistroUso] = useState(false);
  const [showCadastroEstoque, setShowCadastroEstoque] = useState(false);

  // Redireciona se não tiver funcionário validado
  useEffect(() => {
    if (!funcionarioId) {
      toast.error("Acesso não autorizado. Faça login primeiro.");
      navigate("/");
    }
  }, [funcionarioId, navigate]);

  // Atualiza o horário
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Buscar configurações da empresa e tenant
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        // Buscar configurações da empresa
        const { data: empresaData } = await supabase
          .from("configuracoes_empresa")
          .select("nome_empresa, logo_url")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (empresaData) {
          setCompanyName(empresaData.nome_empresa || "Sistema de Gestão");
          setCompanyLogo(empresaData.logo_url || "");
        }

        // Buscar tenant padrão (primeiro ativo)
        const { data: tenantData } = await supabase
          .from("tenants")
          .select("id")
          .eq("ativo", true)
          .limit(1)
          .maybeSingle();

        if (tenantData) {
          setTenantId(tenantData.id);
        }
      } catch (error) {
        console.error("Erro ao buscar configurações:", error);
      }
    };

    fetchConfig();
  }, []);

  const handleVoltar = () => {
    navigate(`/?funcionario_id=${funcionarioId}&funcionario_nome=${encodeURIComponent(funcionarioNome)}`);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  if (!funcionarioId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-900 p-2 sm:p-4">
      <div className="container mx-auto max-w-2xl">
        {/* Header */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-xl mb-4 sm:mb-6">
          <div className="text-center space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {companyLogo ? (
                <img
                  src={companyLogo}
                  alt="Logo da empresa"
                  className="w-32 h-32 sm:w-40 sm:h-40 object-contain flex-shrink-0"
                />
              ) : (
                <img
                  src={careLogo}
                  alt="Logo da empresa"
                  className="w-32 h-32 sm:w-40 sm:h-40 object-contain flex-shrink-0"
                />
              )}
              <div className="text-center sm:text-left">
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-green-700 break-words">
                  {getGreeting()}, {decodeURIComponent(funcionarioNome).split(" ")[0]}!
                </h1>
                <p className="text-sm sm:text-base text-gray-600">Controle de Fraldas</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs sm:text-sm">
              <CalendarRange className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="break-words text-center">
                {currentTime.toLocaleDateString("pt-BR", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>

            <div className="text-lg sm:text-xl font-medium flex items-center justify-center gap-2">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
              {formatInTimeZone(currentTime, "America/Sao_Paulo", "HH:mm:ss")}
            </div>
          </div>
        </div>

        {/* Cards de ação */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
          {/* Registrar Uso */}
          <Card
            className="cursor-pointer hover:shadow-lg transition-all duration-200 active:scale-95 sm:hover:scale-105 border-2 hover:border-green-400"
            onClick={() => setShowRegistroUso(true)}
          >
            <CardHeader className="text-center pb-3 sm:pb-4 p-4 sm:p-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Droplets className="w-6 h-6 sm:w-8 sm:h-8 text-green-700" />
              </div>
              <CardTitle className="text-green-800 text-base sm:text-lg">
                Registrar Uso de Fralda
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center p-4 sm:p-6 pt-0">
              <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">
                Registre a troca de fralda de um residente
              </p>
              <Button className="w-full bg-green-700 hover:bg-green-800 text-sm sm:text-base py-2 sm:py-3">
                Registrar Uso
              </Button>
            </CardContent>
          </Card>

          {/* Cadastrar Estoque */}
          <Card
            className="cursor-pointer hover:shadow-lg transition-all duration-200 active:scale-95 sm:hover:scale-105 border-2 hover:border-green-400"
            onClick={() => setShowCadastroEstoque(true)}
          >
            <CardHeader className="text-center pb-3 sm:pb-4 p-4 sm:p-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Package className="w-6 h-6 sm:w-8 sm:h-8 text-blue-700" />
              </div>
              <CardTitle className="text-blue-800 text-base sm:text-lg">
                Cadastrar Estoque
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center p-4 sm:p-6 pt-0">
              <p className="text-gray-600 mb-3 sm:mb-4 text-sm sm:text-base">
                Adicione novas fraldas ao estoque
              </p>
              <Button className="w-full bg-blue-700 hover:bg-blue-800 text-sm sm:text-base py-2 sm:py-3">
                Cadastrar Estoque
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Botão voltar */}
        <div className="text-center">
          <Button
            variant="outline"
            onClick={handleVoltar}
            className="px-6 sm:px-8 text-sm sm:text-base bg-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Menu
          </Button>
        </div>
      </div>

      {/* Dialog Registro de Uso */}
      <Dialog open={showRegistroUso} onOpenChange={setShowRegistroUso}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <RegistroUsoFraldaPublico
            funcionarioId={funcionarioId}
            funcionarioNome={decodeURIComponent(funcionarioNome)}
            tenantId={tenantId}
            onSuccess={() => {
              setShowRegistroUso(false);
              toast.success("Uso de fralda registrado com sucesso!");
            }}
            onCancel={() => setShowRegistroUso(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog Cadastro de Estoque */}
      <Dialog open={showCadastroEstoque} onOpenChange={setShowCadastroEstoque}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <CadastroEstoquePublico
            tenantId={tenantId}
            onSuccess={() => {
              setShowCadastroEstoque(false);
              toast.success("Estoque cadastrado com sucesso!");
            }}
            onCancel={() => setShowCadastroEstoque(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
