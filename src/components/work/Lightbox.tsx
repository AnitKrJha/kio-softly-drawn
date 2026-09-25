import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import { ArrowLeft, ArrowRight, X, ZoomIn, ZoomOut } from 'lucide-react'
import { artworks, full } from '../../data/artworks'
import { getLenis } from '../../lib/scroll'
import { isFinePointer, prefersReducedMotion } from '../../lib/env'
import { pad, total, wrapIndex } from './shared'
import './Lightbox.css'

export interface LightboxRequest {
  index: number
  /** element the image grows out of (and returns to) — must show the same artwork at the same aspect */
  origin?: HTMLElement | null
  /** open already zoomed onto this focal point (0–1 fractions of the image) */
  focus?: { x: number; y: number }
}

interface Props extends LightboxRequest {
  /** index of the piece whose page we're on */
  pageIndex: number
  onClose: () => void
  onOpenPiece: (slug: string) => void
}

const ZOOM = 2.5
const FOCUSABLE = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
const clamp = (min: number, max: number, v: number) => Math.min(max, Math.max(min, v))

/**
 * Fullscreen viewer. Grows out of the page image, click/tap toggles a 2.5× zoom (pan follows the
 * mouse on desktop, drag on touch), ←/→ or swipe browse every piece, Esc closes back into place.
 */
export function Lightbox({ index: startIndex, origin, focus, pageIndex, onClose, onOpenPiece }: Props) {
  const [index, setIndex] = useState(startIndex)
  const [zoomed, setZoomed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const art = artworks[index]

  const root = useRef<HTMLDivElement>(null)
  const backdrop = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const ui = useRef<HTMLDivElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)

  // captured on first render (before we move focus) so it survives StrictMode's effect replay
  const [returnFocus] = useState(() => document.activeElement as HTMLElement | null)
  const indexRef = useRef(index)
  indexRef.current = index
  const busy = useRef(true)
  const closing = useRef(false)
  const dir = useRef(0)
  const fine = useRef(isFinePointer()).current
  const reduced = useRef(prefersReducedMotion()).current
  /** current (x,y,z) lerps toward target (tx,ty,tz) every frame */
  const view = useRef({ x: 0, y: 0, z: 1, tx: 0, ty: 0, tz: 1, k: 0.14 })
  const pointer = useRef({ nx: 0.5, ny: 0.5 })
  const drag = useRef<{ id: number; x: number; y: number; t: number; tx: number; ty: number; moved: boolean } | null>(null)

  /* ───────── zoom / pan maths ───────── */
  const limits = (z: number) => {
    const f = frame.current
    if (!f) return { mx: 0, my: 0 }
    return {
      mx: Math.max(0, (f.offsetWidth * z - innerWidth) / 2),
      my: Math.max(0, (f.offsetHeight * z - innerHeight) / 2),
    }
  }

  const panFromPointer = () => {
    const v = view.current
    const { mx, my } = limits(v.tz)
    v.tx = mx * (1 - 2 * pointer.current.nx)
    v.ty = my * (1 - 2 * pointer.current.ny)
  }

  /** zoom in/out. `at` = client point to zoom around (touch); `center` = client point to bring to the middle */
  const zoomTo = useCallback(
    (on: boolean, opts: { at?: { x: number; y: number }; center?: { x: number; y: number } } = {}) => {
      const v = view.current
      v.tz = on ? ZOOM : 1
      if (!on) {
        v.tx = v.ty = 0
      } else {
        const { mx, my } = limits(ZOOM)
        const p = opts.center ?? opts.at
        if (p) {
          const dx = p.x - innerWidth / 2
          const dy = p.y - innerHeight / 2
          const m = opts.center ? ZOOM : ZOOM - 1
          v.tx = clamp(-mx, mx, -dx * m)
          v.ty = clamp(-my, my, -dy * m)
          // keep the mouse mapping continuous so the first move doesn't jump
          pointer.current.nx = mx ? (1 - v.tx / mx) / 2 : 0.5
          pointer.current.ny = my ? (1 - v.ty / my) / 2 : 0.5
        } else if (fine) {
          panFromPointer()
        } else {
          v.tx = v.ty = 0
        }
      }
      setZoomed(on)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fine],
  )

  const resetView = () => {
    Object.assign(view.current, { x: 0, y: 0, z: 1, tx: 0, ty: 0, tz: 1 })
    if (stage.current) stage.current.style.transform = ''
    setZoomed(false)
  }

  // the custom cursor re-reads its label when it changes under a still pointer
  useEffect(() => {
    window.dispatchEvent(new Event('cursor:refresh'))
  }, [zoomed])

  /* ───────── render loop ───────── */
  useEffect(() => {
    let raf = 0
    let last = ''
    const tick = () => {
      const v = view.current
      const k = reduced ? 1 : v.k
      v.x += (v.tx - v.x) * k
      v.y += (v.ty - v.y) * k
      v.z += (v.tz - v.z) * k
      const t = `translate3d(${v.x.toFixed(2)}px, ${v.y.toFixed(2)}px, 0) scale(${v.z.toFixed(4)})`
      if (t !== last && stage.current) {
        stage.current.style.transform = t
        last = t
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduced])

  /* ───────── open ───────── */
  useLayoutEffect(() => {
    const f = frame.current!
    const b = backdrop.current!
    const u = ui.current!
    const done = () => {
      if (closing.current) return
      busy.current = false
      if (focus && frame.current) {
        const r = frame.current.getBoundingClientRect()
        zoomTo(true, { center: { x: r.left + focus.x * r.width, y: r.top + focus.y * r.height } })
      }
    }
    if (reduced) {
      gsap.set([b, u, f], { autoAlpha: 1 })
      done()
      return
    }
    // a context so an interrupted open (or StrictMode's double run) reverts cleanly
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ onComplete: done })
      tl.fromTo(b, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, ease: 'power2.out' }, 0)
      if (origin) {
        const o = origin.getBoundingClientRect()
        const t = f.getBoundingClientRect()
        tl.fromTo(
          f,
          { x: o.left + o.width / 2 - (t.left + t.width / 2), y: o.top + o.height / 2 - (t.top + t.height / 2), scale: o.width / t.width },
          { x: 0, y: 0, scale: 1, duration: 1.05, ease: 'expo.out' },
          0,
        )
        origin.style.visibility = 'hidden'
      } else {
        tl.fromTo(
          f,
          { autoAlpha: 0, scale: 0.94, clipPath: 'inset(10% 10% 10% 10% round 24px)' },
          { autoAlpha: 1, scale: 1, clipPath: 'inset(0% 0% 0% 0% round 0px)', duration: 1, ease: 'expo.out', clearProps: 'clipPath' },
          0.05,
        )
      }
      // opacity only (not autoAlpha) so the close button can take focus straight away
      tl.fromTo(u, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0.4)
    })
    return () => {
      if (!closing.current) ctx.revert()
      if (origin) origin.style.visibility = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ───────── close ───────── */
  const close = useCallback(() => {
    if (closing.current) return
    closing.current = true
    busy.current = true
    Object.assign(view.current, { tx: 0, ty: 0, tz: 1, k: 0.22 })
    const f = frame.current
    gsap.killTweensOf([f, backdrop.current, ui.current])
    const finish = () => {
      if (origin) origin.style.visibility = ''
      onClose()
    }
    if (reduced || !f) return finish()
    const back = !!origin && origin.isConnected && indexRef.current === startIndex
    const tl = gsap.timeline({ onComplete: finish })
    tl.to(ui.current, { autoAlpha: 0, duration: 0.25, ease: 'power1.out' }, 0)
    tl.to(backdrop.current, { autoAlpha: 0, duration: 0.65, ease: 'power2.inOut' }, back ? 0.2 : 0)
    if (back) {
      const o = origin!.getBoundingClientRect()
      const t = f.getBoundingClientRect()
      tl.to(
        f,
        {
          x: o.left + o.width / 2 - (t.left + t.width / 2),
          y: o.top + o.height / 2 - (t.top + t.height / 2),
          scale: o.width / t.width,
          duration: 0.85,
          ease: 'expo.inOut',
        },
        0,
      )
    } else {
      if (origin) origin.style.visibility = ''
      tl.to(f, { autoAlpha: 0, scale: 0.94, duration: 0.45, ease: 'power2.in' }, 0)
    }
  }, [origin, onClose, reduced, startIndex])

  /* ───────── browse ───────── */
  const step = useCallback(
    (d: number) => {
      if (busy.current || closing.current) return
      busy.current = true
      dir.current = d
      const swap = () => {
        resetView()
        setLoaded(false)
        setIndex((i) => wrapIndex(i + d))
      }
      if (reduced || !frame.current) return swap()
      gsap.to(frame.current, { x: -d * 70, autoAlpha: 0, duration: 0.28, ease: 'power2.in', overwrite: true, onComplete: swap })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reduced],
  )

  const shownIndex = useRef(index)
  useLayoutEffect(() => {
    if (shownIndex.current === index) return
    shownIndex.current = index
    busy.current = false
    if (reduced || !frame.current) return
    gsap.fromTo(frame.current, { x: dir.current * 70, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.75, ease: 'expo.out', overwrite: true })
  }, [index, reduced])

  // warm the neighbours so browsing is instant
  useEffect(() => {
    ;[wrapIndex(index - 1), wrapIndex(index + 1)].forEach((i) => {
      const img = new Image()
      img.decoding = 'async'
      img.src = full(artworks[i])
    })
  }, [index])

  /* ───────── scroll lock, focus in/out ───────── */
  useLayoutEffect(() => {
    const html = document.documentElement
    const prev = { overflow: html.style.overflow, pad: html.style.paddingRight }
    const sbw = innerWidth - html.clientWidth
    getLenis()?.stop()
    html.style.overflow = 'hidden'
    if (sbw > 0) html.style.paddingRight = `${sbw}px`
    const lastFocus = returnFocus
    closeBtn.current?.focus({ preventScroll: true })
    return () => {
      html.style.overflow = prev.overflow
      html.style.paddingRight = prev.pad
      getLenis()?.start()
      lastFocus?.focus?.({ preventScroll: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ───────── keyboard ───────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        step(e.key === 'ArrowLeft' ? -1 : 1)
      } else if (e.key === 'Tab' && root.current) {
        const items = [...root.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        const active = document.activeElement
        if (e.shiftKey && (active === first || !root.current.contains(active))) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && (active === last || !root.current.contains(active))) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close, step])

  /* ───────── pointer ───────── */
  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const v = view.current
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), tx: v.tx, ty: v.ty, moved: false }
    if (e.pointerType !== 'mouse') e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const v = view.current
    const d = drag.current
    if (d && d.id === e.pointerId && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) d.moved = true
    if (e.pointerType === 'mouse') {
      pointer.current.nx = e.clientX / innerWidth
      pointer.current.ny = e.clientY / innerHeight
      if (v.tz > 1) panFromPointer()
      return
    }
    if (!d || d.id !== e.pointerId || v.tz === 1) return
    const { mx, my } = limits(v.tz)
    v.k = 0.35
    v.tx = clamp(-mx, mx, d.tx + e.clientX - d.x)
    v.ty = clamp(-my, my, d.ty + e.clientY - d.y)
  }

  const onPointerUp = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    drag.current = null
    const v = view.current
    v.k = 0.14
    if (!d || d.id !== e.pointerId || busy.current) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved) {
      // tap / click
      if (v.tz > 1) return zoomTo(false)
      const r = frame.current?.getBoundingClientRect()
      const inside = !!r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
      if (!inside) return close()
      return zoomTo(true, e.pointerType === 'mouse' ? {} : { at: { x: e.clientX, y: e.clientY } })
    }
    // swipe to browse (touch, unzoomed)
    if (e.pointerType !== 'mouse' && v.tz === 1 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.3 && performance.now() - d.t < 700) {
      step(dx < 0 ? 1 : -1)
    }
  }

  const frameStyle = {
    '--ar': art.w / art.h,
    backgroundColor: art.color,
    backgroundImage: `url(${art.lqip})`,
  } as CSSProperties

  const prevArt = artworks[wrapIndex(index - 1)]
  const nextArt = artworks[wrapIndex(index + 1)]

  return createPortal(
    <div className="lb" ref={root} role="dialog" aria-modal="true" aria-label={`${art.title} — full-size view`} data-lenis-prevent>
      <div className="lb__backdrop" ref={backdrop} aria-hidden="true" />

      <div
        className={`lb__viewport ${zoomed ? 'is-zoomed' : ''}`}
        data-cursor={zoomed ? 'Out' : 'Zoom'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
      >
        <div className="lb__frame" ref={frame} style={frameStyle}>
          <div className="lb__stage" ref={stage}>
            <img
              key={art.slug}
              className={loaded ? 'is-loaded' : ''}
              src={full(art)}
              width={art.w}
              height={art.h}
              alt={`${art.title} — digital illustration by Kio, full size`}
              decoding="async"
              draggable={false}
              onLoad={() => setLoaded(true)}
              ref={(el) => {
                if (el?.complete && el.naturalWidth) setLoaded(true)
              }}
            />
          </div>
        </div>
      </div>

      <div className="lb__ui" ref={ui}>
        <div className="lb__bar lb__bar--top">
          <p className="lb__count">
            <span className="accent">{pad(index + 1)}</span> / {pad(total)}
          </p>
          <p className="lb__title serif" aria-live="polite">
            {art.title}
          </p>
          <button ref={closeBtn} type="button" className="lb__btn" onClick={close} aria-label="Close full-size view">
            <X size={20} strokeWidth={1.6} aria-hidden="true" />
          </button>
        </div>

        <button type="button" className="lb__btn lb__nav lb__nav--prev" onClick={() => step(-1)} aria-label={`Previous piece: ${prevArt.title}`}>
          <ArrowLeft size={20} strokeWidth={1.6} aria-hidden="true" />
        </button>
        <button type="button" className="lb__btn lb__nav lb__nav--next" onClick={() => step(1)} aria-label={`Next piece: ${nextArt.title}`}>
          <ArrowRight size={20} strokeWidth={1.6} aria-hidden="true" />
        </button>

        <div className="lb__bar lb__bar--bottom">
          <button
            type="button"
            className="lb__pill lb__pill--zoom"
            onClick={() => zoomTo(!zoomed)}
            aria-pressed={zoomed}
            aria-label={zoomed ? 'Zoom out' : 'Zoom in'}
          >
            {zoomed ? <ZoomOut size={16} aria-hidden="true" /> : <ZoomIn size={16} aria-hidden="true" />}
            <span>{zoomed ? 'Zoom out' : 'Zoom in'}</span>
          </button>
          <p className="lb__hint">{fine ? 'Click to zoom · ← → to browse · Esc to close' : 'Tap to zoom · swipe to browse'}</p>
          {index !== pageIndex && (
            <button type="button" className="lb__pill lb__pill--solid" onClick={() => onOpenPiece(art.slug)}>
              Open this piece <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
