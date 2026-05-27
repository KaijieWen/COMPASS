import { cn } from '@/lib/utils'

type ThemePreviewBarProps = {
  colors: readonly string[]
  className?: string
}

export function ThemePreviewBar({ colors, className }: ThemePreviewBarProps) {
  return (
    <div
      className={cn(
        'flex h-2.5 w-14 shrink-0 overflow-hidden rounded-full border border-black/10',
        className
      )}
      aria-hidden
    >
      {colors.map((color, i) => (
        <div key={i} className="min-w-0 flex-1" style={{ backgroundColor: color }} />
      ))}
    </div>
  )
}
