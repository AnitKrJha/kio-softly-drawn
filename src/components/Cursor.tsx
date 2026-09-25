import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import gsap from 'gsap'
import { isFinePointer, prefersReducedMotion } from '../lib/env'
import './Cursor.css'

type State = 'default' | 'link' | 'label' | 'native'

const NATIVE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]'
const INTERACTIVE = 'a[href], button, [role="button"], summary, label, [tabindex]:not([tabindex="-1"])'

/**
 * Dot + lagging ring. Anything with `data-cursor="View"` (etc.) turns the ring into a labelled disc.
 * One set of document-level listeners — no per-element wiring — so it survives every route change.
 */
export function Cursor() {
  const [enabled] = useState(() => isFinePointer() && !prefersReducedMotion())
  const ringRef = useRef<HTMLDivElement>(null)
  const dotRef = useRef<HTMLDivElement>(null)
  const recheck = useRef<() => void>(() => {})
  const location = useLocation()

  useEffect(() => {
    const ring = ringRef.current
    const dot = dotRef.current
    if (!enabled || !ring || !dot) return
    const label = ring.querySelector<HTMLElement>('.cursor-ring__label')!
    const html = document.documentElement
    html.classList.add('has-cursor')

    const dotX = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3.out' })
    const dotY = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3.out' })
    const ringX = gsap.quickTo(ring, 'x', { duration: 0.55, ease: 'power3.out' })
    const ringY = gsap.quickTo(ring, 'y', { duration: 0.55, ease: 'power3.out' })

    let x = -100
    let y = -100
    let seen = false
    let state: State = 'default'
    let text = ''
    let raf = 0

    const apply = (target: Element | null) => {
      let next: State = 'default'
      let nextText = ''
      if (target) {
        const labelled = target.closest<HTMLElement>('[data-cursor]')
        const native = target.closest(NATIVE)
        if (native) next = 'native'
        else if (labelled?.dataset.cursor) {
          next = 'label'
          nextText = labelled.dataset.cursor
        } else if (target.closest(INTERACTIVE)) next = 'link'
      }
      if (next !== state) {
        state = next
        ring.dataset.state = next
        dot.dataset.state = next
      }
      if (nextText && nextText !== text) {
        text = nextText
        label.textContent = nextText
      }
    }

    const show = (v: boolean) => {
      ring.classList.toggle('is-visible', v)
      dot.classList.toggle('is-visible', v)
    }

    const onMove = (e: PointerEvent) => {
      if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return
      x = e.clientX
      y = e.clientY
      if (!seen) {
        // first contact: appear in place instead of flying in from the corner
        seen = true
        gsap.set([dot, ring], { x, y })
      }
      dotX(x)
      dotY(y)
      ringX(x)
      ringY(y)
      show(true)
      apply(e.target as Element)
    }

    // content can move under a still pointer (scroll, route change, GL hover)
    const reevaluate = () => {
      if (!seen || raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        apply(document.elementFromPoint(x, y))
      })
    }
    recheck.current = reevaluate

    const onOut = (e: MouseEvent) => {
      if (!e.relatedTarget) show(false)
    }
    const onBlur = () => show(false)
    const onDown = () => ring.classList.add('is-pressed')
    const onUp = () => ring.classList.remove('is-pressed')

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    window.addEventListener('scroll', reevaluate, { passive: true })
    // components that swap `data-cursor` under a still pointer can ask for a re-read
    window.addEventListener('cursor:refresh', reevaluate)
    window.addEventListener('mouseout', onOut, { passive: true })
    window.addEventListener('blur', onBlur)
    document.addEventListener('mouseleave', onBlur)

    return () => {
      cancelAnimationFrame(raf)
      recheck.current = () => {}
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('scroll', reevaluate)
      window.removeEventListener('cursor:refresh', reevaluate)
      window.removeEventListener('mouseout', onOut)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('mouseleave', onBlur)
      gsap.killTweensOf([dot, ring])
      html.classList.remove('has-cursor')
    }
  }, [enabled])

  // after a route change the element under a motionless pointer is brand new
  useEffect(() => {
    recheck.current()
    const t = setTimeout(() => recheck.current(), 1100) // once the view transition has settled
    return () => clearTimeout(t)
  }, [location.key])

  if (!enabled) return null
  // Two top-level fixed layers: the dot must sit in the root stacking context for its
  // `mix-blend-mode: difference` to see the page; the ring stays unblended so labels read.
  return (
    <>
      <div ref={ringRef} className="cursor-ring" data-state="default" aria-hidden="true">
        <span className="cursor-ring__circle" />
        <span className="cursor-ring__disc">
          <span className="cursor-ring__label" />
        </span>
      </div>
      <div ref={dotRef} className="cursor-dot" data-state="default" aria-hidden="true" />
    </>
  )
}
