import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface JornadaRequest {
  jornadaValue: string;
  dataInicio: string;
}

interface EscalaDay {
  data: string;
  status: 'trabalho' | 'folga';
  horas: number;
  fim_de_semana: boolean;
  dia_util: boolean;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function gerarEscala(jornadaValue: string, dataInicio: string): EscalaDay[] {
  const startDate = new Date(dataInicio);
  const year = startDate.getFullYear();
  const month = startDate.getMonth() + 1;
  const daysInMonth = getDaysInMonth(year, month);
  
  const escala: EscalaDay[] = [];
  
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(year, month - 1, day);
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const isWeekendDay = isWeekend(currentDate);
    
    let status: 'trabalho' | 'folga' = 'folga';
    let horas = 0;
    let diaUtil = false;
    
    // Calculate days since start for cycle-based schedules
    const daysSinceStart = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    switch (jornadaValue) {
      case '44h_8h_segsex_4h_sab':
        if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Monday to Friday
          status = 'trabalho';
          horas = 8;
          diaUtil = true;
        } else if (dayOfWeek === 6) { // Saturday
          status = 'trabalho';
          horas = 4;
          diaUtil = false;
        }
        break;
        
      case '40h_8h_segsex':
        if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Monday to Friday
          status = 'trabalho';
          horas = 8;
          diaUtil = true;
        }
        break;
        
      case '36h_6h_seg_sab':
        if (dayOfWeek >= 1 && dayOfWeek <= 6) { // Monday to Saturday
          status = 'trabalho';
          horas = 6;
          diaUtil = dayOfWeek <= 5;
        }
        break;
        
      case '12x36':
        // Alternates: work 1 day, rest 1 day
        if (daysSinceStart % 2 === 0) {
          status = 'trabalho';
          horas = 12;
          diaUtil = !isWeekendDay;
        }
        break;
        
      case '24x48':
        // Work 1 day, rest 2 days
        if (daysSinceStart % 3 === 0) {
          status = 'trabalho';
          horas = 24;
          diaUtil = !isWeekendDay;
        }
        break;
        
      case '5x2':
        // Work 5 days, rest 2 days
        const weekCycle5x2 = daysSinceStart % 7;
        if (weekCycle5x2 < 5) {
          status = 'trabalho';
          horas = 8;
          diaUtil = !isWeekendDay;
        }
        break;
        
      case '6x1':
        // Work 6 days, rest 1 day
        const weekCycle6x1 = daysSinceStart % 7;
        if (weekCycle6x1 < 6) {
          status = 'trabalho';
          horas = 8;
          diaUtil = !isWeekendDay;
        }
        break;
    }
    
    escala.push({
      data: formatDate(currentDate),
      status,
      horas,
      fim_de_semana: isWeekendDay,
      dia_util: diaUtil
    });
  }
  
  return escala;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    const { jornadaValue, dataInicio }: JornadaRequest = await req.json();
    
    if (!jornadaValue || !dataInicio) {
      throw new Error('jornadaValue and dataInicio are required');
    }
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dataInicio)) {
      throw new Error('dataInicio must be in YYYY-MM-DD format');
    }
    
    const escala = gerarEscala(jornadaValue, dataInicio);
    
    return new Response(JSON.stringify(escala), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Error in gerar-escala function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});