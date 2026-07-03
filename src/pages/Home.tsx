import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase, Product } from '@/lib/supabase'
import { useT, useLanguage } from '@/contexts/LanguageContext'
import { ArrowRight, ArrowUpRight, Plus, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import ShoeShowcase3D from '@/components/ShoeShowcase3D'

const CATEGORIES = [
  { key: 'Sneakers', en: 'Sneakers', ar: 'أحذية رياضية', img: '/shoes/cloudwalker.webp' },
  { key: 'Boots', en: 'Boots', ar: 'بُوط', img: '/shoes/atlas-boot.webp' },
  { key: 'Loafers', en: 'Loafers', ar: 'لُوفرز', img: '/shoes/atlas-loafer.webp' },
  { key: 'Derbies', en: 'Derbies', ar: 'دَربي', img: '/shoes/marina-derby.webp' },
  { key: 'Slippers', en: 'Slippers', ar: 'نَعال', img: '/shoes/drift-runner.webp' },
  { key: 'Sandals', en: 'Sandals', ar: 'صَنادل', img: '/shoes/dune-boot.webp' },
]

export default function Home() {
  const [featured, setFeatured] = useState<Product[]>([])
  const [all, setAll] = useState<Product[]>([])
  const t = useT()
  const { lang } = useLanguage()
  const revealRefs = useRef<HTMLElement[]>([])

  useEffect(() => {
    async function load() {
      const { data: f } = await supabase
        .from('products')
        .select('*')
        .eq('featured', true)
        .limit(4)
      const { data: a } = await supabase
        .from('products')
        .select('*')
        .limit(6)
      if (f) setFeatured(f)
      if (a) setAll(a)
    }
    load()
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
  }, [featured, all])

  const addRevealRef = (el: HTMLElement | null) => {
    if (el && !revealRefs.current.includes(el)) {
      revealRefs.current.push(el)
    }
  }

  return (
    <div>
      {/* ===== HERO ===== */}
      <section className="relative min-h-[95vh] flex items-center overflow-hidden bg-background">
        {/* Soft moving gradient orbs */}
        <div className="absolute top-1/4 -end-32 w-[40vw] h-[40vw] bg-muted/40 rounded-full blur-3xl float-anim" />
        <div className="absolute bottom-1/4 -start-32 w-[35vw] h-[35vw] bg-muted/30 rounded-full blur-3xl float-anim" style={{ animationDelay: '2s' }} />

        <div className="relative max-w-[1400px] mx-auto px-6 lg:px-10 w-full grid lg:grid-cols-12 gap-8 items-center pt-10 pb-20">
          <div className="lg:col-span-7 z-10">
            <p className="text-[11px] tracking-[0.3em] uppercase font-medium text-muted-foreground mb-8 fade-up">
              <Sparkles className="w-3 h-3 inline-block me-2 -mt-0.5" />
              {t.brandName} · {t.homeEyebrow}
            </p>
            <h1 className="font-display text-6xl md:text-7xl lg:text-[7.5rem] leading-[0.95] tracking-[-0.03em] fade-up fade-up-2">
              {t.homeHeroTitle1}<br />
              <span className="italic text-muted-foreground font-light">{t.homeHeroTitle2}</span>
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

            <div className="mt-20 flex items-center gap-10 fade-up fade-up-5">
              <div>
                <p className="font-display text-4xl">1986</p>
                <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mt-1">{t.homeStat1}</p>
              </div>
              <div className="w-px h-12 bg-border" />
              <div>
                <p className="font-display text-4xl">12</p>
                <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mt-1">{t.homeStat2}</p>
              </div>
              <div className="w-px h-12 bg-border hidden md:block" />
              <div className="hidden md:block">
                <p className="font-display text-4xl">∞</p>
                <p className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mt-1">{t.homeStat3}</p>
              </div>
            </div>
          </div>

          {/* Hero 3D shoe image with float + rotate */}
          <div className="lg:col-span-5 relative h-[500px] lg:h-[680px] hidden lg:block">
            {all[0] && (
              <div className="absolute inset-0 reveal-3d" ref={addRevealRef}>
                <div className="relative w-full h-full float-anim">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <img
                      src={all[0].image_url || ''}
                      alt={all[0].name}
                      className="w-[120%] max-w-none h-auto object-contain drop-shadow-2xl"
                      style={{ filter: 'drop-shadow(0 50px 80px rgba(0,0,0,0.18))' }}
                    />
                  </div>
                </div>
              </div>
            )}
            {/* Floating price card */}
            <div
              className="absolute top-12 end-0 bg-background/95 backdrop-blur-sm border border-border px-5 py-4 shadow-xl scale-in"
              style={{ animationDelay: '600ms' }}
            >
              <p className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-1">{all[0]?.category}</p>
              <p className="font-display text-xl">{all[0]?.name}</p>
              <p className="text-sm font-medium mt-1">${Number(all[0]?.price || 0).toFixed(0)}</p>
            </div>
            {/* Small 3D rotating circle */}
            <div
              className="absolute bottom-16 start-0 w-32 h-32 border border-border flex items-center justify-center spin-slow"
              style={{ animationDuration: '40s' }}
            >
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <defs>
                  <path id="circ" d="M 50,50 m -38,0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0" />
                </defs>
                <text fontSize="9" letterSpacing="3" fill="currentColor" className="text-foreground/60">
                  <textPath href="#circ">BOM STORE · CAIRO · SINCE 1986 · BOM STORE · CAIRO · SINCE 1986 · </textPath>
                </text>
              </svg>
              <span className="absolute font-display text-2xl italic">B</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 3D SCROLL SHOE SHOWCASE ===== */}
      <ShoeShowcase3D />

      {/* ===== SHOP BY CATEGORY ===== */}
      <section className="py-24 md:py-32 px-6 lg:px-10 bg-background">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-center mb-16 reveal" ref={addRevealRef}>
            <p className="text-[11px] tracking-[0.3em] uppercase text-muted-foreground mb-3">{t.homeCategoriesEyebrow}</p>
            <h2 className="font-display text-5xl md:text-6xl lg:text-7xl leading-[0.95]">
              {t.homeCategoriesTitle}
            </h2>
            <p className="text-muted-foreground font-light text-base mt-4 max-w-md mx-auto">
              {t.homeCategoriesSubtitle}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {CATEGORIES.map((cat, i) => (
              <Link
                key={cat.key}
                to={`/shop?category=${cat.key}`}
                className="group relative aspect-[4/5] overflow-hidden bg-muted reveal"
                ref={addRevealRef}
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                <img
                  src={cat.img}
                  alt={cat.en}
                  loading={i < 2 ? 'eager' : 'lazy'}
                  decoding="async"
                  width={1024}
                  height={1024}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                  style={{ filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.15))' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 group-hover:from-black/70 transition-colors duration-500" />
                <div className="absolute inset-0 flex flex-col items-center justify-end p-6 md:p-8 text-background">
                  <p className="text-[10px] tracking-[0.3em] uppercase font-medium opacity-90 mb-2 text-shadow-sm">0{i + 1}</p>
                  <h3 className="font-display text-3xl md:text-4xl text-shadow">
                    {lang === 'ar' ? cat.ar : cat.en}
                  </h3>
                  <div className="mt-4 w-10 h-10 rounded-full bg-background/15 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500">
                    <ArrowUpRight className="w-4 h-4 text-background" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURED / NEW ARRIVALS ===== */}
      <section className="px-6 lg:px-10 py-20 bg-muted/30">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-end justify-between mb-12 reveal" ref={addRevealRef}>
            <div>
              <p className="text-[11px] tracking-[0.3em] uppercase text-muted-foreground mb-3">{t.homeFeaturedEyebrow}</p>
              <h2 className="font-display text-5xl md:text-6xl">{t.homeFeaturedTitle}</h2>
            </div>
            <Link
              to="/shop"
              className="hidden md:inline-flex items-center gap-2 text-[12px] tracking-[0.2em] uppercase font-medium border-b border-foreground/30 pb-1 hover:border-foreground transition-colors"
            >
              {t.homeFeaturedViewAll}
              <ArrowRight className="w-4 h-4 flip-rtl" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featured.map((p, i) => (
              <Link
                key={p.id}
                to={`/product/${p.slug}`}
                className="group block reveal hover-3d"
                ref={addRevealRef}
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-background">
                  <img
                    src={p.image_url || ''}
                    alt={p.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                  />
                  <div className="absolute top-3 start-3 bg-background/90 backdrop-blur-sm px-3 py-1.5 text-[10px] tracking-[0.25em] uppercase">
                    {t.shopFeatured}
                  </div>
                  <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors duration-500" />
                  <div className="absolute bottom-3 end-3 w-9 h-9 rounded-full bg-foreground text-background flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500">
                    <Plus className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-5">
                  <p className="text-[10px] tracking-[0.3em] text-muted-foreground uppercase mb-2">
                    {p.category}
                  </p>
                  <h3 className="font-display text-2xl group-hover:text-muted-foreground transition-colors">
                    {p.name}
                  </h3>
                  <p className="mt-2 text-sm font-medium">
                    ${Number(p.price).toFixed(0)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== ATELIER EDITORIAL ===== */}
      <section className="py-24 md:py-32 px-6 lg:px-10 bg-foreground text-background overflow-hidden">
        <div className="max-w-[1400px] mx-auto grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div className="relative aspect-[4/5] overflow-hidden reveal" ref={addRevealRef}>
            {all[5] && (
              <img
                src={all[5].image_url || ''}
                alt={all[5].name}
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

      {/* ===== TESTIMONIALS ===== */}
      <section className="py-24 md:py-32 px-6 lg:px-10 bg-background">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-center mb-16 reveal" ref={addRevealRef}>
            <p className="text-[11px] tracking-[0.3em] uppercase text-muted-foreground mb-3">{t.homeTestimonialsEyebrow}</p>
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
                className="group relative bg-muted/40 p-8 md:p-10 reveal hover-3d"
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

      {/* ===== NEWSLETTER ===== */}
      <section className="py-24 md:py-32 px-6 lg:px-10 border-t border-border">
        <div className="max-w-xl mx-auto text-center reveal" ref={addRevealRef}>
          <p className="text-[11px] tracking-[0.3em] uppercase text-muted-foreground mb-6">{t.homeNewsletterEyebrow}</p>
          <h2 className="font-display text-4xl md:text-5xl mb-5 leading-tight">
            {t.homeNewsletterTitle}
          </h2>
          <p className="text-muted-foreground font-light text-sm mb-10 leading-relaxed">
            {t.homeNewsletterDesc}
          </p>
          <form
            onSubmit={(e) => { e.preventDefault(); toast.success(t.homeNewsletterToast) }}
            className="flex gap-2 max-w-md mx-auto"
          >
            <input
              type="email"
              required
              placeholder={t.homeNewsletterPlaceholder}
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
              className="flex-1 bg-transparent border-b-2 border-foreground/30 focus:border-foreground outline-none py-3 text-sm placeholder:text-muted-foreground/60 transition-colors"
            />
            <button
              type="submit"
              className="text-[12px] tracking-[0.2em] uppercase font-medium border-b-2 border-foreground pb-1 hover:opacity-70 transition-opacity cursor-pointer"
            >
              {t.homeNewsletterCta}
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
