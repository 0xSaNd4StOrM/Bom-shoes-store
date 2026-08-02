import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useT, useLanguage } from '@/contexts/LanguageContext'
import { useSeo } from '@/hooks/useSeo'
import { supabase } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'

type PoliciesContent = { title_en?: string; title_ar?: string; body_md_en?: string; body_md_ar?: string }

export default function Policies() {
  const t = useT()
  const { lang } = useLanguage()
  const [content, setContent] = useState<PoliciesContent | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('site_content')
      .select('value')
      .eq('key', 'policies')
      .maybeSingle()
      .then(
        ({ data }) => { setContent((data?.value as PoliciesContent) || {}); setLoading(false) },
        () => { setContent({}); setLoading(false) },
      )
  }, [])

  const title = (lang === 'ar' ? content?.title_ar : content?.title_en) || t.navPolicies
  const body = (lang === 'ar' ? content?.body_md_ar : content?.body_md_en) || ''

  useSeo({ title: `${title} · ${t.brandName}`, description: title })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="px-6 lg:px-10 py-16 lg:py-24 bg-cream min-h-screen">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display text-4xl md:text-6xl mb-10">{title}</h1>
        <div className="prose-policies text-sm leading-relaxed">
          <ReactMarkdown>{body}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
