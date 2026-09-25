import { useLayoutEffect, type ReactNode } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { prefersReducedMotion } from './env'

gsap.registerPlugin(ScrollTrigger)

let lenis: Lenis | null = null
export const getLenis = () => lenis

/** Current scroll velocity in px/frame — 0 when native scrolling. */
export const scrollVelocity = () => lenis?.velocity ?? 0

export function scrollToTop() {
  lenis?.scrollTo(0, { immediate: true, force: true })
  window.scrollTo(0, 0)
}

export function scrollToTarget(target: string | HTMLElement) {
  const el = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target
  if (!el) return
  if (lenis) lenis.scrollTo(el, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) })
  else el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
}

export function SmoothScroll({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return
    // Touch devices keep native momentum scrolling — it already feels right there.
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.95 })
    lenis.on('scroll', ScrollTrigger.update)
    const tick = (time: number) => lenis?.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    return () => {
      gsap.ticker.remove(tick)
      lenis?.destroy()
      lenis = null
    }
  }, [])
  return <>{children}</>
}
