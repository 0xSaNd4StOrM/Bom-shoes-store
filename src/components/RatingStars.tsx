import { Star } from 'lucide-react'

type RatingStarsProps = {
  rating: number | null
  count: number
  className?: string
}

// Compact star + count display shared by list/preview contexts (Shop grid
// cards, QuickViewModal). Renders nothing when there are no reviews yet --
// an unrated product should look clean, not show a "0 reviews" placeholder.
export default function RatingStars({ rating, count, className = '' }: RatingStarsProps) {
  if (!count || rating == null) return null
  const rounded = Math.round(rating)
  return (
    <div
      className={`flex items-center gap-1 ${className}`}
      aria-label={`${rating.toFixed(1)} out of 5 stars, ${count} reviews`}
    >
      <div className="flex text-foreground/70">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="w-3 h-3" fill={i < rounded ? 'currentColor' : 'none'} strokeWidth={1.5} />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">({count})</span>
    </div>
  )
}
