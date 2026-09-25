import { Fragment, useRef, type CSSProperties } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowUpRight } from 'lucide-react'
import { useGsap } from '../../lib/useGsap'
import { TLink } from '../../lib/transition'
import { ArtImage } from '../shared/ArtImage'
import { Socials } from '../shared/Socials'
import { bySlug } from '../../data/artworks'
import { site } from '../../data/site'
import { reviews } from '../../data/reviews'
import './About.css'

gsap.registerPlugin(ScrollTrigger)

/*
 * Manifesto copy. Plain strings are split into words (`_word_` = italic);
 * `{ art }` drops a tiny artwork pill into the sentence.
 */
type Token = string | { art: string }
const MANIFESTO: Token[] = [
  'I draw characters',
  { art: 'hush' },
  'who feel like they could _breathe_ — soft',
  { art: 'candlelit-library' },
  'light, natural expressions, and the quiet details that make someone',
  { art: 'rose-garden' },
  '_yours._',
]

type Piece = { kind: 'word'; text: string; italic: boolean } | { kind: 'art'; slug: string }

const pieces: Piece[] = MANIFESTO.flatMap((t): Piece[] =>
  typeof t === 'string'
    ? t
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => {
          const italic = w.startsWith('_') && w.endsWith('_')
          return { kind: 'word', text: italic ? w.slice(1, -1) : w, italic }
        })
    : [{ kind: 'art', slug: t.art }],
)

// Facts — derived from data only, never typed in by hand.
const days = reviews.map((r) => parseInt(r.duration, 10)).filter(Number.isFinite)
const turnaround = days.length ? `${Math.min(...days)}–${Math.max(...days)} days` : ''

const FIGURE_SLUG = 'hush'

export function About() {
  const root = useRef<HTMLElement>(null)
  const figureArt = bySlug(FIGURE_SLUG)

  useGsap(root, () => {
    const section = root.current!
    const mm = gsap.matchMedia()

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      // 1 · Manifesto: words ink in from faint to full, pills unclip as they're reached.
      const manifesto = section.querySelector<HTMLElement>('.about__manifesto')!
      const items = [...manifesto.querySelectorAll<HTMLElement>('.about__word, .about__pill')]
      const tl = gsap.timeline({
        scrollTrigger: { trigger: manifesto, start: 'top 78%', end: 'bottom 42%', scrub: 0.5 },
      })
      const step = 0.22
      items.forEach((el, i) => {
        if (el.classList.contains('about__pill')) {
          const clip = el.querySelector('.about__pill-clip')
          const img = el.querySelector('.about__pill-img')
          tl.fromTo(
            clip,
            { clipPath: 'inset(0% 50% 0% 50% round 999px)' },
            { clipPath: 'inset(0% 0% 0% 0% round 999px)', duration: 1.1, ease: 'power2.out' },
            i * step,
          ).fromTo(img, { scale: 1.7 }, { scale: 1, duration: 1.4, ease: 'power2.out' }, i * step)
        } else {
          tl.fromTo(el, { opacity: 0.14 }, { opacity: 1, duration: 0.5, ease: 'none' }, i * step)
        }
      })

      // 2 · Figure: unclip on enter, then a slow parallax drift for as long as it's on screen.
      const frame = section.querySelector<HTMLElement>('.about__frame-clip')
      const inner = section.querySelector<HTMLElement>('.about__frame-inner')
      if (frame && inner) {
        gsap.fromTo(
          frame,
          { clipPath: 'inset(10% 10% 10% 10% round 28px)' },
          {
            clipPath: 'inset(0% 0% 0% 0% round 14px)',
            duration: 1.6,
            ease: 'expo.out',
            scrollTrigger: { trigger: frame, start: 'top 85%', once: true },
          },
        )
        gsap.fromTo(
          inner,
          { yPercent: -7 },
          { yPercent: 7, ease: 'none', scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: true } },
        )
      }

      // 3 · Text column settles in, line by line.
      const text = section.querySelectorAll<HTMLElement>('.about__reveal')
      gsap.from(text, {
        y: 28,
        opacity: 0,
        duration: 1.1,
        ease: 'expo.out',
        stagger: 0.08,
        clearProps: 'transform,opacity',
        scrollTrigger: { trigger: section.querySelector('.about__text'), start: 'top 82%', once: true },
      })
    })

    return () => mm.revert()
  })

  return (
    <section id="about" data-theme="light" className="about section" ref={root} aria-labelledby="about-title">
      <div className="container">
        <h2 id="about-title" className="visually-hidden">
          About Kio
        </h2>

        <div className="about__intro">
          <p className="about__eyebrow eyebrow" aria-hidden="true">
            About
          </p>
          <p className="about__manifesto display">
            {pieces.map((p, i) => {
              if (p.kind === 'art') {
                const art = bySlug(p.slug)
                if (!art) return null
                return (
                  <Fragment key={i}>
                    <span
                      className="about__pill"
                      aria-hidden="true"
                      style={{ '--fx': `${art.details[0]?.x ?? 50}%`, '--fy': `${art.details[0]?.y ?? 50}%` } as CSSProperties}
                    >
                      <span className="about__pill-clip">
                        <span className="about__pill-img">
                          {/* no transitionName — those are reserved for the gallery + piece page */}
                          <ArtImage art={art} cover sizes="12rem" alt="" />
                        </span>
                      </span>
                    </span>{' '}
                  </Fragment>
                )
              }
              const Tag = p.italic ? 'em' : 'span'
              return (
                <Fragment key={i}>
                  <Tag className="about__word">{p.text}</Tag>{' '}
                </Fragment>
              )
            })}
          </p>
        </div>

        <div className="about__body">
          {figureArt && (
            <figure className="about__figure">
              {/* TODO(kio): artist avatar/photo? Until then, a personal piece stands in — never a fake portrait. */}
              <TLink
                to={`/work/${figureArt.slug}`}
                className="about__frame"
                data-cursor="View"
                aria-label={`View ${figureArt.title}`}
              >
                <span className="about__frame-clip">
                  <span className="about__frame-inner">
                    <ArtImage
                      art={figureArt}
                      cover
                      sizes="(max-width: 899px) 90vw, 40vw"
                      alt={`${figureArt.title} — ${figureArt.kind.toLowerCase()} illustration by Kio`}
                    />
                  </span>
                </span>
              </TLink>
              <figcaption className="about__caption">
                <em className="serif">{figureArt.title}</em>
                <span className="muted"> — {figureArt.kind.toLowerCase()} work</span>
              </figcaption>
            </figure>
          )}

          <div className="about__text">
            <p className="eyebrow about__reveal">The artist</p>
            <p className="about__lead serif about__reveal">{site.bio[0]}</p>
            {site.bio.slice(1).map((para) => (
              <p key={para} className="about__para muted about__reveal">
                {para}
              </p>
            ))}

            <ul className="about__facts">
              <li className="about__fact about__reveal">
                <span className="about__fact-k eyebrow">Rating</span>
                <span className="about__fact-v">
                  <a href={site.fiverr.url} target="_blank" rel="noreferrer" className="about__fact-link" data-cursor="Open">
                    <span className="link">
                      {site.fiverr.rating}★ on {site.fiverr.label}
                    </span>
                    <ArrowUpRight size={16} aria-hidden="true" />
                    <span className="visually-hidden"> (opens in a new tab)</span>
                  </a>
                  <span className="muted about__fact-sub">
                    from {site.fiverr.reviewCount} reviews
                  </span>
                </span>
              </li>
              {turnaround && (
                <li className="about__fact about__reveal">
                  <span className="about__fact-k eyebrow">Turnaround</span>
                  <span className="about__fact-v">Past orders delivered in {turnaround}</span>
                </li>
              )}
              <li className="about__fact about__reveal">
                <span className="about__fact-k eyebrow">Process</span>
                <span className="about__fact-v">Every piece hand-drawn — no AI</span>
              </li>
            </ul>

            <div className="about__elsewhere about__reveal">
              <p className="eyebrow">Find me</p>
              <Socials className="about__socials" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
