import { useEffect, useState } from 'react'
import { supabase, Testimonial } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useT } from '@/contexts/LanguageContext'
import { Loader2, Plus, X, Edit2, Trash2, ArrowUp, ArrowDown, Star } from 'lucide-react'
import { toast } from 'sonner'

// Every one of these keys is pre-seeded by migration (see task context) --
// plain UPDATE is always correct here, there's no insert-then-conflict case.
const SITE_CONTENT_KEYS = [
  'hero', 'showcase', 'curated', 'limited_drop', 'trust_badges', 'atelier',
  'newsletter', 'categories_strip', 'announcement', 'footer_links',
] as const
type SiteContentKey = typeof SITE_CONTENT_KEYS[number]

const TRUST_ICONS = ['Truck', 'ShieldCheck', 'RotateCcw', 'Lock', 'Package', 'Award', 'Heart', 'Star', 'CreditCard', 'Clock', 'Gift', 'Sparkles']

type ProductOption = { id: string; name: string; slug: string }

const TABS = [
  { key: 'hero', label: 'Hero' },
  { key: 'showcase', label: 'Showcase' },
  { key: 'curated', label: 'Curated' },
  { key: 'limited_drop', label: 'Limited Drop' },
  { key: 'trust_badges', label: 'Trust Badges' },
  { key: 'atelier', label: 'Atelier' },
  { key: 'newsletter', label: 'Newsletter' },
  { key: 'categories_strip', label: 'Categories Strip' },
  { key: 'announcement', label: 'Announcement Bar' },
  { key: 'footer_links', label: 'Footer Links' },
  { key: 'testimonials', label: 'Testimonials' },
] as const
type TabKey = typeof TABS[number]['key']

export default function AdminHomepage() {
  const [tab, setTab] = useState<TabKey>('hero')
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, any>>({})
  const [products, setProducts] = useState<ProductOption[]>([])
  const { isAdmin } = useAuth()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: contentRows }, { data: productRows }] = await Promise.all([
        supabase.from('site_content').select('key, value').in('key', SITE_CONTENT_KEYS as unknown as string[]),
        supabase.from('product_catalog').select('id, name, slug').order('name'),
      ])
      const map: Record<string, any> = {}
      for (const row of contentRows || []) map[row.key] = row.value
      setDrafts(map)
      setProducts(productRows || [])
      setLoading(false)
    }
    load()
  }, [])

  function setField(key: SiteContentKey, field: string, value: any) {
    setDrafts(d => ({ ...d, [key]: { ...d[key], [field]: value } }))
  }

  async function saveKey(key: SiteContentKey) {
    const { error } = await supabase.from('site_content').update({ value: drafts[key] || {} }).eq('key', key)
    if (error) { toast.error(error.message); return }
    toast.success('Saved')
  }

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(item => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`px-4 py-2 text-sm tracking-wider border cursor-pointer ${
              tab === item.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-muted'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'hero' && <HeroTab value={drafts.hero || {}} setField={(f, v) => setField('hero', f, v)} onSave={() => saveKey('hero')} readOnly={!isAdmin} />}
      {tab === 'curated' && <CuratedTab value={drafts.curated || {}} setField={(f, v) => setField('curated', f, v)} onSave={() => saveKey('curated')} readOnly={!isAdmin} />}
      {tab === 'limited_drop' && <LimitedDropTab value={drafts.limited_drop || {}} setField={(f, v) => setField('limited_drop', f, v)} onSave={() => saveKey('limited_drop')} readOnly={!isAdmin} />}
      {tab === 'showcase' && (
        <ShowcaseTab
          value={drafts.showcase || { product_ids: [] }}
          setField={(f, v) => setField('showcase', f, v)}
          onSave={() => saveKey('showcase')}
          products={products}
          readOnly={!isAdmin}
        />
      )}
      {tab === 'trust_badges' && (
        <TrustBadgesTab
          value={drafts.trust_badges || { items: [] }}
          setField={(f, v) => setField('trust_badges', f, v)}
          onSave={() => saveKey('trust_badges')}
          readOnly={!isAdmin}
        />
      )}
      {tab === 'atelier' && <AtelierTab value={drafts.atelier || {}} setField={(f, v) => setField('atelier', f, v)} onSave={() => saveKey('atelier')} readOnly={!isAdmin} />}
      {tab === 'newsletter' && <NewsletterTab value={drafts.newsletter || {}} setField={(f, v) => setField('newsletter', f, v)} onSave={() => saveKey('newsletter')} readOnly={!isAdmin} />}
      {tab === 'categories_strip' && <CategoriesStripTab value={drafts.categories_strip || {}} setField={(f, v) => setField('categories_strip', f, v)} onSave={() => saveKey('categories_strip')} readOnly={!isAdmin} />}
      {tab === 'announcement' && <AnnouncementTab value={drafts.announcement || { lines: [] }} setField={(f, v) => setField('announcement', f, v)} onSave={() => saveKey('announcement')} readOnly={!isAdmin} />}
      {tab === 'footer_links' && <FooterLinksTab value={drafts.footer_links || { items: [] }} setField={(f, v) => setField('footer_links', f, v)} onSave={() => saveKey('footer_links')} readOnly={!isAdmin} />}
      {tab === 'testimonials' && <TestimonialsTab />}
    </div>
  )
}

// ---------- shared field building blocks (same visual convention as
// AdminBanners/AdminCoupons' local `Field` component) ----------

function Field({ label, value, onChange, type = 'text', placeholder = '', disabled = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="block text-xs tracking-widest uppercase text-muted-foreground mb-2">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-transparent border border-border px-3 py-2 text-sm focus:border-foreground outline-none disabled:opacity-40"
      />
    </label>
  )
}

function BilingualField({
  label, valueEn, valueAr, onEnChange, onArChange, textarea = false, disabled = false,
}: {
  label: string; valueEn: string; valueAr: string; onEnChange: (v: string) => void; onArChange: (v: string) => void; textarea?: boolean; disabled?: boolean
}) {
  const cls = 'w-full bg-transparent border border-border px-3 py-2 text-sm focus:border-foreground outline-none disabled:opacity-40'
  return (
    <div>
      <span className="block text-xs tracking-widest uppercase text-muted-foreground mb-2">{label}</span>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="block text-[10px] tracking-widest uppercase text-muted-foreground mb-1">EN</span>
          {textarea
            ? <textarea rows={2} value={valueEn} disabled={disabled} onChange={e => onEnChange(e.target.value)} className={cls} />
            : <input value={valueEn} disabled={disabled} onChange={e => onEnChange(e.target.value)} className={cls} />}
        </div>
        <div>
          <span className="block text-[10px] tracking-widest uppercase text-muted-foreground mb-1">AR</span>
          {textarea
            ? <textarea rows={2} dir="rtl" value={valueAr} disabled={disabled} onChange={e => onArChange(e.target.value)} className={cls} />
            : <input dir="rtl" value={valueAr} disabled={disabled} onChange={e => onArChange(e.target.value)} className={cls} />}
        </div>
      </div>
    </div>
  )
}

function EnabledCheckbox({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled: boolean }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 cursor-pointer disabled:opacity-40"
      />
      <span className="text-sm">Show this section on the homepage</span>
    </label>
  )
}

function SaveBar({ onSave, readOnly }: { onSave: () => void; readOnly: boolean }) {
  const [saving, setSaving] = useState(false)
  return (
    <div className="pt-4 border-t border-border flex justify-end">
      <button
        disabled={readOnly || saving}
        onClick={async () => { setSaving(true); await onSave(); setSaving(false) }}
        className="px-5 py-2.5 text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer flex items-center gap-2"
      >
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        Save
      </button>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="border border-border bg-card p-6 space-y-5 max-w-3xl">{children}</div>
}

// ---------- Hero ----------

function HeroTab({ value, setField, onSave, readOnly }: { value: any; setField: (f: string, v: any) => void; onSave: () => void; readOnly: boolean }) {
  return (
    <Card>
      <BilingualField label="Eyebrow" valueEn={value.eyebrow_en || ''} valueAr={value.eyebrow_ar || ''} onEnChange={v => setField('eyebrow_en', v)} onArChange={v => setField('eyebrow_ar', v)} disabled={readOnly} />
      <BilingualField label="Title, line 1" valueEn={value.title1_en || ''} valueAr={value.title1_ar || ''} onEnChange={v => setField('title1_en', v)} onArChange={v => setField('title1_ar', v)} disabled={readOnly} />
      <BilingualField label="Title, line 2" valueEn={value.title2_en || ''} valueAr={value.title2_ar || ''} onEnChange={v => setField('title2_en', v)} onArChange={v => setField('title2_ar', v)} disabled={readOnly} />
      <BilingualField label="Subtitle" valueEn={value.subtitle_en || ''} valueAr={value.subtitle_ar || ''} onEnChange={v => setField('subtitle_en', v)} onArChange={v => setField('subtitle_ar', v)} textarea disabled={readOnly} />
      <BilingualField label="Primary CTA text" valueEn={value.cta1_text_en || ''} valueAr={value.cta1_text_ar || ''} onEnChange={v => setField('cta1_text_en', v)} onArChange={v => setField('cta1_text_ar', v)} disabled={readOnly} />
      <Field label="Primary CTA link" value={value.cta1_link || ''} onChange={v => setField('cta1_link', v)} placeholder="/shop" disabled={readOnly} />
      <BilingualField label="Secondary CTA text" valueEn={value.cta2_text_en || ''} valueAr={value.cta2_text_ar || ''} onEnChange={v => setField('cta2_text_en', v)} onArChange={v => setField('cta2_text_ar', v)} disabled={readOnly} />
      <Field label="Secondary CTA link" value={value.cta2_link || ''} onChange={v => setField('cta2_link', v)} placeholder="/shop" disabled={readOnly} />
      <BilingualField label="Scroll hint text" valueEn={value.scroll_text_en || ''} valueAr={value.scroll_text_ar || ''} onEnChange={v => setField('scroll_text_en', v)} onArChange={v => setField('scroll_text_ar', v)} disabled={readOnly} />
      <EnabledCheckbox checked={value.enabled !== false} onChange={v => setField('enabled', v)} disabled={readOnly} />
      <SaveBar onSave={onSave} readOnly={readOnly} />
    </Card>
  )
}

// ---------- Curated ----------

function CuratedTab({ value, setField, onSave, readOnly }: { value: any; setField: (f: string, v: any) => void; onSave: () => void; readOnly: boolean }) {
  return (
    <Card>
      <BilingualField label="Eyebrow" valueEn={value.eyebrow_en || ''} valueAr={value.eyebrow_ar || ''} onEnChange={v => setField('eyebrow_en', v)} onArChange={v => setField('eyebrow_ar', v)} disabled={readOnly} />
      <BilingualField label="Heading" valueEn={value.heading_en || ''} valueAr={value.heading_ar || ''} onEnChange={v => setField('heading_en', v)} onArChange={v => setField('heading_ar', v)} disabled={readOnly} />
      <BilingualField label={'"View all" link text'} valueEn={value.view_all_en || ''} valueAr={value.view_all_ar || ''} onEnChange={v => setField('view_all_en', v)} onArChange={v => setField('view_all_ar', v)} disabled={readOnly} />
      <Field label="Product limit" type="number" value={String(value.limit ?? 5)} onChange={v => setField('limit', Number(v) || 0)} disabled={readOnly} />
      <EnabledCheckbox checked={value.enabled !== false} onChange={v => setField('enabled', v)} disabled={readOnly} />
      <SaveBar onSave={onSave} readOnly={readOnly} />
    </Card>
  )
}

// ---------- Limited Drop ----------

function LimitedDropTab({ value, setField, onSave, readOnly }: { value: any; setField: (f: string, v: any) => void; onSave: () => void; readOnly: boolean }) {
  return (
    <Card>
      <BilingualField label="Eyebrow" valueEn={value.eyebrow_en || ''} valueAr={value.eyebrow_ar || ''} onEnChange={v => setField('eyebrow_en', v)} onArChange={v => setField('eyebrow_ar', v)} disabled={readOnly} />
      <BilingualField label="Title, line 1" valueEn={value.title1_en || ''} valueAr={value.title1_ar || ''} onEnChange={v => setField('title1_en', v)} onArChange={v => setField('title1_ar', v)} disabled={readOnly} />
      <BilingualField label="Title, line 2" valueEn={value.title2_en || ''} valueAr={value.title2_ar || ''} onEnChange={v => setField('title2_en', v)} onArChange={v => setField('title2_ar', v)} disabled={readOnly} />
      <BilingualField label="Subtitle" valueEn={value.subtitle_en || ''} valueAr={value.subtitle_ar || ''} onEnChange={v => setField('subtitle_en', v)} onArChange={v => setField('subtitle_ar', v)} textarea disabled={readOnly} />
      <BilingualField label="CTA text" valueEn={value.cta_text_en || ''} valueAr={value.cta_text_ar || ''} onEnChange={v => setField('cta_text_en', v)} onArChange={v => setField('cta_text_ar', v)} disabled={readOnly} />
      <Field label="CTA link" value={value.cta_link || ''} onChange={v => setField('cta_link', v)} placeholder="/shop" disabled={readOnly} />
      <Field label="Image URL" value={value.image_url || ''} onChange={v => setField('image_url', v)} placeholder="https://…" disabled={readOnly} />
      <div>
        <label className="block text-xs tracking-widest uppercase text-muted-foreground mb-2">Countdown mode</label>
        <select
          value={value.countdown_mode || 'auto'}
          disabled={readOnly}
          onChange={e => setField('countdown_mode', e.target.value)}
          className="w-full bg-transparent border border-border px-3 py-2 text-sm focus:border-foreground outline-none cursor-pointer disabled:opacity-40"
        >
          <option value="auto">Auto (7 days from now)</option>
          <option value="manual">Manual target date</option>
          <option value="off">Off</option>
        </select>
      </div>
      {value.countdown_mode === 'manual' && (
        <Field
          label="Manual target"
          type="datetime-local"
          value={value.manual_target ? value.manual_target.slice(0, 16) : ''}
          onChange={v => setField('manual_target', v ? new Date(v).toISOString() : null)}
          disabled={readOnly}
        />
      )}
      <EnabledCheckbox checked={value.enabled !== false} onChange={v => setField('enabled', v)} disabled={readOnly} />
      <SaveBar onSave={onSave} readOnly={readOnly} />
    </Card>
  )
}

// ---------- Showcase ----------

function ShowcaseTab({
  value, setField, onSave, products, readOnly,
}: { value: any; setField: (f: string, v: any) => void; onSave: () => void; products: ProductOption[]; readOnly: boolean }) {
  const ids: string[] = value.product_ids || []
  const [pick, setPick] = useState('')
  const byId = Object.fromEntries(products.map(p => [p.id, p]))
  const available = products.filter(p => !ids.includes(p.id))

  function add() {
    if (!pick) return
    setField('product_ids', [...ids, pick])
    setPick('')
  }
  function remove(idx: number) {
    setField('product_ids', ids.filter((_, i) => i !== idx))
  }
  function move(idx: number, dir: -1 | 1) {
    const swap = idx + dir
    if (swap < 0 || swap >= ids.length) return
    const next = [...ids]
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    setField('product_ids', next)
  }

  return (
    <Card>
      <BilingualField label="Label" valueEn={value.label_en || ''} valueAr={value.label_ar || ''} onEnChange={v => setField('label_en', v)} onArChange={v => setField('label_ar', v)} disabled={readOnly} />

      <div>
        <span className="block text-xs tracking-widest uppercase text-muted-foreground mb-2">Products (in showcase order)</span>
        <div className="space-y-2 mb-3">
          {ids.map((id, idx) => (
            <div key={id + idx} className="flex items-center gap-2 border border-border px-3 py-2">
              <span className="flex-1 text-sm truncate">{byId[id]?.name || id}</span>
              <button type="button" onClick={() => move(idx, -1)} disabled={readOnly || idx === 0} className="p-1 hover:bg-muted disabled:opacity-30 cursor-pointer" aria-label="Move up">
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => move(idx, 1)} disabled={readOnly || idx === ids.length - 1} className="p-1 hover:bg-muted disabled:opacity-30 cursor-pointer" aria-label="Move down">
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => remove(idx)} disabled={readOnly} className="p-1 text-red-700 hover:bg-muted disabled:opacity-30 cursor-pointer" aria-label="Remove">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {ids.length === 0 && <p className="text-sm text-muted-foreground">No products in the showcase yet</p>}
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <select
              value={pick}
              onChange={e => setPick(e.target.value)}
              className="flex-1 bg-transparent border border-border px-3 py-2 text-sm focus:border-foreground outline-none cursor-pointer"
            >
              <option value="" disabled>Select a product to add</option>
              {available.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button type="button" onClick={add} disabled={!pick} className="px-4 py-2 text-sm border border-border hover:bg-muted disabled:opacity-40 cursor-pointer flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        )}
      </div>

      <EnabledCheckbox checked={value.enabled !== false} onChange={v => setField('enabled', v)} disabled={readOnly} />
      <SaveBar onSave={onSave} readOnly={readOnly} />
    </Card>
  )
}

// ---------- Trust Badges ----------

function TrustBadgesTab({ value, setField, onSave, readOnly }: { value: any; setField: (f: string, v: any) => void; onSave: () => void; readOnly: boolean }) {
  const items: any[] = value.items || []

  function updateItem(idx: number, field: string, v: any) {
    setField('items', items.map((it, i) => (i === idx ? { ...it, [field]: v } : it)))
  }
  function addItem() {
    setField('items', [...items, { icon: 'Truck', title_en: '', title_ar: '', desc_en: '', desc_ar: '' }])
  }
  function removeItem(idx: number) {
    setField('items', items.filter((_, i) => i !== idx))
  }

  return (
    <Card>
      <BilingualField label="Eyebrow" valueEn={value.eyebrow_en || ''} valueAr={value.eyebrow_ar || ''} onEnChange={v => setField('eyebrow_en', v)} onArChange={v => setField('eyebrow_ar', v)} disabled={readOnly} />

      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="block text-xs tracking-widest uppercase text-muted-foreground">Badges</span>
          {!readOnly && (
            <button type="button" onClick={addItem} className="text-xs underline cursor-pointer">+ Add badge</button>
          )}
        </div>
        <div className="space-y-4">
          {items.map((it, idx) => (
            <div key={idx} className="border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <select
                  value={it.icon || 'Truck'}
                  disabled={readOnly}
                  onChange={e => updateItem(idx, 'icon', e.target.value)}
                  className="bg-transparent border border-border px-2 py-1.5 text-sm focus:border-foreground outline-none cursor-pointer disabled:opacity-40"
                >
                  {TRUST_ICONS.map(icon => <option key={icon} value={icon}>{icon}</option>)}
                </select>
                <button type="button" onClick={() => removeItem(idx)} disabled={readOnly} className="p-1 text-red-700 hover:bg-muted disabled:opacity-30 cursor-pointer" aria-label="Remove badge">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <BilingualField label="Title" valueEn={it.title_en || ''} valueAr={it.title_ar || ''} onEnChange={v => updateItem(idx, 'title_en', v)} onArChange={v => updateItem(idx, 'title_ar', v)} disabled={readOnly} />
              <BilingualField label="Description" valueEn={it.desc_en || ''} valueAr={it.desc_ar || ''} onEnChange={v => updateItem(idx, 'desc_en', v)} onArChange={v => updateItem(idx, 'desc_ar', v)} disabled={readOnly} />
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-muted-foreground">No badges yet</p>}
        </div>
      </div>

      <EnabledCheckbox checked={value.enabled !== false} onChange={v => setField('enabled', v)} disabled={readOnly} />
      <SaveBar onSave={onSave} readOnly={readOnly} />
    </Card>
  )
}

// ---------- Atelier ----------

function AtelierTab({ value, setField, onSave, readOnly }: { value: any; setField: (f: string, v: any) => void; onSave: () => void; readOnly: boolean }) {
  const stats: any[] = value.stats || []

  function updateStat(idx: number, field: string, v: any) {
    setField('stats', stats.map((s, i) => (i === idx ? { ...s, [field]: v } : s)))
  }
  function addStat() {
    setField('stats', [...stats, { value: '', label_en: '', label_ar: '' }])
  }
  function removeStat(idx: number) {
    setField('stats', stats.filter((_, i) => i !== idx))
  }

  return (
    <Card>
      <BilingualField label="Eyebrow" valueEn={value.eyebrow_en || ''} valueAr={value.eyebrow_ar || ''} onEnChange={v => setField('eyebrow_en', v)} onArChange={v => setField('eyebrow_ar', v)} disabled={readOnly} />
      <BilingualField label="Title" valueEn={value.title_en || ''} valueAr={value.title_ar || ''} onEnChange={v => setField('title_en', v)} onArChange={v => setField('title_ar', v)} disabled={readOnly} />
      <BilingualField label="Subtitle" valueEn={value.subtitle_en || ''} valueAr={value.subtitle_ar || ''} onEnChange={v => setField('subtitle_en', v)} onArChange={v => setField('subtitle_ar', v)} textarea disabled={readOnly} />
      <BilingualField label="Tag" valueEn={value.tag_en || ''} valueAr={value.tag_ar || ''} onEnChange={v => setField('tag_en', v)} onArChange={v => setField('tag_ar', v)} disabled={readOnly} />

      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="block text-xs tracking-widest uppercase text-muted-foreground">Stats</span>
          {!readOnly && (
            <button type="button" onClick={addStat} className="text-xs underline cursor-pointer">+ Add stat</button>
          )}
        </div>
        <div className="space-y-3">
          {stats.map((s, idx) => (
            <div key={idx} className="border border-border p-3 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <Field label="Value" value={s.value || ''} onChange={v => updateStat(idx, 'value', v)} disabled={readOnly} />
                <Field label="Label (EN)" value={s.label_en || ''} onChange={v => updateStat(idx, 'label_en', v)} disabled={readOnly} />
                <Field label="Label (AR)" value={s.label_ar || ''} onChange={v => updateStat(idx, 'label_ar', v)} disabled={readOnly} />
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={() => removeStat(idx)} disabled={readOnly} className="p-1 text-red-700 hover:bg-muted disabled:opacity-30 cursor-pointer" aria-label="Remove stat">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {stats.length === 0 && <p className="text-sm text-muted-foreground">No stats yet</p>}
        </div>
      </div>

      <BilingualField label="CTA text" valueEn={value.cta_text_en || ''} valueAr={value.cta_text_ar || ''} onEnChange={v => setField('cta_text_en', v)} onArChange={v => setField('cta_text_ar', v)} disabled={readOnly} />
      <Field label="CTA link" value={value.cta_link || ''} onChange={v => setField('cta_link', v)} placeholder="/shop" disabled={readOnly} />
      <Field label="Image URL" value={value.image_url || ''} onChange={v => setField('image_url', v)} placeholder="https://… (blank for automatic fallback)" disabled={readOnly} />
      <EnabledCheckbox checked={value.enabled !== false} onChange={v => setField('enabled', v)} disabled={readOnly} />
      <SaveBar onSave={onSave} readOnly={readOnly} />
    </Card>
  )
}

// ---------- Newsletter ----------

function NewsletterTab({ value, setField, onSave, readOnly }: { value: any; setField: (f: string, v: any) => void; onSave: () => void; readOnly: boolean }) {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    supabase.from('newsletter_subscribers').select('*', { count: 'exact', head: true }).then(
      ({ count }) => setCount(count ?? 0),
      () => setCount(null),
    )
  }, [])

  return (
    <Card>
      <BilingualField label="Title" valueEn={value.title_en || ''} valueAr={value.title_ar || ''} onEnChange={v => setField('title_en', v)} onArChange={v => setField('title_ar', v)} disabled={readOnly} />
      <BilingualField label="Subtitle" valueEn={value.subtitle_en || ''} valueAr={value.subtitle_ar || ''} onEnChange={v => setField('subtitle_en', v)} onArChange={v => setField('subtitle_ar', v)} textarea disabled={readOnly} />
      <EnabledCheckbox checked={value.enabled !== false} onChange={v => setField('enabled', v)} disabled={readOnly} />
      <p className="text-sm text-muted-foreground">
        {count === null ? 'Loading subscriber count…' : `${count} ${count === 1 ? 'person has' : 'people have'} subscribed`}
      </p>
      <SaveBar onSave={onSave} readOnly={readOnly} />
    </Card>
  )
}

// ---------- Categories Strip ----------

function CategoriesStripTab({ value, setField, onSave, readOnly }: { value: any; setField: (f: string, v: any) => void; onSave: () => void; readOnly: boolean }) {
  return (
    <Card>
      <p className="text-sm text-muted-foreground">
        The category tiles strip is generated automatically from your product categories -- there's nothing else to edit here.
      </p>
      <EnabledCheckbox checked={value.enabled !== false} onChange={v => setField('enabled', v)} disabled={readOnly} />
      <SaveBar onSave={onSave} readOnly={readOnly} />
    </Card>
  )
}

// ---------- Announcement Bar ----------

function AnnouncementTab({ value, setField, onSave, readOnly }: { value: any; setField: (f: string, v: any) => void; onSave: () => void; readOnly: boolean }) {
  const lines: any[] = value.lines || []

  function updateLine(idx: number, field: string, v: any) {
    setField('lines', lines.map((l, i) => (i === idx ? { ...l, [field]: v } : l)))
  }
  function addLine() {
    setField('lines', [...lines, { en: '', ar: '' }])
  }
  function removeLine(idx: number) {
    setField('lines', lines.filter((_, i) => i !== idx))
  }
  function move(idx: number, dir: -1 | 1) {
    const swap = idx + dir
    if (swap < 0 || swap >= lines.length) return
    const next = [...lines]
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    setField('lines', next)
  }

  return (
    <Card>
      <EnabledCheckbox checked={value.enabled !== false} onChange={v => setField('enabled', v)} disabled={readOnly} />

      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="block text-xs tracking-widest uppercase text-muted-foreground">Lines</span>
          {!readOnly && (
            <button type="button" onClick={addLine} className="text-xs underline cursor-pointer">+ Add line</button>
          )}
        </div>
        <div className="space-y-3">
          {lines.map((l, idx) => (
            <div key={idx} className="border border-border p-4 space-y-3">
              <BilingualField label={`Line ${idx + 1}`} valueEn={l.en || ''} valueAr={l.ar || ''} onEnChange={v => updateLine(idx, 'en', v)} onArChange={v => updateLine(idx, 'ar', v)} disabled={readOnly} />
              <div className="flex items-center justify-end gap-1">
                <button type="button" onClick={() => move(idx, -1)} disabled={readOnly || idx === 0} className="p-1 hover:bg-muted disabled:opacity-30 cursor-pointer" aria-label="Move up">
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => move(idx, 1)} disabled={readOnly || idx === lines.length - 1} className="p-1 hover:bg-muted disabled:opacity-30 cursor-pointer" aria-label="Move down">
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => removeLine(idx)} disabled={readOnly} className="p-1 text-red-700 hover:bg-muted disabled:opacity-30 cursor-pointer" aria-label="Remove line">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {lines.length === 0 && <p className="text-sm text-muted-foreground">No lines yet</p>}
        </div>
      </div>

      <SaveBar onSave={onSave} readOnly={readOnly} />
    </Card>
  )
}

// ---------- Footer Links ----------

function FooterLinksTab({ value, setField, onSave, readOnly }: { value: any; setField: (f: string, v: any) => void; onSave: () => void; readOnly: boolean }) {
  const items: any[] = value.items || []

  function updateItem(idx: number, field: string, v: any) {
    setField('items', items.map((it, i) => (i === idx ? { ...it, [field]: v } : it)))
  }
  function addItem() {
    setField('items', [...items, { label_en: '', label_ar: '', url: '' }])
  }
  function removeItem(idx: number) {
    setField('items', items.filter((_, i) => i !== idx))
  }

  return (
    <Card>
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="block text-xs tracking-widest uppercase text-muted-foreground">Links</span>
          {!readOnly && (
            <button type="button" onClick={addItem} className="text-xs underline cursor-pointer">+ Add link</button>
          )}
        </div>
        <div className="space-y-4">
          {items.map((it, idx) => (
            <div key={idx} className="border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Link {idx + 1}</span>
                <button type="button" onClick={() => removeItem(idx)} disabled={readOnly} className="p-1 text-red-700 hover:bg-muted disabled:opacity-30 cursor-pointer" aria-label="Remove link">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <BilingualField label="Label" valueEn={it.label_en || ''} valueAr={it.label_ar || ''} onEnChange={v => updateItem(idx, 'label_en', v)} onArChange={v => updateItem(idx, 'label_ar', v)} disabled={readOnly} />
              <Field label="URL" value={it.url || ''} onChange={v => updateItem(idx, 'url', v)} placeholder="/pages/about" disabled={readOnly} />
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-muted-foreground">No links yet</p>}
        </div>
      </div>

      <SaveBar onSave={onSave} readOnly={readOnly} />
    </Card>
  )
}

// ---------- Testimonials (full CRUD, mirrors AdminBanners.tsx) ----------

const EMPTY_TESTIMONIAL: Partial<Testimonial> = {
  author_name: '', author_title: '', quote_en: '', quote_ar: '', rating: 5, avatar_url: '', position: 0, active: true,
}

function TestimonialsTab() {
  const [rows, setRows] = useState<Testimonial[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Testimonial> | null>(null)
  const [saving, setSaving] = useState(false)
  const { isAdmin } = useAuth()
  const t = useT()

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('testimonials').select('*').order('position')
    setRows(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openNew() {
    const nextPosition = rows.length ? Math.max(...rows.map(r => r.position)) + 1 : 0
    setEditing({ ...EMPTY_TESTIMONIAL, position: nextPosition })
  }
  function openEdit(r: Testimonial) {
    setEditing({ ...r })
  }

  async function toggleActive(r: Testimonial) {
    const { error } = await supabase.from('testimonials').update({ active: !r.active }).eq('id', r.id)
    if (error) { toast.error(error.message); return }
    load()
  }

  async function move(row: Testimonial, direction: -1 | 1) {
    const idx = rows.findIndex(r => r.id === row.id)
    const swapIdx = idx + direction
    if (swapIdx < 0 || swapIdx >= rows.length) return
    const reordered = [...rows]
    ;[reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]]
    setRows(reordered)
    await Promise.all(reordered.map((r, i) => supabase.from('testimonials').update({ position: i }).eq('id', r.id)))
    load()
  }

  async function handleSave() {
    if (!editing) return
    if (!editing.author_name?.trim()) { toast.error('Author name is required'); return }
    if (!editing.quote_en?.trim() || !editing.quote_ar?.trim()) { toast.error('Quote is required in both languages'); return }
    setSaving(true)
    try {
      const payload = {
        author_name: editing.author_name.trim(),
        author_title: editing.author_title?.trim() || null,
        quote_en: editing.quote_en.trim(),
        quote_ar: editing.quote_ar.trim(),
        rating: editing.rating === null || editing.rating === undefined || (editing.rating as any) === '' ? null : Number(editing.rating),
        avatar_url: editing.avatar_url?.trim() || null,
        position: Number(editing.position) || 0,
        active: !!editing.active,
      }

      if (editing.id) {
        const { error } = await supabase.from('testimonials').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('testimonials').insert(payload)
        if (error) throw error
      }

      toast.success(editing.id ? 'Testimonial updated' : 'Testimonial created')
      setEditing(null)
      load()
    } catch (e: any) {
      toast.error(e.message || 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(r: Testimonial) {
    if (!confirm(`Delete testimonial from "${r.author_name}"?`)) return
    const { error } = await supabase.from('testimonials').delete().eq('id', r.id)
    if (error) { toast.error(error.message); return }
    toast.success('Testimonial deleted')
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">{rows.length} testimonial{rows.length === 1 ? '' : 's'}</p>
        {isAdmin && (
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-sm tracking-wider hover:bg-primary/90 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add testimonial
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
                  <th className="text-start px-4 py-3">Author</th>
                  <th className="text-start px-4 py-3">Quote</th>
                  <th className="text-start px-4 py-3">Rating</th>
                  <th className="text-start px-4 py-3">Active</th>
                  <th className="text-end px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => move(r, -1)} disabled={idx === 0} className="p-1 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer" aria-label="Move up">
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => move(r, 1)} disabled={idx === rows.length - 1} className="p-1 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer" aria-label="Move down">
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-muted overflow-hidden flex-shrink-0">
                          {r.avatar_url && <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{r.author_name}</p>
                          {r.author_title && <p className="text-xs text-muted-foreground truncate max-w-[180px]">{r.author_title}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-[240px]">{r.quote_en}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.rating ? (
                        <span className="inline-flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-current" />{r.rating}</span>
                      ) : t.dash}
                    </td>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={r.active} onChange={() => toggleActive(r)} className="w-4 h-4 cursor-pointer" aria-label="Active" />
                    </td>
                    <td className="px-4 py-3 text-end">
                      <button onClick={() => openEdit(r)} className="p-1.5 hover:bg-muted cursor-pointer" aria-label="Edit testimonial">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(r)} className="p-1.5 hover:bg-muted text-red-700 cursor-pointer" aria-label="Delete testimonial">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No testimonials yet</td>
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
              <h2 className="font-display text-2xl">{editing.id ? 'Edit testimonial' : 'New testimonial'}</h2>
              <button onClick={() => setEditing(null)} className="p-2 cursor-pointer" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Author name" value={editing.author_name || ''} onChange={v => setEditing({ ...editing, author_name: v })} />
                <Field label="Author title" value={editing.author_title || ''} onChange={v => setEditing({ ...editing, author_title: v })} placeholder="e.g. Verified buyer" />
              </div>
              <div>
                <label className="block text-xs tracking-widest uppercase text-muted-foreground mb-2">Quote (EN)</label>
                <textarea
                  value={editing.quote_en || ''}
                  onChange={e => setEditing({ ...editing, quote_en: e.target.value })}
                  rows={3}
                  className="w-full bg-transparent border border-border p-3 text-sm focus:border-foreground outline-none"
                />
              </div>
              <div>
                <label className="block text-xs tracking-widest uppercase text-muted-foreground mb-2">Quote (AR)</label>
                <textarea
                  dir="rtl"
                  value={editing.quote_ar || ''}
                  onChange={e => setEditing({ ...editing, quote_ar: e.target.value })}
                  rows={3}
                  className="w-full bg-transparent border border-border p-3 text-sm focus:border-foreground outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Rating (1-5)"
                  type="number"
                  value={editing.rating != null ? String(editing.rating) : ''}
                  onChange={v => setEditing({ ...editing, rating: v === '' ? null : Math.max(1, Math.min(5, Number(v))) })}
                />
                <Field label="Avatar URL" value={editing.avatar_url || ''} onChange={v => setEditing({ ...editing, avatar_url: v })} placeholder="https://…" />
              </div>
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
