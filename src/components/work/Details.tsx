import { useRef, type CSSProperties } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { full, type Artwork, type Detail } from '../../data/artworks'
import { useGsap } from '../../lib/useGsap'
import { prefersReducedMotion } from '../../lib/env'
import { pad } from './shared'
import './Details.css'

gsap.registerPlugin(ScrollTrigger)

/** zoom factor of each crop, relative to the frame width */
const ZOOM = 3.2
/** frame is 4:5; the inner plate is 120% tall so it can drift for parallax */
const FRAME_AR = 4 / 5
const PLATE = 1.2

/**
 * `background-position` percentages align the p% point of the image with the p% point of the box,
 * so a raw `${x}%` would push edge focal points to the frame's edge. Solve for the value that puts
 * the focal point in the *centre* of the frame instead (clamped so we never show past the edge).
 */
function crop(art: Artwork, d: Detail) {
  const imgRatio = art.h / art.w
  const plateH = PLATE / FRAME_AR // plate height in frame-widths
  // make sure the enlarged image always covers the plate vertically
  const kx = Math.max(ZOOM, (plateH * 1.05) / imgRatio)
  const ky = (kx * imgRatio) / plateH
  const solve = (focal: number, k: number) => (k <= 1 ? 50 : Math.min(100, Math.max(0, ((focal * k - 0.5) / (k - 1)) * 100)))
  return {
    size: `${(kx * 100).toFixed(1)}% auto`,
    position: `${solve(d.x / 100, kx).toFixed(2)}% ${solve(d.y / 100, ky).toFixed(2)}%`,
    zoom: kx,
  }
}

interface Props {
  art: Artwork
  onOpen: (detail: Detail, el: HTMLElement) => void
}

/** Close-up crops from the finished file — a small catalogue of craft. */
export function Details({ art, onOpen }: Props) {
  const root = useRef<HTMLElement>(null)

  useGsap(root, () => {
    if (prefersReducedMotion()) return
    gsap.from('.details__head > *', {
      autoAlpha: 0,
      y: 30,
      duration: 1.1,
      ease: 'expo.out',
      stagger: 0.08,
      scrollTrigger: { trigger: '.details__head', start: 'top 85%', once: true },
    })
    gsap.utils.toArray<HTMLElement>('.detail').forEach((fig, i) => {
      const frame = fig.querySelector('.detail__frame')
      const plate = fig.querySelector('.detail__plate')
      const cap = fig.querySelector('.detail__cap')
      const tl = gsap.timeline({ scrollTrigger: { trigger: fig, start: 'top 88%', once: true } })
      tl.fromTo(
        frame,
        { clipPath: 'inset(100% 0% 0% 0% round 22px)' },
        { clipPath: 'inset(0% 0% 0% 0% round 22px)', duration: 1.5, ease: 'expo.out', delay: (i % 3) * 0.08 },
      )
        .from(plate, { scale: 1.25, duration: 1.9, ease: 'expo.out' }, '<')
        .from(cap, { autoAlpha: 0, y: 16, duration: 1, ease: 'expo.out' }, '<0.3')
      // slow drift inside the frame as the page scrolls
      gsap.fromTo(
        plate,
        { yPercent: -7 },
        { yPercent: 7, ease: 'none', scrollTrigger: { trigger: fig, start: 'top bottom', end: 'bottom top', scrub: true } },
      )
    })
  }, [art.slug])

  return (
    <section className="details container" data-theme="dark" ref={root} aria-labelledby="details-title">
      <header className="details__head">
        <p className="eyebrow">Details</p>
        <h2 id="details-title" className="details__title display">
          Up <em>close</em>
        </h2>
        <p className="details__lede muted">Enlarged crops from the finished piece. Every strand, petal and highlight — drawn by hand.</p>
      </header>

      <div className="details__grid">
        {art.details.map((d, i) => {
          const c = crop(art, d)
          const style = { backgroundImage: `url(${full(art)})`, backgroundSize: c.size, backgroundPosition: c.position } as CSSProperties
          return (
            <figure className="detail" key={d.label}>
              <button
                type="button"
                className="detail__frame"
                data-cursor="Zoom"
                aria-label={`Detail ${pad(i + 1)}: ${d.label}. Open full-size view zoomed here`}
                onClick={(e) => onOpen(d, e.currentTarget)}
                style={{ backgroundColor: art.color }}
              >
                <span className="detail__plate" style={style} aria-hidden="true" />
                <span className="detail__zoom" aria-hidden="true">
                  ×{c.zoom.toFixed(1)}
                </span>
              </button>
              <figcaption className="detail__cap">
                <span className="detail__num">{pad(i + 1)}</span>
                <span className="detail__label serif">
                  Detail — <em>{d.label}</em>
                </span>
              </figcaption>
            </figure>
          )
        })}
      </div>
    </section>
  )
}
