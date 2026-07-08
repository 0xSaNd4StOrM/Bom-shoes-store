import { useEffect, useState } from 'react'
import { supabase, Coupon } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useCurrency } from '@/contexts/CurrencyContext'
import { Loader2, Plus, X, Edit2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { CATEGORY_VALUES } from './AdminProducts'

const EMPTY: Partial<Coupon> = {
  code: '',
  requires_code: true,
  description: '',
  discount_type: 'percentage',
  discount_value: 0,
  min_order_amount: null,
  max_discount_amount: null,
  usage_limit: null,
  per_customer_limit: null,
  starts_at: null,
  ends_at: null,
  active: true,
  target_type: 'all',
  target_category: null,
  target_product_ids: [],
  buy_quantity: null,
  get_quantity: null,
  get_discount_percent: null,
  stackable: false,
}

type ProductOption = { id: string; name: string }

// `starts_at`/`ends_at` are stored as timestamptz ISO strings; <input
// type="datetime-local"> needs/returns a timezone-less "YYYY-MM-DDTHH:mm" in
// the browser's local time -- these just round-trip between the two.
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fromLocalInput(v: string): string | null {
  return v ? new Date(v).toISOString() : null
}

function discountLabel(c: Coupon, formatPrice: (n: number) => string): string {
  if (c.discount_type === 'percentage') return `${c.discount_value}% off`
  if (c.discount_type === 'fixed') return `${formatPrice(c.discount_value)} off`
  if (c.discount_type === 'buy_x_get_y') {
    return `Buy ${c.buy_quantity ?? '?'} Get ${c.get_quantity ?? '?'} ${c.get_discount_percent ?? '?'}% off`
  }
  return 'Free shipping'
}

function dateRangeLabel(c: Coupon): string {
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null)
  const start = fmt(c.starts_at)
  const end = fmt(c.ends_at)
  if (!start && !end) return 'No date limit'
  return `${start || 'Any'} → ${end || 'Any'}`
}

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({})
  const [products, setProducts] = useState<ProductOption[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Coupon> | null>(null)
  const [saving, setSaving] = useState(false)
  const { isAdmin } = useAuth()
  const { formatPrice, currency } = useCurrency()

  async function load() {
    setLoading(true)
    const [{ data: couponRows }, { data: redemptions }, { data: productRows }] = await Promise.all([
      supabase.from('coupons').select('*').order('created_at', { ascending: false }),
      supabase.from('coupon_redemptions').select('coupon_id'),
      supabase.from('products').select('id, name').order('name'),
    ])
    setCoupons(couponRows || [])
    setProducts(productRows || [])
    const counts: Record<string, number> = {}
    for (const r of redemptions || []) counts[r.coupon_id] = (counts[r.coupon_id] || 0) + 1
    setUsageCounts(counts)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openNew() {
    setEditing({ ...EMPTY })
  }
  function openEdit(c: Coupon) {
    setEditing({ ...c })
  }

  async function toggleActive(c: Coupon) {
    const { error } = await supabase.from('coupons').update({ active: !c.active }).eq('id', c.id)
    if (error) { toast.error(error.message); return }
    load()
  }

  async function handleSave() {
    if (!editing) return
    if (editing.requires_code && !editing.code?.trim()) {
      toast.error('A code is required unless this coupon applies automatically')
      return
    }
    setSaving(true)
    try {
      const payload = {
        code: editing.requires_code ? editing.code!.trim() : null,
        requires_code: !!editing.requires_code,
        description: editing.description?.trim() || null,
        discount_type: editing.discount_type || 'percentage',
        discount_value: Number(editing.discount_value) || 0,
        min_order_amount: editing.min_order_amount === null || editing.min_order_amount === undefined || (editing.min_order_amount as any) === '' ? null : Number(editing.min_order_amount),
        max_discount_amount: editing.max_discount_amount === null || editing.max_discount_amount === undefined || (editing.max_discount_amount as any) === '' ? null : Number(editing.max_discount_amount),
        usage_limit: editing.usage_limit === null || editing.usage_limit === undefined || (editing.usage_limit as any) === '' ? null : Number(editing.usage_limit),
        per_customer_limit: editing.per_customer_limit === null || editing.per_customer_limit === undefined || (editing.per_customer_limit as any) === '' ? null : Number(editing.per_customer_limit),
        starts_at: editing.starts_at || null,
        ends_at: editing.ends_at || null,
        active: !!editing.active,
        target_type: editing.target_type || 'all',
        target_category: editing.target_type === 'category' ? (editing.target_category || null) : null,
        target_product_ids: editing.target_type === 'products' ? (editing.target_product_ids || []) : [],
        buy_quantity: editing.discount_type === 'buy_x_get_y' ? Number(editing.buy_quantity) || null : null,
        get_quantity: editing.discount_type === 'buy_x_get_y' ? Number(editing.get_quantity) || null : null,
        get_discount_percent: editing.discount_type === 'buy_x_get_y' ? Number(editing.get_discount_percent) || null : null,
        stackable: !!editing.stackable,
      }

      if (editing.id) {
        const { error } = await supabase.from('coupons').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('coupons').insert(payload)
        if (error) throw error
      }

      toast.success(editing.id ? 'Coupon updated' : 'Coupon created')
      setEditing(null)
      load()
    } catch (e: any) {
      toast.error(e.message || 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(c: Coupon) {
    if (!confirm(`Delete ${c.code || 'this auto-promotion'}?`)) return
    const { error } = await supabase.from('coupons').delete().eq('id', c.id)
    if (error) { toast.error(error.message); return }
    toast.success('Coupon deleted')
    load()
  }

  function toggleTargetProduct(id: string) {
    setEditing(prev => {
      if (!prev) return prev
      const set = new Set(prev.target_product_ids || [])
      if (set.has(id)) set.delete(id); else set.add(id)
      return { ...prev, target_product_ids: Array.from(set) }
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">{coupons.length} coupon{coupons.length === 1 ? '' : 's'}</p>
        {isAdmin && (
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-sm tracking-wider hover:bg-primary/90 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add coupon
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-24 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs tracking-widest uppercase text-muted-foreground">
                <tr>
                  <th className="text-start px-4 py-3">Code</th>
                  <th className="text-start px-4 py-3">Discount</th>
                  <th className="text-start px-4 py-3">Stackable</th>
                  <th className="text-start px-4 py-3">Active</th>
                  <th className="text-start px-4 py-3">Usage</th>
                  <th className="text-start px-4 py-3">Dates</th>
                  <th className="text-end px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map(c => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-mono font-medium">{c.code || 'Auto-apply'}</p>
                      {c.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{c.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{discountLabel(c, formatPrice)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.stackable ? 'Yes' : '—'}</td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={c.active}
                        onChange={() => toggleActive(c)}
                        className="w-4 h-4 cursor-pointer"
                        aria-label="Active"
                      />
                    </td>
                    <td className="px-4 py-3">
                      {usageCounts[c.id] || 0} / {c.usage_limit ?? '∞'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{dateRangeLabel(c)}</td>
                    <td className="px-4 py-3 text-end">
                      <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-muted cursor-pointer" aria-label="Edit coupon">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(c)} className="p-1.5 hover:bg-muted text-red-700 cursor-pointer" aria-label="Delete coupon">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {coupons.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No coupons yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-foreground/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-background w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-background z-10">
              <h2 className="font-display text-2xl">{editing.id ? 'Edit coupon' : 'New coupon'}</h2>
              <button onClick={() => setEditing(null)} className="p-2 cursor-pointer" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!editing.requires_code}
                  onChange={e => setEditing({ ...editing, requires_code: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm">{editing.requires_code ? 'Requires a code' : 'Applies automatically'}</span>
              </label>

              {editing.requires_code && (
                <Field label="Code" value={editing.code || ''} onChange={v => setEditing({ ...editing, code: v.toUpperCase() })} />
              )}

              <div>
                <label className="block text-xs tracking-widest uppercase text-muted-foreground mb-2">Description</label>
                <textarea
                  value={editing.description || ''}
                  onChange={e => setEditing({ ...editing, description: e.target.value })}
                  rows={2}
                  className="w-full bg-transparent border border-border p-3 text-sm focus:border-foreground outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs tracking-widest uppercase text-muted-foreground mb-2">Discount type</label>
                  <select
                    value={editing.discount_type || 'percentage'}
                    onChange={e => setEditing({ ...editing, discount_type: e.target.value as Coupon['discount_type'] })}
                    className="w-full bg-transparent border border-border px-3 py-2 text-sm focus:border-foreground outline-none cursor-pointer"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed amount</option>
                    <option value="free_shipping">Free shipping</option>
                    <option value="buy_x_get_y">Buy X Get Y</option>
                  </select>
                </div>
                <Field
                  label={editing.discount_type === 'percentage' ? 'Discount (%)' : `Discount (${currency})`}
                  type="number"
                  value={String(editing.discount_value ?? 0)}
                  onChange={v => setEditing({ ...editing, discount_value: Number(v) })}
                  disabled={editing.discount_type === 'free_shipping' || editing.discount_type === 'buy_x_get_y'}
                />
              </div>

              {editing.discount_type === 'buy_x_get_y' && (
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Buy quantity" type="number" value={editing.buy_quantity != null ? String(editing.buy_quantity) : ''} onChange={v => setEditing({ ...editing, buy_quantity: v === '' ? null : Number(v) })} />
                  <Field label="Get quantity" type="number" value={editing.get_quantity != null ? String(editing.get_quantity) : ''} onChange={v => setEditing({ ...editing, get_quantity: v === '' ? null : Number(v) })} />
                  <Field label="Get discount (%)" type="number" value={editing.get_discount_percent != null ? String(editing.get_discount_percent) : ''} onChange={v => setEditing({ ...editing, get_discount_percent: v === '' ? null : Number(v) })} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Field label={`Min order amount (${currency})`} type="number" value={editing.min_order_amount != null ? String(editing.min_order_amount) : ''} onChange={v => setEditing({ ...editing, min_order_amount: v === '' ? null : Number(v) })} />
                <Field label={`Max discount amount (${currency})`} type="number" value={editing.max_discount_amount != null ? String(editing.max_discount_amount) : ''} onChange={v => setEditing({ ...editing, max_discount_amount: v === '' ? null : Number(v) })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Usage limit (total)" type="number" value={editing.usage_limit != null ? String(editing.usage_limit) : ''} onChange={v => setEditing({ ...editing, usage_limit: v === '' ? null : Number(v) })} />
                <Field label="Per-customer limit" type="number" value={editing.per_customer_limit != null ? String(editing.per_customer_limit) : ''} onChange={v => setEditing({ ...editing, per_customer_limit: v === '' ? null : Number(v) })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Starts at" type="datetime-local" value={toLocalInput(editing.starts_at)} onChange={v => setEditing({ ...editing, starts_at: fromLocalInput(v) })} />
                <Field label="Ends at" type="datetime-local" value={toLocalInput(editing.ends_at)} onChange={v => setEditing({ ...editing, ends_at: fromLocalInput(v) })} />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!editing.active}
                  onChange={e => setEditing({ ...editing, active: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm">Active</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!editing.stackable}
                  onChange={e => setEditing({ ...editing, stackable: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm">Stackable with a qualifying bundle</span>
              </label>

              <div className="pt-2 border-t border-border">
                <label className="block text-xs tracking-widest uppercase text-muted-foreground mb-2 mt-4">Applies to</label>
                <select
                  value={editing.target_type || 'all'}
                  onChange={e => setEditing({ ...editing, target_type: e.target.value as Coupon['target_type'] })}
                  className="w-full bg-transparent border border-border px-3 py-2 text-sm focus:border-foreground outline-none cursor-pointer"
                >
                  <option value="all">Whole order</option>
                  <option value="category">A category</option>
                  <option value="products">Specific products</option>
                </select>

                {editing.target_type === 'category' && (
                  <select
                    value={editing.target_category || ''}
                    onChange={e => setEditing({ ...editing, target_category: e.target.value })}
                    className="w-full mt-3 bg-transparent border border-border px-3 py-2 text-sm focus:border-foreground outline-none cursor-pointer"
                  >
                    <option value="" disabled>Select a category</option>
                    {CATEGORY_VALUES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                )}

                {editing.target_type === 'products' && (
                  <div className="mt-3 max-h-48 overflow-y-auto border border-border p-3 space-y-2">
                    {products.length === 0 && <p className="text-sm text-muted-foreground">No products yet</p>}
                    {products.map(p => (
                      <label key={p.id} className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={(editing.target_product_ids || []).includes(p.id)}
                          onChange={() => toggleTargetProduct(p.id)}
                          className="w-4 h-4"
                        />
                        {p.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-border flex items-center justify-end gap-3 sticky bottom-0 bg-background">
              <button onClick={() => setEditing(null)} className="px-5 py-2.5 text-sm border border-border hover:bg-muted cursor-pointer">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editing.id ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', disabled = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="block text-xs tracking-widest uppercase text-muted-foreground mb-2">{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-transparent border border-border px-3 py-2 text-sm focus:border-foreground outline-none disabled:opacity-40"
      />
    </label>
  )
}
