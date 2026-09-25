import { useRef, type CSSProperties } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowRight } from 'lucide-react'
import { useGsap } from '../../lib/useGsap'
import { getLenis } from '../../lib/scroll'
import { TLink } from '../../lib/transition'
import { ArtImage } from '../shared/ArtImage'
import { artworks } from '../../data/artworks'
import './SelectedWorks.css'

gsap.registerPlugin(ScrollTrigger)

/** Keep in sync with the `@media` block in SelectedWorks.css. */
const HORIZONTAL = '(min-width: 1024px) and (prefers-reduced-motion: no-preference)'
const STACKED = '(max-width: 1023px) and (prefers-reduced-motion: no-preference)'

const pad = (n: number) => String(n).padStart(2, '0')

export function SelectedWorks() {
  const root = useRef<HTMLElement>(null)

  useGsap(root, () => {
    const section = root.current!
    const stage = section.querySelector<HTMLElement>('.works__stage')!
    const track = section.querySelector<HTMLElement>('.works__track')!
    const items = [...section.querySelectorAll<HTMLElement>('.works__item')]
    const mm = gsap.matchMedia()

    /* ── Desktop: pinned horizontal gallery ───────────────────────────── */
    mm.add(HORIZONTAL, () => {
      const distance = () => Math.max(0, track.scrollWidth - stage.clientWidth)
      const progress = section.querySelector<HTMLElement>('.works__progress')!
      const setBar = gsap.quickSetter(section.querySelector('.works__progress-fill'), 'scaleX')

      // Frames live off-screen inside a clipped track, so native lazy-loading would only
      // fetch them as they slide in. Warm them up as the section approaches instead.
      ScrollTrigger.create({
        trigger: section,
        start: 'top bottom+=120%',
        once: true,
        onEnter: () => section.querySelectorAll('img').forEach((img) => (img.loading = 'eager')),
      })

      // declared up-front: ScrollTrigger may fire callbacks synchronously while it's being created
      let active = false
      let scroller: gsap.core.Tween | null = null
      scroller = gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        onUpdate: () => scroller && setBar(scroller.progress()),
        scrollTrigger: {
          trigger: stage,
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 0.6,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onToggle: (self) => {
            active = self.isActive
            gsap.to(progress, { autoAlpha: self.isActive ? 1 : 0, duration: 0.5, overwrite: true })
          },
        },
      })
      const st = scroller.scrollTrigger!
      const container = scroller

      // Per-frame depth: the image drifts inside its window, the outlined numeral drifts the other way.
      items.forEach((item) => {
        const parallax = item.querySelector('.works__parallax')
        const num = item.querySelector('.works__num')
        const along = { trigger: item, containerAnimation: container, start: 'left right', end: 'right left', scrub: true }
        if (parallax)
          gsap.fromTo(parallax, { xPercent: -7, scale: 1.2 }, { xPercent: 7, scale: 1.2, ease: 'none', scrollTrigger: { ...along } })
        if (num) gsap.fromTo(num, { xPercent: 28 }, { xPercent: -28, ease: 'none', scrollTrigger: { ...along } })
      })

      // Velocity → a whisper of skew + scale on the frames. Lenis velocity decays smoothly to 0,
      // so the frames settle on their own when scrolling stops.
      const media = [...section.querySelectorAll<HTMLElement>('.works__media')]
      const skewers = media.map((el) => gsap.quickTo(el, 'skewX', { duration: 0.6, ease: 'power3' }))
      const scalers = media.map((el) => gsap.quickTo(el, 'scale', { duration: 0.6, ease: 'power3' }))
      let last = 0
      const tick = () => {
        const lenis = getLenis()
        const v = active ? (lenis ? lenis.velocity : st.getVelocity() / 60) : 0
        if (Math.abs(v) < 0.05 && last === 0) return
        last = Math.abs(v) < 0.05 ? 0 : v
        const skew = gsap.utils.clamp(-3, 3, -v * 0.1)
        const scale = 1 - Math.min(0.025, Math.abs(v) * 0.001)
        skewers.forEach((fn) => fn(skew))
        scalers.forEach((fn) => fn(scale))
      }
      gsap.ticker.add(tick)
      return () => gsap.ticker.remove(tick)
    })

    /* ── Tablet / mobile: vertical stack, clip-path reveals ───────────── */
    mm.add(STACKED, () => {
      items.forEach((item) => {
        const media = item.querySelector('.works__media')
        const parallax = item.querySelector('.works__parallax')
        const caption = item.querySelector('.works__caption')
        gsap
          .timeline({ scrollTrigger: { trigger: item, start: 'top 88%', once: true } })
          .fromTo(
            media,
            { clipPath: 'inset(12% 9% 12% 9% round 18px)' },
            { clipPath: 'inset(0% 0% 0% 0% round 6px)', duration: 1.4, ease: 'expo.out' },
          )
          .fromTo(parallax, { scale: 1.16 }, { scale: 1, duration: 1.8, ease: 'expo.out' }, 0)
          .fromTo(caption, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'expo.out' }, 0.25)
      })
    })

    return () => mm.revert()
  })

  return (
    <section id="work" data-theme="dark" className="works section" ref={root} aria-labelledby="works-title">
      <header className="works__head container">
        <p className="eyebrow">Portfolio</p>
        <div className="works__head-row">
          <h2 id="works-title" className="works__title display">
            Selected <em>works</em>
            <span className="works__count" aria-hidden="true">
              ({pad(artworks.length)})
            </span>
            <span className="visually-hidden">, {artworks.length} pieces</span>
          </h2>
          <TLink to="/work" className="works__all" data-cursor="Open">
            <span className="link">Full gallery</span> <span aria-hidden="true">→</span>
          </TLink>
        </div>
      </header>

      <div className="works__stage">
        <ol className="works__track">
          {artworks.map((a, i) => {
            const meta = [a.kind, a.year].filter(Boolean).join(' · ')
            const focal = a.details[0]
            return (
              <li
                key={a.slug}
                className="works__item"
                style={
                  {
                    '--ar': `${a.w} / ${a.h}`,
                    '--fx': `${focal?.x ?? 50}%`,
                    '--fy': `${focal?.y ?? 50}%`,
                  } as CSSProperties
                }
              >
                <TLink to={`/work/${a.slug}`} className="works__link" data-cursor="View">
                  <div className="works__media">
                    <div className="works__parallax">
                      <div className="works__zoom">
                        {/* never a transitionName here — reserved for the gallery grid + piece page */}
                        <ArtImage
                          art={a}
                          cover
                          sizes={`(min-width: 1024px) ${Math.round((68 * a.w) / a.h)}vh, (min-width: 640px) 50vw, 100vw`}
                          alt={`${a.title} — ${a.kind.toLowerCase()} illustration by Kio`}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="works__caption">
                    <span className="works__num" aria-hidden="true">
                      {pad(i + 1)}
                    </span>
                    <div className="works__caption-main">
                      <h3 className="works__name serif">{a.title}</h3>
                      <span className="works__meta">{meta}</span>
                    </div>
                    <span className="works__cats">{a.categories.join(', ')}</span>
                  </div>
                </TLink>
              </li>
            )
          })}

          <li className="works__end">
            <TLink to="/work" className="works__end-link" data-cursor="Open">
              <span className="works__end-kicker eyebrow">Commissions &amp; personal work</span>
              <span className="works__end-title display">
                See all <em>work</em>
              </span>
              <span className="works__end-arrow" aria-hidden="true">
                <ArrowRight size={28} strokeWidth={1.4} />
              </span>
            </TLink>
          </li>
        </ol>

        <div className="works__progress" aria-hidden="true">
          <span className="works__progress-fill" />
        </div>
      </div>
    </section>
  )
}
