import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase, ProductCatalogEntry, HeroBanner } from '@/lib/supabase'
import { useT, useLanguage } from '@/contexts/LanguageContext'
import { useCart } from '@/contexts/CartContext'
import { ArrowRight, ArrowUpRight, Truck, ShieldCheck, RotateCcw, Lock } from 'lucide-react'
import { toast } from 'sonner'
import ShoeShowcase3D from '@/components/ShoeShowcase3D'
import ProductCard from '@/components/ProductCard'
import SectionHeading from '@/components/SectionHeading'
import CountdownTimer from '@/components/CountdownTimer'
import QuickViewModal from '@/components/QuickViewModal'
import { useSeo } from '@/hooks/useSeo'

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

const CATEGORIES = [
  { key: 'Sneakers', en: 'Sneakers', ar: 'أحذية رياضية' },
  { key: 'Boots', en: 'Boots', ar: 'بوط' },
  { key: 'Loafers', en: 'Loafers', ar: 'لوفرز' },
  { key: 'Derbies', en: 'Derbies', ar: 'دربي' },
  { key: 'Slippers', en: 'Slippers', ar: 'نعال' },
  { key: 'Sandals', en: 'Sandals', ar: 'صنادل' },
]

export default function Home() {
  const [featured, setFeatured] = useState<ProductCatalogEntry[]>([])
  const [recent, setRecent] = useState<ProductCatalogEntry[]>([])
  const [banners, setBanners] = useState<HeroBanner[]>([])
  const [dropEndsAt, setDropEndsAt] = useState<Date | null>(null)
  // ponytail: no admin-configured auto-apply promo has an end date yet --
  // static 7-day-out placeholder so the countdown never looks broken. Swap
  // for real campaigns via the Coupons admin dashboard.
  const [placeholderDrop] = useState(() => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
  const [quickViewId, setQuickViewId] = useState<string | null>(null)
  const [quickAddingId, setQuickAddingId] = useState<string | null>(null)
  const t = useT()
  const { lang } = useLanguage()
  const { addItem } = useCart()
  const revealRefs = useRef<HTMLElement[]>([])

  useSeo({ title: `${t.brandName} — ${t.brandTagline}`, description: t.homeHeroSubtitle })

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
    }
    load()
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
  }, [])

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

  function categoryLabel(c: string): string {
    switch (c) {
      case 'Sneakers': return t.navSneakers
      case 'Boots': return t.navBoots
      case 'Loafers': return t.navLoafers
      case 'Derbies': return t.navDerbies
      case 'Slippers': return t.navSlippers
      case 'Sandals': return t.navSandals
      default: return c
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
  const curated = pool.filter(p => p.id !== heroProduct?.id).slice(0, 5)
  const lookThumbs = curated.length > 0 ? curated.slice(0, 2) : (heroProduct ? [heroProduct] : [])
  const dropTarget = dropEndsAt || placeholderDrop

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
              {t.homeEyebrow}
            </p>
            <h1 className="font-display text-6xl md:text-7xl lg:text-[7.5rem] leading-[0.95] tracking-[-0.03em] fade-up fade-up-2">
              {t.homeHeroTitle1}<br />
              {t.homeHeroTitle2}
            </h1>
            <p className="mt-8 text-base md:text-lg text-muted-foreground max-w-md font-light leading-relaxed fade-up fade-up-3">
              {t.homeHeroSubtitle}
            </p>
            <div className="mt-12 flex flex-wrap items-center gap-6 fade-up fade-up-4">
              <Link
                to="/shop"
                className="group inline-flex items-center gap-3 bg-foreground text-background px-8 py-4 text-[13px] tracking-[0.2em] uppercase font-medium hover:bg-foreground/85 transition-all duration-300 cursor-pointer hover:shadow-2xl hover:-translate-y-0.5"
              >
                {t.homeHeroCta1}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform flip-rtl" />
              </Link>
              <Link
                to="/shop?category=Boots"
                className="group inline-flex items-center gap-2 text-[13px] tracking-[0.18em] uppercase font-medium border-b border-foreground/30 pb-1 hover:border-foreground transition-colors"
              >
                {t.homeHeroCta2}
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
            </div>

            {/* Vertical "scroll" hint */}
            <div className="mt-20 hidden lg:flex flex-col items-center gap-3 w-fit fade-up fade-up-5">
              <span className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">{t.homeHeroScroll}</span>
              <span className="w-px h-12 bg-foreground/25" />
            </div>
          </div>

          {/* Hero product image with float + Shop the Look card */}
          <div className="lg:col-span-5 relative h-[500px] lg:h-[680px] hidden lg:block">
            {heroProduct && (
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
            {heroProduct && (
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
          {CATEGORIES.map(cat => (
            <Link
              key={cat.key}
              to={`/shop?category=${cat.key}`}
              className="px-4 py-2 text-[12px] tracking-[0.1em] uppercase border border-border hover:border-foreground hover:bg-foreground hover:text-background transition-colors"
            >
              {lang === 'ar' ? cat.ar : cat.en}
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
            eyebrow={t.homeFeaturedEyebrow}
            title={t.homeFeaturedTitle}
            viewAllHref="/shop"
            viewAllLabel={t.homeFeaturedViewAll}
            className="mb-12 reveal"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-14">
            {curated.map((p, i) => (
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
              src="/stock/hero-banner-moody-sneakers-legs.jpg"
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
              <p className="text-[11px] tracking-[0.3em] uppercase text-gold mb-6">{t.homeDropEyebrow}</p>
              <h2 className="font-display text-5xl md:text-6xl leading-[0.95] mb-6">
                {t.homeDropTitle1}<br />{t.homeDropTitle2}
              </h2>
              <p className="text-background/70 font-light leading-relaxed max-w-sm mb-10">
                {t.homeDropSubtitle}
              </p>
              <CountdownTimer
                target={dropTarget}
                labels={{ days: t.homeDropDays, hours: t.homeDropHrs, minutes: t.homeDropMins, seconds: t.homeDropSecs }}
                className="mb-10"
              />
              <Link
                to="/shop"
                className="group inline-flex items-center gap-3 bg-background text-foreground px-8 py-4 text-[13px] tracking-[0.2em] uppercase font-medium hover:bg-background/90 transition-all duration-300"
              >
                {t.homeDropCta}
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
            {t.homePromiseEyebrow}
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-10">
            {[
              { icon: Truck, title: t.homeTrust1Title, desc: t.homeTrust1Desc },
              { icon: ShieldCheck, title: t.homeTrust2Title, desc: t.homeTrust2Desc },
              { icon: RotateCcw, title: t.homeTrust3Title, desc: t.homeTrust3Desc },
              { icon: Lock, title: t.homeTrust4Title, desc: t.homeTrust4Desc },
            ].map((item, i) => (
              <div key={i} className="text-center reveal" ref={addRevealRef} style={{ transitionDelay: `${i * 80}ms` }}>
                <item.icon className="w-6 h-6 mx-auto mb-4 text-foreground/70" strokeWidth={1.5} />
                <p className="text-sm font-medium tracking-wide mb-1.5">{item.title}</p>
                <p className="text-xs text-muted-foreground font-light leading-relaxed max-w-[16rem] mx-auto">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== ATELIER EDITORIAL (kept -- distinct brand story, not covered
          by any of the new sections above) ===== */}
      <section className="py-24 md:py-32 px-6 lg:px-10 bg-foreground text-background overflow-hidden">
        <div className="max-w-[1400px] mx-auto grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div className="relative aspect-[4/5] overflow-hidden reveal" ref={addRevealRef}>
            {recent[5] && (
              <img
                src={recent[5].image_url || ''}
                alt={recent[5].name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            {/* Floating tag */}
            <div className="absolute top-6 start-6 bg-background text-foreground px-4 py-2 text-[10px] tracking-[0.3em] uppercase font-medium">
              The Workshop · 1986
            </div>
          </div>
          <div className="reveal" ref={addRevealRef}>
            <p className="text-[11px] tracking-[0.3em] uppercase text-background/60 mb-6">{t.homeAtelierEyebrowNew}</p>
            <h2 className="font-display text-5xl md:text-6xl lg:text-7xl leading-[0.95] mb-8 text-balance">
              {t.homeAtelierTitleNew}
            </h2>
            <p className="text-background/70 font-light leading-relaxed max-w-lg mb-10 text-lg">
              {t.homeAtelierSubtitle}
            </p>
            <div className="grid grid-cols-3 gap-6 mb-10">
              <div>
                <p className="font-display text-4xl md:text-5xl">40</p>
                <p className="text-[10px] tracking-[0.3em] uppercase text-background/60 mt-1">years of craft</p>
              </div>
              <div>
                <p className="font-display text-4xl md:text-5xl">16</p>
                <p className="text-[10px] tracking-[0.3em] uppercase text-background/60 mt-1">pairs of hands</p>
              </div>
              <div>
                <p className="font-display text-4xl md:text-5xl">3</p>
                <p className="text-[10px] tracking-[0.3em] uppercase text-background/60 mt-1">days per pair</p>
              </div>
            </div>
            <Link
              to="/shop"
              className="group inline-flex items-center gap-3 bg-background text-foreground px-8 py-4 text-[13px] tracking-[0.2em] uppercase font-medium hover:bg-background/90 transition-all duration-300 cursor-pointer hover:shadow-2xl"
            >
              {t.homeAtelierCta}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform flip-rtl" />
            </Link>
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS (kept -- social proof, restyled to cream) ===== */}
      <section className="py-24 md:py-32 px-6 lg:px-10 bg-cream">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-center mb-16 reveal" ref={addRevealRef}>
            <p className="text-[11px] tracking-[0.3em] uppercase text-gold-on-light mb-3">{t.homeTestimonialsEyebrow}</p>
            <h2 className="font-display text-5xl md:text-6xl">{t.homeTestimonialsTitle}</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { quote: t.homeTestimonial1, author: t.homeTestimonial1Author, img: '/shoes/cloudwalker.webp' },
              { quote: t.homeTestimonial2, author: t.homeTestimonial2Author, img: '/shoes/atlas-boot.webp' },
              { quote: t.homeTestimonial3, author: t.homeTestimonial3Author, img: '/shoes/drift-runner.webp' },
            ].map((item, i) => (
              <div
                key={i}
                className="group relative bg-background p-8 md:p-10 reveal hover-3d"
                ref={addRevealRef}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className="absolute top-6 end-6 text-6xl font-display text-foreground/10 leading-none">"</div>
                <p className="text-base md:text-lg font-light leading-relaxed mb-8 relative z-10 font-display italic">
                  {item.quote}
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-muted flex-shrink-0 ring-2 ring-foreground/10">
                    <img src={item.img} alt="" loading="lazy" decoding="async" width="56" height="56" className="w-full h-full object-cover" />
                  </div>
                  <p className="text-[11px] tracking-[0.25em] uppercase font-medium">{item.author}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <QuickViewModal productId={quickViewId} onClose={() => setQuickViewId(null)} />
    </div>
  )
}
