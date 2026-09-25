import { useRef } from 'react'
import gsap from 'gsap'
import { TLink } from '../lib/transition'
import { useGsap } from '../lib/useGsap'
import { useSectionThemes } from '../lib/theme'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { prefersReducedMotion } from '../lib/env'
import { afterIntro } from '../components/work/shared'
import './NotFound.css'

/* A loose pencil test: a line that wanders, loops twice, and trails off. */
const SQUIGGLE =
  'M8 92 C 40 60, 62 40, 96 62 S 132 118, 168 88 S 196 18, 232 36 C 262 52, 250 96, 222 92 C 196 88, 204 42, 246 40 S 312 84, 344 70 C 372 58, 380 30, 408 34 C 436 38, 432 78, 408 80 C 384 82, 392 46, 428 44 S 488 66, 512 58'

export function NotFound() {
  useDocumentTitle('Not found')
  useSectionThemes()
  const root = useRef<HTMLElement>(null)

  useGsap(root, (ctx) => {
    const paths = gsap.utils.toArray<SVGPathElement>('.nf__stroke')
    paths.forEach((p) => {
      const len = p.getTotalLength()
      gsap.set(p, { strokeDasharray: len, strokeDashoffset: prefersReducedMotion() ? 0 : len })
    })
    if (prefersReducedMotion()) return
    gsap.set('.nf__fade', { autoAlpha: 0, y: 24 })
    gsap.set('.nf__dot', { scale: 0, transformOrigin: '50% 50%' })
    return afterIntro(() =>
      ctx.add(() => {
        const tl = gsap.timeline({ delay: 0.2 })
        const [ghost, main] = paths
        tl.to(main, { strokeDashoffset: 0, duration: 2.2, ease: 'power2.inOut' })
          .to(ghost, { strokeDashoffset: 0, duration: 1.8, ease: 'power1.inOut' }, 0.45)
          .to('.nf__dot', { scale: 1, duration: 0.6, ease: 'back.out(3)' }, '-=0.35')
          .to('.nf__fade', { autoAlpha: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08 }, 0.4)
      }),
    )
  }, [])

  return (
    <section className="nf container" data-theme="dark" ref={root}>
      <svg className="nf__art" viewBox="0 0 520 130" fill="none" aria-hidden="true">
        <defs>
          {/* a touch of wobble so it reads as graphite, not vector */}
          <filter id="nf-pencil" x="-5%" y="-20%" width="110%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" />
          </filter>
        </defs>
        <g filter="url(#nf-pencil)" strokeLinecap="round" strokeLinejoin="round">
          <path className="nf__stroke nf__stroke--ghost" d={SQUIGGLE} transform="translate(3 5)" />
          <path className="nf__stroke nf__stroke--main" d={SQUIGGLE} />
        </g>
        <circle className="nf__dot" cx="512" cy="58" r="5" />
      </svg>

      <p className="eyebrow nf__fade">Error 404</p>
      <h1 className="nf__title display nf__fade">
        This page hasn’t been <em>drawn</em> yet.
      </h1>
      <p className="nf__lede muted nf__fade">The link may be old, or the sketch never made it off the page.</p>
      <div className="nf__actions nf__fade">
        <TLink to="/" className="btn">
          Back home
        </TLink>
        <TLink to="/work" className="btn btn--ghost">
          See the gallery
        </TLink>
      </div>
    </section>
  )
}
