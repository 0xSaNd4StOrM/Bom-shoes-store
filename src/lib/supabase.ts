import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pediesdpfmsdfceeknlb.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlZGllc2RwZm1zZGZjZWVrbmxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3ODYwMjksImV4cCI6MjA5NzM2MjAyOX0.-PDnyFqZ371n5Hno30klvSaIQACpkwVFWCO40douhrw'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Product = {
  id: string
  name: string
  slug: string
  description: string | null
  price: number
  category: string | null
  image_url: string | null
  stock: number
  sizes: string[]
  colors: string[]
  featured: boolean
  created_at: string
}

export type Order = {
  id: string
  user_id: string | null
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  shipping_address: string | null
  total_amount: number | null
  status: string
  payment_status: string
  payment_method: string | null
  kashier_order_id: string | null
  items: any
  created_at: string
}

export type Profile = {
  id: string
  email: string | null
  full_name: string | null
  role: string
  created_at: string
}
