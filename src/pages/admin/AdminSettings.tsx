import { useEffect, useState } from 'react'
import { supabase, StoreSettings } from '@/lib/supabase'
import { useCategories } from '@/contexts/CategoriesContext'
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import { toast } from 'sonner'

// Singleton row id -- see supabase/migrations/20260704008000_store_settings_realtime.sql.
// Always read/write this exact id; never a bare insert.
const STORE_SETTINGS_ID = '00000000-0000-0000-0000-000000000001'

type UploadField = 'logo_url' | 'favicon_url'
type SettingsState = Pick<StoreSettings, 'logo_url' | 'favicon_url' | 'currency'>

type WhatsAppContent = { phone: string; message_en: string; message_ar: string }
type ContactContentState = {
  email: string
  phone: string
  address_en: string
  address_ar: string
  map_url: string
  social_instagram: string
  social_facebook: string
  social_tiktok: string
  social_twitter: string
}

const CURRENCY_VALUES = ['EGP', 'USD', 'SAR', 'AED', 'EUR', 'GBP']
const EMPTY_WHATSAPP: WhatsAppContent = { phone: '', message_en: '', message_ar: '' }
const EMPTY_CONTACT: ContactContentState = {
  email: '', phone: '', address_en: '', address_ar: '', map_url: '',
  social_instagram: '', social_facebook: '', social_tiktok: '', social_twitter: '',
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<SettingsState | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingFavicon, setUploadingFavicon] = useState(false)
  const [whatsapp, setWhatsapp] = useState<WhatsAppContent>(EMPTY_WHATSAPP)
  const [contact, setContact] = useState<ContactContentState>(EMPTY_CONTACT)
  const [savingWhatsapp, setSavingWhatsapp] = useState(false)
  const [savingContact, setSavingContact] = useState(false)
  const { categories, reload: reloadCategories } = useCategories()
  const [newLabelEn, setNewLabelEn] = useState('')
  const [newLabelAr, setNewLabelAr] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('store_settings')
      .select('logo_url, favicon_url, currency')
      .eq('id', STORE_SETTINGS_ID)
      .maybeSingle()
    setSettings(data || { logo_url: null, favicon_url: null, currency: 'EGP' })

    const { data: content } = await supabase
      .from('site_content')
      .select('key, value')
      .in('key', ['whatsapp', 'contact'])
    for (const row of content || []) {
      if (row.key === 'whatsapp') setWhatsapp({ ...EMPTY_WHATSAPP, ...row.value })
      if (row.key === 'contact') {
        const v = row.value as Record<string, string | null>
        setContact({
          email: v.email || '', phone: v.phone || '',
          address_en: v.address_en || '', address_ar: v.address_ar || '',
          map_url: v.map_url || '',
          social_instagram: v.social_instagram || '', social_facebook: v.social_facebook || '',
          social_tiktok: v.social_tiktok || '', social_twitter: v.social_twitter || '',
        })
      }
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleSaveWhatsapp() {
    setSavingWhatsapp(true)
    const { error } = await supabase
      .from('site_content')
      .update({ value: whatsapp })
      .eq('key', 'whatsapp')
    setSavingWhatsapp(false)
    if (error) { toast.error(error.message || 'Save failed'); return }
    toast.success('Saved')
  }

  async function handleSaveContact() {
    setSavingContact(true)
    // Store nulls, not empty strings, for fields the admin left blank -- the
    // storefront footer treats "" and null the same, but null is the honest
    // representation of "not set" the migration seeded.
    const value = Object.fromEntries(
      Object.entries(contact).map(([k, v]) => [k, v || null])
    )
    const { error } = await supabase
      .from('site_content')
      .update({ value })
      .eq('key', 'contact')
    setSavingContact(false)
    if (error) { toast.error(error.message || 'Save failed'); return }
    toast.success('Saved')
  }

  // UPDATE the seeded singleton, never upsert -- same RLS reason as the logo/
  // favicon writes below (no insert policy; an upsert's INSERT arm 500s).
  async function handleCurrencyChange(currency: string) {
    setSettings(prev => ({ ...(prev || { logo_url: null, favicon_url: null, currency: 'EGP' }), currency }))
    const { error } = await supabase
      .from('store_settings')
      .update({ currency })
      .eq('id', STORE_SETTINGS_ID)
    if (error) { toast.error(error.message || 'Save failed'); return }
    toast.success('Saved')
  }

  async function handleUpload(field: UploadField, file: File | undefined, setUploading: (v: boolean) => void) {
    if (!file) return
    setUploading(true)
    try {
      const prefix = field === 'logo_url' ? 'logo' : 'favicon'
      const path = `${prefix}/${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage.from('store-assets').upload(path, file)
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from('store-assets').getPublicUrl(path)
      // UPDATE, not upsert: store_settings is a migration-seeded singleton with
      // an admin-only UPDATE policy and NO insert policy (a check constraint
      // makes the one row the only possible row). An upsert issues INSERT ... ON
      // CONFLICT, whose INSERT arm the missing insert policy rejects with an RLS
      // violation even though the row already exists -- so update the seeded row.
      const { error: dbErr } = await supabase
        .from('store_settings')
        .update({ [field]: pub.publicUrl })
        .eq('id', STORE_SETTINGS_ID)
      if (dbErr) throw dbErr
      setSettings(prev => ({ ...(prev || { logo_url: null, favicon_url: null, currency: 'EGP' }), [field]: pub.publicUrl }))
      toast.success('Saved')
    } catch (e: any) {
      toast.error(e.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleAddCategory() {
    const label_en = newLabelEn.trim()
    const label_ar = newLabelAr.trim()
    if (!label_en || !label_ar) { toast.error('Both English and Arabic names are required'); return }
    setSavingCategory(true)
    const position = categories.length ? Math.max(...categories.map(c => c.position)) + 1 : 0
    const { error } = await supabase
      .from('categories')
      .insert({ value: label_en, label_en, label_ar, position })
    setSavingCategory(false)
    if (error) { toast.error(error.message || 'Could not add category'); return }
    setNewLabelEn('')
    setNewLabelAr('')
    toast.success('Category added')
    reloadCategories()
  }

  async function handleUpdateCategoryLabel(value: string, field: 'label_en' | 'label_ar', text: string) {
    const { error } = await supabase.from('categories').update({ [field]: text }).eq('value', value)
    if (error) { toast.error(error.message || 'Save failed'); return }
    reloadCategories()
  }

  async function handleDeleteCategory(value: string) {
    // ponytail: a simple existence check, not a foreign key -- products.category
    // has always been free text, so this is the same protection an FK ON DELETE
    // RESTRICT would give without a schema change.
    const { count } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('category', value)
    if (count) { toast.error(`${count} product(s) still use this category`); return }
    const { error } = await supabase.from('categories').delete().eq('value', value)
    if (error) { toast.error(error.message || 'Delete failed'); return }
    toast.success('Category deleted')
    reloadCategories()
  }

  async function handleMoveCategory(index: number, direction: -1 | 1) {
    const target = categories[index + direction]
    const current = categories[index]
    if (!target) return
    await Promise.all([
      supabase.from('categories').update({ position: target.position }).eq('value', current.value),
      supabase.from('categories').update({ position: current.position }).eq('value', target.value),
    ])
    reloadCategories()
  }

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-xl space-y-8">
      <UploadField
        label="Logo"
        currentUrl={settings?.logo_url || null}
        uploading={uploadingLogo}
        onChange={file => handleUpload('logo_url', file, setUploadingLogo)}
      />
      <UploadField
        label="Favicon"
        currentUrl={settings?.favicon_url || null}
        uploading={uploadingFavicon}
        onChange={file => handleUpload('favicon_url', file, setUploadingFavicon)}
      />
      <div className="border border-border bg-card p-6">
        <span className="block text-xs tracking-widest uppercase text-muted-foreground mb-4">Display currency</span>
        <select
          value={settings?.currency || 'EGP'}
          onChange={e => handleCurrencyChange(e.target.value)}
          className="w-full bg-transparent border border-border px-3 py-2 text-sm focus:border-foreground outline-none cursor-pointer"
        >
          {CURRENCY_VALUES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <p className="text-[11px] text-muted-foreground mt-3">
          Shown to shoppers only. Payment is always charged in EGP by Kashier.
        </p>
      </div>

      <div className="border border-border bg-card p-6 space-y-4">
        <span className="block text-xs tracking-widest uppercase text-muted-foreground">Categories</span>
        <div className="space-y-2">
          {categories.map((c, i) => (
            <div key={c.value} className="flex items-center gap-2">
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => handleMoveCategory(i, -1)}
                  disabled={i === 0}
                  className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                  aria-label="Move up"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveCategory(i, 1)}
                  disabled={i === categories.length - 1}
                  className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                  aria-label="Move down"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>
              <input
                type="text"
                defaultValue={c.label_en}
                onBlur={e => e.target.value.trim() && e.target.value !== c.label_en && handleUpdateCategoryLabel(c.value, 'label_en', e.target.value.trim())}
                placeholder="English name"
                className="flex-1 min-w-0 bg-transparent border border-border px-3 py-2 text-sm focus:border-foreground outline-none"
              />
              <input
                type="text"
                dir="rtl"
                defaultValue={c.label_ar}
                onBlur={e => e.target.value.trim() && e.target.value !== c.label_ar && handleUpdateCategoryLabel(c.value, 'label_ar', e.target.value.trim())}
                placeholder="الاسم بالعربية"
                className="flex-1 min-w-0 bg-transparent border border-border px-3 py-2 text-sm focus:border-foreground outline-none"
              />
              <button
                type="button"
                onClick={() => handleDeleteCategory(c.value)}
                className="p-2 text-red-700 hover:bg-muted cursor-pointer flex-shrink-0"
                aria-label="Delete category"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <input
            type="text"
            value={newLabelEn}
            onChange={e => setNewLabelEn(e.target.value)}
            placeholder="English name"
            className="flex-1 min-w-0 bg-transparent border border-border px-3 py-2 text-sm focus:border-foreground outline-none"
          />
          <input
            type="text"
            dir="rtl"
            value={newLabelAr}
            onChange={e => setNewLabelAr(e.target.value)}
            placeholder="الاسم بالعربية"
            className="flex-1 min-w-0 bg-transparent border border-border px-3 py-2 text-sm focus:border-foreground outline-none"
          />
          <button
            type="button"
            onClick={handleAddCategory}
            disabled={savingCategory}
            className="p-2 border border-border hover:bg-muted cursor-pointer disabled:opacity-50 flex-shrink-0"
            aria-label="Add category"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="border border-border bg-card p-6 space-y-4">
        <span className="block text-xs tracking-widest uppercase text-muted-foreground">WhatsApp</span>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Phone number</label>
          <input
            type="text"
            value={whatsapp.phone}
            onChange={e => setWhatsapp(prev => ({ ...prev, phone: e.target.value }))}
            placeholder="+201234567890"
            className="w-full bg-transparent border border-border px-3 py-2 text-sm focus:border-foreground outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Message (English)</label>
          <textarea
            value={whatsapp.message_en}
            onChange={e => setWhatsapp(prev => ({ ...prev, message_en: e.target.value }))}
            rows={3}
            className="w-full bg-transparent border border-border px-3 py-2 text-sm focus:border-foreground outline-none resize-none"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Message (Arabic)</label>
          <textarea
            value={whatsapp.message_ar}
            onChange={e => setWhatsapp(prev => ({ ...prev, message_ar: e.target.value }))}
            dir="rtl"
            rows={3}
            className="w-full bg-transparent border border-border px-3 py-2 text-sm focus:border-foreground outline-none resize-none"
          />
        </div>
        <button
          onClick={handleSaveWhatsapp}
          disabled={savingWhatsapp}
          className="text-xs tracking-wider uppercase border border-foreground px-4 py-2 hover:bg-foreground hover:text-background transition-colors disabled:opacity-50 cursor-pointer"
        >
          {savingWhatsapp ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="border border-border bg-card p-6 space-y-4">
        <span className="block text-xs tracking-widest uppercase text-muted-foreground">Contact & Social</span>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Email</label>
            <input
              type="email"
              value={contact.email}
              onChange={e => setContact(prev => ({ ...prev, email: e.target.value }))}
              className="w-full bg-transparent border border-border px-3 py-2 text-sm focus:border-foreground outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Phone</label>
            <input
              type="text"
              value={contact.phone}
              onChange={e => setContact(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full bg-transparent border border-border px-3 py-2 text-sm focus:border-foreground outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Address (English)</label>
            <input
              type="text"
              value={contact.address_en}
              onChange={e => setContact(prev => ({ ...prev, address_en: e.target.value }))}
              className="w-full bg-transparent border border-border px-3 py-2 text-sm focus:border-foreground outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Address (Arabic)</label>
            <input
              type="text"
              dir="rtl"
              value={contact.address_ar}
              onChange={e => setContact(prev => ({ ...prev, address_ar: e.target.value }))}
              className="w-full bg-transparent border border-border px-3 py-2 text-sm focus:border-foreground outline-none"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">Map URL</label>
            <input
              type="text"
              value={contact.map_url}
              onChange={e => setContact(prev => ({ ...prev, map_url: e.target.value }))}
              className="w-full bg-transparent border border-border px-3 py-2 text-sm focus:border-foreground outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Instagram URL</label>
            <input
              type="text"
              value={contact.social_instagram}
              onChange={e => setContact(prev => ({ ...prev, social_instagram: e.target.value }))}
              className="w-full bg-transparent border border-border px-3 py-2 text-sm focus:border-foreground outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Facebook URL</label>
            <input
              type="text"
              value={contact.social_facebook}
              onChange={e => setContact(prev => ({ ...prev, social_facebook: e.target.value }))}
              className="w-full bg-transparent border border-border px-3 py-2 text-sm focus:border-foreground outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">TikTok URL</label>
            <input
              type="text"
              value={contact.social_tiktok}
              onChange={e => setContact(prev => ({ ...prev, social_tiktok: e.target.value }))}
              className="w-full bg-transparent border border-border px-3 py-2 text-sm focus:border-foreground outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Twitter / X URL</label>
            <input
              type="text"
              value={contact.social_twitter}
              onChange={e => setContact(prev => ({ ...prev, social_twitter: e.target.value }))}
              className="w-full bg-transparent border border-border px-3 py-2 text-sm focus:border-foreground outline-none"
            />
          </div>
        </div>
        <button
          onClick={handleSaveContact}
          disabled={savingContact}
          className="text-xs tracking-wider uppercase border border-foreground px-4 py-2 hover:bg-foreground hover:text-background transition-colors disabled:opacity-50 cursor-pointer"
        >
          {savingContact ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function UploadField({
  label,
  currentUrl,
  uploading,
  onChange,
}: {
  label: string
  currentUrl: string | null
  uploading: boolean
  onChange: (file: File | undefined) => void
}) {
  return (
    <div className="border border-border bg-card p-6">
      <span className="block text-xs tracking-widest uppercase text-muted-foreground mb-4">{label}</span>
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
          {currentUrl ? (
            <img src={currentUrl} alt={`Current ${label}`} className="w-full h-full object-contain" />
          ) : (
            <span className="text-[10px] text-muted-foreground">None</span>
          )}
        </div>
        <label className={`text-xs underline ${uploading ? 'opacity-50' : 'cursor-pointer'}`}>
          {uploading ? 'Uploading…' : `Upload ${label}`}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={e => { onChange(e.target.files?.[0]); e.target.value = '' }}
          />
        </label>
      </div>
    </div>
  )
}
