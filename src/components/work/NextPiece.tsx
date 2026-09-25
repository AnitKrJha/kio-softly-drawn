import { useRef, type CSSProperties } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { artworks, type Artwork } from '../../data/artworks'
import { ArtImage } from '../shared/ArtImage'
import { TLink } from '../../lib/transition'
import { useGsap } from '../../lib/useGsap'
import { prefersReducedMotion } from '../../lib/env'
import { eyebrowFor, pad, total, vtName } from './shared'
import './NextPiece.css'

gsap.registerPlugin(ScrollTrigger, SplitText)

interface Props {
  next: Artwork
}

/**
 * Footer hand-off to the next piece (wraps around). Desktop: the artwork un-masks on hover and
 * morphs into the next page's hero. Touch: it's simply shown as a strip.
 */
export function NextPiece({ next }: Props) {
  const root = useRef<HTMLElement>(null)
  const media = useRef<HTMLSpanElement>(null)
  const n = artworks.indexOf(next) + 1

  useGsap(root, () => {
    if (prefersReducedMotion()) return
    const trigger = () => ({ trigger: root.current, start: 'top 80%', once: true })
    gsap.from('.next__reveal', { yPercent: 110, duration: 1.2, ease: 'expo.out', scrollTrigger: trigger() })
    SplitText.create(root.current!.querySelector('.next__title')!, {
      type: 'lines',
      mask: 'lines',
      linesClass: 'next__line',
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.lines, { yPercent: 110, duration: 1.3, ease: 'expo.out', stagger: 0.08, scrollTrigger: trigger() }),
    })
  }, [next.slug])

  // At click time, hand the `art-*` name to this preview so it morphs into the next hero.
  // (The current hero drops its own name in Piece's capture-phase click handler.)
  const handoff = () => {
    const img = media.current?.querySelector<HTMLElement>('.art-image')
    if (img) img.style.viewTransitionName = vtName(next.slug)
  }

  return (
    <section className="next container" data-theme="dark" ref={root} aria-label="Next piece">
      <hr className="hairline" />
      <TLink
        to={`/work/${next.slug}`}
        className="next__link"
        data-cursor="View"
        onClick={handoff}
        aria-label={`Next piece: ${next.title}`}
        style={{ '--ar': next.w / next.h } as CSSProperties}
      >
        <span className="next__top">
          <span className="split-mask">
            <span className="next__reveal eyebrow">
              Next piece · {pad(n)} / {pad(total)}
            </span>
          </span>
          <span className="next__hint eyebrow" aria-hidden="true">
            ← → to browse
          </span>
        </span>
        <span className="next__title display">
          Next — <em>{next.title}</em>
        </span>
        <span className="next__meta">
          <span>{eyebrowFor(next)}</span>
          <span className="next__arrow" aria-hidden="true">
            →
          </span>
        </span>
        <span className="next__media" ref={media} aria-hidden="true">
          <ArtImage art={next} cover alt="" sizes="(max-width: 899px) 100vw, 28vw" />
        </span>
      </TLink>
    </section>
  )
}
