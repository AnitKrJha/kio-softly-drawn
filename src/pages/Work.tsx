import { useLayoutEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router'
import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { artworks } from '../data/artworks'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { useSectionThemes } from '../lib/theme'
import { useGsap } from '../lib/useGsap'
import { prefersReducedMotion } from '../lib/env'
import { TLink } from '../lib/transition'
import { GalleryGrid } from '../components/work/GalleryGrid'
import { IndexList } from '../components/work/IndexList'
import { afterIntro, filters, pad } from '../components/work/shared'
import './Work.css'

gsap.registerPlugin(Flip, ScrollTrigger)

type View = 'grid' | 'index'

export function Work() {
  useDocumentTitle('Gallery')
  useSectionThemes()

  // filter + view live in the URL (?filter=fantasy&view=index) so back/forward and sharing keep them
  const [params, setParams] = useSearchParams()
  const filter = filters.find((f) => f.id === params.get('filter')) ?? filters[0]
  const view: View = params.get('view') === 'index' ? 'index' : 'grid'
  const visible = useMemo(() => new Set(artworks.filter(filter.test).map((a) => a.slug)), [filter])

  const root = useRef<HTMLElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const pending = useRef<{ state: Flip.FlipState; height: number } | null>(null)
  const flip = useRef<gsap.core.Timeline | null>(null)

  const update = (patch: { filter?: string; view?: View }) =>
    setParams(
      (prev) => {
        const q = new URLSearchParams(prev)
        const set = (k: string, v: string | undefined, fallback: string) => (v === undefined ? null : v === fallback ? q.delete(k) : q.set(k, v))
        set('filter', patch.filter, 'all')
        set('view', patch.view, 'grid')
        return q
      },
      { replace: true },
    )

  const chooseFilter = (id: string) => {
    if (id === filter.id) return
    const el = body.current
    if (el && !prefersReducedMotion()) {
      // record where everything is *now*; the layout effect below animates from here
      const state = Flip.getState(el.querySelectorAll('[data-flip-id]'))
      pending.current = { state, height: el.offsetHeight }
    }
    update({ filter: id })
  }

  useLayoutEffect(() => {
    const p = pending.current
    const el = body.current
    pending.current = null
    if (!p || !el) return
    const height = el.offsetHeight
    flip.current = Flip.from(p.state, {
      duration: 0.95,
      ease: 'expo.inOut',
      absoluteOnLeave: true,
      stagger: 0.03,
      onEnter: (els) =>
        gsap.fromTo(els, { autoAlpha: 0, scale: 0.9 }, { autoAlpha: 1, scale: 1, duration: 0.8, delay: 0.3, ease: 'expo.out' }),
      onLeave: (els) => gsap.to(els, { autoAlpha: 0, scale: 0.9, duration: 0.45, ease: 'power2.in' }),
      onComplete: () => ScrollTrigger.refresh(),
    })
    // ease the page height too, so the footer glides instead of jumping
    if (height !== p.height) flip.current.fromTo(el, { height: p.height }, { height, duration: 0.95, ease: 'expo.inOut', clearProps: 'height' }, 0)
  }, [filter])

  useLayoutEffect(() => () => void flip.current?.kill(), [])

  const chooseView = (v: View) => {
    if (v === view) return
    const el = body.current
    if (!el || prefersReducedMotion()) return update({ view: v })
    gsap.to(el, { autoAlpha: 0, y: 14, duration: 0.3, ease: 'power2.in', overwrite: true, onComplete: () => update({ view: v }) })
  }

  // new view mounted: its own entrance takes over
  const firstView = useRef(true)
  useLayoutEffect(() => {
    if (firstView.current) {
      firstView.current = false
      return
    }
    if (body.current) gsap.set(body.current, { clearProps: 'opacity,visibility,transform' })
    ScrollTrigger.refresh()
  }, [view])

  // Header entrance
  useGsap(root, (ctx) => {
    if (prefersReducedMotion()) return
    gsap.set('.work__word', { yPercent: 110 })
    gsap.set('.work__count', { autoAlpha: 0, y: 10 })
    gsap.set('.work__fade', { autoAlpha: 0, y: 20 })
    return afterIntro(() =>
      ctx.add(() => {
        const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
        tl.to('.work__word', { yPercent: 0, duration: 1.4, stagger: 0.1 }, 0.1)
          .to('.work__count', { autoAlpha: 1, y: 0, duration: 1 }, 0.6)
          .to('.work__fade', { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.07 }, 0.45)
      }),
    )
  }, [])

  return (
    <section className="work container" data-theme="dark" ref={root}>
      <header className="work__head">
        <p className="eyebrow work__fade">Gallery · every line drawn by hand</p>
        <h1 className="work__title display">
          <span className="split-mask">
            <span className="work__word">The</span>
          </span>{' '}
          <span className="work__nowrap">
            <span className="split-mask">
              <em className="work__word">gallery</em>
            </span>
            <sup className="work__count" aria-label={`${visible.size} pieces shown`}>
              ({pad(visible.size)})
            </sup>
          </span>
        </h1>

        <div className="work__bar">
          <p className="work__intro muted work__fade">
            Semi-realistic portraits, couples, quiet scenes, book covers and icons — every piece drawn by hand.
          </p>

          <div className="work__controls work__fade">
            <div className="work__filters" role="group" aria-label="Filter artworks">
              {filters.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`work__chip ${f.id === filter.id ? 'is-active' : ''}`}
                  aria-pressed={f.id === filter.id}
                  onClick={() => chooseFilter(f.id)}
                >
                  {f.label}
                  <sup className="work__chip-count">{f.count}</sup>
                </button>
              ))}
            </div>

            <div className="work__views" role="group" aria-label="Layout" data-view={view}>
              <span className="work__views-pill" aria-hidden="true" />
              {(['grid', 'index'] as const).map((v) => (
                <button key={v} type="button" className={`work__view ${v === view ? 'is-active' : ''}`} aria-pressed={v === view} onClick={() => chooseView(v)}>
                  {v === 'grid' ? 'Grid' : 'Index'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="work__body" ref={body}>
        {view === 'grid' ? <GalleryGrid visible={visible} /> : <IndexList visible={visible} />}
      </div>

      <p className="work__note">
        <span className="muted">Have a character in mind?</span>{' '}
        <TLink to="/contact" className="link" data-cursor="Open">
          Tell me about them →
        </TLink>
      </p>
    </section>
  )
}
