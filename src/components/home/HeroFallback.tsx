import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { artworks, bySlug, caption, type Artwork } from '../../data/artworks'
import { prefersReducedMotion } from '../../lib/env'
import { TLink } from '../../lib/transition'
import { ArtImage } from '../shared/ArtImage'
import { Seal } from '../shared/Seal'

const DECK = ['autumn-beanie', 'vows-in-bloom', 'moonlit-pond', 'celestial-sentinel']
const CYCLE_MS = 3500

const deckArt = (): Artwork[] => {
  const picked = DECK.map((s) => bySlug(s)).filter((a): a is Artwork => !!a)
  return picked.length >= 3 ? picked : artworks.slice(0, 4)
}

/**
 * The phone (and no-WebGL / reduced-motion) hero: a fanned deck of real pieces that deals itself
 * every few seconds. Transform/opacity only; pauses offscreen, in background tabs and on hover/focus.
 */
export function HeroFallback() {
  const [cards] = useState(deckArt)
  const [active, setActive] = useState(0)
  const [cycled, setCycled] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const n = cards.length

  useEffect(() => {
    const el = root.current
    if (!el || n < 2 || prefersReducedMotion()) return
    let inView = true
    let held = false
    let timer = 0
    const schedule = () => {
      clearTimeout(timer)
      if (!inView || held || document.hidden) return
      timer = window.setTimeout(() => {
        setActive((a) => (a + 1) % n)
        setCycled(true)
        schedule()
      }, CYCLE_MS)
    }
    const io = new IntersectionObserver(([e]) => {
      inView = e.isIntersecting
      schedule()
    })
    io.observe(el)
    const hold = (v: boolean) => () => {
      held = v
      schedule()
    }
    const onEnter = hold(true)
    const onLeave = hold(false)
    const onVis = () => schedule()
    el.addEventListener('pointerenter', onEnter)
    el.addEventListener('pointerleave', onLeave)
    el.addEventListener('focusin', onEnter)
    el.addEventListener('focusout', onLeave)
    document.addEventListener('visibilitychange', onVis)
    schedule()
    return () => {
      clearTimeout(timer)
      io.disconnect()
      el.removeEventListener('pointerenter', onEnter)
      el.removeEventListener('pointerleave', onLeave)
      el.removeEventListener('focusin', onEnter)
      el.removeEventListener('focusout', onLeave)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [n])

  return (
    <div className="hero-deck" ref={root}>
      <div className="hero-deck__enter">
        <div className="hero-deck__float">
          <ul className="hero-deck__cards" aria-label="A few recent pieces">
            {cards.map((art, i) => {
              const pos = (i - active + n) % n
              return (
                <li
                  key={art.slug}
                  className={`hero-card ${cycled && pos === n - 1 ? 'is-tucking' : ''}`}
                  data-pos={pos}
                  style={{ '--pos': pos } as CSSProperties}
                >
                  <TLink
                    to={`/work/${art.slug}`}
                    className="hero-card__link"
                    data-cursor="View"
                    aria-label={`${art.title} — ${caption(art).toLowerCase()}`}
                  >
                    <ArtImage
                      art={art}
                      cover
                      priority={i === 0}
                      loading="eager"
                      sizes="(max-width: 900px) 62vw, 30vw"
                      alt=""
                    />
                    <span className="hero-card__caption" aria-hidden="true">
                      <span className="hero-card__title serif">{art.title}</span>
                      <span className="hero-card__kind">{caption(art)}</span>
                    </span>
                  </TLink>
                </li>
              )
            })}
          </ul>
          <Seal size={78} className="hero-deck__seal" />
        </div>
      </div>
    </div>
  )
}
