import { Link } from 'react-router-dom'
import { ProductCatalogEntry } from '@/lib/supabase'
import { useT } from '@/contexts/LanguageContext'
import WishlistButton from '@/components/WishlistButton'
import RatingStars from '@/components/RatingStars'
import { cn } from '@/lib/utils'

const NEW_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

type ProductCardProps = {
  product: ProductCatalogEntry
  categoryLabel: string
  /** Pre-formatted buy-x-get-y badge text, if an active promo applies to this product. */
  bxgyBadge?: string
  onQuickView: (productId: string) => void
  onQuickAdd: (product: ProductCatalogEntry, e: React.MouseEvent) => void
  quickAdding?: boolean
  animationDelay?: string
  className?: string
}

// Shared product grid card -- image, wishlist, hover quick view/quick add,
// category label, name, price, rating, and the Featured/Only-N-left/BXGY/New
// badges. Extracted from Shop.tsx so other grids (e.g. the homepage) render
// an identical card instead of a second copy of this markup.
export default function ProductCard({
  product: p,
  categoryLabel,
  bxgyBadge,
  onQuickView,
  onQuickAdd,
  quickAdding = false,
  animationDelay,
  className = '',
}: ProductCardProps) {
  const t = useT()
  const isNew = Date.now() - new Date(p.created_at).getTime() < NEW_WINDOW_MS

  return (
    <Link
      to={`/product/${p.slug}`}
      className={cn('group block fade-up', className)}
      style={animationDelay ? { animationDelay } : undefined}
    >
      <div className="relative aspect-square overflow-hidden bg-muted img-zoom">
        <img
          src={p.image_url || ''}
          alt={p.name}
          className="w-full h-full object-cover"
        />

        {/* Featured/New badges stack in the same corner -- distinct signals,
            a product can be both at once. */}
        {(p.featured || isNew) && (
          <div className="absolute top-3 start-3 flex flex-col items-start gap-1.5">
            {p.featured && (
              <span className="bg-background/90 backdrop-blur-sm px-2.5 py-1 text-[10px] tracking-widest uppercase">
                {t.shopFeatured}
              </span>
            )}
            {isNew && (
              <span className="bg-gold text-foreground px-2.5 py-1 text-[10px] tracking-widest uppercase">
                {t.shopNew}
              </span>
            )}
          </div>
        )}

        {p.total_stock < 10 && (
          <div className="absolute bottom-3 start-3 bg-foreground/90 text-background px-2.5 py-1 text-[10px] tracking-widest uppercase">
            {t.shopOnlyLeft(p.total_stock)}
          </div>
        )}
        {bxgyBadge && (
          <div className="absolute bottom-3 end-3 bg-background/90 backdrop-blur-sm px-2.5 py-1 text-[10px] tracking-widest uppercase">
            {bxgyBadge}
          </div>
        )}

        {/* Hover actions -- centered so they never collide with the corner badges above.
            pointer-events-none until hovered, otherwise this full-cover div would eat
            every click on the card (including the Link navigation) even while invisible. */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-300 bg-black/0 group-hover:bg-black/5">
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onQuickView(p.id) }}
            className="bg-background/95 backdrop-blur-sm px-4 py-2 text-[10px] tracking-widest uppercase hover:bg-background transition-colors cursor-pointer"
          >
            {t.shopQuickView}
          </button>
          {p.total_stock > 0 && (
            <button
              onClick={(e) => onQuickAdd(p, e)}
              disabled={quickAdding}
              className="bg-foreground text-background px-4 py-2 text-[10px] tracking-widest uppercase hover:bg-foreground/90 transition-colors cursor-pointer disabled:opacity-50"
            >
              {t.shopQuickAdd}
            </button>
          )}
        </div>

        {/* Rendered after the hover overlay so it stays on top and clickable at all times,
            including while the overlay above is active during hover. */}
        <div className="absolute top-3 end-3">
          <WishlistButton productId={p.id} className="bg-background/90 backdrop-blur-sm" />
        </div>
      </div>
      <div className="mt-5">
        <p className="text-[11px] tracking-widest text-muted-foreground uppercase mb-1.5">
          {categoryLabel}
        </p>
        <h3 className="font-display text-xl group-hover:text-muted-foreground transition-colors">
          {p.name}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          ${Number(p.min_price).toFixed(0)}
        </p>
        <RatingStars rating={p.avg_rating} count={p.review_count} className="mt-1.5" />
      </div>
    </Link>
  )
}
