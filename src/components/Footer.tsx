import { useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import gsap from 'gsap'
import { ArrowUp, ArrowUpRight, Heart } from 'lucide-react'
import { TLink } from '../lib/transition'
import { getLenis } from '../lib/scroll'
import { prefersReducedMotion } from '../lib/env'
import { site } from '../data/site'
import { Seal } from './shared/Seal'
import './Footer.css'

const WORDMARK = site.brand

// TODO(kio): confirm usage wording
const LEGAL = 'All artwork hand-drawn by Kio — please don’t repost, trace or use it to train AI without permission.'

const PAGES = [
  { to: '/', label: 'Home' },
  { to: '/work', label: 'Work' },
  { to: '/contact', label: 'Contact' },
]

/** Global footer — its own fixed dark palette, a wordmark fitted edge to edge, and the essentials. */
export function Footer() {
  const { pathname } = useLocation()
  const boxRef = useRef<HTMLDivElement>(null)
  const wordRef = useRef<HTMLParagraphElement>(null)
  const year = new Date().getFullYear()

  // fit the wordmark to the container width: measure at a known size, then scale
  useLayoutEffect(() => {
    const box = boxRef.current
    const word = wordRef.current
    if (!box || !word) return
    let last = 0
    const fit = () => {
      const w = box.clientWidth
      if (!w || w === last) return
      word.style.fontSize = '100px'
      const natural = word.offsetWidth // .footer__word is width: max-content
      if (!natural) return
      last = w
      word.style.fontSize = `${(100 * w * 0.995) / natural}px`
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    let alive = true
    document.fonts?.ready.then(() => {
      if (!alive) return
      last = 0
      fit()
    })
    return () => {
      alive = false
      ro.disconnect()
    }
  }, [])

  // reveal the letters whenever the footer scrolls into view — replayed on each route
  useLayoutEffect(() => {
    const word = wordRef.current
    if (!word || prefersReducedMotion()) return
    const chars = word.querySelectorAll('.footer__char')
    gsap.set(chars, { yPercent: 105 })
    let tween: gsap.core.Tween | null = null
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()
        tween = gsap.to(chars, { yPercent: 0, duration: 1.4, ease: 'expo.out', stagger: 0.045 })
      },
      { threshold: 0.35 },
    )
    io.observe(word)
    return () => {
      io.disconnect()
      tween?.kill()
      gsap.set(chars, { clearProps: 'transform' })
    }
  }, [pathname])

  const toTop = () => {
    const lenis = getLenis()
    if (lenis) lenis.scrollTo(0, { duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) })
    else window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }

  const external = { target: '_blank', rel: 'noreferrer', 'data-cursor': 'Open' } as const

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__top">
          <div className="footer__intro">
            <Seal size={96} />
            <p className="footer__tagline serif">{site.tagline}</p>
          </div>

          <nav className="footer__col" aria-label="Footer">
            <h2 className="eyebrow">Pages</h2>
            <ul>
              {PAGES.map((p) => (
                <li key={p.to}>
                  <TLink to={p.to} className="link" aria-current={pathname === p.to ? 'page' : undefined}>
                    {p.label}
                  </TLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="footer__col">
            <h2 className="eyebrow">Elsewhere</h2>
            <ul>
              <li>
                <a href={site.threads.url} {...external}>
                  <span className="link">{site.threads.label}</span> <ArrowUpRight size={14} aria-hidden="true" />
                  <span className="footer__sub">{site.threads.handle}</span>
                </a>
              </li>
              <li>
                <a href={site.fiverr.url} {...external}>
                  <span className="link">{site.fiverr.label}</span> <ArrowUpRight size={14} aria-hidden="true" />
                  <span className="footer__sub">★ {site.fiverr.rating}</span>
                </a>
              </li>
            </ul>
          </div>

          <div className="footer__col">
            <h2 className="eyebrow">Contact</h2>
            {site.email ? (
              <a href={`mailto:${site.email}`} className="footer__email link">
                {site.email}
              </a>
            ) : (
              <p className="footer__note">
                Message me on{' '}
                <a href={site.threads.url} className="link" {...external}>
                  Threads
                </a>{' '}
                or{' '}
                <a href={site.fiverr.url} className="link" {...external}>
                  Fiverr
                </a>
                .
              </p>
            )}
            <TLink to="/contact" className="footer__cta link">
              Start a commission
            </TLink>
          </div>
        </div>

        <div ref={boxRef} className="footer__mark">
          <p ref={wordRef} className="footer__word display">
            <span className="visually-hidden">{WORDMARK}</span>
            {WORDMARK.split(' ').map((w, wi) => (
              <span key={w} aria-hidden="true">
                {wi > 0 && ' '}
                <span className={`footer__w ${wi > 0 ? 'footer__w--em' : ''}`}>
                  {[...w].map((ch, ci) => (
                    <span key={ci} className="footer__char">
                      {ch}
                    </span>
                  ))}
                </span>
              </span>
            ))}
          </p>
        </div>

        <div className="footer__bottom">
          <p className="footer__legal">
            © {year} {site.brand} · {site.artist}. {LEGAL}
          </p>
          <a className="footer__credit" href={site.credit.url} target="_blank" rel="noreferrer" data-cursor="Open">
            Website designed with <Heart size={13} aria-label="love" className="footer__heart" /> by{' '}
            <span className="link">{site.credit.label}</span>
          </a>
          <button type="button" className="footer__totop" onClick={toTop}>
            Back to top <ArrowUp size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </footer>
  )
}
