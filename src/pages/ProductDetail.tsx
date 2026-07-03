import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase, Product } from '@/lib/supabase'
import { useCart } from '@/contexts/CartContext'
import { useT } from '@/contexts/LanguageContext'
import { ArrowLeft, Check, Loader2, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'

export default function ProductDetail() {
  const { slug } = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [related, setRelated] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [size, setSize] = useState('')
  const [color, setColor] = useState('')
  const [adding, setAdding] = useState(false)
  const { addItem } = useCart()
  const navigate = useNavigate()
  const t = useT()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()

      if (data) {
        setProduct(data)
        setColor(data.colors[0])
        setSize(data.sizes[0])
        const { data: rel } = await supabase
          .from('products')
          .select('*')
          .eq('category', data.category)
          .neq('id', data.id)
          .limit(4)
        setRelated(rel || [])
      }
      setLoading(false)
    }
    load()
  }, [slug])

  async function handleAdd() {
    if (!product) return
    if (!size) { toast.error(t.productChooseSize); return }
    setAdding(true)
    addItem(product, size, color, 1)
    setTimeout(() => {
      setAdding(false)
      toast.success(t.productAdded, {
        description: `${product.name}, Size ${size}`,
        action: { label: t.cart, onClick: () => navigate('/cart') }
      })
    }, 400)
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
        <p className="text-muted-foreground">{t.productNotFound}</p>
        <Link to="/shop" className="mt-4 text-sm border-b border-foreground pb-0.5">{t.productReturnShop}</Link>
      </div>
    )
  }

  return (
    <div className="px-6 lg:px-10 py-10">
      <div className="max-w-[1400px] mx-auto">
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground mb-10"
        >
          <ArrowLeft className="w-3.5 h-3.5 flip-rtl" />
          {t.productBack}
        </Link>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
          {/* Image */}
          <div className="aspect-square bg-muted overflow-hidden">
            <img
              src={product.image_url || ''}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Details */}
          <div className="lg:pt-8">
            <p className="text-zen text-muted-foreground mb-3">{product.category}</p>
            <h1 className="font-display text-4xl md:text-5xl mb-3 text-balance">{product.name}</h1>
            <p className="font-display text-2xl text-muted-foreground mb-8">
              ${Number(product.price).toFixed(0)}
            </p>

            <p className="text-foreground/80 font-light leading-relaxed mb-10 max-w-md">
              {product.description}
            </p>

            {/* Color */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs tracking-widest uppercase text-muted-foreground">{t.productColor}</span>
                <span className="text-xs text-foreground/70">{color}</span>
              </div>
              <div className="flex gap-2">
                {product.colors.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`px-3.5 py-1.5 text-sm border transition-colors cursor-pointer ${
                      color === c
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border hover:border-foreground/50'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Size */}
            <div className="mb-10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs tracking-widest uppercase text-muted-foreground">{t.productSize}</span>
                <button className="text-xs text-muted-foreground underline-offset-2 hover:underline">
                  {t.productSizeGuide}
                </button>
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-8 gap-1.5">
                {product.sizes.map(s => (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    className={`py-2.5 text-sm border transition-colors cursor-pointer ${
                      size === s
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border hover:border-foreground/50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Add */}
            <div className="flex gap-3">
              <button
                onClick={handleAdd}
                disabled={adding || product.stock === 0}
                className="flex-1 bg-primary text-primary-foreground py-4 text-sm tracking-widest uppercase hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {adding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : product.stock === 0 ? (
                  t.productOutOfStock
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    {t.productAddToBag}
                  </>
                )}
              </button>
            </div>

            {/* Meta */}
            <div className="mt-10 pt-8 border-t border-border space-y-4 text-sm">
              <div className="flex items-center gap-3 text-foreground/80">
                <Check className="w-4 h-4 text-foreground/60" />
                <span>{t.productShip1}</span>
              </div>
              <div className="flex items-center gap-3 text-foreground/80">
                <Check className="w-4 h-4 text-foreground/60" />
                <span>{t.productShip2}</span>
              </div>
              <div className="flex items-center gap-3 text-foreground/80">
                <Check className="w-4 h-4 text-foreground/60" />
                <span>{t.productShip3}</span>
              </div>
            </div>

            {/* Description accordion */}
            <div className="mt-10 pt-8 border-t border-border">
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer list-none py-2">
                  <span className="text-xs tracking-widest uppercase">{t.productAccordion1}</span>
                  <span className="text-lg group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="text-sm text-foreground/80 font-light leading-relaxed pt-3 pb-2">
                  {t.productAccordion1Text}
                </p>
              </details>
              <details className="group border-t border-border/60">
                <summary className="flex items-center justify-between cursor-pointer list-none py-4">
                  <span className="text-xs tracking-widest uppercase">{t.productAccordion2}</span>
                  <span className="text-lg group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="text-sm text-foreground/80 font-light leading-relaxed pt-2 pb-4">
                  {t.productAccordion2Text}
                </p>
              </details>
              <details className="group border-t border-border/60">
                <summary className="flex items-center justify-between cursor-pointer list-none py-4">
                  <span className="text-xs tracking-widest uppercase">{t.productAccordion3}</span>
                  <span className="text-lg group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="text-sm text-foreground/80 font-light leading-relaxed pt-2 pb-4">
                  {t.productAccordion3Text}
                </p>
              </details>
            </div>
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div className="mt-32">
            <p className="text-zen text-muted-foreground mb-3">{t.productAlsoTitle}</p>
            <h2 className="font-display text-3xl mb-10">{t.productAlsoSubtitle}</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
              {related.map(p => (
                <Link key={p.id} to={`/product/${p.slug}`} className="group block">
                  <div className="aspect-square bg-muted overflow-hidden img-zoom">
                    <img src={p.image_url || ''} alt={p.name} className="w-full h-full object-cover" />
                  </div>
                  <h3 className="mt-4 font-display text-lg group-hover:text-muted-foreground transition-colors">{p.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">${Number(p.price).toFixed(0)}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
