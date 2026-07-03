import { useLanguage } from '@/contexts/LanguageContext'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: number
  className?: string
  showText?: boolean
}

/**
 * BOM Store monogram logo.
 * "B" inside a thin gold circle, with "BOM STORE" underneath (Latin, in both languages).
 */
export default function Logo({ size = 64, className, showText = true }: LogoProps) {
  const { lang } = useLanguage()
  const r = size * 0.45
  const cx = size / 2
  const cy = size / 2

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
          fontFamily={lang === 'ar' ? "'Reem Kufi', 'Amiri', serif" : "'Cormorant Garamond', 'Playfair Display', Georgia, serif"}
          fontSize={size * 0.5}
          fontWeight={500}
          fontStyle={lang === 'ar' ? 'normal' : 'italic'}
          fill="url(#goldGradient)"
        >
          {lang === 'ar' ? 'م' : 'M'}
        </text>
      </svg>
      {showText && (
        <div
          className="mt-1 text-center font-display tracking-[0.35em] text-[10px] font-light"
          style={{ color: '#B8860B' }}
        >
          {lang === 'ar' ? 'مَشْوار' : 'MASHWAR'}
        </div>
      )}
    </div>
  )
}
