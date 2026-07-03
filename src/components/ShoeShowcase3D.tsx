import { useEffect, useRef, useState } from 'react'
import { useT } from '@/contexts/LanguageContext'

/**
 * Sticky 3D scroll showcase with transparent-background shoes.
 * As the user scrolls the page, the active shoe image transitions,
 * rotates and floats in 3D space.
 */
const SHOES = [
  {
    src: '/shoes/cloudwalker.webp',
    name: 'The Cloudwalker',
    enTitle: 'Cloudwalker',
    arTitle: 'كلاود ووكر',
    price: '$420',
    color: '#F8F4ED',
  },
  {
    src: '/shoes/atlas-loafer.webp',
    name: 'The Atlas Loafer',
    enTitle: 'Atlas Loafer',
    arTitle: 'أطلس لوفر',
    price: '$380',
    color: '#C9A98F',
  },
  {
    src: '/shoes/atlas-boot.webp',
    name: 'The Atlas Boot',
    enTitle: 'Atlas Boot',
    arTitle: 'أطلس بوت',
    price: '$520',
    color: '#1F1B16',
  },
  {
    src: '/shoes/marina-derby.webp',
    name: 'The Marina Derby',
    enTitle: 'Marina Derby',
    arTitle: 'مارينا ديربي',
    price: '$395',
    color: '#1E2A4A',
  },
  {
    src: '/shoes/drift-runner.webp',
    name: 'The Drift Runner',
    enTitle: 'Drift Runner',
    arTitle: 'دريفت رانر',
    price: '$340',
    color: '#EDE6D6',
  },
  {
    src: '/shoes/dune-boot.webp',
    name: 'The Dune Boot',
    enTitle: 'Dune Boot',
    arTitle: 'دون بوت',
    price: '$460',
    color: '#A57C52',
  },
]

export default function ShoeShowcase3D() {
  const t = useT()
  const sectionRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [scrollProgress, setScrollProgress] = useState(0)

  useEffect(() => {
    function onScroll() {
      if (!sectionRef.current) return
      const rect = sectionRef.current.getBoundingClientRect()
      const sectionTop = window.scrollY + rect.top
      const sectionHeight = sectionRef.current.offsetHeight - window.innerHeight
      const scrolled = window.scrollY - sectionTop
      const progress = Math.max(0, Math.min(1, scrolled / sectionHeight))
      setScrollProgress(progress)
      const idx = Math.min(SHOES.length - 1, Math.floor(progress * SHOES.length))
      setActive(idx)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const current = SHOES[active]
  // Continuous scroll position (0..N) used to drive the bottom-to-top slide
  const rawPos = scrollProgress * SHOES.length
  const floatY = Math.sin(scrollProgress * Math.PI * 3) * 24

  return (
    <section
      ref={sectionRef}
      className="relative bg-[#0A0907] text-white"
      style={{ height: `${SHOES.length * 100}vh` }}
    >
      <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden">
        {/* Subtle background gradient that shifts */}
        <div
          className="absolute inset-0 transition-all duration-1000"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${current.color}33 0%, #0A0907 60%)`,
          }}
        />

        {/* Decorative index counter */}
        <div className="absolute top-10 left-10 right-10 flex items-center justify-between text-xs tracking-[0.3em] uppercase font-light opacity-80 text-shadow-sm">
          <span>0{active + 1} / 0{SHOES.length}</span>
          <span>{t.showcaseLabel}</span>
        </div>

        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-px bg-white/10">
          <div
            className="h-full bg-white/70 transition-all duration-100"
            style={{ width: `${scrollProgress * 100}%` }}
          />
        </div>

        {/* Shoes slide in from the bottom and exit through the top */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {SHOES.map((s, i) => {
            // diff > 0 → this shoe has already scrolled past (move it upward / off the top)
            // diff < 0 → this shoe hasn't appeared yet (park it below)
            const diff = rawPos - i
            const isActive = Math.abs(diff) < 0.5
            // Distance from "centered": 1 unit of diff = 100vh of vertical travel
            const baseTranslateY = -diff * 100 // vh
            // Fade out as it leaves the centred band
            const opacity = isActive ? 1 : Math.max(0, 1 - (Math.abs(diff) - 0.5) * 1.4)
            const scale = isActive ? 1 : Math.max(0.75, 1 - Math.abs(diff) * 0.12)
            return (
              <img
                key={i}
                src={s.src}
                alt={s.enTitle}
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
                width={1024}
                height={1024}
                fetchPriority={i === 0 ? 'high' : 'auto'}
                className="absolute w-[60vw] max-w-[680px] h-auto select-none"
                style={{
                  opacity,
                  transform: `translateY(calc(${baseTranslateY}vh + ${isActive ? floatY : 0}px)) scale(${scale})`,
                  transition: 'opacity 600ms ease, transform 600ms cubic-bezier(0.16, 1, 0.3, 1)',
                  filter: isActive ? 'drop-shadow(0 60px 80px rgba(0,0,0,0.55))' : 'drop-shadow(0 30px 40px rgba(0,0,0,0.35))',
                  willChange: 'transform, opacity',
                }}
                draggable={false}
              />
            )
          })}
        </div>

        {/* Product info card - right side (or left in RTL) */}
        <div className="relative z-10 w-full max-w-[1400px] mx-auto px-6 lg:px-10 grid lg:grid-cols-2 gap-10 items-center pointer-events-none">
          <div className="hidden lg:block" />
          <div className="text-start lg:text-end max-w-md lg:ms-auto lg:rtl:ms-0 lg:rtl:me-auto">
            <p
              key={`eb-${active}`}
              className="text-xs tracking-[0.3em] uppercase font-light opacity-80 mb-3 text-shadow-sm"
              style={{ animation: 'fadeUp 600ms 100ms ease-out both' }}
            >
              {t.showcaseEyebrow}
            </p>
            <h3
              key={`t-${active}`}
              className="font-display text-5xl md:text-6xl lg:text-7xl leading-[0.95] mb-4 text-shadow-lg"
              style={{ animation: 'fadeUp 600ms 200ms ease-out both' }}
            >
              {current.enTitle}
            </h3>
            <p
              key={`p-${active}`}
              className="text-2xl font-light opacity-95 mb-6 text-shadow"
              style={{ animation: 'fadeUp 600ms 300ms ease-out both' }}
            >
              {current.price}
            </p>
            <p
              key={`d-${active}`}
              className="text-sm font-light leading-relaxed opacity-80 mb-8 max-w-sm lg:ms-auto text-shadow"
              style={{ animation: 'fadeUp 600ms 400ms ease-out both' }}
            >
              {t.showcaseDesc}
            </p>
            <a
              href={`/product/${shoeSlug(current.enTitle)}`}
              className="pointer-events-auto inline-flex items-center gap-2 text-sm tracking-wider border-b border-white/70 pb-1 hover:border-white transition-colors text-shadow-sm"
              style={{ animation: 'fadeUp 600ms 500ms ease-out both' }}
            >
              {t.showcaseCta} →
            </a>
          </div>
        </div>

        {/* Side dots navigation */}
        <div className="absolute end-6 top-1/2 -translate-y-1/2 flex flex-col gap-3">
          {SHOES.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                const el = sectionRef.current
                if (!el) return
                const rect = el.getBoundingClientRect()
                const sectionTop = window.scrollY + rect.top
                const sectionHeight = el.offsetHeight - window.innerHeight
                const target = sectionTop + (i / SHOES.length) * sectionHeight + 50
                window.scrollTo({ top: target, behavior: 'smooth' })
              }}
              aria-label={`Go to slide ${i + 1}`}
              className="w-2 h-2 rounded-full transition-all duration-300 cursor-pointer"
              style={{
                backgroundColor: i === active ? '#fff' : 'rgba(255,255,255,0.3)',
                transform: i === active ? 'scale(1.5)' : 'scale(1)',
              }}
            />
          ))}
        </div>

        {/* Scroll hint - only at the top */}
        {scrollProgress < 0.05 && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-60">
            <span className="text-[10px] tracking-[0.3em] uppercase">{t.showcaseScroll}</span>
            <span className="w-px h-10 bg-white/40 animate-pulse" />
          </div>
        )}
      </div>
    </section>
  )
}

function shoeSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, '-')
}
