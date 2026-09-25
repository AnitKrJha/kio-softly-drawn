const mq = (q: string) => typeof window !== 'undefined' && window.matchMedia(q).matches

export const prefersReducedMotion = () => mq('(prefers-reduced-motion: reduce)')
export const isFinePointer = () => mq('(hover: hover) and (pointer: fine)')

/**
 * Heavy WebGL scenes only run on capable, mouse-driven, wide screens.
 * Phones and tablets get lightweight CSS/SVG versions of the same moments.
 */
export function canRunHeavyGL() {
  if (typeof window === 'undefined') return false
  if (prefersReducedMotion() || !isFinePointer() || window.innerWidth < 900) return false
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
  if (nav.connection?.saveData) return false
  if ((nav.deviceMemory ?? 8) < 4) return false
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}
