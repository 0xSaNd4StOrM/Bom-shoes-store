import { useEffect, useState } from 'react'
import { supabase, Profile } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useT } from '@/contexts/LanguageContext'
import { Loader2, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

const ROLE_VALUES = ['customer', 'admin']

export default function AdminUsers() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const { profile: me, isAdmin } = useAuth()
  const t = useT()

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    setProfiles(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function updateRole(p: Profile, newRole: string) {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', p.id)
    if (error) { toast.error(error.message); return }
    toast.success('Role updated')
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">{profiles.length} {profiles.length === 1 ? t.piece : t.pieces}</p>
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
                  <th className="text-start px-4 py-3">Email</th>
                  <th className="text-start px-4 py-3">Full Name</th>
                  <th className="text-start px-4 py-3">{t.adminDate}</th>
                  <th className="text-start px-4 py-3">Role</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map(p => {
                  const isSelf = p.id === me?.id
                  return (
                    <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-3">
                        {p.email || t.dash}{isSelf && <span className="text-xs text-muted-foreground"> (you)</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.full_name || t.dash}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {new Date(p.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        {isAdmin ? (
                          <div className="relative inline-block">
                            <select
                              value={p.role}
                              disabled={isSelf}
                              // ponytail: block self-demotion by disabling the control outright
                              // rather than a confirm() dialog -- nothing to misclick through,
                              // and it can't leave the app with zero admins by accident.
                              title={isSelf ? "You can't change your own role here" : undefined}
                              onChange={e => updateRole(p, e.target.value)}
                              className="appearance-none bg-transparent border border-border px-2.5 py-1 pe-7 text-xs cursor-pointer focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {ROLE_VALUES.map(r => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                            <ChevronDown className="w-3 h-3 absolute end-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        ) : (
                          <span className="text-xs">{p.role}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
