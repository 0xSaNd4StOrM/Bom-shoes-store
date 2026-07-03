import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { supabase, Order, Product } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useT, useLanguage } from '@/contexts/LanguageContext'
import { Package, ShoppingBag, TrendingUp, LayoutDashboard, ListOrdered, LogOut, Loader2 } from 'lucide-react'

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

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    revenue: 0,
    orders: 0,
    products: 0,
    pending: 0,
  })
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [topProducts, setTopProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const t = useT()
  const { lang } = useLanguage()

  useEffect(() => {
    async function load() {
      const [{ data: orders }, { data: products }] = await Promise.all([
        supabase.from('orders').select('*'),
        supabase.from('products').select('*'),
      ])

      const revenue = (orders || []).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)
      setStats({
        revenue,
        orders: (orders || []).length,
        products: (products || []).length,
        pending: (orders || []).filter(o => o.status === 'pending' || o.status === 'confirmed').length,
      })
      setRecentOrders((orders || []).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5))
      setTopProducts((products || []).sort((a, b) => (b.stock < 10 ? 1 : 0) - (a.stock < 10 ? 1 : 0)).slice(0, 5))
      setLoading(false)
    }
    load()
  }, [])

  const navItems = [
    { to: '/admin', label: t.adminNavOverview, icon: LayoutDashboard, end: true },
    { to: '/admin/products', label: t.adminNavProducts, icon: Package },
    { to: '/admin/orders', label: t.adminNavOrders, icon: ListOrdered },
  ]

  function statusLabel(s: string): string {
    const key = STATUS_LABEL_MAP[s]
    return key ? (t as any)[key] : s
  }

  return (
    <div className="px-6 lg:px-10 py-10 bg-muted/20 min-h-screen">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <p className="text-zen text-muted-foreground mb-2">{t.adminEyebrow}</p>
            <h1 className="font-display text-3xl md:text-4xl">{t.adminTitle}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{profile?.email}</span>
            <button
              onClick={signOut}
              className="p-2 border border-border hover:bg-card transition-colors cursor-pointer"
              aria-label={t.adminSignOut}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex gap-2 border-b border-border mb-8 overflow-x-auto scrollbar-none">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-3 text-sm border-b-2 -mb-px transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </div>

        {location.pathname === '/admin' ? (
          loading ? (
            <div className="py-24 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                <StatCard
                  icon={TrendingUp}
                  label={t.adminRevenue}
                  value={`$${stats.revenue.toFixed(0)}`}
                />
                <StatCard
                  icon={ListOrdered}
                  label={t.adminOrders}
                  value={stats.orders}
                />
                <StatCard
                  icon={Package}
                  label={t.adminProducts}
                  value={stats.products}
                />
                <StatCard
                  icon={ShoppingBag}
                  label={t.adminActive}
                  value={stats.pending}
                />
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                <div className="border border-border bg-card p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="font-display text-xl">{t.adminRecentOrders}</h2>
                    <Link to="/admin/orders" className="text-xs text-muted-foreground hover:text-foreground">
                      {t.adminViewAll}
                    </Link>
                  </div>
                  {recentOrders.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">{t.adminNoOrders}</p>
                  ) : (
                    <div className="space-y-3">
                      {recentOrders.map(o => (
                        <div key={o.id} className="flex items-center justify-between text-sm">
                          <div className="min-w-0">
                            <p className="font-mono text-xs text-muted-foreground truncate">
                              {o.kashier_order_id || o.id.slice(0, 8)}
                            </p>
                            <p className="truncate">{o.customer_name || (lang === 'ar' ? 'زائر' : 'Guest')}</p>
                          </div>
                          <div className="text-end flex-shrink-0 ms-4">
                            <p className="font-medium">${Number(o.total_amount).toFixed(0)}</p>
                            <p className="text-xs text-muted-foreground">{statusLabel(o.status)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border border-border bg-card p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="font-display text-xl">{t.adminLowStock}</h2>
                    <Link to="/admin/products" className="text-xs text-muted-foreground hover:text-foreground">
                      {t.adminViewAll}
                    </Link>
                  </div>
                  {topProducts.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">{t.adminAllStocked}</p>
                  ) : (
                    <div className="space-y-3">
                      {topProducts.map(p => (
                        <div key={p.id} className="flex items-center gap-3 text-sm">
                          <div className="w-10 h-10 bg-muted overflow-hidden flex-shrink-0">
                            <img src={p.image_url || ''} alt="" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate">{p.name}</p>
                            <p className="text-xs text-muted-foreground">${Number(p.price).toFixed(0)}</p>
                          </div>
                          <p className={`text-sm font-medium ${p.stock < 10 ? 'text-red-700' : 'text-foreground'}`}>
                            {t.shopOnlyLeft(p.stock)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )
        ) : (
          <Outlet />
        )}
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="border border-border bg-card p-5">
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs tracking-widest uppercase text-muted-foreground">{label}</p>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <p className="font-display text-3xl">{value}</p>
    </div>
  )
}
