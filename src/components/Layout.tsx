import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { useCart } from '@/contexts/CartContext'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage, useT } from '@/contexts/LanguageContext'
import { useCurrency } from '@/contexts/CurrencyContext'
import { ShoppingBag, User, Menu, X, LogOut, LayoutDashboard, Globe, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase, ProductCatalogEntry } from '@/lib/supabase'
import Logo from './Logo'
import WhatsAppButton from './WhatsAppButton'

type SearchHit = Pick<ProductCatalogEntry, 'id' | 'slug' | 'name' | 'min_price' | 'image_url'>

const SEARCH_HISTORY_KEY = 'bom-store-search-history'
const MAX_SEARCH_HISTORY = 8

function loadSearchHistory(): string[] {
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export default function Layout() {
  const { totalItems } = useCart()
  const { user, profile, isAdmin, signOut } = useAuth()
  const t = useT()
  const { lang, setLang } = useLanguage()
  const { formatPrice } = useCurrency()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [history, setHistory] = useState<string[]>(() => loadSearchHistory())
  const navigate = useNavigate()
  const langRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)
  const searchBtnRef = useRef<HTMLButtonElement>(null)
  const searchPanelRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false)
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserOpen(false)
      }
      if (
        searchPanelRef.current && searchBtnRef.current &&
        !searchPanelRef.current.contains(e.target as Node) &&
        !searchBtnRef.current.contains(e.target as Node)
      ) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close on Escape -- this overlay isn't a native <dialog>/Radix Dialog, so it
  // doesn't get that behavior for free.
  useEffect(() => {
    if (!searchOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [searchOpen])

  // Move focus into the panel on open, and back to the toggle button on
  // close -- however it closes (Escape, click-outside, the X, or committing
  // a search), since all of those just flip `searchOpen` to false and the
  // effect cleanup below fires right before that happens. Previously focus
  // was dropped to <body> on close, a real loss for keyboard/AT users.
  useEffect(() => {
    if (!searchOpen) return
    searchInputRef.current?.focus()
    const trigger = searchBtnRef.current
    return () => { trigger?.focus() }
  }, [searchOpen])

  // Debounced (250ms) live suggestions as the user types. No cancellation
  // token for the in-flight fetch -- same call QuickViewModal made, and at
  // 250ms/5-rows this race is not worth the plumbing.
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setSuggestions([])
      setSearching(false)
      return
    }
    setSearching(true)
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('product_catalog')
        .select('id, slug, name, min_price, image_url')
        .textSearch('search_vector', q, { type: 'websearch' })
        .limit(5)
      setSuggestions(data || [])
      setSearching(false)
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  function closeSearch() {
    setSearchOpen(false)
    setQuery('')
  }

  function commitSearch(raw: string) {
    const q = raw.trim()
    if (!q) return
    setHistory(current => {
      const next = [q, ...current.filter(h => h.toLowerCase() !== q.toLowerCase())].slice(0, MAX_SEARCH_HISTORY)
      try { localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next)) } catch { /* storage unavailable */ }
      return next
    })
    navigate(`/shop?search=${encodeURIComponent(q)}`)
    closeSearch()
  }

  function goToProduct(slug: string) {
    navigate(`/product/${slug}`)
    closeSearch()
  }

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const nav = [
    { to: '/shop', label: t.navShop },
    { to: '/shop?category=Sneakers', label: t.navSneakers },
    { to: '/shop?category=Boots', label: t.navBoots },
    { to: '/shop?category=Loafers', label: t.navLoafers },
  ]

  async function handleSignOut() {
    await signOut()
    setUserOpen(false)
    navigate('/')
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Announcement bar */}
      <div className="bg-foreground text-background text-[11px] tracking-[0.25em] uppercase py-2.5 px-4 text-center font-light overflow-hidden">
        <div className="marquee-track gap-12">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex gap-12 px-6 shrink-0">
              <span>★ {t.marqueeLine1}</span>
              <span>★ {t.marqueeLine2}</span>
              <span>★ {t.marqueeLine3}</span>
              <span>★ {t.marqueeLine4}</span>
              <span>★ {t.marqueeLine5}</span>
              <span>★ {t.marqueeLine6}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Header */}
      <header
        className={cn(
          'sticky top-0 z-30 transition-all duration-500 border-b',
          scrolled
            ? 'bg-background/95 backdrop-blur-md border-border/40 shadow-sm'
            : 'bg-background border-transparent'
        )}
      >
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-20 flex items-center justify-between gap-4">
          {/* Mobile menu */}
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 -ms-2 cursor-pointer hover:text-foreground/70 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Left nav (desktop) */}
          <nav className="hidden lg:flex items-center gap-10 flex-1">
            {nav.map(n => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) => cn(
                  "text-[12px] tracking-[0.18em] uppercase font-medium transition-colors hover:text-foreground/60 relative group",
                  isActive && "text-foreground"
                )}
              >
                {n.label}
                <span className="absolute -bottom-1 start-0 end-0 h-px bg-foreground scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
              </NavLink>
            ))}
          </nav>

          {/* Logo - centered */}
          <Link
            to="/"
            className="flex-shrink-0 transition-transform duration-500 hover:scale-105"
            aria-label="BOM Store home"
          >
            <Logo size={56} showText={false} />
          </Link>

          {/* Right icons */}
          <div className="flex items-center gap-0 md:gap-1 flex-1 justify-end">
            {/* Search */}
            <button
              ref={searchBtnRef}
              onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
              className="hidden md:flex p-2 hover:text-foreground/60 transition-colors cursor-pointer"
              aria-label={searchOpen ? 'Close search' : 'Search'}
            >
              {searchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
            </button>

            {/* Language toggle */}
            <div className="relative" ref={langRef}>
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1.5 p-2 cursor-pointer hover:text-foreground/60 transition-colors text-[11px] tracking-[0.18em] uppercase font-medium"
                aria-label="Switch language"
              >
                <Globe className="w-4 h-4" />
                <span className="hidden sm:inline">{lang === 'ar' ? 'AR' : 'EN'}</span>
                <ChevronDown className={cn("w-3 h-3 transition-transform", langOpen && "rotate-180")} />
              </button>
              {langOpen && (
                <div className="absolute end-0 top-full mt-3 w-40 bg-card border border-border shadow-xl z-50 fade-in">
                  <button
                    onClick={() => { setLang('ar'); setLangOpen(false) }}
                    className={cn(
                      "block w-full text-start px-4 py-3 text-sm hover:bg-muted transition-colors",
                      lang === 'ar' && "bg-muted font-medium"
                    )}
                  >
                    العربية
                  </button>
                  <button
                    onClick={() => { setLang('en'); setLangOpen(false) }}
                    className={cn(
                      "block w-full text-start px-4 py-3 text-sm hover:bg-muted transition-colors border-t border-border/60",
                      lang === 'en' && "bg-muted font-medium"
                    )}
                  >
                    English
                  </button>
                </div>
              )}
            </div>

            <div className="relative" ref={userRef}>
              <button
                onClick={() => setUserOpen(!userOpen)}
                className="p-2 cursor-pointer hover:text-foreground/60 transition-colors"
                aria-label="Account"
              >
                <User className="w-5 h-5" />
              </button>
              {userOpen && (
                <div className="absolute end-0 top-full mt-3 w-60 bg-card border border-border shadow-xl z-50 fade-in">
                  {user ? (
                    <div className="py-2">
                      <div className="px-4 py-3 border-b border-border/60">
                        <p className="text-sm font-medium">{profile?.full_name || (lang === 'ar' ? 'زائر' : 'Guest')}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{user.email}</p>
                      </div>
                      <Link
                        to="/account"
                        onClick={() => setUserOpen(false)}
                        className="block px-4 py-2.5 text-sm hover:bg-muted transition-colors"
                      >
                        {t.myAccount}
                      </Link>
                      {isAdmin && (
                        <Link
                          to="/admin"
                          onClick={() => setUserOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted transition-colors"
                        >
                          <LayoutDashboard className="w-4 h-4" />
                          {t.adminPanel}
                        </Link>
                      )}
                      <button
                        onClick={handleSignOut}
                        className="flex items-center gap-2 w-full text-start px-4 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        {t.signOut}
                      </button>
                    </div>
                  ) : (
                    <div className="py-2">
                      <Link
                        to="/login"
                        onClick={() => setUserOpen(false)}
                        className="block px-4 py-2.5 text-sm hover:bg-muted transition-colors"
                      >
                        {t.signIn}
                      </Link>
                      <Link
                        to="/signup"
                        onClick={() => setUserOpen(false)}
                        className="block px-4 py-2.5 text-sm hover:bg-muted transition-colors"
                      >
                        {t.createAccount}
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
            <Link
              to="/cart"
              className="p-2 hover:text-foreground/60 transition-colors relative"
              aria-label={t.cart}
            >
              <ShoppingBag className="w-5 h-5" />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -end-0.5 bg-foreground text-background text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-medium">
                  {totalItems}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Search overlay -- slide-down panel under the header, same fade-in
            treatment as the language/account dropdowns above. */}
        {searchOpen && (
          <div
            ref={searchPanelRef}
            className="absolute inset-x-0 top-full bg-background border-b border-border shadow-xl z-40 fade-in"
          >
            <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-6">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitSearch(query) }}
                  placeholder={t.searchPlaceholder}
                  dir={lang === 'ar' ? 'rtl' : 'ltr'}
                  className="w-full bg-transparent border-b border-foreground/30 focus:border-foreground outline-none py-3 ps-9 text-lg font-display placeholder:text-muted-foreground placeholder:font-sans"
                />
              </div>

              <div className="mt-6 min-h-[3rem]">
                {query.trim() ? (
                  <>
                    {suggestions.length > 0 ? (
                      <div className="space-y-1">
                        {suggestions.map(p => (
                          <button
                            key={p.id}
                            onClick={() => goToProduct(p.slug)}
                            className="w-full flex items-center gap-4 p-2 hover:bg-muted transition-colors text-start cursor-pointer"
                          >
                            <div className="w-12 h-12 bg-muted overflow-hidden shrink-0">
                              <img src={p.image_url || ''} alt={p.name} className="w-full h-full object-cover" />
                            </div>
                            <span className="flex-1 text-sm truncate">{p.name}</span>
                            <span className="text-sm text-muted-foreground shrink-0">{formatPrice(Number(p.min_price))}</span>
                          </button>
                        ))}
                      </div>
                    ) : !searching && (
                      <p className="text-sm text-muted-foreground py-2">{t.searchNoResults}</p>
                    )}
                    <button
                      onClick={() => commitSearch(query)}
                      className="mt-4 text-xs tracking-widest uppercase border-b border-foreground pb-0.5 cursor-pointer"
                    >
                      {t.searchSeeAll(query.trim())}
                    </button>
                  </>
                ) : history.length > 0 && (
                  <div>
                    <p className="text-xs tracking-widest uppercase text-muted-foreground mb-3">{t.searchRecent}</p>
                    <div className="flex flex-wrap gap-2">
                      {history.map(h => (
                        <button
                          key={h}
                          onClick={() => commitSearch(h)}
                          className="px-3.5 py-1.5 text-sm border border-border hover:border-foreground/50 transition-colors cursor-pointer"
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-background lg:hidden overflow-y-auto slide-in-right">
          <div className="flex items-center justify-between h-20 px-6 border-b border-border/60">
            <Link to="/" onClick={() => setMobileOpen(false)} aria-label="BOM Store home">
              <Logo size={48} showText={false} />
            </Link>
            <button onClick={() => setMobileOpen(false)} className="p-2 cursor-pointer" aria-label="Close menu">
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav className="flex flex-col p-6">
            {nav.map(n => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setMobileOpen(false)}
                className="py-4 text-2xl font-display border-b border-border/40 hover:text-foreground/60 transition-colors"
              >
                {n.label}
              </Link>
            ))}
            <Link
              to="/cart"
              onClick={() => setMobileOpen(false)}
              className="py-4 text-2xl font-display border-b border-border/40 flex items-center justify-between"
            >
              <span>{t.cart}</span>
              {totalItems > 0 && <span className="text-base text-muted-foreground">({totalItems})</span>}
            </Link>
            {user ? (
              <Link
                to="/account"
                onClick={() => setMobileOpen(false)}
                className="py-4 text-2xl font-display border-b border-border/40"
              >
                {t.myAccount}
              </Link>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="py-4 text-2xl font-display border-b border-border/40"
              >
                {t.signIn}
              </Link>
            )}
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setLang('ar')}
                className={cn(
                  "flex-1 py-3 text-sm border transition-colors cursor-pointer uppercase tracking-widest",
                  lang === 'ar' ? "bg-foreground text-background" : "border-border"
                )}
              >
                AR
              </button>
              <button
                onClick={() => setLang('en')}
                className={cn(
                  "flex-1 py-3 text-sm border transition-colors cursor-pointer uppercase tracking-widest",
                  lang === 'en' ? "bg-foreground text-background" : "border-border"
                )}
              >
                EN
              </button>
            </div>
          </nav>
        </div>
      )}

      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-foreground text-background mt-0">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-20">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
            <div className="md:col-span-5">
              <div className="mb-6">
                <Logo size={72} showText={false} />
              </div>
              <p className="font-light text-base leading-relaxed max-w-sm text-background/70">
                {t.brandTagline}
              </p>
              <p className="text-sm text-background/50 mt-8 italic font-display">
                {t.footerQuote}
              </p>
            </div>
            <div className="md:col-span-2">
              <h4 className="text-[11px] tracking-[0.25em] uppercase font-medium mb-6 text-background/90">{t.footerShop}</h4>
              <ul className="space-y-3 text-sm font-light text-background/70">
                <li><Link to="/shop?category=Sneakers" className="hover:text-background transition-colors">{t.navSneakers}</Link></li>
                <li><Link to="/shop?category=Boots" className="hover:text-background transition-colors">{t.navBoots}</Link></li>
                <li><Link to="/shop?category=Loafers" className="hover:text-background transition-colors">{t.navLoafers}</Link></li>
                <li><Link to="/shop?category=Slippers" className="hover:text-background transition-colors">{t.navSlippers}</Link></li>
              </ul>
            </div>
            <div className="md:col-span-2">
              <h4 className="text-[11px] tracking-[0.25em] uppercase font-medium mb-6 text-background/90">{t.footerAtelier}</h4>
              <ul className="space-y-3 text-sm font-light text-background/70">
                <li><a href="#" className="hover:text-background transition-colors">{t.footerOurStory}</a></li>
                <li><a href="#" className="hover:text-background transition-colors">{t.footerCraftsmanship}</a></li>
                <li><a href="#" className="hover:text-background transition-colors">{t.footerCare}</a></li>
                <li><a href="#" className="hover:text-background transition-colors">{t.footerContact}</a></li>
              </ul>
            </div>
            <div className="md:col-span-3">
              <h4 className="text-[11px] tracking-[0.25em] uppercase font-medium mb-6 text-background/90">Newsletter</h4>
              <p className="text-sm font-light text-background/70 mb-4 leading-relaxed">{t.homeNewsletterDesc}</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder={t.homeNewsletterPlaceholder}
                  dir={lang === 'ar' ? 'rtl' : 'ltr'}
                  className="flex-1 bg-transparent border-b border-background/30 focus:border-background outline-none py-2 text-sm placeholder:text-background/40 text-background"
                />
                <button className="text-sm tracking-wider border-b border-background pb-1 hover:opacity-70 transition-opacity cursor-pointer">
                  {t.homeNewsletterCta}
                </button>
              </div>
            </div>
          </div>
          <div className="mt-16 pt-8 border-t border-background/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-background/50 font-light">
              {t.footerCopyright}
            </p>
            <div className="flex items-center gap-6 text-xs text-background/50 font-light">
              <span>{t.footerSecure}</span>
              <span>·</span>
              <span>{t.footerReturns}</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp */}
      <WhatsAppButton />
    </div>
  )
}
