import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { artworks, type Artwork } from '../../data/artworks'
import { ArtImage } from '../shared/ArtImage'
import { TLink } from '../../lib/transition'
import { useGsap } from '../../lib/useGsap'
import { isFinePointer, prefersReducedMotion } from '../../lib/env'
import { afterIntro, clickedPath, eyebrowFor, getLastViewed, pad, vtName } from './shared'
import './GalleryGrid.css'

gsap.registerPlugin(ScrollTrigger)

/* ───────── columns ─────────
 * Cards are absolutely positioned with pure-CSS calc() against the grid's container width (cqw),
 * so the layout is exact, resize-proof and shift-free. JS only decides *which* column each card
 * joins (shortest-first) — and because every card stays a sibling in one parent, Flip can
 * animate them between columns without remounting anything. */
const colsFor = () => (window.matchMedia('(min-width: 1100px)').matches ? 3 : window.matchMedia('(min-width: 600px)').matches ? 2 : 1)

function useColumns() {
  const [cols, setCols] = useState(colsFor)
  useEffect(() => {
    const mqs = ['(min-width: 600px)', '(min-width: 1100px)'].map((q) => window.matchMedia(q))
    const on = () => setCols(colsFor())
    mqs.forEach((m) => m.addEventListener('change', on))
    return () => mqs.forEach((m) => m.removeEventListener('change', on))
  }, [])
  return cols
}

/** per-column vertical drop (in units of --drop) — gives the grid its editorial, staggered rhythm */
const DROPS: Record<number, number[]> = { 1: [0], 2: [0, 1], 3: [0, 1, 0.42] }
/** caption + gap, expressed in column widths — only used to balance columns */
const CAP_W = 0.2
const DROP_W = 0.25

interface Slot {
  c: number
  r: number
  n: number
}

function layout(items: Artwork[], cols: number) {
  const drops = DROPS[cols]
  const R = new Array(cols).fill(0)
  const N = new Array(cols).fill(0)
  const slots = new Map<string, Slot>()
  for (const a of items) {
    let best = 0
    let bestScore = Infinity
    for (let c = 0; c < cols; c++) {
      const score = R[c] + N[c] * CAP_W + drops[c] * DROP_W
      if (score < bestScore - 0.02) {
        best = c
        bestScore = score
      }
    }
    slots.set(a.slug, { c: best, r: R[best], n: N[best] })
    R[best] += a.h / a.w
    N[best] += 1
  }
  const f = (v: number) => +v.toFixed(4)
  const heights = R.map((r, c) => `calc(var(--colw) * ${f(r)} + ${N[c]} * (var(--cap) + var(--gap)) + ${drops[c]} * var(--drop))`)
  return { slots, height: `calc(max(${heights.join(', ')}) - var(--gap))` }
}

/* ───────── tilt — rAF-lerped toward the cursor, desktop only ───────── */
function useTilt(enabled: boolean) {
  return useMemo(() => {
    if (!enabled) return undefined
    const state = new WeakMap<HTMLElement, { tx: number; ty: number; x: number; y: number; raf: number }>()
    const get = (el: HTMLElement) => {
      let s = state.get(el)
      if (!s) state.set(el, (s = { tx: 0, ty: 0, x: 0, y: 0, raf: 0 }))
      return s
    }
    const run = (link: HTMLElement) => {
      const s = get(link)
      if (s.raf) return
      const tilt = link.querySelector<HTMLElement>('.gcard__tilt')
      const tick = () => {
        s.x += (s.tx - s.x) * 0.1
        s.y += (s.ty - s.y) * 0.1
        if (tilt) tilt.style.transform = `rotateX(${s.x.toFixed(3)}deg) rotateY(${s.y.toFixed(3)}deg)`
        if (Math.abs(s.tx - s.x) > 0.005 || Math.abs(s.ty - s.y) > 0.005) s.raf = requestAnimationFrame(tick)
        else s.raf = 0
      }
      s.raf = requestAnimationFrame(tick)
    }
    return {
      onPointerMove(e: RPointerEvent<HTMLElement>) {
        if (e.pointerType !== 'mouse') return
        const link = e.currentTarget
        const r = link.getBoundingClientRect()
        const px = (e.clientX - r.left) / r.width
        const py = (e.clientY - r.top) / r.height
        const s = get(link)
        s.tx = (0.5 - py) * 7
        s.ty = (px - 0.5) * 9
        link.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`)
        link.style.setProperty('--my', `${(py * 100).toFixed(1)}%`)
        run(link)
      },
      onPointerLeave(e: RPointerEvent<HTMLElement>) {
        const s = get(e.currentTarget)
        s.tx = s.ty = 0
        run(e.currentTarget)
      },
    }
  }, [enabled])
}

interface Props {
  /** slugs currently passing the filter */
  visible: Set<string>
}

export function GalleryGrid({ visible }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const cols = useColumns()
  const items = useMemo(() => artworks.filter((a) => visible.has(a.slug)), [visible])
  const { slots, height } = useMemo(() => layout(items, cols), [items, cols])
  const [tiltOn] = useState(() => isFinePointer() && !prefersReducedMotion())
  const tilt = useTilt(tiltOn)
  const lastViewed = useMemo(getLastViewed, [])
  const batch = useRef<ScrollTrigger[]>([])

  // Entrance: each card's image wipes up out of a mask as it scrolls in (after the preloader).
  useGsap(root, (ctx) => {
    if (prefersReducedMotion()) return
    // the card we just came back from is the view-transition target — it must be visible at once
    const cards = gsap.utils.toArray<HTMLElement>('.gcard:not(.is-hidden)').filter((c) => c.dataset.flipId !== lastViewed)
    const parts = (els: Element[]) => ({
      media: els.map((c) => c.querySelector('.gcard__media')),
      art: els.map((c) => c.querySelector('.art-image')),
      cap: els.map((c) => c.querySelector('.gcard__cap')),
    })
    const all = parts(cards)
    gsap.set(all.media, { clipPath: 'inset(100% 0% 0% 0%)' })
    gsap.set(all.art, { scale: 1.2 })
    gsap.set(all.cap, { autoAlpha: 0, y: 18 })
    return afterIntro(() =>
      ctx.add(() => {
        batch.current = ScrollTrigger.batch(cards, {
          start: 'top 94%',
          once: true,
          onEnter: (els) => {
            const p = parts(els)
            const vars = { stagger: 0.11, ease: 'expo.out' }
            gsap.to(p.media, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.35, ...vars })
            gsap.to(p.art, { scale: 1, duration: 1.8, ...vars })
            gsap.to(p.cap, { autoAlpha: 1, y: 0, duration: 1, delay: 0.25, ...vars })
          },
        })
      }),
    )
  }, [])

  // Once the user filters, everything left mid-entrance just settles (Flip owns the motion now).
  const lastVisible = useRef(visible)
  useLayoutEffect(() => {
    if (lastVisible.current === visible) return
    lastVisible.current = visible
    const el = root.current
    if (!el) return
    batch.current.forEach((t) => t.kill())
    batch.current = []
    const media = el.querySelectorAll('.gcard__media')
    const art = el.querySelectorAll('.gcard .art-image')
    const cap = el.querySelectorAll('.gcard__cap')
    gsap.killTweensOf([...media, ...art, ...cap])
    gsap.set(media, { clearProps: 'clipPath' })
    gsap.set(art, { clearProps: 'transform' })
    gsap.set(cap, { clearProps: 'opacity,visibility,transform' })
  }, [visible])

  // View-transition hygiene: at click time, only the clicked card keeps its `art-*` name.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const path = clickedPath(e)
      if (!path || !root.current) return
      root.current.querySelectorAll<HTMLElement>('.gcard').forEach((card) => {
        const img = card.querySelector<HTMLElement>('.art-image')
        if (img && path !== location.pathname)
          img.style.viewTransitionName = path === `/work/${card.dataset.flipId}` ? vtName(card.dataset.flipId!) : 'none'
      })
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  return (
    <div className="ggrid" ref={root} data-cols={cols}>
      <ul className="ggrid__stage" style={{ height }} aria-label="Artworks">
        {artworks.map((a, i) => {
          const slot = slots.get(a.slug)
          const style = slot
            ? ({ '--c': slot.c, '--r': +slot.r.toFixed(4), '--n': slot.n, '--d': DROPS[cols][slot.c] } as CSSProperties)
            : undefined
          return (
            <li key={a.slug} className={`gcard ${slot ? '' : 'is-hidden'}`} data-flip-id={a.slug} style={style}>
              <TLink
                to={`/work/${a.slug}`}
                className="gcard__link"
                data-cursor="View"
                aria-label={`${a.title} — ${eyebrowFor(a)}`}
                {...tilt}
              >
                <span className="gcard__tilt">
                  <span className="gcard__media">
                    <ArtImage
                      art={a}
                      sizes="(max-width: 599px) 92vw, (max-width: 1099px) 46vw, 31vw"
                      transitionName={a.slug === lastViewed ? vtName(a.slug) : undefined}
                      priority={i < 3}
                    />
                    <span className="gcard__sheen" aria-hidden="true" />
                  </span>
                </span>
                <span className="gcard__cap" aria-hidden="true">
                  <span className="gcard__title serif">{a.title}</span>
                  <span className="gcard__row">
                    <span className="gcard__num">{pad(i + 1)}</span>
                    <span className="gcard__slide">
                      <span className="gcard__meta">{eyebrowFor(a)}</span>
                      <span className="gcard__meta gcard__meta--hover">View piece →</span>
                    </span>
                    <span className="gcard__cats">{a.categories.join(', ')}</span>
                  </span>
                </span>
              </TLink>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
