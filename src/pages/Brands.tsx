import { Link } from 'react-router-dom'
import { useT } from '@/contexts/LanguageContext'
import { useSeo } from '@/hooks/useSeo'
import { ArrowUpRight } from 'lucide-react'

// Static for now -- BOM Store is a multi-brand retailer, but the
// admin-managed `brands` table (mirroring `categories`) hasn't been
// migrated in yet. Swap this list for a live `useBrands()` fetch once that
// lands; the /shop?brand= links below already degrade harmlessly today
// since Shop.tsx doesn't yet filter on that param.
const BRANDS = ['Prada', 'Nike', 'Balenciaga', 'Adidas', 'Amiri', 'New Balance', 'Gucci']

export default function Brands() {
  const t = useT()

  useSeo({ title: `${t.navBrands} · ${t.brandName}`, description: t.brandsSubtitle })

  return (
    <div className="px-6 lg:px-10 py-16 lg:py-24 bg-cream min-h-screen">
      <div className="max-w-[1400px] mx-auto">
        <div className="text-center mb-16">
          <p className="text-zen text-muted-foreground mb-4">{t.brandsEyebrow}</p>
          <h1 className="font-display text-5xl md:text-7xl">{t.navBrands}</h1>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {BRANDS.map(brand => (
            <Link
              key={brand}
              to={`/shop?brand=${encodeURIComponent(brand)}`}
              className="group flex items-center justify-between gap-3 border border-border bg-background px-6 py-8 hover:border-foreground hover:bg-foreground hover:text-background transition-colors"
            >
              <span className="font-display text-xl md:text-2xl">{brand}</span>
              <ArrowUpRight className="w-5 h-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
