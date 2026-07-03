import { useEffect, useState } from 'react'
import { supabase, Product } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useT } from '@/contexts/LanguageContext'
import { Loader2, Plus, X, Edit2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

const EMPTY: Partial<Product> = {
  name: '', slug: '', description: '', price: 0, category: 'Sneakers',
  image_url: '', stock: 20, sizes: ['38','39','40','41','42','43','44','45'],
  colors: ['Bone'], featured: false,
}

const CATEGORY_VALUES = ['Sneakers', 'Boots', 'Loafers', 'Derbies', 'Slippers', 'Sandals']

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Product> | null>(null)
  const [saving, setSaving] = useState(false)
  const { isAdmin } = useAuth()
  const t = useT()

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false })
    setProducts(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openNew() {
    setEditing({ ...EMPTY })
  }
  function openEdit(p: Product) {
    setEditing({ ...p })
  }

  async function handleSave() {
    if (!editing) return
    if (!editing.name || !editing.price) { toast.error(t.adminRequired); return }
    setSaving(true)
    try {
      const slug = editing.slug || editing.name!.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      const payload = {
        name: editing.name,
        slug,
        description: editing.description || '',
        price: Number(editing.price),
        category: editing.category || 'Sneakers',
        image_url: editing.image_url || '',
        stock: Number(editing.stock) || 0,
        sizes: editing.sizes || [],
        colors: editing.colors || [],
        featured: !!editing.featured,
      }
      if (editing.id) {
        const { error } = await supabase.from('products').update(payload).eq('id', editing.id)
        if (error) throw error
        toast.success(t.adminUpdateSuccess)
      } else {
        const { error } = await supabase.from('products').insert(payload)
        if (error) throw error
        toast.success(t.adminCreateSuccess)
      }
      setEditing(null)
      load()
    } catch (e: any) {
      toast.error(e.message || t.adminRequired)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(p: Product) {
    if (!confirm(t.adminDeleteConfirm(p.name))) return
    const { error } = await supabase.from('products').delete().eq('id', p.id)
    if (error) { toast.error(error.message); return }
    toast.success(t.adminDeleted)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">{t.adminPieces(products.length)}</p>
        {isAdmin && (
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-sm tracking-wider hover:bg-primary/90 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {t.adminAddProduct}
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
                  <th className="text-start px-4 py-3">{t.adminProduct}</th>
                  <th className="text-start px-4 py-3">{t.adminCategory}</th>
                  <th className="text-start px-4 py-3">{t.adminPrice}</th>
                  <th className="text-start px-4 py-3">{t.adminStock}</th>
                  <th className="text-start px-4 py-3">{t.adminFeatured}</th>
                  <th className="text-end px-4 py-3">{t.adminActions}</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-muted overflow-hidden flex-shrink-0">
                          {p.image_url && <img src={p.image_url} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{p.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.category}</td>
                    <td className="px-4 py-3">${Number(p.price).toFixed(0)}</td>
                    <td className="px-4 py-3">
                      <span className={p.stock < 10 ? 'text-red-700' : ''}>{p.stock}</span>
                    </td>
                    <td className="px-4 py-3">{p.featured ? t.yes : t.dash}</td>
                    <td className="px-4 py-3 text-end">
                      <button
                        onClick={() => openEdit(p)}
                        className="p-1.5 hover:bg-muted cursor-pointer"
                        aria-label={t.adminEditProduct}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        className="p-1.5 hover:bg-muted text-red-700 cursor-pointer"
                        aria-label={t.adminDeleted}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-foreground/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-background w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-background z-10">
              <h2 className="font-display text-2xl">
                {editing.id ? t.adminEditProduct : t.adminNewProduct}
              </h2>
              <button onClick={() => setEditing(null)} className="p-2 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <Field label={t.adminName} value={editing.name || ''} onChange={v => setEditing({ ...editing, name: v })} />
              <Field label={t.adminSlug} value={editing.slug || ''} onChange={v => setEditing({ ...editing, slug: v })} />
              <div>
                <label className="block text-xs tracking-widest uppercase text-muted-foreground mb-2">{t.adminDescription}</label>
                <textarea
                  value={editing.description || ''}
                  onChange={e => setEditing({ ...editing, description: e.target.value })}
                  rows={3}
                  className="w-full bg-transparent border border-border p-3 text-sm focus:border-foreground outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label={`${t.adminPrice} ($)`} type="number" value={String(editing.price || 0)} onChange={v => setEditing({ ...editing, price: Number(v) })} />
                <Field label={t.adminStock} type="number" value={String(editing.stock || 0)} onChange={v => setEditing({ ...editing, stock: Number(v) })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs tracking-widest uppercase text-muted-foreground mb-2">{t.adminCategory}</label>
                  <select
                    value={editing.category || 'Sneakers'}
                    onChange={e => setEditing({ ...editing, category: e.target.value })}
                    className="w-full bg-transparent border border-border px-3 py-2 text-sm focus:border-foreground outline-none cursor-pointer"
                  >
                    {CATEGORY_VALUES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <Field label="Image URL" value={editing.image_url || ''} onChange={v => setEditing({ ...editing, image_url: v })} />
              </div>
              <Field label="Colors (comma separated)" value={(editing.colors || []).join(', ')} onChange={v => setEditing({ ...editing, colors: v.split(',').map(s => s.trim()).filter(Boolean) })} />
              <Field label="Sizes (comma separated)" value={(editing.sizes || []).join(', ')} onChange={v => setEditing({ ...editing, sizes: v.split(',').map(s => s.trim()).filter(Boolean) })} />
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.featured || false}
                  onChange={e => setEditing({ ...editing, featured: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm">{t.adminFeaturedCheckbox}</span>
              </label>
            </div>
            <div className="p-6 border-t border-border flex items-center justify-end gap-3 sticky bottom-0 bg-background">
              <button
                onClick={() => setEditing(null)}
                className="px-5 py-2.5 text-sm border border-border hover:bg-muted cursor-pointer"
              >
                {t.adminCancel}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editing.id ? t.adminSave : t.adminCreate}
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
