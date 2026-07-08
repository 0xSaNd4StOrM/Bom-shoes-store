import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { Loader2, ShoppingBag, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase, ProductImage, ProductVariant, ProductCatalogEntry } from '@/lib/supabase'
import { useCart } from '@/contexts/CartContext'
import { useT } from '@/contexts/LanguageContext'
import { useCurrency } from '@/contexts/CurrencyContext'
import RatingStars from '@/components/RatingStars'

type QuickViewModalProps = {
  productId: string | null
  onClose: () => void
}

export default function QuickViewModal({ productId, onClose }: QuickViewModalProps) {
  const [product, setProduct] = useState<ProductCatalogEntry | null>(null)
  const [images, setImages] = useState<ProductImage[]>([])
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [loading, setLoading] = useState(false)
  const [size, setSize] = useState('')
  const [color, setColor] = useState('')
  const { addItem } = useCart()
  const t = useT()
  const { formatPrice } = useCurrency()

  useEffect(() => {
    if (!productId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('product_catalog')
        .select('*')
        .eq('id', productId)
        .maybeSingle()

      if (cancelled) return

      if (data) {
        setProduct(data)
        const [{ data: imgs }, { data: vars }] = await Promise.all([
          supabase.from('product_images').select('*').eq('product_id', data.id).order('position'),
          supabase.from('product_variants').select('*').eq('product_id', data.id),
        ])
        if (cancelled) return
        setImages(imgs || [])
        setVariants(vars || [])

        // Same preference as ProductDetail: a real variant combo first, legacy
        // flat arrays as a fallback for products with no variants yet.
        if (vars && vars.length > 0) {
          setColor(vars[0].color)
          setSize(vars[0].size)
        } else {
          setColor(data.available_colors[0] ?? '')
          setSize(data.available_sizes[0] ?? '')
        }
      } else {
        setProduct(null)
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [productId])

  // Guards against showing the previous product's data while the next one loads.
  const ready = !loading && product?.id === productId

  const hasVariants = variants.length > 0
  const colorOptions = hasVariants ? Array.from(new Set(variants.map(v => v.color))) : (product?.available_colors ?? [])
  const sizeOptions = hasVariants ? Array.from(new Set(variants.map(v => v.size))) : (product?.available_sizes ?? [])
  const selectedVariant = hasVariants ? variants.find(v => v.color === color && v.size === size) : undefined
  const effectivePrice = selectedVariant ? (selectedVariant.price_override ?? product?.min_price ?? 0) : (product?.min_price ?? 0)
  const outOfStock = hasVariants ? (!selectedVariant || selectedVariant.stock === 0) : (product?.total_stock ?? 0) === 0
  const mainImage = images[0]?.url || product?.image_url || ''

  function sizeAvailable(s: string) {
    if (!hasVariants) return true
    const v = variants.find(v => v.color === color && v.size === s)
    return !!v && v.stock > 0
  }

  function handleAdd() {
    if (!product) return
    if (!size) { toast.error(t.productChooseSize); return }
    addItem(product, size, color, 1)
    toast.success(t.productAdded, { description: `${product.name}, Size ${size}` })
    onClose()
  }

  return (
    <Dialog.Root open={productId !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 fade-in" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[92vw] max-w-2xl max-h-[85vh] overflow-y-auto bg-background scale-in focus:outline-none"
          aria-describedby={undefined}
        >
          <Dialog.Close
            className="absolute top-4 end-4 p-2 cursor-pointer hover:text-foreground/60 transition-colors z-10"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </Dialog.Close>

          {/* Always mounted (even mid-load) so Radix never warns about a missing Title. */}
          <Dialog.Title className="sr-only">{product?.name || 'Quick view'}</Dialog.Title>

          {!ready ? (
            <div className="min-h-[360px] flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : product && (
            <div className="grid sm:grid-cols-2 gap-8 p-6 sm:p-8">
              <div className="aspect-square bg-muted overflow-hidden">
                <img src={mainImage} alt={product.name} className="w-full h-full object-cover" />
              </div>

              <div>
                <h2 className="font-display text-2xl mb-2 text-balance">
                  {product.name}
                </h2>
                <div className="mb-6">
                  <p className="font-display text-xl text-muted-foreground mb-1.5">
                    {formatPrice(Number(effectivePrice))}
                  </p>
                  <RatingStars rating={product.avg_rating} count={product.review_count} />
                </div>

                {colorOptions.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs tracking-widest uppercase text-muted-foreground">{t.productColor}</span>
                      <span className="text-xs text-foreground/70">{color}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {colorOptions.map(c => (
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
                )}

                {sizeOptions.length > 0 && (
                  <div className="mb-8">
                    <span className="text-xs tracking-widest uppercase text-muted-foreground block mb-3">{t.productSize}</span>
                    <div className="grid grid-cols-5 gap-1.5">
                      {sizeOptions.map(s => {
                        const available = sizeAvailable(s)
                        return (
                          <button
                            key={s}
                            onClick={() => available && setSize(s)}
                            disabled={!available}
                            className={`py-2.5 text-sm border transition-colors ${
                              !available
                                ? 'border-border/50 text-muted-foreground/40 cursor-not-allowed'
                                : size === s
                                ? 'border-foreground bg-foreground text-background cursor-pointer'
                                : 'border-border hover:border-foreground/50 cursor-pointer'
                            }`}
                          >
                            {s}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleAdd}
                  disabled={outOfStock}
                  className="w-full bg-foreground text-background py-3.5 text-sm tracking-widest uppercase hover:bg-foreground/90 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 mb-4"
                >
                  {outOfStock ? t.productOutOfStock : (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      {t.productAddToBag}
                    </>
                  )}
                </button>

                <Link
                  to={`/product/${product.slug}`}
                  onClick={onClose}
                  className="block text-center text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground"
                >
                  {t.quickViewDetails}
                </Link>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
