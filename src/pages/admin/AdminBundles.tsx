import { useEffect, useState } from 'react'
import { supabase, Bundle } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useCurrency } from '@/contexts/CurrencyContext'
import { Loader2, Plus, X, Edit2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

const EMPTY: Partial<Bundle> = {
  name: '',
  description: '',
  discount_type: 'percentage',
  discount_value: 0,
  active: true,
}

type ProductOption = { id: string; name: string }

// Local editable row for the bundle-items list. `_key` is a stable React key
// that exists even before a row has been saved to the DB (no `id` yet) --
// same approach as AdminProducts' VariantRow.
type ItemRow = {
  id?: string
  product_id: string
  quantity: number
  _key: string
}

function blankItemRow(): ItemRow {
  return { product_id: '', quantity: 1, _key: crypto.randomUUID() }
}

function discountLabel(b: Bundle, formatPrice: (n: number) => string): string {
  return b.discount_type === 'percentage' ? `${b.discount_value}% off` : `${formatPrice(b.discount_value)} off`
}

export default function AdminBundles() {
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({})
  const [products, setProducts] = useState<ProductOption[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Bundle> | null>(null)
  const [itemRows, setItemRows] = useState<ItemRow[]>([])
  const [saving, setSaving] = useState(false)
  const { isAdmin } = useAuth()
  const { formatPrice } = useCurrency()

  async function load() {
    setLoading(true)
    const [{ data: bundleRows }, { data: itemRowsData }, { data: productRows }] = await Promise.all([
      supabase.from('bundles').select('*').order('created_at', { ascending: false }),
      supabase.from('bundle_items').select('bundle_id'),
      supabase.from('products').select('id, name').order('name'),
    ])
    setBundles(bundleRows || [])
    setProducts(productRows || [])
    const counts: Record<string, number> = {}
    for (const r of itemRowsData || []) counts[r.bundle_id] = (counts[r.bundle_id] || 0) + 1
    setItemCounts(counts)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function loadItems(bundleId: string) {
    const { data } = await supabase.from('bundle_items').select('*').eq('bundle_id', bundleId)
    const rows: ItemRow[] = (data || []).map(i => ({ id: i.id, product_id: i.product_id, quantity: i.quantity, _key: i.id }))
    setItemRows(rows.length ? rows : [blankItemRow()])
  }

  function openNew() {
    setEditing({ ...EMPTY })
    setItemRows([blankItemRow()])
  }
  async function openEdit(b: Bundle) {
    setEditing({ ...b })
    await loadItems(b.id)
  }

  function updateItemRow(key: string, field: keyof ItemRow, value: string | number) {
    setItemRows(rows => rows.map(r => (r._key === key ? { ...r, [field]: value } : r)))
  }
  function addItemRow() {
    setItemRows(rows => [...rows, blankItemRow()])
  }
  function removeItemRow(key: string) {
    setItemRows(rows => rows.filter(r => r._key !== key))
  }

  async function toggleActive(b: Bundle) {
    const { error } = await supabase.from('bundles').update({ active: !b.active }).eq('id', b.id)
    if (error) { toast.error(error.message); return }
    load()
  }

  // Full replace against the DB for this bundle: delete every existing
  // bundle_items row, then insert the current set in one batch -- same
  // reasoning as AdminProducts.saveVariants (a per-row update loop can race
  // against unique/foreign-key constraints mid-loop; delete+insert sidesteps
  // that entirely, and this is an admin-only, low-traffic screen).
  async function saveItems(bundleId: string) {
    const rows = itemRows
      .filter(r => r.product_id) // ponytail: skip incomplete rows, don't persist rows with no product picked
      .map(row => ({
        bundle_id: bundleId,
        product_id: row.product_id,
        quantity: Number(row.quantity) || 1,
      }))
    const { error: delError } = await supabase.from('bundle_items').delete().eq('bundle_id', bundleId)
    if (delError) throw delError
    if (rows.length) {
      const { error: insError } = await supabase.from('bundle_items').insert(rows)
      if (insError) throw insError
    }
  }

  async function handleSave() {
    if (!editing) return
    if (!editing.name?.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      const payload = {
        name: editing.name.trim(),
        description: editing.description?.trim() || null,
        discount_type: editing.discount_type || 'percentage',
        discount_value: Number(editing.discount_value) || 0,
        active: !!editing.active,
      }

      let bundleId = editing.id
      if (bundleId) {
        const { error } = await supabase.from('bundles').update(payload).eq('id', bundleId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('bundles').insert(payload).select().single()
        if (error) throw error
        bundleId = data.id
      }

      await saveItems(bundleId!)

      toast.success(editing.id ? 'Bundle updated' : 'Bundle created')
      setEditing(null)
      load()
    } catch (e: any) {
      toast.error(e.message || 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(b: Bundle) {
    if (!confirm(`Delete "${b.name}"?`)) return
    const { error } = await supabase.from('bundles').delete().eq('id', b.id)
    if (error) { toast.error(error.message); return }
    toast.success('Bundle deleted')
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">{bundles.length} bundle{bundles.length === 1 ? '' : 's'}</p>
        {isAdmin && (
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-sm tracking-wider hover:bg-primary/90 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add bundle
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
                  <th className="text-start px-4 py-3">Name</th>
                  <th className="text-start px-4 py-3">Discount</th>
                  <th className="text-start px-4 py-3">Items</th>
                  <th className="text-start px-4 py-3">Active</th>
                  <th className="text-end px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bundles.map(b => (
                  <tr key={b.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium">{b.name}</p>
                      {b.description && <p className="text-xs text-muted-foreground truncate max-w-[240px]">{b.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{discountLabel(b, formatPrice)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{itemCounts[b.id] || 0}</td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={b.active}
                        onChange={() => toggleActive(b)}
                        className="w-4 h-4 cursor-pointer"
                        aria-label="Active"
                      />
                    </td>
                    <td className="px-4 py-3 text-end">
                      <button onClick={() => openEdit(b)} className="p-1.5 hover:bg-muted cursor-pointer" aria-label="Edit bundle">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(b)} className="p-1.5 hover:bg-muted text-red-700 cursor-pointer" aria-label="Delete bundle">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {bundles.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No bundles yet</td>
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
              <h2 className="font-display text-2xl">{editing.id ? 'Edit bundle' : 'New bundle'}</h2>
              <button onClick={() => setEditing(null)} className="p-2 cursor-pointer" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <Field label="Name" value={editing.name || ''} onChange={v => setEditing({ ...editing, name: v })} />

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
                    onChange={e => setEditing({ ...editing, discount_type: e.target.value as Bundle['discount_type'] })}
                    className="w-full bg-transparent border border-border px-3 py-2 text-sm focus:border-foreground outline-none cursor-pointer"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed amount</option>
                  </select>
                </div>
                <Field
                  label={editing.discount_type === 'percentage' ? 'Discount (%)' : 'Discount ($)'}
                  type="number"
                  value={String(editing.discount_value ?? 0)}
                  onChange={v => setEditing({ ...editing, discount_value: Number(v) })}
                />
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

              {/* --- Required products --- */}
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between mb-2 mt-4">
                  <span className="block text-xs tracking-widest uppercase text-muted-foreground">Required products</span>
                  <button type="button" onClick={addItemRow} className="text-xs underline cursor-pointer">+ Add row</button>
                </div>
                <div className="space-y-2">
                  {itemRows.map(row => (
                    <div key={row._key} className="grid grid-cols-[1fr_5rem_1.5rem] gap-2 items-center">
                      <select
                        value={row.product_id}
                        onChange={e => updateItemRow(row._key, 'product_id', e.target.value)}
                        className="w-full bg-transparent border border-border px-2 py-1.5 text-sm focus:border-foreground outline-none cursor-pointer"
                      >
                        <option value="" disabled>Select a product</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={row.quantity}
                        onChange={e => updateItemRow(row._key, 'quantity', Number(e.target.value) || 1)}
                        className="w-full bg-transparent border border-border px-2 py-1.5 text-sm focus:border-foreground outline-none"
                      />
                      <button type="button" onClick={() => removeItemRow(row._key)} className="p-1 text-red-700 cursor-pointer" aria-label="Remove row">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
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

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="block text-xs tracking-widest uppercase text-muted-foreground mb-2">{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-transparent border border-border px-3 py-2 text-sm focus:border-foreground outline-none"
      />
    </label>
  )
}
