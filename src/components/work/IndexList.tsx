import { useEffect, useRef, useState, type CSSProperties } from 'react'
import gsap from 'gsap'
import { artworks } from '../../data/artworks'
import { ArtImage } from '../shared/ArtImage'
import { TLink } from '../../lib/transition'
import { useGsap } from '../../lib/useGsap'
import { isFinePointer, prefersReducedMotion } from '../../lib/env'
import { afterIntro, pad } from './shared'
import './IndexList.css'

interface Props {
  visible: Set<string>
}

/**
 * Large typographic rows. On desktop a single floating preview trails the cursor (lerped, leaning
 * into its own velocity). On touch, each row carries its own small thumbnail instead.
 */
export function IndexList({ visible }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const preview = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<number | null>(null)
  const [hovering, setHovering] = useState(false)

  useGsap(root, (ctx) => {
    if (prefersReducedMotion()) return
    // animate the inner link, never the <li> — Flip owns the rows' transforms when filtering
    const rows = gsap.utils.toArray<HTMLElement>('.irow:not(.is-hidden) .irow__link')
    gsap.set(rows, { autoAlpha: 0, y: 40 })
    gsap.set('.irow__rule', { scaleX: 0 })
    return afterIntro(() =>
      ctx.add(() => {
        gsap.to(rows, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.07, delay: 0.05 })
        gsap.to('.irow__rule', { scaleX: 1, duration: 1.4, ease: 'expo.inOut', stagger: 0.07 })
      }),
    )
  }, [])

  // Floating preview: follow the pointer with a soft lerp; tilt with horizontal velocity.
  useEffect(() => {
    const el = preview.current
    const list = root.current
    if (!el || !list || !isFinePointer()) return
    const reduced = prefersReducedMotion()
    const s = { x: innerWidth / 2, y: innerHeight / 2, tx: innerWidth / 2, ty: innerHeight / 2, r: 0 }
    let raf = 0
    let primed = false
    const tick = () => {
      const k = reduced ? 1 : 0.13
      const dx = (s.tx - s.x) * k
      s.x += dx
      s.y += (s.ty - s.y) * k
      s.r += (gsap.utils.clamp(-9, 9, dx * 0.35) - s.r) * 0.12
      el.style.transform = `translate3d(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px, 0) rotate(${s.r.toFixed(2)}deg)`
      raf = Math.abs(s.tx - s.x) > 0.1 || Math.abs(s.ty - s.y) > 0.1 || Math.abs(s.r) > 0.02 ? requestAnimationFrame(tick) : 0
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      s.tx = e.clientX
      s.ty = e.clientY
      if (!primed) {
        // first contact: appear under the cursor rather than flying in from the middle
        s.x = s.tx
        s.y = s.ty
        primed = true
      }
      if (!raf) raf = requestAnimationFrame(tick)
    }
    const onLeave = () => (primed = false)
    list.addEventListener('pointermove', onMove)
    list.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(raf)
      list.removeEventListener('pointermove', onMove)
      list.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return (
    <div
      className={`ilist ${hovering ? 'is-hovering' : ''}`}
      ref={root}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHovering(true)}
      onPointerLeave={() => {
        setHovering(false)
        setActive(null)
      }}
    >
      <div className="ilist__head eyebrow" aria-hidden="true">
        <span>No.</span>
        <span>Title</span>
        <span className="ilist__col">Type</span>
        <span className="ilist__col">Category</span>
        <span className="ilist__col">Year</span>
      </div>
      <ol className="ilist__rows">
        {artworks.map((a, i) => (
          <li
            key={a.slug}
            className={`irow ${visible.has(a.slug) ? '' : 'is-hidden'} ${active === i ? 'is-active' : ''}`}
            data-flip-id={a.slug}
          >
            <span className="irow__rule" aria-hidden="true" />
            <TLink
              to={`/work/${a.slug}`}
              className="irow__link"
              data-cursor="View"
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
            >
              <span className="irow__num">{pad(i + 1)}</span>
              <span className="irow__thumb" aria-hidden="true">
                <ArtImage art={a} cover sizes="96px" alt="" />
              </span>
              <span className="irow__main">
                <span className="irow__title display">{a.title}</span>
                <span className="irow__sub">
                  {[a.kind, ...a.categories, a.year].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="irow__col irow__kind">{a.kind}</span>
              <span className="irow__col irow__cats">{a.categories.join(', ')}</span>
              <span className="irow__col irow__year">{a.year ?? ''}</span>
              <span className="irow__arrow" aria-hidden="true">
                →
              </span>
            </TLink>
          </li>
        ))}
      </ol>

      {/* one follower, six stacked frames — the hovered one un-masks */}
      <div className={`ilist__preview ${hovering && active !== null ? 'is-on' : ''}`} ref={preview} aria-hidden="true">
        {artworks.map((a, i) => (
          <span
            key={a.slug}
            className={`ilist__pv ${active === i ? 'is-active' : ''}`}
            style={{ aspectRatio: `${a.w} / ${a.h}`, '--ar': a.w / a.h } as CSSProperties}
          >
            <ArtImage art={a} cover sizes="360px" alt="" />
          </span>
        ))}
      </div>
    </div>
  )
}
