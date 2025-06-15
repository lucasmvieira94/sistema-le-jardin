
import React from "react";
import { CalendarRange, LogIn, LogOut, PauseCircle } from "lucide-react";
import CadastroFuncionarioForm from "@/components/CadastroFuncionarioForm";

export default function RegistroPonto() {
  return (
    <div className="container mx-auto max-w-2xl pt-12 font-heebo">
      <h2 className="text-3xl font-bold mb-3 text-primary">Registro de Ponto</h2>
      <div className="bg-white rounded-xl p-6 shadow-lg flex flex-col gap-3">
        <CadastroFuncionarioForm />
        <div className="flex flex-col md:flex-row md:items-baseline gap-4 justify-between">
          <div>
            <div className="text-lg font-semibold">Hoje: {new Date().toLocaleDateString('pt-BR')}</div>
            <div className="text-muted-foreground text-sm mb-2 flex items-center gap-1">
              <CalendarRange className="w-4 h-4" /> {new Date().toLocaleTimeString('pt-BR').slice(0,5)}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="bg-primary hover:bg-emerald-700 text-white font-semibold px-5 py-2 rounded-lg flex items-center gap-2 shadow transition">
              <LogIn className="w-5 h-5" /> Entrada
            </button>
            <button className="bg-accent hover:bg-green-400 text-foreground font-semibold px-5 py-2 rounded-lg flex items-center gap-2 shadow transition">
              <PauseCircle className="w-5 h-5" /> Intervalo
            </button>
            <button className="bg-secondary hover:bg-green-200 text-foreground font-semibold px-5 py-2 rounded-lg flex items-center gap-2 shadow transition">
              <LogOut className="w-5 h-5" /> Saída
            </button>
          </div>
        </div>
        <div className="mt-6">
          <div className="font-bold text-base mb-3 text-muted-foreground">Registros do dia</div>
          <table className="w-full border rounded-lg overflow-hidden bg-background">
            <thead>
              <tr className="text-left text-gray-500 bg-green-50">
                <th className="py-2 px-3">Horário</th>
                <th className="py-2 px-3">Tipo</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-2 px-3">08:01</td>
                <td className="py-2 px-3">Entrada</td>
              </tr>
              <tr>
                <td className="py-2 px-3">12:03</td>
                <td className="py-2 px-3">Intervalo</td>
              </tr>
              <tr>
                <td className="py-2 px-3">13:04</td>
                <td className="py-2 px-3">Retorno</td>
              </tr>
              <tr>
                <td className="py-2 px-3">17:59</td>
                <td className="py-2 px-3">Saída</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
