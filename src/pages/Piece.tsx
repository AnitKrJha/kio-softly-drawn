import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { Star } from 'lucide-react'
import { artworks, bySlug, type Artwork, type Detail } from '../data/artworks'
import { reviews } from '../data/reviews'
import { site } from '../data/site'
import { ArtImage } from '../components/shared/ArtImage'
import { TLink, useTransitionNavigate } from '../lib/transition'
import { useGsap } from '../lib/useGsap'
import { useSectionThemes } from '../lib/theme'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { prefersReducedMotion } from '../lib/env'
import { Lightbox, type LightboxRequest } from '../components/work/Lightbox'
import { Details } from '../components/work/Details'
import { NextPiece } from '../components/work/NextPiece'
import { afterIntro, clickedPath, eyebrowFor, kindLabel, pad, setLastViewed, total, vtName, wrapIndex } from '../components/work/shared'
import { NotFound } from './NotFound'
import './Piece.css'

gsap.registerPlugin(SplitText)

export function Piece() {
  const { slug } = useParams()
  const art = bySlug(slug)
  if (!art) return <NotFound />
  // keyed by slug: piece → piece navigation remounts everything (animations, lightbox, splits)
  return <PieceView key={art.slug} art={art} />
}

/** "Vows in Bloom" → "Vows in <em>Bloom</em>" */
function Title({ text }: { text: string }) {
  const words = text.split(' ')
  const last = words.pop()
  return (
    <>
      {words.length > 0 && `${words.join(' ')} `}
      <em>{last}</em>
    </>
  )
}

function PieceView({ art }: { art: Artwork }) {
  useDocumentTitle(art.title)
  useSectionThemes()

  const root = useRef<HTMLDivElement>(null)
  const heroBtn = useRef<HTMLButtonElement>(null)
  const go = useTransitionNavigate()
  const index = artworks.indexOf(art)
  const prev = artworks[wrapIndex(index - 1)]
  const next = artworks[wrapIndex(index + 1)]
  const review = reviews.find((r) => r.art === art.slug)
  const [lightbox, setLightbox] = useState<LightboxRequest | null>(null)
  const lightboxOpen = useRef(false)
  lightboxOpen.current = !!lightbox
  const landscape = art.w / art.h > 1.2

  const heroImage = () => heroBtn.current?.querySelector<HTMLElement>('.art-image') ?? null

  useEffect(() => setLastViewed(art.slug), [art.slug])

  // View-transition hygiene: the hero keeps `art-${slug}` only when heading back to the gallery
  // (where its card is waiting to receive it); anywhere else it just leaves with the page.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const path = clickedPath(e)
      const img = heroImage()
      if (!path || !img || path === location.pathname) return
      img.style.viewTransitionName = path === '/work' ? vtName(art.slug) : 'none'
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [art.slug])

  const navigateTo = useCallback(
    (slug: string) => {
      const img = heroImage()
      if (img) img.style.viewTransitionName = 'none'
      go(`/work/${slug}`)
    },
    [go],
  )

  // ←/→ browse pieces (unless the lightbox is open or the user is typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if (lightboxOpen.current || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      const t = e.target as HTMLElement | null
      if (t?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return
      e.preventDefault()
      navigateTo(e.key === 'ArrowLeft' ? prev.slug : next.slug)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigateTo, prev.slug, next.slug])

  // Entrance — masked title lines, then the quieter details settle in.
  useGsap(root, (ctx) => {
    if (prefersReducedMotion()) return
    const title = root.current!.querySelector<HTMLElement>('.piece__title')!
    const fades = gsap.utils.toArray<HTMLElement>('.piece__fade')
    gsap.set(title, { autoAlpha: 0 })
    gsap.set(fades, { autoAlpha: 0, y: 26 })
    return afterIntro(() =>
      ctx.add(() => {
        gsap.set(title, { autoAlpha: 1 })
        SplitText.create(title, {
          type: 'lines',
          mask: 'lines',
          linesClass: 'piece__line',
          autoSplit: true,
          onSplit: (self) => gsap.from(self.lines, { yPercent: 112, duration: 1.3, ease: 'expo.out', stagger: 0.09, delay: 0.15 }),
        })
        gsap.to(fades, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.06, delay: 0.4 })
        gsap.from('.piece__swatch', { scale: 0, duration: 0.8, ease: 'back.out(2.2)', stagger: 0.06, delay: 0.9 })
      }),
    )
  }, [])

  const openHero = () => setLightbox({ index, origin: heroImage() })
  const openDetail = (d: Detail) => setLightbox({ index, focus: { x: d.x / 100, y: d.y / 100 } })
  const openPiece = (slug: string) => {
    setLightbox(null)
    navigateTo(slug)
  }

  return (
    <div className="piece" ref={root}>
      <section className="piece__hero container" data-theme="dark" data-orient={landscape ? 'landscape' : 'portrait'}>
        <div className="piece__info">
          <nav className="piece__crumbs piece__fade" aria-label="Breadcrumb">
            <TLink to="/work" className="link">
              Gallery
            </TLink>
            <span aria-hidden="true">/</span>
            <span aria-current="page">
              No. {pad(index + 1)} of {pad(total)}
            </span>
          </nav>

          <p className="eyebrow piece__fade">{eyebrowFor(art)}</p>
          <h1 className="piece__title display">
            <Title text={art.title} />
          </h1>
          <p className="piece__blurb piece__fade">{art.blurb}</p>

          <dl className="piece__meta piece__fade">
            <div>
              <dt>Type</dt>
              <dd>{kindLabel(art.kind)}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{art.categories.join(', ')}</dd>
            </div>
            {art.year && (
              <div>
                <dt>Year</dt>
                <dd>{art.year}</dd>
              </div>
            )}
            <div>
              <dt>Medium</dt>
              <dd>Digital, drawn by hand</dd>
            </div>
            <div className="piece__meta-wide">
              <dt>Palette</dt>
              <dd>
                <ul className="piece__palette">
                  {art.palette.map((c) => (
                    <li key={c} className="piece__swatch" style={{ '--c': c } as CSSProperties} title={c}>
                      <span className="visually-hidden">{c}</span>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>

          {review && (
            <figure className="piece__review piece__fade">
              <p className="piece__stars" aria-label={`${review.rating} out of 5 stars`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} size={14} strokeWidth={1.5} fill={i < review.rating ? 'currentColor' : 'none'} aria-hidden="true" />
                ))}
              </p>
              <blockquote className="piece__quote serif">
                <p>“{review.text}”</p>
              </blockquote>
              <figcaption className="piece__cite">
                <span className="piece__author">{review.author}</span>
                <span className="muted">
                  {review.when} ·{' '}
                  <a className="link" href={site.fiverr.url} target="_blank" rel="noreferrer" data-cursor="Open">
                    on Fiverr
                  </a>
                </span>
              </figcaption>
            </figure>
          )}

          <div className="piece__actions piece__fade">
            <TLink to={`/contact?ref=${art.slug}`} className="btn" data-cursor="Open">
              Commission something like this <span aria-hidden="true">→</span>
            </TLink>
          </div>
        </div>

        <figure className="piece__figure" style={{ '--ar': art.w / art.h } as CSSProperties}>
          <button
            ref={heroBtn}
            type="button"
            className="piece__zoom"
            onClick={openHero}
            data-cursor="Open"
            aria-haspopup="dialog"
            aria-label={`${art.title} — open full-size view`}
          >
            <ArtImage art={art} transitionName={vtName(art.slug)} priority sizes="(max-width: 999px) 100vw, 55vw" />
            <span className="piece__zoom-hint" aria-hidden="true">
              View full size <span className="piece__plus">+</span>
            </span>
          </button>
          <figcaption className="piece__caption piece__fade">
            <span>Hand-drawn · no AI</span>
            <span className="piece__keys" aria-hidden="true">
              ← → browse
            </span>
          </figcaption>
        </figure>
      </section>

      {art.details.length > 0 && <Details art={art} onOpen={openDetail} />}
      <NextPiece next={next} />

      {lightbox && <Lightbox {...lightbox} pageIndex={index} onClose={() => setLightbox(null)} onOpenPiece={openPiece} />}
    </div>
  )
}
