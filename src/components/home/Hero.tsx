import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import type { HeroGL } from '../../gl/HeroGL'
import { artworks, caption as captionFor, type Artwork } from '../../data/artworks'
import { site } from '../../data/site'
import { canRunHeavyGL } from '../../lib/env'
import { introDone } from '../../lib/intro'
import { scrollToTarget, scrollVelocity } from '../../lib/scroll'
import { TLink, useTransitionNavigate } from '../../lib/transition'
import { useGsap } from '../../lib/useGsap'
import { Seal } from '../shared/Seal'
import { HeroFallback } from './HeroFallback'
import './Hero.css'

gsap.registerPlugin(ScrollTrigger, SplitText)

export function Hero() {
  const root = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const caption = useRef<HTMLDivElement>(null)
  const gl = useRef<HeroGL | null>(null)
  const progress = useRef(0)
  const [wantsGL] = useState(canRunHeavyGL)
  const [glFailed, setGlFailed] = useState(false)
  const [hovered, setHovered] = useState<Artwork | null>(null)
  // keep the last piece rendered while the caption fades out
  const [captioned, setCaptioned] = useState<Artwork | null>(null)
  const useGL = wantsGL && !glFailed

  const navigate = useTransitionNavigate()
  const navRef = useRef(navigate)
  useLayoutEffect(() => {
    navRef.current = navigate
  }, [navigate])

  /* ── WebGL ring (desktop): code-split, created once, torn down on unmount ── */
  useEffect(() => {
    const container = stage.current
    if (!useGL || !container) return
    let cancelled = false
    let engine: HeroGL | null = null

    import('../../gl/HeroGL')
      .then(({ HeroGL }) => {
        if (cancelled) return
        try {
          engine = new HeroGL({
            container,
            artworks,
            getVelocity: scrollVelocity,
            onHover: (art) => {
              container.dataset.cursor = art ? 'View' : 'Drag'
              window.dispatchEvent(new Event('cursor:refresh'))
              setHovered(art)
              if (art) setCaptioned(art)
            },
            onSelect: (art) => navRef.current(`/work/${art.slug}`),
          })
        } catch {
          setGlFailed(true)
          return
        }
        gl.current = engine
        engine.setProgress(progress.current)
        const e = engine
        Promise.all([introDone, e.ready]).then(() => {
          if (cancelled) return
          container.classList.add('is-live')
          e.reveal()
        })
      })
      .catch(() => {
        if (!cancelled) setGlFailed(true)
      })

    return () => {
      cancelled = true
      engine?.dispose()
      gl.current = null
      container.classList.remove('is-live')
      container.dataset.cursor = 'Drag'
    }
  }, [useGL])

  /* ── floating caption follows the pointer while a canvas is hovered ── */
  useEffect(() => {
    const el = caption.current
    if (!useGL || !el) return
    const x = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' })
    const y = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' })
    let first = true
    const onMove = (e: PointerEvent) => {
      if (first) {
        gsap.set(el, { x: e.clientX, y: e.clientY })
        first = false
      }
      x(e.clientX)
      y(e.clientY)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      gsap.killTweensOf(el)
    }
  }, [useGL])

  /* ── entrance after the intro + scroll-out ── */
  useGsap(
    root,
    () => {
      const mm = gsap.matchMedia()
      let live = true

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const lines = gsap.utils.toArray<HTMLElement>('.hero__line-inner')
        const splits = lines.map((l) => SplitText.create(l, { type: 'chars', charsClass: 'hero__char', aria: 'hidden' }))
        const chars = splits.flatMap((s) => s.chars)
        const fades = gsap.utils.toArray<HTMLElement>('[data-hero-in]')
        const deck = root.current?.querySelector('.hero-deck__enter')

        gsap.set(chars, { yPercent: 118, rotate: 5, transformOrigin: '0% 100%' })
        gsap.set(fades, { y: 24, opacity: 0 })
        if (deck) gsap.set(deck, { y: 60, opacity: 0, scale: 0.94 })

        const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } })
        tl.to(chars, { yPercent: 0, rotate: 0, duration: 1.5, stagger: 0.045 }, 0.1)
          .to(fades, { y: 0, opacity: 1, duration: 1.2, stagger: 0.07, clearProps: 'transform' }, 0.45)
        if (deck) tl.to(deck, { y: 0, opacity: 1, scale: 1, duration: 1.6, clearProps: 'transform' }, 0.2)

        introDone.then(() => {
          if (live) tl.play()
        })
        return () => splits.forEach((s) => s.revert())
      })

      // scroll-out: overlay drifts up and fades (each block is a separate target so the
      // title stays in the section's stacking context for its blend mode)
      const out = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: root.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
          onUpdate: (self) => {
            progress.current = self.progress
            gl.current?.setProgress(self.progress)
          },
        },
      })
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        out
          .to('.hero__title', { yPercent: -28, opacity: 0, duration: 0.8 }, 0)
          .to('.hero__top', { y: -40, opacity: 0, duration: 0.45 }, 0)
          .to('.hero__aside', { y: -90, opacity: 0, duration: 0.6 }, 0)
          .to('.hero__meta', { y: -40, opacity: 0, duration: 0.35 }, 0)
          .to('.hero-deck', { yPercent: 18, scale: 0.94, opacity: 0.4, duration: 1 }, 0)
      })

      return () => {
        live = false
        mm.revert()
      }
    },
    [useGL],
  )

  const scrollOn = () => {
    const next = root.current?.nextElementSibling as HTMLElement | null
    if (next) scrollToTarget(next)
  }

  const rating = site.fiverr

  return (
    <section
      ref={root}
      className={`hero ${useGL ? 'hero--gl' : 'hero--fallback'}`}
      data-theme="dark"
      aria-labelledby="hero-title"
    >
      <div className="hero__glow" aria-hidden="true" />

      {useGL && <div ref={stage} className="hero__stage" data-cursor="Drag" aria-hidden="true" />}

      <div className="hero__scrim" aria-hidden="true" />

      <div className="hero__overlay container">
        <div className="hero__top">
          <p className="eyebrow hero__eyebrow" data-hero-in>
            by {site.artist} — {site.role}
          </p>
          {useGL && (
            <p className="hero__hint" data-hero-in aria-hidden="true">
              Drag to turn · click a piece to open it
            </p>
          )}
        </div>

        {!useGL && (
          <div className="hero__deck-slot">
            <HeroFallback />
          </div>
        )}

        <div className="hero__main">
          <h1 id="hero-title" className="hero__title display" aria-label="Softly drawn.">
            <span className="hero__line">
              <span className="hero__line-inner">Softly</span>
            </span>
            <span className="hero__line hero__line--2">
              <span className="hero__line-inner">
                <em>drawn.</em>
              </span>
            </span>
          </h1>

          <div className="hero__aside">
            <p className="hero__intro" data-hero-in>
              {site.tagline}
            </p>
            <div className="hero__ctas">
              <span data-hero-in>
                <TLink to="/work" className="btn" data-cursor="View">
                  View the work <ArrowRight size={16} aria-hidden="true" />
                </TLink>
              </span>
              <span data-hero-in>
                <TLink to="/contact" className="btn btn--ghost">
                  Work with me
                </TLink>
              </span>
            </div>
          </div>
        </div>

        <div className="hero__meta">
          <div className="hero__meta-start">
            <span data-hero-in>
              <TLink to="/contact" className="chip hero__status">
                <span className="dot-live" aria-hidden="true" />
                {site.status}
              </TLink>
            </span>
            <span data-hero-in>
              <a
                href={rating.url}
                target="_blank"
                rel="noreferrer"
                className="hero__rating"
                data-cursor="Open"
                aria-label={`Rated ${rating.rating} out of 5 on Fiverr from ${rating.reviewCount} reviews (opens in a new tab)`}
              >
                <span className="hero__star" aria-hidden="true">
                  ★
                </span>
                <span className="link">
                  {rating.rating} on {rating.label}
                </span>
                <ArrowUpRight size={13} aria-hidden="true" />
              </a>
            </span>
          </div>
          <div className="hero__meta-end">
            <span data-hero-in className="hero__seal-wrap">
              <Seal size={68} className="hero__seal" />
            </span>
            <span data-hero-in className="hero__scroll-wrap">
              <button type="button" className="hero__scroll" onClick={scrollOn}>
                <span>Scroll</span>
                <span className="hero__scroll-line" aria-hidden="true" />
              </button>
            </span>
          </div>
        </div>
      </div>

      {useGL && (
        <div ref={caption} className={`hero__caption ${hovered ? 'is-on' : ''}`} aria-hidden="true">
          <div className="hero__caption-card">
            <span className="hero__caption-title serif">{captioned?.title}</span>
            <span className="hero__caption-meta">
              {captioned ? captionFor(captioned) : ''}
            </span>
          </div>
        </div>
      )}
    </section>
  )
}
