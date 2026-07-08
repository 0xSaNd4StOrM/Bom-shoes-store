import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useT } from '@/contexts/LanguageContext'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useSeo } from '@/hooks/useSeo'
import { supabase, Order } from '@/lib/supabase'
import { Package, LayoutDashboard, ListOrdered, Tag, LogOut, Image, Users, History, Settings, Gift, PanelTop } from 'lucide-react'

// Shared chrome (header + nav tabs) for every /admin/* screen. Nested under
// a single <Route path="/admin"> in App.tsx so this renders once and each
// tab swaps only the <Outlet/> content -- previously this bar only existed
// inside AdminDashboard, so it vanished on /admin/products and /admin/orders.
export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  const t = useT()
  const { formatPrice } = useCurrency()
  const location = useLocation()
  const [unreadOrders, setUnreadOrders] = useState(0)
  // Read inside the realtime callback below so an INSERT while already on
  // /admin/orders doesn't bump the badge (a ref avoids re-subscribing the
  // channel effect on every navigation).
  const pathRef = useRef(location.pathname)
  useEffect(() => { pathRef.current = location.pathname }, [location.pathname])

  // Set once here rather than in every admin child page -- every /admin/*
  // route renders through this layout's <Outlet/>, so one noindex'd title
  // covers all of them (dashboard, products, orders, coupons, banners,
  // users, activity log) with no per-page repetition.
  useSeo({
    title: 'Admin — BOM Store',
    description: 'BOM Store admin console.',
    noindex: true,
  })

  // Live new-order feed for the whole admin section. INSERT (not the later
  // payment_status -> 'paid' UPDATE) is the signal here: it fires the moment
  // a customer starts checkout, which is more useful for an admin watching
  // the console live than waiting for payment confirmation.
  useEffect(() => {
    const channel = supabase
      // Unique topic per mount -- a static topic string collides with the
      // still-leaving channel from a StrictMode/Fast-Refresh remount, since
      // removeChannel() only unsubscribes after a server round trip.
      .channel(`admin-new-orders-${crypto.randomUUID()}`)
      .on<Order>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        payload => {
          const o = payload.new
          setUnreadOrders(n => (pathRef.current === '/admin/orders' ? n : n + 1))
          toast.info(
            t.adminNewOrderToast(
              o.kashier_order_id || o.id.slice(0, 8),
              o.customer_name || o.customer_email || t.dash,
              formatPrice(Number(o.total_amount || 0))
            )
          )
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Visiting the Orders tab clears its unread badge.
  useEffect(() => {
    if (location.pathname === '/admin/orders') setUnreadOrders(0)
  }, [location.pathname])

  const navItems = [
    { to: '/admin', label: t.adminNavOverview, icon: LayoutDashboard, end: true },
    { to: '/admin/products', label: t.adminNavProducts, icon: Package },
    { to: '/admin/orders', label: t.adminNavOrders, icon: ListOrdered, badge: unreadOrders },
    { to: '/admin/coupons', label: t.adminNavCoupons, icon: Tag },
    { to: '/admin/bundles', label: t.adminNavBundles, icon: Gift },
    { to: '/admin/banners', label: t.adminNavBanners, icon: Image },
    { to: '/admin/homepage', label: t.adminNavHomepage, icon: PanelTop },
    { to: '/admin/users', label: t.adminNavUsers, icon: Users },
    { to: '/admin/activity', label: t.adminNavActivity, icon: History },
    { to: '/admin/settings', label: t.adminNavSettings, icon: Settings },
  ]

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
              {!!item.badge && (
                <span className="min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-foreground text-background text-[10px] flex items-center justify-center leading-none">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </div>

        <Outlet />
      </div>
    </div>
  )
}
