/**
 * Handmatig geschreven, op basis van supabase/migrations/00001_init.sql.
 * Vervang dit bestand later door de écht gegenereerde types zodra je lokaal
 * `supabase login && supabase link` hebt gedraaid:
 *   npm run supabase:types
 */

export interface Database {
  public: {
    Tables: {
      events: {
        Row: {
          id: string
          name: string
          low_stock_default: number
          opening_float_cents: number
          return_days: number
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['events']['Row']> & { name: string }
        Update: Partial<Database['public']['Tables']['events']['Row']>
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          event_id: string
          name: string
          default_vat_rate_bp: number
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['categories']['Row']> & {
          event_id: string
          name: string
          default_vat_rate_bp: number
        }
        Update: Partial<Database['public']['Tables']['categories']['Row']>
        Relationships: []
      }
      registers: {
        Row: {
          id: string
          event_id: string
          name: string
          code: string
          current_receipt_no: number
          active: boolean
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['registers']['Row']> & {
          event_id: string
          name: string
          code: string
        }
        Update: Partial<Database['public']['Tables']['registers']['Row']>
        Relationships: []
      }
      products: {
        Row: {
          id: string
          event_id: string
          sku: string
          name: string
          category_id: string
          variant: string
          vat_rate_bp: number | null
          price_cents: number
          cost_cents: number
          stock: number
          min_stock: number | null
          barcode: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['products']['Row']> & {
          event_id: string
          sku: string
          name: string
          category_id: string
          price_cents: number
        }
        Update: Partial<Database['public']['Tables']['products']['Row']>
        Relationships: [
          {
            foreignKeyName: 'products_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
        ]
      }
      receipts: {
        Row: {
          id: string
          register_id: string
          receipt_number: number
          kind: 'sale' | 'refund'
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['receipts']['Row']> & {
          register_id: string
          receipt_number: number
          kind: 'sale' | 'refund'
        }
        Update: Partial<Database['public']['Tables']['receipts']['Row']>
        Relationships: [
          {
            foreignKeyName: 'receipts_register_id_fkey'
            columns: ['register_id']
            isOneToOne: false
            referencedRelation: 'registers'
            referencedColumns: ['id']
          },
        ]
      }
      sales: {
        Row: {
          id: string
          method: 'pin' | 'cash' | 'qr'
          subtotal_cents: number
          discount_cents: number
          total_cents: number
          paid_cents: number
          credit_cents: number
          credit_ref_id: string | null
          received_cents: number | null
        }
        Insert: Database['public']['Tables']['sales']['Row']
        Update: Partial<Database['public']['Tables']['sales']['Row']>
        Relationships: [
          {
            foreignKeyName: 'sales_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'receipts'
            referencedColumns: ['id']
          },
        ]
      }
      sale_items: {
        Row: {
          id: string
          sale_id: string
          product_id: string
          sku_snapshot: string
          name_snapshot: string
          variant_snapshot: string
          category_snapshot: string
          vat_rate_bp_snapshot: number
          unit_price_cents: number
          unit_cost_cents: number
          qty: number
        }
        Insert: Omit<Database['public']['Tables']['sale_items']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['sale_items']['Row']>
        Relationships: [
          {
            foreignKeyName: 'sale_items_sale_id_fkey'
            columns: ['sale_id']
            isOneToOne: false
            referencedRelation: 'sales'
            referencedColumns: ['id']
          },
        ]
      }
      refunds: {
        Row: {
          id: string
          method: 'pin' | 'cash' | 'qr' | 'exchange'
          reason: 'wrong_size' | 'defective' | 'unhappy' | 'mis_scanned' | 'other'
          restock: boolean
          ref_sale_id: string | null
          subtotal_cents: number
          discount_cents: number
          total_cents: number
        }
        Insert: Database['public']['Tables']['refunds']['Row']
        Update: Partial<Database['public']['Tables']['refunds']['Row']>
        Relationships: []
      }
      refund_items: {
        Row: {
          id: string
          refund_id: string
          product_id: string
          sku_snapshot: string
          name_snapshot: string
          variant_snapshot: string
          category_snapshot: string
          vat_rate_bp_snapshot: number
          original_unit_price_cents: number
          refunded_unit_cents: number
          unit_cost_cents: number
          qty: number
        }
        Insert: Omit<Database['public']['Tables']['refund_items']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['refund_items']['Row']>
        Relationships: []
      }
      stock_movements: {
        Row: {
          id: string
          event_id: string
          product_id: string
          register_id: string | null
          sale_id: string | null
          refund_id: string | null
          import_batch_id: string | null
          sku_snapshot: string
          name_snapshot: string
          variant_snapshot: string
          delta: number
          balance_after: number | null
          reason: 'sale' | 'return' | 'delivery' | 'count' | 'correction' | 'import' | 'manual'
          ref: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['stock_movements']['Row']> & {
          event_id: string
          product_id: string
          delta: number
          reason: Database['public']['Tables']['stock_movements']['Row']['reason']
        }
        Update: Partial<Database['public']['Tables']['stock_movements']['Row']>
        Relationships: []
      }
      import_batches: {
        Row: {
          id: string
          event_id: string
          filename: string
          mode: 'overwrite' | 'add'
          row_count: number
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['import_batches']['Row']> & {
          event_id: string
          filename: string
          mode: 'overwrite' | 'add'
          row_count: number
        }
        Update: Partial<Database['public']['Tables']['import_batches']['Row']>
        Relationships: []
      }
      closings: {
        Row: {
          id: string
          event_id: string
          register_id: string | null
          date: string
          opening_float_cents: number
          expected_cents: number
          counted_cents: number
          diff_cents: number
          tx_count: number
          net_cents: number
          gross_cents: number
          refunds_cents: number
          discount_cents: number
          vat_cents: number
          items_count: number
          methods: Record<string, { in: number; out: number; n: number }>
          note: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['closings']['Row']> & {
          event_id: string
          date: string
          opening_float_cents: number
          expected_cents: number
          counted_cents: number
          diff_cents: number
          tx_count: number
          net_cents: number
          gross_cents: number
          refunds_cents: number
          discount_cents: number
          vat_cents: number
          items_count: number
          methods: Database['public']['Tables']['closings']['Row']['methods']
        }
        Update: Partial<Database['public']['Tables']['closings']['Row']>
        Relationships: [
          {
            foreignKeyName: 'closings_register_id_fkey'
            columns: ['register_id']
            isOneToOne: false
            referencedRelation: 'registers'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      checkout_sale: {
        Args: {
          p_register_id: string
          p_method: string
          p_items: { product_id: string; qty: number; unit_price_cents: number }[]
          p_discount_cents?: number
          p_received_cents?: number | null
          p_credit_cents?: number
          p_credit_ref_id?: string | null
        }
        Returns: { sale_id: string; receipt_number: number }[]
      }
      create_refund: {
        Args: {
          p_register_id: string
          p_method: string
          p_reason: string
          p_restock: boolean
          p_ref_sale_id: string | null
          p_items: { product_id: string; qty: number; original_unit_price_cents: number; refunded_unit_cents: number }[]
        }
        Returns: { refund_id: string; receipt_number: number }[]
      }
      apply_stock_movement: {
        Args: {
          p_product_id: string
          p_delta: number
          p_reason: string
          p_ref?: string | null
          p_register_id?: string | null
          p_import_batch_id?: string | null
        }
        Returns: Database['public']['Tables']['stock_movements']['Row']
      }
      create_product: {
        Args: {
          p_event_id: string
          p_sku: string
          p_name: string
          p_category_id: string
          p_variant: string
          p_price_cents: number
          p_cost_cents: number
          p_min_stock?: number | null
          p_barcode?: string | null
          p_vat_rate_bp?: number | null
        }
        Returns: Database['public']['Tables']['products']['Row']
      }
      update_product_details: {
        Args: {
          p_product_id: string
          p_name: string
          p_category_id: string
          p_variant: string
          p_price_cents: number
          p_cost_cents: number
          p_min_stock: number | null
          p_barcode: string | null
          p_vat_rate_bp: number | null
          p_active: boolean
        }
        Returns: Database['public']['Tables']['products']['Row']
      }
    }
  }
}
