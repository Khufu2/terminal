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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          balance_usd: number
          created_at: string
          equity_usd: number
          id: string
          label: string
          market: string
          mode: string
          target_weight: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_usd?: number
          created_at?: string
          equity_usd?: number
          id?: string
          label: string
          market: string
          mode?: string
          target_weight?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_usd?: number
          created_at?: string
          equity_usd?: number
          id?: string
          label?: string
          market?: string
          mode?: string
          target_weight?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      advisor_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          body: string | null
          created_at: string
          delivered: boolean
          id: string
          level: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          delivered?: boolean
          id?: string
          level?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          delivered?: boolean
          id?: string
          level?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      bot_decisions: {
        Row: {
          accepted: boolean
          action: string
          blocked_reason: string | null
          confidence: number
          created_at: string
          id: string
          market: string
          price: number | null
          quantity: number | null
          reason: string | null
          symbol: string
          user_id: string
        }
        Insert: {
          accepted?: boolean
          action: string
          blocked_reason?: string | null
          confidence?: number
          created_at?: string
          id?: string
          market: string
          price?: number | null
          quantity?: number | null
          reason?: string | null
          symbol: string
          user_id: string
        }
        Update: {
          accepted?: boolean
          action?: string
          blocked_reason?: string | null
          confidence?: number
          created_at?: string
          id?: string
          market?: string
          price?: number | null
          quantity?: number | null
          reason?: string | null
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
      bot_runs: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          job: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          job: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          job?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      connections: {
        Row: {
          category: string
          created_at: string
          id: string
          notes: string | null
          provider: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          notes?: string | null
          provider: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          notes?: string | null
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      equity_snapshots: {
        Row: {
          equity_usd: number
          id: string
          market: string
          snapshot_at: string
          user_id: string
        }
        Insert: {
          equity_usd: number
          id?: string
          market: string
          snapshot_at?: string
          user_id: string
        }
        Update: {
          equity_usd?: number
          id?: string
          market?: string
          snapshot_at?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_entries: {
        Row: {
          amount: number
          category: string
          created_at: string
          entry_date: string
          id: string
          kind: string
          label: string
          recurring: boolean
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          entry_date?: string
          id?: string
          kind: string
          label: string
          recurring?: boolean
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          entry_date?: string
          id?: string
          kind?: string
          label?: string
          recurring?: boolean
          user_id?: string
        }
        Relationships: []
      }
      followed_traders: {
        Row: {
          created_at: string
          current_stance: string | null
          following: boolean
          handle: string | null
          id: string
          market: string
          name: string
          specialty: string | null
          user_id: string
          win_rate: number
          ytd_return: number
        }
        Insert: {
          created_at?: string
          current_stance?: string | null
          following?: boolean
          handle?: string | null
          id?: string
          market: string
          name: string
          specialty?: string | null
          user_id: string
          win_rate?: number
          ytd_return?: number
        }
        Update: {
          created_at?: string
          current_stance?: string | null
          following?: boolean
          handle?: string | null
          id?: string
          market?: string
          name?: string
          specialty?: string | null
          user_id?: string
          win_rate?: number
          ytd_return?: number
        }
        Relationships: []
      }
      holdings: {
        Row: {
          avg_cost: number
          created_at: string
          id: string
          last_price: number
          market: string
          name: string | null
          quantity: number
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_cost?: number
          created_at?: string
          id?: string
          last_price?: number
          market: string
          name?: string | null
          quantity?: number
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_cost?: number
          created_at?: string
          id?: string
          last_price?: number
          market?: string
          name?: string | null
          quantity?: number
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          body: string | null
          created_at: string
          entry_date: string
          id: string
          market: string | null
          outcome: string | null
          r_multiple: number | null
          symbol: string | null
          tags: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          entry_date?: string
          id?: string
          market?: string | null
          outcome?: string | null
          r_multiple?: number | null
          symbol?: string | null
          tags?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          entry_date?: string
          id?: string
          market?: string | null
          outcome?: string | null
          r_multiple?: number | null
          symbol?: string | null
          tags?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      news_items: {
        Row: {
          created_at: string
          id: string
          impact: string
          published_at: string
          sentiment: number
          source: string
          summary: string | null
          symbols: string | null
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          impact?: string
          published_at?: string
          sentiment?: number
          source: string
          summary?: string | null
          symbols?: string | null
          title: string
          url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          impact?: string
          published_at?: string
          sentiment?: number
          source?: string
          summary?: string | null
          symbols?: string | null
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          base_currency: string
          created_at: string
          display_name: string | null
          id: string
          risk_profile: string
          starting_capital: number
          updated_at: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          display_name?: string | null
          id: string
          risk_profile?: string
          starting_capital?: number
          updated_at?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          display_name?: string | null
          id?: string
          risk_profile?: string
          starting_capital?: number
          updated_at?: string
        }
        Relationships: []
      }
      risk_settings: {
        Row: {
          autonomy_enabled: boolean
          created_at: string
          daily_loss_limit_pct: number
          day_start_date: string
          day_start_equity: number
          halt_reason: string | null
          halted: boolean
          id: string
          live_crypto: boolean
          live_kalshi: boolean
          live_stocks: boolean
          max_drawdown_pct: number
          max_market_exposure_pct: number
          max_open_positions: number
          min_confidence: number
          peak_equity: number
          risk_per_trade_pct: number
          telegram_chat_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          autonomy_enabled?: boolean
          created_at?: string
          daily_loss_limit_pct?: number
          day_start_date?: string
          day_start_equity?: number
          halt_reason?: string | null
          halted?: boolean
          id?: string
          live_crypto?: boolean
          live_kalshi?: boolean
          live_stocks?: boolean
          max_drawdown_pct?: number
          max_market_exposure_pct?: number
          max_open_positions?: number
          min_confidence?: number
          peak_equity?: number
          risk_per_trade_pct?: number
          telegram_chat_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          autonomy_enabled?: boolean
          created_at?: string
          daily_loss_limit_pct?: number
          day_start_date?: string
          day_start_equity?: number
          halt_reason?: string | null
          halted?: boolean
          id?: string
          live_crypto?: boolean
          live_kalshi?: boolean
          live_stocks?: boolean
          max_drawdown_pct?: number
          max_market_exposure_pct?: number
          max_open_positions?: number
          min_confidence?: number
          peak_equity?: number
          risk_per_trade_pct?: number
          telegram_chat_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      signals: {
        Row: {
          ai_reason: string | null
          confidence: number
          created_at: string
          direction: string
          entry_price: number | null
          id: string
          market: string
          sentiment: number
          source: string
          stop_price: number | null
          symbol: string
          target_price: number | null
          user_id: string
        }
        Insert: {
          ai_reason?: string | null
          confidence?: number
          created_at?: string
          direction: string
          entry_price?: number | null
          id?: string
          market: string
          sentiment?: number
          source?: string
          stop_price?: number | null
          symbol: string
          target_price?: number | null
          user_id: string
        }
        Update: {
          ai_reason?: string | null
          confidence?: number
          created_at?: string
          direction?: string
          entry_price?: number | null
          id?: string
          market?: string
          sentiment?: number
          source?: string
          stop_price?: number | null
          symbol?: string
          target_price?: number | null
          user_id?: string
        }
        Relationships: []
      }
      strategies: {
        Row: {
          created_at: string
          crypto_weight: number
          description: string | null
          id: string
          is_active: boolean
          kalshi_weight: number
          max_position_pct: number
          min_confidence: number
          name: string
          risk_level: string
          stocks_weight: number
          user_id: string
        }
        Insert: {
          created_at?: string
          crypto_weight?: number
          description?: string | null
          id?: string
          is_active?: boolean
          kalshi_weight?: number
          max_position_pct?: number
          min_confidence?: number
          name: string
          risk_level?: string
          stocks_weight?: number
          user_id: string
        }
        Update: {
          created_at?: string
          crypto_weight?: number
          description?: string | null
          id?: string
          is_active?: boolean
          kalshi_weight?: number
          max_position_pct?: number
          min_confidence?: number
          name?: string
          risk_level?: string
          stocks_weight?: number
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          created_at: string
          executed_at: string
          fees: number
          id: string
          market: string
          mode: string
          notes: string | null
          order_type: string
          price: number
          quantity: number
          side: string
          status: string
          stop_price: number | null
          symbol: string
          target_price: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          executed_at?: string
          fees?: number
          id?: string
          market: string
          mode?: string
          notes?: string | null
          order_type?: string
          price: number
          quantity: number
          side: string
          status?: string
          stop_price?: number | null
          symbol: string
          target_price?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          executed_at?: string
          fees?: number
          id?: string
          market?: string
          mode?: string
          notes?: string | null
          order_type?: string
          price?: number
          quantity?: number
          side?: string
          status?: string
          stop_price?: number | null
          symbol?: string
          target_price?: number | null
          user_id?: string
        }
        Relationships: []
      }
      watchlist_items: {
        Row: {
          created_at: string
          id: string
          market: string
          name: string | null
          symbol: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          market: string
          name?: string | null
          symbol: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          market?: string
          name?: string | null
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      verify_cron_token: { Args: { _token: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
