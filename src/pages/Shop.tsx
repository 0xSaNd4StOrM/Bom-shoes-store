import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { supabase, Product } from '@/lib/supabase'
import { useT, useLanguage } from '@/contexts/LanguageContext'
import { Loader2 } from 'lucide-react'

const CATEGORY_VALUES = ['All', 'Sneakers', 'Boots', 'Loafers', 'Derbies', 'Slippers', 'Sandals']
const SORT_VALUES = ['featured', 'price-asc', 'price-desc', 'newest']

export default function Shop() {
  const [params, setParams] = useSearchParams()
  const initialCategory = params.get('category') || 'All'
  const [category, setCategory] = useState(initialCategory)
  const [sort, setSort] = useState('featured')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const t = useT()
  const { lang } = useLanguage()

  function categoryLabel(c: string): string {
    switch (c) {
      case 'All': return t.shopAll
      case 'Sneakers': return t.navSneakers
      case 'Boots': return t.navBoots
      case 'Loafers': return t.navLoafers
      case 'Derbies': return t.navDerbies
      case 'Slippers': return t.navSlippers
      case 'Sandals': return t.navSandals
      default: return c
    }
  }

  function sortLabel(s: string): string {
    switch (s) {
      case 'featured': return t.shopSortFeatured
      case 'price-asc': return t.shopSortPriceAsc
      case 'price-desc': return t.shopSortPriceDesc
      case 'newest': return t.shopSortNewest
      default: return s
    }
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      let query = supabase.from('products').select('*')
      if (category !== 'All') query = query.eq('category', category)
      const { data } = await query
      setProducts(data || [])
      setLoading(false)
    }
    load()
  }, [category])

  const sorted = useMemo(() => {
    const copy = [...products]
    switch (sort) {
      case 'price-asc': return copy.sort((a, b) => a.price - b.price)
      case 'price-desc': return copy.sort((a, b) => b.price - a.price)
      case 'newest': return copy.sort((a, b) => b.created_at.localeCompare(a.created_at))
      default: return copy.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0))
    }
  }, [products, sort])

  function selectCategory(c: string) {
    setCategory(c)
    if (c === 'All') {
      params.delete('category')
    } else {
      params.set('category', c)
    }
    setParams(params, { replace: true })
  }

  return (
    <div className="px-6 lg:px-10 py-12 lg:py-16">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-zen text-muted-foreground mb-4">{t.shopEyebrow}</p>
          <h1 className="font-display text-5xl md:text-7xl mb-6">{t.shopTitle}</h1>
          <p className="text-muted-foreground font-light max-w-md mx-auto">
            {t.shopSubtitle}
          </p>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-y border-border py-5 mb-12">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none -mx-1 px-1">
            {CATEGORY_VALUES.map(c => (
              <button
                key={c}
                onClick={() => selectCategory(c)}
                className={`px-4 py-1.5 text-sm whitespace-nowrap transition-colors cursor-pointer ${
                  category === c
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {categoryLabel(c)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground tracking-wider uppercase">{t.shopSort}</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
              className="bg-transparent text-sm border-b border-foreground/30 py-1 focus:outline-none focus:border-foreground cursor-pointer"
            >
              {SORT_VALUES.map(s => (
                <option key={s} value={s}>{sortLabel(s)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="py-24 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-muted-foreground">{t.shopNoMatch}</p>
            <button
              onClick={() => selectCategory('All')}
              className="mt-4 text-sm border-b border-foreground pb-0.5"
            >
              {t.shopViewAll}
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground tracking-wider mb-6">
              {t.shopPieces(sorted.length)}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-14">
              {sorted.map((p, i) => (
                <Link
                  key={p.id}
                  to={`/product/${p.slug}`}
                  className="group block fade-up"
                  style={{ animationDelay: `${(i % 8) * 60}ms` }}
                >
                  <div className="relative aspect-square overflow-hidden bg-muted img-zoom">
                    <img
                      src={p.image_url || ''}
                      alt={p.name}
                      className="w-full h-full object-cover"
                    />
                    {p.featured && (
                      <div className="absolute top-3 start-3 bg-background/90 backdrop-blur-sm px-2.5 py-1 text-[10px] tracking-widest uppercase">
                        {t.shopFeatured}
                      </div>
                    )}
                    {p.stock < 10 && (
                      <div className="absolute bottom-3 start-3 bg-primary/90 text-primary-foreground px-2.5 py-1 text-[10px] tracking-widest uppercase">
                        {t.shopOnlyLeft(p.stock)}
                      </div>
                    )}
                  </div>
                  <div className="mt-5">
                    <p className="text-[11px] tracking-widest text-muted-foreground uppercase mb-1.5">
                      {categoryLabel(p.category)}
                    </p>
                    <h3 className="font-display text-xl group-hover:text-muted-foreground transition-colors">
                      {p.name}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      ${Number(p.price).toFixed(0)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
