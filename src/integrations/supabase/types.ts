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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      cad_meshes: {
        Row: {
          created_at: string | null
          file_hash: string
          file_name: string
          id: string
          indices: number[]
          line_item_id: string | null
          normals: number[]
          quotation_id: string | null
          triangle_count: number
          vertices: number[]
        }
        Insert: {
          created_at?: string | null
          file_hash: string
          file_name: string
          id?: string
          indices: number[]
          line_item_id?: string | null
          normals: number[]
          quotation_id?: string | null
          triangle_count: number
          vertices: number[]
        }
        Update: {
          created_at?: string | null
          file_hash?: string
          file_name?: string
          id?: string
          indices?: number[]
          line_item_id?: string | null
          normals?: number[]
          quotation_id?: string | null
          triangle_count?: number
          vertices?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "cad_meshes_line_item_id_fkey"
            columns: ["line_item_id"]
            isOneToOne: false
            referencedRelation: "quote_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cad_meshes_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotation_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          created_at: string | null
          email: string
          id: string
          ip_hash: string
          submitted_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          ip_hash: string
          submitted_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          ip_hash?: string
          submitted_at?: string | null
        }
        Relationships: []
      }
      manufacturing_processes: {
        Row: {
          base_rate_per_hour: number
          complexity_multiplier: number | null
          created_at: string | null
          depth_of_cut_mm: number | null
          feed_rate_mm_per_min: number | null
          id: string
          is_active: boolean | null
          name: string
          rapid_feed_rate_mm_per_min: number | null
          setup_cost: number
          spindle_speed_rpm: number | null
          tool_change_time_minutes: number | null
        }
        Insert: {
          base_rate_per_hour: number
          complexity_multiplier?: number | null
          created_at?: string | null
          depth_of_cut_mm?: number | null
          feed_rate_mm_per_min?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          rapid_feed_rate_mm_per_min?: number | null
          setup_cost: number
          spindle_speed_rpm?: number | null
          tool_change_time_minutes?: number | null
        }
        Update: {
          base_rate_per_hour?: number
          complexity_multiplier?: number | null
          created_at?: string | null
          depth_of_cut_mm?: number | null
          feed_rate_mm_per_min?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          rapid_feed_rate_mm_per_min?: number | null
          setup_cost?: number
          spindle_speed_rpm?: number | null
          tool_change_time_minutes?: number | null
        }
        Relationships: []
      }
      material_categories: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      material_costs: {
        Row: {
          category_id: string | null
          chip_load_per_tooth: number | null
          cost_per_cubic_cm: number
          cost_per_square_cm: number
          created_at: string | null
          cross_sections: Json | null
          cutting_speed_m_per_min: number | null
          cutting_speed_m_per_min_max: number | null
          cutting_speed_m_per_min_min: number | null
          default_nesting_efficiency: number | null
          density: number | null
          depth_of_cut_mm_max: number | null
          depth_of_cut_mm_min: number | null
          feed_rate_mm_per_min_max: number | null
          feed_rate_mm_per_min_min: number | null
          finish_options: Json | null
          hardness_brinell: number | null
          id: string
          is_active: boolean | null
          machinability_rating: number | null
          material_name: string
          price_per_lb: number | null
          pricing_method: string | null
          recommended_coolant: string | null
          sheet_configurations: Json | null
          spindle_speed_rpm_max: number | null
          spindle_speed_rpm_min: number | null
          tool_life_factor: number | null
          work_hardening_factor: number | null
        }
        Insert: {
          category_id?: string | null
          chip_load_per_tooth?: number | null
          cost_per_cubic_cm: number
          cost_per_square_cm: number
          created_at?: string | null
          cross_sections?: Json | null
          cutting_speed_m_per_min?: number | null
          cutting_speed_m_per_min_max?: number | null
          cutting_speed_m_per_min_min?: number | null
          default_nesting_efficiency?: number | null
          density?: number | null
          depth_of_cut_mm_max?: number | null
          depth_of_cut_mm_min?: number | null
          feed_rate_mm_per_min_max?: number | null
          feed_rate_mm_per_min_min?: number | null
          finish_options?: Json | null
          hardness_brinell?: number | null
          id?: string
          is_active?: boolean | null
          machinability_rating?: number | null
          material_name: string
          price_per_lb?: number | null
          pricing_method?: string | null
          recommended_coolant?: string | null
          sheet_configurations?: Json | null
          spindle_speed_rpm_max?: number | null
          spindle_speed_rpm_min?: number | null
          tool_life_factor?: number | null
          work_hardening_factor?: number | null
        }
        Update: {
          category_id?: string | null
          chip_load_per_tooth?: number | null
          cost_per_cubic_cm?: number
          cost_per_square_cm?: number
          created_at?: string | null
          cross_sections?: Json | null
          cutting_speed_m_per_min?: number | null
          cutting_speed_m_per_min_max?: number | null
          cutting_speed_m_per_min_min?: number | null
          default_nesting_efficiency?: number | null
          density?: number | null
          depth_of_cut_mm_max?: number | null
          depth_of_cut_mm_min?: number | null
          feed_rate_mm_per_min_max?: number | null
          feed_rate_mm_per_min_min?: number | null
          finish_options?: Json | null
          hardness_brinell?: number | null
          id?: string
          is_active?: boolean | null
          machinability_rating?: number | null
          material_name?: string
          price_per_lb?: number | null
          pricing_method?: string | null
          recommended_coolant?: string | null
          sheet_configurations?: Json | null
          spindle_speed_rpm_max?: number | null
          spindle_speed_rpm_min?: number | null
          tool_life_factor?: number | null
          work_hardening_factor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "material_costs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "material_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      material_process_parameters: {
        Row: {
          created_at: string | null
          cutting_speed_m_per_min: number | null
          cycle_time_multiplier: number | null
          depth_of_cut_mm: number | null
          feed_rate_mm_per_min: number | null
          id: string
          material_id: string
          material_removal_rate_adjustment: number | null
          process_id: string
          setup_time_multiplier: number | null
          spindle_speed_rpm: number | null
          surface_finish_factor: number | null
          tool_wear_multiplier: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          cutting_speed_m_per_min?: number | null
          cycle_time_multiplier?: number | null
          depth_of_cut_mm?: number | null
          feed_rate_mm_per_min?: number | null
          id?: string
          material_id: string
          material_removal_rate_adjustment?: number | null
          process_id: string
          setup_time_multiplier?: number | null
          spindle_speed_rpm?: number | null
          surface_finish_factor?: number | null
          tool_wear_multiplier?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          cutting_speed_m_per_min?: number | null
          cycle_time_multiplier?: number | null
          depth_of_cut_mm?: number | null
          feed_rate_mm_per_min?: number | null
          id?: string
          material_id?: string
          material_removal_rate_adjustment?: number | null
          process_id?: string
          setup_time_multiplier?: number | null
          spindle_speed_rpm?: number | null
          surface_finish_factor?: number | null
          tool_wear_multiplier?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_process_parameters_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "material_costs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_process_parameters_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "manufacturing_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      part_features: {
        Row: {
          created_at: string | null
          feature_type: string
          file_name: string
          id: string
          line_item_id: string | null
          orientation: string | null
          parameters: Json
          quotation_id: string | null
        }
        Insert: {
          created_at?: string | null
          feature_type: string
          file_name: string
          id?: string
          line_item_id?: string | null
          orientation?: string | null
          parameters: Json
          quotation_id?: string | null
        }
        Update: {
          created_at?: string | null
          feature_type?: string
          file_name?: string
          id?: string
          line_item_id?: string | null
          orientation?: string | null
          parameters?: Json
          quotation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "part_features_line_item_id_fkey"
            columns: ["line_item_id"]
            isOneToOne: false
            referencedRelation: "quote_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_features_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotation_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      quotation_submissions: {
        Row: {
          created_at: string
          customer_company: string | null
          customer_message: string | null
          customer_name: string | null
          customer_phone: string | null
          email: string
          id: string
          ip_hash: string
          quote_number: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          shipping_address: string | null
          status: Database["public"]["Enums"]["quotation_status"]
          submitted_at: string
        }
        Insert: {
          created_at?: string
          customer_company?: string | null
          customer_message?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          email: string
          id?: string
          ip_hash: string
          quote_number?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shipping_address?: string | null
          status?: Database["public"]["Enums"]["quotation_status"]
          submitted_at?: string
        }
        Update: {
          created_at?: string
          customer_company?: string | null
          customer_message?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          email?: string
          id?: string
          ip_hash?: string
          quote_number?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shipping_address?: string | null
          status?: Database["public"]["Enums"]["quotation_status"]
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotation_submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_line_items: {
        Row: {
          created_at: string
          estimated_complexity_score: number | null
          estimated_machine_time_hours: number | null
          estimated_surface_area_cm2: number | null
          estimated_volume_cm3: number | null
          file_name: string
          file_path: string
          finish_cost: number | null
          finish_type: string | null
          id: string
          lead_time_days: number | null
          machining_cost: number | null
          material_cost: number | null
          material_type: string | null
          mesh_id: string | null
          notes: string | null
          part_depth_cm: number | null
          part_height_cm: number | null
          part_width_cm: number | null
          preliminary_unit_price: number | null
          quantity: number
          quotation_id: string
          selected_process: string | null
          setup_cost: number | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          estimated_complexity_score?: number | null
          estimated_machine_time_hours?: number | null
          estimated_surface_area_cm2?: number | null
          estimated_volume_cm3?: number | null
          file_name: string
          file_path: string
          finish_cost?: number | null
          finish_type?: string | null
          id?: string
          lead_time_days?: number | null
          machining_cost?: number | null
          material_cost?: number | null
          material_type?: string | null
          mesh_id?: string | null
          notes?: string | null
          part_depth_cm?: number | null
          part_height_cm?: number | null
          part_width_cm?: number | null
          preliminary_unit_price?: number | null
          quantity?: number
          quotation_id: string
          selected_process?: string | null
          setup_cost?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          estimated_complexity_score?: number | null
          estimated_machine_time_hours?: number | null
          estimated_surface_area_cm2?: number | null
          estimated_volume_cm3?: number | null
          file_name?: string
          file_path?: string
          finish_cost?: number | null
          finish_type?: string | null
          id?: string
          lead_time_days?: number | null
          machining_cost?: number | null
          material_cost?: number | null
          material_type?: string | null
          mesh_id?: string | null
          notes?: string | null
          part_depth_cm?: number | null
          part_height_cm?: number | null
          part_width_cm?: number | null
          preliminary_unit_price?: number | null
          quantity?: number
          quotation_id?: string
          selected_process?: string | null
          setup_cost?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_line_items_mesh_id_fkey"
            columns: ["mesh_id"]
            isOneToOne: false
            referencedRelation: "cad_meshes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotation_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          created_at: string
          created_by: string
          currency: string
          estimated_lead_time_days: number | null
          id: string
          notes: string | null
          quotation_id: string
          quote_number: string
          rejected_at: string | null
          sent_at: string | null
          shipping_cost: number
          subtotal: number
          tax_amount: number
          tax_rate: number
          total_amount: number
          valid_until: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          created_by: string
          currency?: string
          estimated_lead_time_days?: number | null
          id?: string
          notes?: string | null
          quotation_id: string
          quote_number: string
          rejected_at?: string | null
          sent_at?: string | null
          shipping_cost?: number
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total_amount?: number
          valid_until?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          estimated_lead_time_days?: number | null
          id?: string
          notes?: string | null
          quotation_id?: string
          quote_number?: string
          rejected_at?: string | null
          sent_at?: string | null
          shipping_cost?: number
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total_amount?: number
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: true
            referencedRelation: "quotation_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      surface_treatments: {
        Row: {
          category: string
          cost_per_cm2: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          category: string
          cost_per_cm2?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          category?: string
          cost_per_cm2?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      website_content: {
        Row: {
          content: Json
          id: string
          section: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          content?: Json
          id?: string
          section: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          content?: Json
          id?: string
          section?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_quote_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      quotation_status:
        | "pending"
        | "reviewing"
        | "quoted"
        | "accepted"
        | "rejected"
        | "expired"
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
      app_role: ["admin", "user"],
      quotation_status: [
        "pending",
        "reviewing",
        "quoted",
        "accepted",
        "rejected",
        "expired",
      ],
    },
  },
} as const
