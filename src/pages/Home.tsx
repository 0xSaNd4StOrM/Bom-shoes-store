import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase, ProductCatalogEntry, HeroBanner } from '@/lib/supabase'
import { useT, useLanguage } from '@/contexts/LanguageContext'
import { useCart } from '@/contexts/CartContext'
import {
  ArrowRight, ArrowUpRight, Truck, ShieldCheck, RotateCcw, Lock,
  Package, Award, Heart, Star, CreditCard, Clock, Gift, Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import ShoeShowcase3D from '@/components/ShoeShowcase3D'
import ProductCard from '@/components/ProductCard'
import SectionHeading from '@/components/SectionHeading'
import CountdownTimer from '@/components/CountdownTimer'
import QuickViewModal from '@/components/QuickViewModal'
import { useSeo } from '@/hooks/useSeo'
import { useCategories } from '@/contexts/CategoriesContext'

// Homepage hero banner slide, sourced from the admin-managed hero_banners
// table. Rendered instead of the hardcoded hero below when >=1 active banner
// exists; auto-advances with a plain interval when there's more than one --
// no carousel library, this codebase doesn't already use embla anywhere.
function HeroBanners({ banners }: { banners: HeroBanner[] }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (banners.length < 2) return
    const id = setInterval(() => setIndex(i => (i + 1) % banners.length), 6000)
    return () => clearInterval(id)
  }, [banners.length])

  const banner = banners[index]

  return (
    <section className="relative min-h-[95vh] flex items-center overflow-hidden bg-background">
      {banner.image_url && (
        <img
          src={banner.image_url}
          alt={banner.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />

      <div className="relative max-w-[1400px] mx-auto px-6 lg:px-10 w-full py-20 text-background">
        <h1 className="font-display text-6xl md:text-7xl lg:text-[7.5rem] leading-[0.95] tracking-[-0.03em] max-w-3xl fade-up fade-up-2">
          {banner.title}
        </h1>
        {banner.subtitle && (
          <p className="mt-8 text-base md:text-lg text-background/80 max-w-md font-light leading-relaxed fade-up fade-up-3">
            {banner.subtitle}
          </p>
        )}
        {banner.cta_text && banner.cta_link && (
          <div className="mt-12 fade-up fade-up-4">
            <Link
              to={banner.cta_link}
              className="group inline-flex items-center gap-3 bg-background text-foreground px-8 py-4 text-[13px] tracking-[0.2em] uppercase font-medium hover:bg-background/90 transition-all duration-300 cursor-pointer hover:shadow-2xl hover:-translate-y-0.5"
            >
              {banner.cta_text}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform flip-rtl" />
            </Link>
          </div>
        )}
        {banners.length > 1 && (
          <div className="mt-16 flex items-center gap-2">
            {banners.map((b, i) => (
              <button
                key={b.id}
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${i === index ? 'w-8 bg-background' : 'w-1.5 bg-background/40'}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

const TRUST_ICONS: Record<string, typeof Truck> = {
  Truck, ShieldCheck, RotateCcw, Lock, Package, Award, Heart, Star, CreditCard, Clock, Gift, Sparkles,
}

export default function Home() {
  const [featured, setFeatured] = useState<ProductCatalogEntry[]>([])
  const [recent, setRecent] = useState<ProductCatalogEntry[]>([])
  // null = fetch in flight (render a skeleton); [] = loaded, genuinely empty.
  const [productsLoading, setProductsLoading] = useState(true)
  const [banners, setBanners] = useState<HeroBanner[]>([])
  const [dropEndsAt, setDropEndsAt] = useState<Date | null>(null)
  // ponytail: no admin-configured auto-apply promo has an end date yet --
  // static 7-day-out placeholder so the countdown never looks broken. Swap
  // for real campaigns via the Coupons admin dashboard.
  const [placeholderDrop] = useState(() => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
  const [quickViewId, setQuickViewId] = useState<string | null>(null)
  const [quickAddingId, setQuickAddingId] = useState<string | null>(null)
  const [content, setContent] = useState<Record<string, any>>({})
  // null = fetch in flight (render a skeleton); [] = loaded, genuinely none configured.
  const [categories, setCategories] = useState<string[] | null>(null)
  const [testimonials, setTestimonials] = useState<any[] | null>(null)
  const t = useT()
  const { lang } = useLanguage()
  const { addItem } = useCart()
  const { categoryLabel } = useCategories()
  const revealRefs = useRef<HTMLElement[]>([])

  useSeo({ title: `${t.brandName} · ${t.brandTagline}`, description: t.homeHeroSubtitle })

  useEffect(() => {
    async function load() {
      const { data: f } = await supabase
        .from('product_catalog')
        .select('*')
        .eq('featured', true)
        .order('created_at', { ascending: false })
        .limit(6)
      const { data: r } = await supabase
        .from('product_catalog')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6)
      if (f) setFeatured(f)
      if (r) setRecent(r)
      setProductsLoading(false)
    }
    load()
  }, [])

  // Site-wide CMS copy for the homepage sections (hero fallback, curated,
  // limited drop, trust badges, atelier) -- one round trip, keyed by row.
  useEffect(() => {
    supabase
      .from('site_content')
      .select('key, value')
      .then(({ data }) => {
        const map: Record<string, any> = {}
        for (const row of data || []) map[row.key] = row.value
        setContent(map)
      })
  }, [])

  // Categories strip: derived from whatever categories actually exist on
  // real products, so a brand-new category shows up with no CMS step.
  useEffect(() => {
    supabase
      .from('product_catalog')
      .select('category')
      .then(({ data }) => {
        const seen: string[] = []
        for (const row of data || []) {
          const c = row.category
          if (c && !seen.includes(c)) seen.push(c)
        }
        setCategories(seen)
      })
  }, [])

  // Testimonials: admin-managed table, active rows only, ordered by position.
  useEffect(() => {
    supabase
      .from('testimonials')
      .select('*')
      .eq('active', true)
      .order('position')
      .then(({ data }) => setTestimonials(data || []))
  }, [])

  // Admin-managed hero banners. Zero active rows -> the hardcoded hero below
  // renders unchanged, so the homepage never looks broken/empty just because
  // no banners have been configured yet.
  useEffect(() => {
    async function loadBanners() {
      const { data } = await supabase
        .from('hero_banners')
        .select('*')
        .eq('active', true)
        .order('position')
      setBanners(data || [])
    }
    loadBanners()
  }, [])

  // Countdown target for the Limited Drop banner: the soonest-ending active
  // auto-apply promotion, if one exists. The public RLS policy on `coupons`
  // only ever exposes requires_code=false + active=true + discount_type=
  // 'buy_x_get_y' rows (see supabase/migrations/20260704009001_public_bxgy_promo_read.sql)
  // -- .eq('discount_type', ...) here just matches that boundary explicitly
  // rather than relying on RLS to silently drop every other row.
  useEffect(() => {
    const mode = content.limited_drop?.countdown_mode ?? 'auto'
    if (mode !== 'auto') return
    supabase
      .from('coupons')
      .select('ends_at')
      .eq('requires_code', false)
      .eq('active', true)
      .eq('discount_type', 'buy_x_get_y')
      .not('ends_at', 'is', null)
      .order('ends_at', { ascending: true })
      .limit(1)
      .then(({ data }) => setDropEndsAt(data?.[0]?.ends_at ? new Date(data[0].ends_at) : null))
  }, [content.limited_drop])

  // IntersectionObserver for reveal animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
          }
        })
      },
      { threshold: 0.15 }
    )
    revealRefs.current.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [featured, recent])

  const addRevealRef = (el: HTMLElement | null) => {
    if (el && !revealRefs.current.includes(el)) {
      revealRefs.current.push(el)
    }
  }

  // Same quick-add flow as Shop.tsx: grab any in-stock variant and add one.
  async function quickAdd(p: ProductCatalogEntry, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setQuickAddingId(p.id)
    const { data: variants } = await supabase.from('product_variants').select('*').eq('product_id', p.id)
    const variant = variants?.find(v => v.stock > 0)
    setQuickAddingId(null)
    if (!variant) {
      toast.error(t.productOutOfStock)
      return
    }
    addItem(p, variant.size, variant.color, 1)
    toast.success(t.productAdded, { description: `${p.name}, ${variant.size}` })
  }

  // Hero and the curated grid share one pool: featured products first,
  // falling back to the most recently added products if nothing is
  // featured yet -- the homepage is never empty on a fresh catalog.
  const pool = featured.length > 0 ? featured : recent
  const heroProduct = pool[0]
  const curatedLimit = content.curated?.limit ?? 5
  const curated = pool.filter(p => p.id !== heroProduct?.id).slice(0, curatedLimit)
  const lookThumbs = curated.length > 0 ? curated.slice(0, 2) : (heroProduct ? [heroProduct] : [])
  const dropTarget = content.limited_drop?.countdown_mode === 'manual' && content.limited_drop?.manual_target
    ? new Date(content.limited_drop.manual_target)
    : (dropEndsAt || placeholderDrop)
  const heroC = content.hero
  const curatedC = content.curated
  const dropC = content.limited_drop
  const trustC = content.trust_badges
  const atelierC = content.atelier
  const trustItems = trustC?.items?.length ? trustC.items : [
    { icon: 'Truck', title_en: t.homeTrust1Title, title_ar: t.homeTrust1Title, desc_en: t.homeTrust1Desc, desc_ar: t.homeTrust1Desc },
    { icon: 'ShieldCheck', title_en: t.homeTrust2Title, title_ar: t.homeTrust2Title, desc_en: t.homeTrust2Desc, desc_ar: t.homeTrust2Desc },
    { icon: 'RotateCcw', title_en: t.homeTrust3Title, title_ar: t.homeTrust3Title, desc_en: t.homeTrust3Desc, desc_ar: t.homeTrust3Desc },
    { icon: 'Lock', title_en: t.homeTrust4Title, title_ar: t.homeTrust4Title, desc_en: t.homeTrust4Desc, desc_ar: t.homeTrust4Desc },
  ]

  return (
    <div className="bg-cream">
      {/* ===== HERO ===== */}
      {banners.length > 0 ? (
        <HeroBanners banners={banners} />
      ) : (
      <section className="relative min-h-[95vh] flex items-center overflow-hidden bg-cream">
        {/* Background texture photo -- kept very subtle so text/product stay legible over it */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.07]"
          style={{ backgroundImage: "url('/stock/hero-background-leather.jpg')" }}
        />
        <div className="absolute inset-0 bg-cream/60" />
        {/* Soft moving gradient orbs */}
        <div className="absolute top-1/4 -end-32 w-[40vw] h-[40vw] bg-muted/40 rounded-full blur-3xl float-anim" />
        <div className="absolute bottom-1/4 -start-32 w-[35vw] h-[35vw] bg-muted/30 rounded-full blur-3xl float-anim" style={{ animationDelay: '2s' }} />

        <div className="relative max-w-[1400px] mx-auto px-6 lg:px-10 w-full grid lg:grid-cols-12 gap-8 items-center pt-10 pb-20">
          <div className="lg:col-span-7 z-10">
            <p className="text-[11px] tracking-[0.3em] uppercase font-medium text-gold-on-light mb-8 fade-up">
              {(lang === 'ar' ? heroC?.eyebrow_ar : heroC?.eyebrow_en) ?? t.homeEyebrow}
            </p>
            <h1 className="font-display text-6xl md:text-7xl lg:text-[7.5rem] leading-[0.95] tracking-[-0.03em] fade-up fade-up-2">
              {(lang === 'ar' ? heroC?.title1_ar : heroC?.title1_en) ?? t.homeHeroTitle1}<br />
              {(lang === 'ar' ? heroC?.title2_ar : heroC?.title2_en) ?? t.homeHeroTitle2}
            </h1>
            <p className="mt-8 text-base md:text-lg text-muted-foreground max-w-md font-light leading-relaxed fade-up fade-up-3">
              {(lang === 'ar' ? heroC?.subtitle_ar : heroC?.subtitle_en) ?? t.homeHeroSubtitle}
            </p>
            <div className="mt-12 flex flex-wrap items-center gap-6 fade-up fade-up-4">
              <Link
                to={heroC?.cta1_link ?? '/shop'}
                className="group inline-flex items-center gap-3 bg-foreground text-background px-8 py-4 text-[13px] tracking-[0.2em] uppercase font-medium hover:bg-foreground/85 transition-all duration-300 cursor-pointer hover:shadow-2xl hover:-translate-y-0.5"
              >
                {(lang === 'ar' ? heroC?.cta1_text_ar : heroC?.cta1_text_en) ?? t.homeHeroCta1}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform flip-rtl" />
              </Link>
              <Link
                to={heroC?.cta2_link ?? '/shop?category=Boots'}
                className="group inline-flex items-center gap-2 text-[13px] tracking-[0.18em] uppercase font-medium border-b border-foreground/30 pb-1 hover:border-foreground transition-colors"
              >
                {(lang === 'ar' ? heroC?.cta2_text_ar : heroC?.cta2_text_en) ?? t.homeHeroCta2}
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
            </div>

            {/* Vertical "scroll" hint */}
            <div className="mt-20 hidden lg:flex flex-col items-center gap-3 w-fit fade-up fade-up-5">
              <span className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">{(lang === 'ar' ? heroC?.scroll_text_ar : heroC?.scroll_text_en) ?? t.homeHeroScroll}</span>
              <span className="w-px h-12 bg-foreground/25" />
            </div>
          </div>

          {/* Hero product image with float + Shop the Look card */}
          <div className="lg:col-span-5 relative h-[500px] lg:h-[680px] hidden lg:block">
            {productsLoading && (
              <div className="absolute inset-0 bg-muted/60 animate-pulse" />
            )}
            {!productsLoading && heroProduct && (
              <div className="absolute inset-0 reveal-3d" ref={addRevealRef}>
                <div className="relative w-full h-full float-anim">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <img
                      src={heroProduct.image_url || ''}
                      alt={heroProduct.name}
                      className="w-[120%] max-w-none h-auto object-contain drop-shadow-2xl"
                      style={{ filter: 'drop-shadow(0 50px 80px rgba(0,0,0,0.18))' }}
                    />
                  </div>
                </div>
              </div>
            )}
            {!productsLoading && heroProduct && (
              <Link
                to={`/product/${heroProduct.slug}`}
                className="group absolute bottom-10 start-0 bg-background/95 backdrop-blur-sm border border-border px-5 py-4 shadow-xl scale-in flex items-center gap-4 hover:shadow-2xl transition-shadow"
                style={{ animationDelay: '600ms' }}
              >
                <div className="flex -space-x-3 rtl:space-x-reverse shrink-0">
                  {lookThumbs.slice(0, 2).map((p, i) => (
                    <img
                      key={`${p.id}-${i}`}
                      src={p.image_url || ''}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover border-2 border-background bg-muted"
                    />
                  ))}
                </div>
                <div>
                  <p className="font-display text-lg leading-tight">{heroProduct.name}</p>
                  <p className="text-[11px] tracking-[0.2em] uppercase text-gold-on-light mt-1 inline-flex items-center gap-1.5">
                    {t.homeShopTheLook}
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform flip-rtl" />
                  </p>
                </div>
              </Link>
            )}
          </div>
        </div>
      </section>
      )}

      {/* ===== CATEGORIES STRIP (replaces the reference's brand-logo strip) ===== */}
      <section className="py-8 px-6 lg:px-10 border-y border-border/60 bg-cream">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center gap-3">
          <span className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground me-2">
            {t.homeCategoriesEyebrow}
          </span>
          {categories === null
            ? [1, 2, 3, 4].map(i => (
                <span key={i} className="h-9 w-24 bg-muted/60 animate-pulse" />
              ))
            : categories.map(cat => (
                <Link
                  key={cat}
                  to={`/shop?category=${cat}`}
                  className="px-4 py-2 text-[12px] tracking-[0.1em] uppercase border border-border hover:border-foreground hover:bg-foreground hover:text-background transition-colors"
                >
                  {categoryLabel(cat)}
                </Link>
              ))}
          <Link
            to="/shop"
            className="ms-auto inline-flex items-center gap-2 bg-foreground text-background px-5 py-2 text-[11px] tracking-[0.2em] uppercase font-medium hover:bg-foreground/85 transition-colors"
          >
            {t.shopViewAll}
            <ArrowRight className="w-3.5 h-3.5 flip-rtl" />
          </Link>
        </div>
      </section>

      {/* ===== 3D SCROLL SHOE SHOWCASE -- untouched, signature feature ===== */}
      <ShoeShowcase3D />

      {/* ===== CURATED FOR YOU ===== */}
      <section className="px-6 lg:px-10 py-24 md:py-32 bg-cream">
        <div className="max-w-[1400px] mx-auto">
          <SectionHeading
            align="between"
            eyebrow={(lang === 'ar' ? curatedC?.eyebrow_ar : curatedC?.eyebrow_en) ?? t.homeFeaturedEyebrow}
            title={(lang === 'ar' ? curatedC?.heading_ar : curatedC?.heading_en) ?? t.homeFeaturedTitle}
            viewAllHref="/shop"
            viewAllLabel={(lang === 'ar' ? curatedC?.view_all_ar : curatedC?.view_all_en) ?? t.homeFeaturedViewAll}
            className="mb-12 reveal"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-14">
            {productsLoading
              ? [1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="animate-pulse">
                    <div className="aspect-[4/5] bg-muted/60 mb-4" />
                    <div className="h-3 w-2/3 bg-muted/60 mb-2" />
                    <div className="h-3 w-1/3 bg-muted/40" />
                  </div>
                ))
              : curated.map((p, i) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    categoryLabel={categoryLabel(p.category)}
                    onQuickView={setQuickViewId}
                    onQuickAdd={quickAdd}
                    quickAdding={quickAddingId === p.id}
                    animationDelay={`${(i % 8) * 60}ms`}
                  />
                ))}
          </div>
        </div>
      </section>

      {/* ===== LIMITED DROP ===== */}
      <section className="relative bg-[#0A0907] text-background overflow-hidden">
        <div className="max-w-[1400px] mx-auto grid lg:grid-cols-2">
          <div className="relative aspect-[4/5] lg:aspect-auto lg:min-h-[640px] reveal" ref={addRevealRef}>
            <img
              src={dropC?.image_url ?? '/stock/hero-banner-moody-sneakers-legs.jpg'}
              alt=""
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/10" />
          </div>
          <div className="relative flex items-center px-6 lg:px-16 py-20 overflow-hidden">
            {/* Oversized faint brand-initial watermark */}
            <span className="pointer-events-none select-none absolute -top-16 -end-10 font-display text-[22rem] md:text-[28rem] leading-none text-background/[0.04]">
              B
            </span>
            <div className="relative reveal" ref={addRevealRef}>
              <p className="text-[11px] tracking-[0.3em] uppercase text-gold mb-6">{(lang === 'ar' ? dropC?.eyebrow_ar : dropC?.eyebrow_en) ?? t.homeDropEyebrow}</p>
              <h2 className="font-display text-5xl md:text-6xl leading-[0.95] mb-6">
                {(lang === 'ar' ? dropC?.title1_ar : dropC?.title1_en) ?? t.homeDropTitle1}<br />{(lang === 'ar' ? dropC?.title2_ar : dropC?.title2_en) ?? t.homeDropTitle2}
              </h2>
              <p className="text-background/70 font-light leading-relaxed max-w-sm mb-10">
                {(lang === 'ar' ? dropC?.subtitle_ar : dropC?.subtitle_en) ?? t.homeDropSubtitle}
              </p>
              {dropC?.countdown_mode !== 'off' && (
                <CountdownTimer
                  target={dropTarget}
                  labels={{ days: t.homeDropDays, hours: t.homeDropHrs, minutes: t.homeDropMins, seconds: t.homeDropSecs }}
                  className="mb-10"
                />
              )}
              <Link
                to={dropC?.cta_link ?? '/shop'}
                className="group inline-flex items-center gap-3 bg-background text-foreground px-8 py-4 text-[13px] tracking-[0.2em] uppercase font-medium hover:bg-background/90 transition-all duration-300"
              >
                {(lang === 'ar' ? dropC?.cta_text_ar : dropC?.cta_text_en) ?? t.homeDropCta}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform flip-rtl" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TRUST BADGES ===== */}
      <section className="px-6 lg:px-10 py-20 bg-cream">
        <div className="max-w-[1400px] mx-auto">
          <p className="text-center text-[11px] tracking-[0.3em] uppercase text-gold-on-light mb-12 reveal" ref={addRevealRef}>
            {(lang === 'ar' ? trustC?.eyebrow_ar : trustC?.eyebrow_en) ?? t.homePromiseEyebrow}
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-10">
            {trustItems.map((item: any, i: number) => {
              const Icon = TRUST_ICONS[item.icon] ?? Truck
              return (
                <div key={i} className="text-center reveal" ref={addRevealRef} style={{ transitionDelay: `${i * 80}ms` }}>
                  <Icon className="w-6 h-6 mx-auto mb-4 text-foreground/70" strokeWidth={1.5} />
                  <p className="text-sm font-medium tracking-wide mb-1.5">{lang === 'ar' ? item.title_ar : item.title_en}</p>
                  <p className="text-xs text-muted-foreground font-light leading-relaxed max-w-[16rem] mx-auto">{lang === 'ar' ? item.desc_ar : item.desc_en}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ===== ATELIER EDITORIAL (kept -- distinct brand story, not covered
          by any of the new sections above) ===== */}
      <section className="py-24 md:py-32 px-6 lg:px-10 bg-foreground text-background overflow-hidden">
        <div className="max-w-[1400px] mx-auto grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div className="relative aspect-[4/5] overflow-hidden reveal" ref={addRevealRef}>
            {(atelierC?.image_url || recent[5]?.image_url) && (
              <img
                src={atelierC?.image_url || recent[5]?.image_url || ''}
                alt={recent[5]?.name ?? ''}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            {/* Floating tag */}
            <div className="absolute top-6 start-6 bg-background text-foreground px-4 py-2 text-[10px] tracking-[0.3em] uppercase font-medium">
              {(lang === 'ar' ? atelierC?.tag_ar : atelierC?.tag_en) ?? 'The Workshop · 1986'}
            </div>
          </div>
          <div className="reveal" ref={addRevealRef}>
            <p className="text-[11px] tracking-[0.3em] uppercase text-background/60 mb-6">{(lang === 'ar' ? atelierC?.eyebrow_ar : atelierC?.eyebrow_en) ?? t.homeAtelierEyebrowNew}</p>
            <h2 className="font-display text-5xl md:text-6xl lg:text-7xl leading-[0.95] mb-8 text-balance">
              {(lang === 'ar' ? atelierC?.title_ar : atelierC?.title_en) ?? t.homeAtelierTitleNew}
            </h2>
            <p className="text-background/70 font-light leading-relaxed max-w-lg mb-10 text-lg">
              {(lang === 'ar' ? atelierC?.subtitle_ar : atelierC?.subtitle_en) ?? t.homeAtelierSubtitle}
            </p>
            <div className="grid grid-cols-3 gap-3 sm:gap-6 mb-10">
              {(atelierC?.stats?.length ? atelierC.stats : [
                { value: 40, label_en: 'years of craft', label_ar: 'years of craft' },
                { value: 16, label_en: 'pairs of hands', label_ar: 'pairs of hands' },
                { value: 3, label_en: 'days per pair', label_ar: 'days per pair' },
              ]).map((stat: any, i: number) => (
                <div key={i}>
                  <p className="font-display text-4xl md:text-5xl">{stat.value}</p>
                  <p className="text-[10px] tracking-[0.3em] uppercase text-background/60 mt-1">{lang === 'ar' ? stat.label_ar : stat.label_en}</p>
                </div>
              ))}
            </div>
            <Link
              to={atelierC?.cta_link ?? '/shop'}
              className="group inline-flex items-center gap-3 bg-background text-foreground px-8 py-4 text-[13px] tracking-[0.2em] uppercase font-medium hover:bg-background/90 transition-all duration-300 cursor-pointer hover:shadow-2xl"
            >
              {(lang === 'ar' ? atelierC?.cta_text_ar : atelierC?.cta_text_en) ?? t.homeAtelierCta}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform flip-rtl" />
            </Link>
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS (kept -- social proof, restyled to cream) ===== */}
      {testimonials === null && (
      <section className="py-24 md:py-32 px-6 lg:px-10 bg-cream">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-center mb-16">
            <div className="h-3 w-40 bg-muted/60 animate-pulse mx-auto mb-3" />
            <div className="h-10 w-72 bg-muted/60 animate-pulse mx-auto" />
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-background p-8 md:p-10 animate-pulse">
                <div className="h-4 w-full bg-muted/60 mb-3" />
                <div className="h-4 w-5/6 bg-muted/60 mb-8" />
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-muted/60 shrink-0" />
                  <div className="h-3 w-24 bg-muted/60" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}
      {testimonials !== null && testimonials.length > 0 && (
      <section className="py-24 md:py-32 px-6 lg:px-10 bg-cream">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-center mb-16 reveal" ref={addRevealRef}>
            <p className="text-[11px] tracking-[0.3em] uppercase text-gold-on-light mb-3">{t.homeTestimonialsEyebrow}</p>
            <h2 className="font-display text-5xl md:text-6xl">{t.homeTestimonialsTitle}</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((item, i) => (
              <div
                key={item.id ?? i}
                className="group relative bg-background p-8 md:p-10 reveal hover-3d"
                ref={addRevealRef}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className="absolute top-6 end-6 text-6xl font-display text-foreground/10 leading-none">"</div>
                <p className="text-base md:text-lg font-light leading-relaxed mb-8 relative z-10 font-display italic">
                  {(lang === 'ar' ? item.quote_ar : item.quote_en) ?? ''}
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-muted flex-shrink-0 ring-2 ring-foreground/10">
                    <img src={item.avatar_url || '/shoes/cloudwalker.webp'} alt="" loading="lazy" decoding="async" width="56" height="56" className="w-full h-full object-cover" />
                  </div>
                  <p className="text-[11px] tracking-[0.25em] uppercase font-medium">{item.author_name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      <QuickViewModal productId={quickViewId} onClose={() => setQuickViewId(null)} />
    </div>
  )
}
