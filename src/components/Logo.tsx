import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

interface LogoProps {
  size?: number
  className?: string
  showText?: boolean
}

// Singleton row id -- see supabase/migrations/20260704008000_store_settings_realtime.sql.
const STORE_SETTINGS_ID = '00000000-0000-0000-0000-000000000001'

// One-time fetch of the admin-configured logo URL, if any. Stays null (and
// the SVG monogram below keeps rendering) on a missing row, a fetch error,
// or an unreachable table -- this must never blank/break the header logo.
function useStoreLogoUrl() {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    supabase
      .from('store_settings')
      .select('logo_url')
      .eq('id', STORE_SETTINGS_ID)
      .maybeSingle()
      .then(
        ({ data }) => { if (!cancelled) setUrl(data?.logo_url || null) },
        () => {} // ponytail: leave url null, SVG fallback covers it
      )
    return () => { cancelled = true }
  }, [])
  return url
}

/**
 * BOM Store monogram logo.
 * "B" inside a thin gold circle, with "BOM STORE" underneath (Latin, in both languages).
 * Renders the admin-uploaded logo (store_settings.logo_url) if one is set,
 * otherwise falls back to this hardcoded SVG monogram.
 */
export default function Logo({ size = 64, className, showText = true }: LogoProps) {
  const fetchedLogoUrl = useStoreLogoUrl()
  const [imgFailed, setImgFailed] = useState(false)
  const logoUrl = imgFailed ? null : fetchedLogoUrl
  const r = size * 0.45
  const cx = size / 2
  const cy = size / 2

  const text = showText && (
    <div
      className="mt-1 text-center font-display tracking-[0.35em] text-[10px] font-light"
      style={{ color: '#B8860B' }}
    >
      BOM STORE
    </div>
  )

  if (logoUrl) {
    return (
      <div className={cn('flex flex-col items-center select-none', className)} style={{ width: size }}>
        <img
          src={logoUrl}
          alt="BOM Store logo"
          width={size}
          height={size}
          style={{ width: size, height: size }}
          className="object-contain"
          onError={() => setImgFailed(true)}
        />
        {text}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col items-center select-none', className)} style={{ width: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        xmlns="http://www.w3.org/2000/svg"
        aria-label="BOM Store logo"
      >
        <defs>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#D4AF37" />
            <stop offset="50%" stopColor="#F1D27A" />
            <stop offset="100%" stopColor="#B8860B" />
          </linearGradient>
        </defs>
        {/* Outer thin ring */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="url(#goldGradient)"
          strokeWidth={size * 0.012}
        />
        {/* Inner thin ring */}
        <circle
          cx={cx}
          cy={cy}
          r={r - size * 0.04}
          fill="none"
          stroke="url(#goldGradient)"
          strokeWidth={size * 0.006}
          opacity="0.5"
        />
        {/* Monogram letter */}
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="'Cairo', 'Amiri', Georgia, serif"
          fontSize={size * 0.5}
          fontWeight={600}
          fill="url(#goldGradient)"
        >
          B
        </text>
      </svg>
      {text}
    </div>
  )
}
