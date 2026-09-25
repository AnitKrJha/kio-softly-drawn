import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useLocation } from 'react-router'
import gsap from 'gsap'
import { TLink } from '../lib/transition'
import { introDone } from '../lib/intro'
import { getLenis } from '../lib/scroll'
import { prefersReducedMotion } from '../lib/env'
import { useGsap } from '../lib/useGsap'
import { site } from '../data/site'
import { Socials } from './shared/Socials'
import { Seal } from './shared/Seal'
import './Nav.css'

const LINKS = [
  { to: '/work', label: 'Work' },
  { to: '/#about', label: 'About' },
  { to: '/#services', label: 'Services' },
  { to: '/contact', label: 'Contact' },
]

const MOBILE = '(max-width: 899.98px)'

/** Text that rolls up letter by letter on hover; the duplicate is presentational only. */
function Roll({ text }: { text: string }) {
  return (
    <>
      <span className="roll" aria-hidden="true">
        {[...text].map((c, i) => (
          <span key={i} className="roll__char" style={{ '--ci': i } as CSSProperties}>
            <span>{c === ' ' ? ' ' : c}</span>
            <span>{c === ' ' ? ' ' : c}</span>
          </span>
        ))}
      </span>
      <span className="visually-hidden">{text}</span>
    </>
  )
}

export function Nav() {
  const location = useLocation()
  const header = useRef<HTMLElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [hidden, setHidden] = useState(false)
  const [atTop, setAtTop] = useState(true)
  // The menu is "open for" one location: navigating closes it in the same render (no flash of the
  // overlay inside the incoming view-transition snapshot) and without its exit animation.
  const [openAt, setOpenAt] = useState<string | null>(null)
  const open = openAt === location.key
  const instant = openAt !== null && !open

  useEffect(() => {
    if (instant) setOpenAt(null)
  }, [instant])

  const isActive = (to: string) =>
    to === '/work' ? location.pathname.startsWith('/work') : to === '/contact' && location.pathname === '/contact'

  /* ── entrance after the intro ── */
  useGsap(header, () => {
    if (prefersReducedMotion()) return
    const items = '.nav__brand, .nav__link, .nav__chip, .nav__toggle'
    gsap.set(items, { yPercent: -120, opacity: 0 })
    let live = true
    introDone.then(() => {
      if (!live) return
      gsap.to(items, { yPercent: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.06, delay: 0.15, clearProps: 'transform,opacity' })
    })
    return () => {
      live = false
    }
  }, [])

  /* ── hide on scroll down, show on scroll up ── */
  useEffect(() => {
    let last = window.scrollY
    let raf = 0
    const read = () => {
      raf = 0
      const y = window.scrollY
      const top = y < 24
      setAtTop(top)
      if (top) setHidden(false)
      else if (y > last + 6 && y > 160) setHidden(true)
      else if (y < last - 6) setHidden(false)
      if (Math.abs(y - last) > 6 || top) last = y
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    read()
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  // new page → nav comes back
  useEffect(() => setHidden(false), [location.key])

  /* ── menu: scroll lock, inert page, Esc, focus ── */
  const unlock = useCallback(() => {
    document.documentElement.style.removeProperty('overflow')
    getLenis()?.start()
  }, [])

  const close = useCallback(
    (returnFocus = true) => {
      // unlock synchronously: a same-page hash link scrolls right after this click handler
      unlock()
      setOpenAt(null)
      if (returnFocus) toggle.current?.focus({ preventScroll: true })
    },
    [unlock],
  )

  useEffect(() => {
    if (!open) return
    document.documentElement.style.overflow = 'hidden'
    getLenis()?.stop()
    const page = [...document.querySelectorAll<HTMLElement>('#main, footer')].filter((n) => !n.closest('.nav, .nav-menu'))
    page.forEach((n) => (n.inert = true))
    const first = menu.current?.querySelector<HTMLElement>('.nav-menu__link')
    const raf = requestAnimationFrame(() => first?.focus({ preventScroll: true }))
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const mq = window.matchMedia(MOBILE)
    const onMq = () => !mq.matches && close(false)
    document.addEventListener('keydown', onKey)
    mq.addEventListener('change', onMq)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey)
      mq.removeEventListener('change', onMq)
      page.forEach((n) => (n.inert = false))
      unlock()
    }
  }, [open, close, unlock])

  // Links to another route: let the location change close the menu (instantly, inside the
  // transition). Links to the current route (hash / same page): close with the animation.
  const onMenuLink = (to: string) => {
    const path = to.split('#')[0] || location.pathname
    if (path === location.pathname) close(false)
  }

  const cls = ['nav', hidden && !open && 'is-hidden', !atTop && 'is-scrolled', open && 'is-open'].filter(Boolean).join(' ')

  return (
    <>
      <header ref={header} className={cls}>
        <div className="nav__bar container">
          <TLink to="/" className="nav__brand" aria-label={`${site.brand} by ${site.artist}, home`} onClick={() => open && onMenuLink('/')}>
            <span className="nav__mark display">
              Softly <em>Drawn</em>
            </span>
            <span className="nav__sub">by {site.artist}</span>
          </TLink>

          <nav className="nav__links" aria-label="Primary">
            <ul>
              {LINKS.map((l) => (
                <li key={l.to}>
                  <TLink to={l.to} className="nav__link" aria-current={isActive(l.to) ? 'page' : undefined}>
                    <Roll text={l.label} />
                  </TLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="nav__end">
            <TLink to="/contact" className="nav__chip chip" onClick={() => open && onMenuLink('/contact')}>
              <span className="dot-live" aria-hidden="true" />
              <Roll text={site.status} />
            </TLink>
            <button
              ref={toggle}
              type="button"
              className="nav__toggle"
              aria-expanded={open}
              aria-controls="nav-menu"
              onClick={() => (open ? close() : setOpenAt(location.key))}
            >
              <span className="nav__toggle-lines" aria-hidden="true">
                <span />
                <span />
              </span>
              <span className="visually-hidden">{open ? 'Close menu' : 'Open menu'}</span>
            </button>
          </div>
        </div>
      </header>

      <div
        ref={menu}
        id="nav-menu"
        className={`nav-menu ${open ? 'is-open' : ''} ${instant ? 'is-instant' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        inert={!open}
        data-lenis-prevent
      >
        <div className="nav-menu__inner container">
          <nav aria-label="Menu">
            <ol className="nav-menu__links">
              {LINKS.map((l, i) => (
                <li key={l.to} style={{ '--i': i } as CSSProperties}>
                  <span className="nav-menu__mask">
                    <TLink
                      to={l.to}
                      className="nav-menu__link display"
                      aria-current={isActive(l.to) ? 'page' : undefined}
                      onClick={() => onMenuLink(l.to)}
                    >
                      <span className="nav-menu__num" aria-hidden="true">
                        0{i + 1}
                      </span>
                      {i % 2 ? <em>{l.label}</em> : l.label}
                    </TLink>
                  </span>
                </li>
              ))}
            </ol>
          </nav>

          <div className="nav-menu__foot">
            <div className="nav-menu__meta">
              <TLink to="/contact" className="chip nav-menu__status" onClick={() => onMenuLink('/contact')}>
                <span className="dot-live" aria-hidden="true" />
                {site.status}
              </TLink>
              <Socials className="nav-menu__socials" />
            </div>
            <Seal size={92} className="nav-menu__seal" />
          </div>
        </div>
      </div>
    </>
  )
}
