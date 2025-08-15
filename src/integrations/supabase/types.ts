export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      afastamentos: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string
          funcionario_id: string
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          observacoes: string | null
          quantidade_dias: number | null
          quantidade_horas: number | null
          tipo_afastamento_id: number
          tipo_periodo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio: string
          funcionario_id: string
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          observacoes?: string | null
          quantidade_dias?: number | null
          quantidade_horas?: number | null
          tipo_afastamento_id: number
          tipo_periodo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          funcionario_id?: string
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          observacoes?: string | null
          quantidade_dias?: number | null
          quantidade_horas?: number | null
          tipo_afastamento_id?: number
          tipo_periodo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "afastamentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afastamentos_tipo_afastamento_id_fkey"
            columns: ["tipo_afastamento_id"]
            isOneToOne: false
            referencedRelation: "tipos_afastamento"
            referencedColumns: ["id"]
          },
        ]
      }
      atividades_templates: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          descricao: string
          id: string
          nome: string
          periodicidade: string | null
        }
        Insert: {
          ativo?: boolean
          categoria: string
          created_at?: string
          descricao: string
          id?: string
          nome: string
          periodicidade?: string | null
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          descricao?: string
          id?: string
          nome?: string
          periodicidade?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          id: string
          ip_address: unknown | null
          operacao: string
          tabela: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          ip_address?: unknown | null
          operacao: string
          tabela: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          ip_address?: unknown | null
          operacao?: string
          tabela?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      configuracoes_empresa: {
        Row: {
          adicional_hora_extra_100: number | null
          adicional_hora_extra_50: number | null
          adicional_noturno: number | null
          cnpj: string | null
          created_at: string | null
          dominio_email: string | null
          endereco: string | null
          hora_fim_noturno: string | null
          hora_inicio_noturno: string | null
          id: string
          intervalo_minimo_minutos: number | null
          nome_empresa: string
          updated_at: string | null
        }
        Insert: {
          adicional_hora_extra_100?: number | null
          adicional_hora_extra_50?: number | null
          adicional_noturno?: number | null
          cnpj?: string | null
          created_at?: string | null
          dominio_email?: string | null
          endereco?: string | null
          hora_fim_noturno?: string | null
          hora_inicio_noturno?: string | null
          id?: string
          intervalo_minimo_minutos?: number | null
          nome_empresa: string
          updated_at?: string | null
        }
        Update: {
          adicional_hora_extra_100?: number | null
          adicional_hora_extra_50?: number | null
          adicional_noturno?: number | null
          cnpj?: string | null
          created_at?: string | null
          dominio_email?: string | null
          endereco?: string | null
          hora_fim_noturno?: string | null
          hora_inicio_noturno?: string | null
          id?: string
          intervalo_minimo_minutos?: number | null
          nome_empresa?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      escalas: {
        Row: {
          created_at: string
          entrada: string
          id: number
          intervalo_fim: string | null
          intervalo_inicio: string | null
          jornada_trabalho: string
          nome: string
          observacoes: string | null
          saida: string
        }
        Insert: {
          created_at?: string
          entrada: string
          id?: number
          intervalo_fim?: string | null
          intervalo_inicio?: string | null
          jornada_trabalho?: string
          nome: string
          observacoes?: string | null
          saida: string
        }
        Update: {
          created_at?: string
          entrada?: string
          id?: number
          intervalo_fim?: string | null
          intervalo_inicio?: string | null
          jornada_trabalho?: string
          nome?: string
          observacoes?: string | null
          saida?: string
        }
        Relationships: []
      }
      funcionarios: {
        Row: {
          ativo: boolean
          codigo_4_digitos: string
          cpf: string
          created_at: string
          data_admissao: string
          data_inicio_vigencia: string
          data_nascimento: string
          email: string
          escala_id: number
          funcao: string
          id: string
          nome_completo: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          codigo_4_digitos: string
          cpf: string
          created_at?: string
          data_admissao: string
          data_inicio_vigencia: string
          data_nascimento: string
          email: string
          escala_id: number
          funcao: string
          id?: string
          nome_completo: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          codigo_4_digitos?: string
          cpf?: string
          created_at?: string
          data_admissao?: string
          data_inicio_vigencia?: string
          data_nascimento?: string
          email?: string
          escala_id?: number
          funcao?: string
          id?: string
          nome_completo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_escala_id_fkey"
            columns: ["escala_id"]
            isOneToOne: false
            referencedRelation: "escalas"
            referencedColumns: ["id"]
          },
        ]
      }
      prontuario_ciclos: {
        Row: {
          created_at: string
          data_ciclo: string
          data_criacao: string
          data_encerramento: string | null
          funcionario_encerrou: string | null
          id: string
          residente_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_ciclo: string
          data_criacao?: string
          data_encerramento?: string | null
          funcionario_encerrou?: string | null
          id?: string
          residente_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_ciclo?: string
          data_criacao?: string
          data_encerramento?: string | null
          funcionario_encerrou?: string | null
          id?: string
          residente_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prontuario_ciclos_residente_id_fkey"
            columns: ["residente_id"]
            isOneToOne: false
            referencedRelation: "residentes"
            referencedColumns: ["id"]
          },
        ]
      }
      prontuario_registros: {
        Row: {
          ciclo_id: string | null
          created_at: string
          data_registro: string
          descricao: string
          funcionario_id: string
          horario_registro: string
          id: string
          observacoes: string | null
          residente_id: string
          tipo_registro: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ciclo_id?: string | null
          created_at?: string
          data_registro?: string
          descricao: string
          funcionario_id: string
          horario_registro?: string
          id?: string
          observacoes?: string | null
          residente_id: string
          tipo_registro: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ciclo_id?: string | null
          created_at?: string
          data_registro?: string
          descricao?: string
          funcionario_id?: string
          horario_registro?: string
          id?: string
          observacoes?: string | null
          residente_id?: string
          tipo_registro?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prontuario_registros_ciclo_id_fkey"
            columns: ["ciclo_id"]
            isOneToOne: false
            referencedRelation: "prontuario_ciclos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prontuario_registros_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prontuario_registros_residente_id_fkey"
            columns: ["residente_id"]
            isOneToOne: false
            referencedRelation: "residentes"
            referencedColumns: ["id"]
          },
        ]
      }
      prontuario_templates_obrigatorios: {
        Row: {
          ativo: boolean
          created_at: string
          descricao_padrao: string | null
          id: string
          ordem: number
          tipo_registro: string
          titulo: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao_padrao?: string | null
          id?: string
          ordem?: number
          tipo_registro: string
          titulo: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao_padrao?: string | null
          id?: string
          ordem?: number
          tipo_registro?: string
          titulo?: string
        }
        Relationships: []
      }
      registro_tentativas: {
        Row: {
          bloqueado_ate: string | null
          codigo_tentativa: string
          created_at: string
          id: string
          ip_address: unknown | null
          tentativas: number | null
          updated_at: string
        }
        Insert: {
          bloqueado_ate?: string | null
          codigo_tentativa: string
          created_at?: string
          id?: string
          ip_address?: unknown | null
          tentativas?: number | null
          updated_at?: string
        }
        Update: {
          bloqueado_ate?: string | null
          codigo_tentativa?: string
          created_at?: string
          id?: string
          ip_address?: unknown | null
          tentativas?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      registros_ponto: {
        Row: {
          created_at: string | null
          data: string | null
          entrada: string | null
          funcionario_id: string | null
          id: string
          intervalo_fim: string | null
          intervalo_inicio: string | null
          justificativa: string | null
          latitude: number | null
          longitude: number | null
          observacoes: string | null
          saida: string | null
          tipo_registro: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data?: string | null
          entrada?: string | null
          funcionario_id?: string | null
          id?: string
          intervalo_fim?: string | null
          intervalo_inicio?: string | null
          justificativa?: string | null
          latitude?: number | null
          longitude?: number | null
          observacoes?: string | null
          saida?: string | null
          tipo_registro?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data?: string | null
          entrada?: string | null
          funcionario_id?: string | null
          id?: string
          intervalo_fim?: string | null
          intervalo_inicio?: string | null
          justificativa?: string | null
          latitude?: number | null
          longitude?: number | null
          observacoes?: string | null
          saida?: string | null
          tipo_registro?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registros_ponto_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      residentes: {
        Row: {
          ativo: boolean
          condicoes_medicas: string | null
          cpf: string | null
          created_at: string
          data_nascimento: string
          id: string
          nome_completo: string
          numero_prontuario: string
          observacoes_gerais: string | null
          quarto: string | null
          responsavel_email: string | null
          responsavel_nome: string | null
          responsavel_telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          condicoes_medicas?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento: string
          id?: string
          nome_completo: string
          numero_prontuario: string
          observacoes_gerais?: string | null
          quarto?: string | null
          responsavel_email?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          condicoes_medicas?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string
          id?: string
          nome_completo?: string
          numero_prontuario?: string
          observacoes_gerais?: string | null
          quarto?: string | null
          responsavel_email?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tipos_afastamento: {
        Row: {
          categoria: string
          codigo: string
          created_at: string
          descricao: string
          id: number
          remunerado: boolean
        }
        Insert: {
          categoria: string
          codigo: string
          created_at?: string
          descricao: string
          id?: number
          remunerado?: boolean
        }
        Update: {
          categoria?: string
          codigo?: string
          created_at?: string
          descricao?: string
          id?: number
          remunerado?: boolean
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calcular_horas_noturnas: {
        Args: {
          p_entrada: string
          p_intervalo_fim?: string
          p_intervalo_inicio?: string
          p_saida: string
        }
        Returns: unknown
      }
      calcular_horas_trabalhadas: {
        Args: {
          p_entrada: string
          p_intervalo_fim?: string
          p_intervalo_inicio?: string
          p_saida: string
        }
        Returns: unknown
      }
      calcular_horas_trabalhadas_turno_noturno: {
        Args: {
          p_entrada: string
          p_intervalo_fim?: string
          p_intervalo_inicio?: string
          p_saida: string
        }
        Returns: unknown
      }
      calcular_totais_folha_ponto: {
        Args: { p_ano: number; p_funcionario_id: string; p_mes: number }
        Returns: {
          dias_trabalhados: number
          total_abonos: number
          total_faltas: number
          total_horas_extras_diurnas: unknown
          total_horas_extras_noturnas: unknown
          total_horas_trabalhadas: unknown
        }[]
      }
      criar_ciclo_prontuario_diario: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      eh_horario_noturno: {
        Args: {
          p_fim_noturno?: string
          p_horario: string
          p_inicio_noturno?: string
        }
        Returns: boolean
      }
      encerrar_ciclo_prontuario: {
        Args: { p_ciclo_id: string; p_funcionario_id: string }
        Returns: boolean
      }
      executar_criacao_prontuarios_manual: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      gerar_folha_ponto_mensal: {
        Args: { p_ano: number; p_funcionario_id: string; p_mes: number }
        Returns: {
          abonos: boolean
          data: string
          dia: number
          entrada: string
          faltas: boolean
          funcionario_cpf: string
          funcionario_escala_entrada: string
          funcionario_escala_nome: string
          funcionario_escala_saida: string
          funcionario_funcao: string
          funcionario_nome: string
          horas_extras_diurnas: string
          horas_extras_noturnas: string
          horas_trabalhadas: string
          intervalo_fim: string
          intervalo_inicio: string
          observacoes: string
          saida: string
        }[]
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      inserir_intervalo_automatico: {
        Args: {
          p_data: string
          p_entrada: string
          p_funcionario_id: string
          p_saida: string
        }
        Returns: {
          intervalo_fim: string
          intervalo_inicio: string
        }[]
      }
      log_audit_event: {
        Args: {
          p_dados_anteriores?: Json
          p_dados_novos?: Json
          p_operacao: string
          p_tabela: string
        }
        Returns: undefined
      }
      obter_data_referencia_registro: {
        Args: {
          p_data_entrada: string
          p_hora_entrada: string
          p_hora_saida: string
        }
        Returns: string
      }
      preencher_horarios_por_escala: {
        Args: {
          p_data_fim: string
          p_data_inicio: string
          p_funcionario_id: string
        }
        Returns: {
          data: string
          deve_trabalhar: boolean
          entrada: string
          intervalo_fim: string
          intervalo_inicio: string
          saida: string
        }[]
      }
      registrar_tentativa_codigo: {
        Args: { p_codigo: string; p_ip_address?: unknown }
        Returns: undefined
      }
      validar_codigo_funcionario: {
        Args: { p_codigo: string }
        Returns: {
          funcionario_id: string
          nome_completo: string
          valid: boolean
        }[]
      }
      verificar_ciclo_completo: {
        Args: { p_ciclo_id: string }
        Returns: boolean
      }
      verificar_limite_tentativas: {
        Args: { p_codigo: string; p_ip_address?: unknown }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "employee"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "employee"],
    },
  },
} as const
