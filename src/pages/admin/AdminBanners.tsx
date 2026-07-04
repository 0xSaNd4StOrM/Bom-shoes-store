import { useEffect, useState } from 'react'
import { supabase, HeroBanner } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, Plus, X, Edit2, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import { toast } from 'sonner'

const EMPTY: Partial<HeroBanner> = {
  title: '', subtitle: '', cta_text: '', cta_link: '', image_url: '', position: 0, active: true,
}

export default function AdminBanners() {
  const [banners, setBanners] = useState<HeroBanner[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<HeroBanner> | null>(null)
  const [saving, setSaving] = useState(false)
  const { isAdmin } = useAuth()

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('hero_banners').select('*').order('position')
    setBanners(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openNew() {
    // New banners default to the end of the list, not position 0, so they
    // don't jump ahead of everything already ordered.
    const nextPosition = banners.length ? Math.max(...banners.map(b => b.position)) + 1 : 0
    setEditing({ ...EMPTY, position: nextPosition })
  }
  function openEdit(b: HeroBanner) {
    setEditing({ ...b })
  }

  async function toggleActive(b: HeroBanner) {
    const { error } = await supabase.from('hero_banners').update({ active: !b.active }).eq('id', b.id)
    if (error) { toast.error(error.message); return }
    load()
  }

  // Swaps this row with its neighbor in the currently-ordered list, then
  // reassigns 0..n-1 positions across the whole list -- simpler and more
  // robust than juggling raw position values, which can collide if rows were
  // ever saved with duplicate/default positions. List is short and
  // low-frequency to reorder, so re-writing every row is cheap.
  async function move(banner: HeroBanner, direction: -1 | 1) {
    const idx = banners.findIndex(b => b.id === banner.id)
    const swapIdx = idx + direction
    if (swapIdx < 0 || swapIdx >= banners.length) return
    const reordered = [...banners]
    ;[reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]]
    setBanners(reordered)
    await Promise.all(reordered.map((b, i) => supabase.from('hero_banners').update({ position: i }).eq('id', b.id)))
    load()
  }

  async function handleSave() {
    if (!editing) return
    if (!editing.title?.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      const payload = {
        title: editing.title.trim(),
        subtitle: editing.subtitle?.trim() || null,
        cta_text: editing.cta_text?.trim() || null,
        cta_link: editing.cta_link?.trim() || null,
        image_url: editing.image_url?.trim() || null,
        position: Number(editing.position) || 0,
        active: !!editing.active,
      }

      if (editing.id) {
        const { error } = await supabase.from('hero_banners').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('hero_banners').insert(payload)
        if (error) throw error
      }

      toast.success(editing.id ? 'Banner updated' : 'Banner created')
      setEditing(null)
      load()
    } catch (e: any) {
      toast.error(e.message || 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(b: HeroBanner) {
    if (!confirm(`Delete "${b.title}"?`)) return
    const { error } = await supabase.from('hero_banners').delete().eq('id', b.id)
    if (error) { toast.error(error.message); return }
    toast.success('Banner deleted')
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">{banners.length} banner{banners.length === 1 ? '' : 's'}</p>
        {isAdmin && (
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-sm tracking-wider hover:bg-primary/90 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add banner
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
                  <th className="text-start px-4 py-3">Order</th>
                  <th className="text-start px-4 py-3">Banner</th>
                  <th className="text-start px-4 py-3">CTA</th>
                  <th className="text-start px-4 py-3">Active</th>
                  <th className="text-end px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {banners.map((b, idx) => (
                  <tr key={b.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => move(b, -1)}
                          disabled={idx === 0}
                          className="p-1 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          aria-label="Move up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => move(b, 1)}
                          disabled={idx === banners.length - 1}
                          className="p-1 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          aria-label="Move down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-muted overflow-hidden flex-shrink-0">
                          {b.image_url && <img src={b.image_url} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{b.title}</p>
                          {b.subtitle && <p className="text-xs text-muted-foreground truncate max-w-[240px]">{b.subtitle}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {b.cta_text || '—'}
                    </td>
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
                      <button onClick={() => openEdit(b)} className="p-1.5 hover:bg-muted cursor-pointer" aria-label="Edit banner">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(b)} className="p-1.5 hover:bg-muted text-red-700 cursor-pointer" aria-label="Delete banner">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {banners.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No banners yet</td>
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
              <h2 className="font-display text-2xl">{editing.id ? 'Edit banner' : 'New banner'}</h2>
              <button onClick={() => setEditing(null)} className="p-2 cursor-pointer" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <Field label="Title" value={editing.title || ''} onChange={v => setEditing({ ...editing, title: v })} />
              <div>
                <label className="block text-xs tracking-widest uppercase text-muted-foreground mb-2">Subtitle</label>
                <textarea
                  value={editing.subtitle || ''}
                  onChange={e => setEditing({ ...editing, subtitle: e.target.value })}
                  rows={2}
                  className="w-full bg-transparent border border-border p-3 text-sm focus:border-foreground outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="CTA text" value={editing.cta_text || ''} onChange={v => setEditing({ ...editing, cta_text: v })} />
                <Field label="CTA link" value={editing.cta_link || ''} onChange={v => setEditing({ ...editing, cta_link: v })} placeholder="/shop?category=Boots" />
              </div>
              <Field label="Image URL" value={editing.image_url || ''} onChange={v => setEditing({ ...editing, image_url: v })} placeholder="https://…" />
              {editing.image_url && (
                <div className="w-full aspect-[21/9] bg-muted overflow-hidden">
                  <img src={editing.image_url} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 items-end">
                <Field label="Position" type="number" value={String(editing.position ?? 0)} onChange={v => setEditing({ ...editing, position: Number(v) })} />
                <label className="flex items-center gap-2 cursor-pointer pb-2.5">
                  <input
                    type="checkbox"
                    checked={editing.active ?? true}
                    onChange={e => setEditing({ ...editing, active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Active</span>
                </label>
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

function Field({ label, value, onChange, type = 'text', placeholder = '' }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="block text-xs tracking-widest uppercase text-muted-foreground mb-2">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-transparent border border-border px-3 py-2 text-sm focus:border-foreground outline-none"
      />
    </label>
  )
}
