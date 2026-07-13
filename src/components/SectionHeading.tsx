import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type SectionHeadingProps = {
  eyebrow: string
  title: string
  subtitle?: string
  viewAllHref?: string
  viewAllLabel?: string
  /** 'center' stacks everything centered (hero-adjacent sections).
   *  'between' puts the heading at the row start and "View All" at the row
   *  end -- mirrors automatically in RTL via logical flex properties. */
  align?: 'center' | 'between'
  className?: string
}

export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  viewAllHref,
  viewAllLabel,
  align = 'center',
  className = '',
}: SectionHeadingProps) {
  const viewAllLink = viewAllHref && (
    <Link
      to={viewAllHref}
      className="inline-flex items-center gap-2 text-[12px] tracking-[0.2em] uppercase font-medium border-b border-foreground/30 pb-1 hover:border-foreground transition-colors whitespace-nowrap"
    >
      {viewAllLabel}
      <ArrowRight className="w-4 h-4 flip-rtl" />
    </Link>
  )

  if (align === 'between') {
    return (
      <div className={cn('flex items-end justify-between gap-6', className)}>
        <div>
          <p className="text-[11px] tracking-[0.3em] uppercase text-muted-foreground mb-3">{eyebrow}</p>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl leading-[0.95]">{title}</h2>
          {subtitle && <p className="text-muted-foreground font-light text-base mt-4 max-w-md">{subtitle}</p>}
        </div>
        {viewAllLink && <div className="hidden md:block">{viewAllLink}</div>}
      </div>
    )
  }

  return (
    <div className={cn('text-center', className)}>
      <p className="text-[11px] tracking-[0.3em] uppercase text-muted-foreground mb-3">{eyebrow}</p>
      <h2 className="font-display text-5xl md:text-6xl lg:text-7xl leading-[0.95]">{title}</h2>
      {subtitle && <p className="text-muted-foreground font-light text-base mt-4 max-w-md mx-auto">{subtitle}</p>}
      {viewAllLink && <div className="mt-6">{viewAllLink}</div>}
    </div>
  )
}
