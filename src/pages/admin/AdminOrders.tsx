import { useEffect, useState } from 'react'
import { supabase, Order } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useT } from '@/contexts/LanguageContext'
import { Loader2, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

const STATUS_VALUES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']
const STATUS_LABEL_MAP: Record<string, string> = {
  pending: 'statusPending',
  confirmed: 'statusConfirmed',
  processing: 'statusProcessing',
  shipped: 'statusShipped',
  delivered: 'statusDelivered',
  cancelled: 'statusCancelled',
  paid: 'statusPaid',
  failed: 'statusFailed',
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const { isAdmin } = useAuth()
  const t = useT()

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function updateStatus(order: Order, newStatus: string) {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', order.id)
    if (error) { toast.error(error.message); return }
    toast.success(t.adminUpdated)
    load()
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)

  function statusLabel(s: string): string {
    const key = STATUS_LABEL_MAP[s]
    return key ? (t as any)[key] : s
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {['all', ...STATUS_VALUES].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-xs tracking-wider uppercase whitespace-nowrap cursor-pointer transition-colors ${
                filter === s
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s === 'all' ? t.adminOrdersAll : statusLabel(s)} {s !== 'all' && `(${orders.filter(o => o.status === s).length})`}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{filtered.length} {filtered.length === 1 ? t.piece : t.pieces}</p>
      </div>

      {loading ? (
        <div className="py-24 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">{t.adminNoOrdersFilter}</p>
        </div>
      ) : (
        <div className="border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs tracking-widest uppercase text-muted-foreground">
                <tr>
                  <th className="text-start px-4 py-3">{t.adminOrder}</th>
                  <th className="text-start px-4 py-3">{t.adminCustomer}</th>
                  <th className="text-start px-4 py-3">{t.adminDate}</th>
                  <th className="text-start px-4 py-3">{t.adminItems}</th>
                  <th className="text-start px-4 py-3">{t.adminTotal}</th>
                  <th className="text-start px-4 py-3">{t.adminPayment}</th>
                  <th className="text-start px-4 py-3">{t.adminStatus}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <tr key={o.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-4 font-mono text-xs text-muted-foreground">
                      {o.kashier_order_id || o.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium">{o.customer_name || t.dash}</p>
                      <p className="text-xs text-muted-foreground">{o.customer_email}</p>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground whitespace-nowrap">
                      {new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {Array.isArray(o.items) ? o.items.length : 0} {(o.items as any[])?.length === 1 ? t.piece : t.pieces}
                    </td>
                    <td className="px-4 py-4 font-medium">${Number(o.total_amount).toFixed(0)}</td>
                    <td className="px-4 py-4">
                      <span className={`text-xs px-2 py-0.5 border ${
                        o.payment_status === 'paid'
                          ? 'border-emerald-700/50 text-emerald-700'
                          : o.payment_status === 'failed'
                          ? 'border-red-700/50 text-red-700'
                          : 'border-muted-foreground/40 text-muted-foreground'
                      }`}>
                        {statusLabel(o.payment_status)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {isAdmin ? (
                        <div className="relative inline-block">
                          <select
                            value={o.status}
                            onChange={e => updateStatus(o, e.target.value)}
                            className="appearance-none bg-transparent border border-border px-2.5 py-1 pe-7 text-xs cursor-pointer focus:outline-none"
                          >
                            {STATUS_VALUES.map(s => (
                              <option key={s} value={s}>{statusLabel(s)}</option>
                            ))}
                          </select>
                          <ChevronDown className="w-3 h-3 absolute end-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      ) : (
                        <span className="text-xs">{statusLabel(o.status)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
