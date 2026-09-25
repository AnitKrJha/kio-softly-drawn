import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowRight } from 'lucide-react'
import { useGsap } from '../../lib/useGsap'
import { TLink } from '../../lib/transition'
import { isFinePointer, prefersReducedMotion } from '../../lib/env'
import { ArtImage } from '../shared/ArtImage'
import { bySlug, type Artwork } from '../../data/artworks'
import './Services.css'

gsap.registerPlugin(ScrollTrigger)

type ServiceType = 'character-art' | 'original-character' | 'book-cover' | 'pfp-icon'

interface Service {
  type: ServiceType
  /** [roman, italic] */
  title: [string, string]
  desc: string
  arts: string[]
}

// Artworks here are style references for each service, not claims about what they were made for.
const SERVICES: Service[] = [
  {
    type: 'character-art',
    title: ['Character', 'art'],
    desc: 'Semi-realistic portraits and full-body pieces of your characters, drawn with soft light and natural, living expressions.',
    arts: ['witch-knight', 'rose-garden'],
  },
  {
    type: 'original-character',
    title: ['Original', 'characters'],
    desc: "From a loose idea to a fully realised OC — I'll help you find their face, their look and the small details that make them feel real.",
    // TODO(kio): add more OC pieces here as they're cleared for the portfolio.
    arts: ['vows-in-bloom'],
  },
  {
    type: 'book-cover',
    title: ['Book', 'covers'],
    desc: 'Cover art for your story — your characters front and centre, composed with room for the title to breathe.',
    // TODO(kio): swap in real cover commissions once they can be shown.
    arts: ['forest-centaur', 'candlelit-library'],
  },
  {
    type: 'pfp-icon',
    title: ['PFP &', 'icons'],
    desc: 'A portrait made to be seen small — profile pictures and icons for your socials, streams or community, clear at any size.',
    arts: ['hush'],
  },
]

const resolve = (slugs: string[]) => slugs.map((s) => bySlug(s)).filter((a): a is Artwork => !!a)
const PREVIEW_ARTS = resolve([...new Set(SERVICES.flatMap((s) => s.arts))])
const CYCLE_MS = 1100

/** crop small frames around the piece's first focal point */
const focal = (a: Artwork) => ({ '--fx': `${a.details[0]?.x ?? 50}%`, '--fy': `${a.details[0]?.y ?? 50}%` }) as CSSProperties

type Controller = { show: (e: PointerEvent) => void; hide: () => void }

export function Services() {
  const root = useRef<HTMLElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const ctrl = useRef<Controller | null>(null)

  // Cursor-following previews only where there's a real mouse and motion is welcome;
  // everyone else gets inline thumbnails and no hover dependency.
  const [canPreview] = useState(() => isFinePointer() && !prefersReducedMotion())
  const [active, setActive] = useState<number | null>(null)
  const [previewRow, setPreviewRow] = useState(0)
  const [frame, setFrame] = useState(0)
  const [armed, setArmed] = useState(false)

  const previewSlug = (() => {
    const arts = SERVICES[previewRow].arts
    return arts[frame % arts.length]
  })()

  // Cycle through a row's artworks while it's hovered.
  useEffect(() => {
    if (active === null || SERVICES[active].arts.length < 2) return
    const id = window.setInterval(() => setFrame((f) => f + 1), CYCLE_MS)
    return () => window.clearInterval(id)
  }, [active])

  // Floating preview: lerped follow + rotation from how far it's lagging behind the cursor.
  useEffect(() => {
    const el = previewRef.current
    const list = listRef.current
    if (!canPreview || !el || !list) return

    gsap.set(el, { xPercent: -50, yPercent: -50, scale: 0.5, autoAlpha: 0 })
    const setX = gsap.quickSetter(el, 'x', 'px')
    const setY = gsap.quickSetter(el, 'y', 'px')
    const setR = gsap.quickSetter(el, 'rotation', 'deg')
    let tx = 0
    let ty = 0
    let x = 0
    let y = 0
    let r = 0
    let running = false
    let visible = false

    const loop = (_time: number, dt: number) => {
      const k = 1 - Math.pow(1 - 0.15, dt / (1000 / 60)) // frame-rate independent lerp
      x += (tx - x) * k
      y += (ty - y) * k
      r += (gsap.utils.clamp(-12, 12, (tx - x) * 0.08) - r) * k
      setX(x)
      setY(y)
      setR(r)
    }
    const stop = () => {
      gsap.ticker.remove(loop)
      running = false
    }
    const onMove = (e: PointerEvent) => {
      tx = e.clientX
      ty = e.clientY
    }

    ctrl.current = {
      show(e) {
        onMove(e)
        // appear under the cursor rather than flying in from wherever it last was
        if (!visible && Number(gsap.getProperty(el, 'opacity')) < 0.05) {
          x = tx
          y = ty
          r = 0
        }
        visible = true
        if (!running) {
          gsap.ticker.add(loop)
          running = true
        }
        gsap.to(el, { autoAlpha: 1, scale: 1, duration: 0.7, ease: 'expo.out', overwrite: 'auto' })
      },
      hide() {
        if (!visible) return
        visible = false
        gsap.to(el, { autoAlpha: 0, scale: 0.5, duration: 0.45, ease: 'power3.out', overwrite: 'auto', onComplete: stop })
      },
    }

    const off = () => {
      ctrl.current?.hide()
      setActive(null)
    }
    // Lenis can scroll the list out from under a still cursor — don't leave the preview hanging.
    const st = ScrollTrigger.create({ trigger: list, start: 'top bottom', end: 'bottom top', onLeave: off, onLeaveBack: off })

    list.addEventListener('pointermove', onMove)
    return () => {
      list.removeEventListener('pointermove', onMove)
      st.kill()
      stop()
      gsap.killTweensOf(el)
      ctrl.current = null
    }
  }, [canPreview])

  useGsap(root, () => {
    const section = root.current!
    const mm = gsap.matchMedia()

    if (canPreview) {
      // Mount (and fetch) the preview layers only once the section is on its way in.
      ScrollTrigger.create({ trigger: section, start: 'top bottom+=60%', once: true, onEnter: () => setArmed(true) })
    }

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      section.querySelectorAll<HTMLElement>('.services__item').forEach((item) => {
        const tl = gsap.timeline({ scrollTrigger: { trigger: item, start: 'top 88%', once: true } })
        tl.fromTo(item.querySelector('.services__rule'), { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: 'expo.out' }).from(
          item.querySelectorAll('.services__num, .services__name, .services__body, .services__cta'),
          { y: 36, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.06, clearProps: 'transform,opacity' },
          0.1,
        )
      })
      gsap.from(section.querySelectorAll('.services__foot > *'), {
        y: 24,
        opacity: 0,
        duration: 1,
        ease: 'expo.out',
        stagger: 0.1,
        clearProps: 'transform,opacity',
        scrollTrigger: { trigger: section.querySelector('.services__foot'), start: 'top 90%', once: true },
      })
    })

    return () => mm.revert()
  }, [canPreview])

  const activate = (i: number, e: ReactPointerEvent) => {
    if (!canPreview || e.pointerType !== 'mouse') return
    if (i !== active) {
      setActive(i)
      setPreviewRow(i)
      setFrame(0)
    }
    ctrl.current?.show(e.nativeEvent)
  }

  const deactivate = () => {
    ctrl.current?.hide()
    setActive(null)
  }

  return (
    <section
      id="commissions"
      data-theme="light"
      className="services section"
      ref={root}
      aria-labelledby="services-title"
    >
      <div className="container">
        <header className="services__head">
          <p className="eyebrow">Commissions</p>
          <h2 id="services-title" className="services__title display">
            What I <em>draw</em>
          </h2>
          <p className="services__intro muted">Four ways to work together — every one of them drawn by hand, start to finish.</p>
        </header>

        <ul className="services__list" ref={listRef} data-active={active !== null ? '' : undefined} onPointerLeave={deactivate}>
          {SERVICES.map((s, i) => (
            <li key={s.type} className={`services__item ${active === i ? 'is-active' : ''}`}>
              <span className="services__rule" aria-hidden="true" />
              <TLink
                to={`/contact?type=${s.type}`}
                className="services__link"
                data-cursor="Open"
                onPointerEnter={(e) => activate(i, e)}
              >
                <span className="services__num">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="services__name display">
                  <span className="services__name-inner">
                    {s.title[0]} <em>{s.title[1]}</em>
                  </span>
                </h3>
                <span className="services__body">
                  <span className="services__desc">{s.desc}</span>
                  {!canPreview && (
                    <span className="services__thumbs" aria-hidden="true">
                      {resolve(s.arts).map((a) => (
                        <span
                          key={a.slug}
                          className="services__thumb"
                          style={focal(a)}
                        >
                          <ArtImage art={a} cover sizes="96px" alt="" />
                        </span>
                      ))}
                    </span>
                  )}
                </span>
                <span className="services__cta" aria-hidden="true">
                  <ArrowRight size={20} strokeWidth={1.5} />
                </span>
              </TLink>
            </li>
          ))}
        </ul>

        <div className="services__foot">
          <p className="services__note serif">
            Every piece is priced by complexity — tell me about your idea and I'll send a quote.
          </p>
          {/* wrapper takes the entrance tween — .btn has its own CSS transform transition */}
          <span className="services__foot-cta">
            <TLink to="/contact" className="btn">
              Start a commission <ArrowRight size={18} aria-hidden="true" />
            </TLink>
          </span>
        </div>
      </div>

      {canPreview && (
        <div className="services__preview" ref={previewRef} aria-hidden="true">
          <div className="services__preview-inner">
            {armed &&
              PREVIEW_ARTS.map((a) => (
                <div
                  key={a.slug}
                  className={`services__layer ${a.slug === previewSlug ? 'is-on' : ''}`}
                  style={focal(a)}
                >
                  {/* decorative duplicate of real work; no transitionName (reserved) */}
                  <ArtImage art={a} cover sizes="340px" alt="" loading="eager" />
                </div>
              ))}
          </div>
        </div>
      )}
    </section>
  )
}
