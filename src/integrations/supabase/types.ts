export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
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
          dias_semana: string[]
          entrada: string
          id: number
          nome: string
          saida: string
        }
        Insert: {
          created_at?: string
          dias_semana: string[]
          entrada: string
          id?: number
          nome: string
          saida: string
        }
        Update: {
          created_at?: string
          dias_semana?: string[]
          entrada?: string
          id?: number
          nome?: string
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
          data: string
          entrada: string | null
          funcionario_id: string
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
          data: string
          entrada?: string | null
          funcionario_id: string
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
          data?: string
          entrada?: string | null
          funcionario_id?: string
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
      calcular_horas_trabalhadas: {
        Args: {
          p_entrada: string
          p_saida: string
          p_intervalo_inicio?: string
          p_intervalo_fim?: string
        }
        Returns: unknown
      }
      calcular_totais_folha_ponto: {
        Args: { p_funcionario_id: string; p_mes: number; p_ano: number }
        Returns: {
          total_horas_trabalhadas: unknown
          total_horas_extras_diurnas: unknown
          total_horas_extras_noturnas: unknown
          total_faltas: number
          total_abonos: number
          dias_trabalhados: number
        }[]
      }
      eh_horario_noturno: {
        Args: {
          p_horario: string
          p_inicio_noturno?: string
          p_fim_noturno?: string
        }
        Returns: boolean
      }
      gerar_folha_ponto_mensal: {
        Args: { p_funcionario_id: string; p_mes: number; p_ano: number }
        Returns: {
          funcionario_nome: string
          funcionario_cpf: string
          funcionario_funcao: string
          funcionario_escala_nome: string
          funcionario_escala_entrada: string
          funcionario_escala_saida: string
          dia: number
          data: string
          entrada: string
          intervalo_inicio: string
          intervalo_fim: string
          saida: string
          horas_trabalhadas: unknown
          horas_extras_diurnas: unknown
          horas_extras_noturnas: unknown
          faltas: boolean
          abonos: boolean
          observacoes: string
        }[]
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _user_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      log_audit_event: {
        Args: {
          p_tabela: string
          p_operacao: string
          p_dados_anteriores?: Json
          p_dados_novos?: Json
        }
        Returns: undefined
      }
      registrar_tentativa_codigo: {
        Args: { p_codigo: string; p_ip_address?: unknown }
        Returns: undefined
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
