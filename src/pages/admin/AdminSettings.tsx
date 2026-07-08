import { useEffect, useState } from 'react'
import { supabase, StoreSettings } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

// Singleton row id -- see supabase/migrations/20260704008000_store_settings_realtime.sql.
// Always read/write this exact id; never a bare insert.
const STORE_SETTINGS_ID = '00000000-0000-0000-0000-000000000001'

type UploadField = 'logo_url' | 'favicon_url'
type SettingsState = Pick<StoreSettings, 'logo_url' | 'favicon_url' | 'currency'>

const CURRENCY_VALUES = ['EGP', 'USD', 'SAR', 'AED', 'EUR', 'GBP']

export default function AdminSettings() {
  const [settings, setSettings] = useState<SettingsState | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingFavicon, setUploadingFavicon] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('store_settings')
      .select('logo_url, favicon_url, currency')
      .eq('id', STORE_SETTINGS_ID)
      .maybeSingle()
    setSettings(data || { logo_url: null, favicon_url: null, currency: 'EGP' })
    setLoading(false)
  }
  useEffect(() => { load() }, [])

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
