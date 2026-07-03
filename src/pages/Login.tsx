import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useT, useLanguage } from '@/contexts/LanguageContext'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = (location.state as any)?.from || '/account'
  const t = useT()
  const { lang } = useLanguage()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      toast.error(error.message || t.loginError)
    } else {
      toast.success(t.loginWelcome)
      navigate(redirectTo)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <p className="text-zen text-muted-foreground mb-4">{t.loginEyebrow}</p>
          <h1 className="font-display text-4xl md:text-5xl">{t.loginTitle}</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs tracking-widest uppercase text-muted-foreground mb-2">{t.loginEmail}</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
              className="w-full bg-transparent border-b border-foreground/30 focus:border-foreground outline-none py-2 text-sm transition-colors"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs tracking-widest uppercase text-muted-foreground mb-2">{t.loginPassword}</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
              className="w-full bg-transparent border-b border-foreground/30 focus:border-foreground outline-none py-2 text-sm transition-colors"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-3.5 text-sm tracking-widest uppercase hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t.loginCta}
          </button>
        </form>
        <p className="mt-10 text-center text-sm text-muted-foreground">
          {t.loginNew}{' '}
          <Link to="/signup" className="text-foreground underline-offset-2 hover:underline">
            {t.loginCreate}
          </Link>
        </p>
      </div>
    </div>
  )
}
