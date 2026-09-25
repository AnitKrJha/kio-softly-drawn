import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { caption, type Artwork } from '../../data/artworks'
import { ArtImage } from '../shared/ArtImage'
import { TLink } from '../../lib/transition'
import { useGsap } from '../../lib/useGsap'
import { prefersReducedMotion } from '../../lib/env'
import './Related.css'

gsap.registerPlugin(ScrollTrigger)

/** "More like this" — pieces sharing a category, so a visitor can keep browsing one style. */
export function Related({ items }: { items: Artwork[] }) {
  const root = useRef<HTMLElement>(null)

  useGsap(root, () => {
    if (prefersReducedMotion()) return
    gsap.from('.related__card', {
      autoAlpha: 0,
      y: 40,
      duration: 1.1,
      ease: 'expo.out',
      stagger: 0.08,
      scrollTrigger: { trigger: root.current, start: 'top 82%', once: true },
    })
  }, [items.map((a) => a.slug).join()])

  if (!items.length) return null
  return (
    <section className="related container" data-theme="dark" ref={root} aria-labelledby="related-title">
      <header className="related__head">
        <p className="eyebrow">Keep looking</p>
        <h2 id="related-title" className="related__title display">
          More like <em>this</em>
        </h2>
      </header>
      <ul className="related__grid">
        {items.map((a) => (
          <li key={a.slug} className="related__card">
            <TLink to={`/work/${a.slug}`} className="related__link" data-cursor="View">
              <span className="related__frame">
                {/* no transitionName — `art-${slug}` is reserved for the gallery card + piece hero */}
                <ArtImage art={a} cover sizes="(max-width: 700px) 80vw, 30vw" alt={`${a.title} — illustration by Kio`} />
              </span>
              <span className="related__cap">
                <span className="related__name serif">{a.title}</span>
                <span className="related__meta">{caption(a)}</span>
              </span>
            </TLink>
          </li>
        ))}
      </ul>
    </section>
  )
}
