import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { artworks, src, texture } from '../data/artworks'
import { site } from '../data/site'
import { canRunHeavyGL, prefersReducedMotion } from '../lib/env'
import { finishIntro } from '../lib/intro'
import { getLenis } from '../lib/scroll'
import './Preloader.css'

gsap.registerPlugin(SplitText)

const KEY = 'kio-intro'
/** never faster than this (s) — the wordmark needs a beat to land */
const MIN = 1.6
/** never slower than this (s) — whatever hasn't arrived keeps loading behind the page */
const CAP = 4

function shouldPlay() {
  if (prefersReducedMotion()) return false
  try {
    return !sessionStorage.getItem(KEY)
  } catch {
    return false
  }
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Load the faces the first screen actually uses, then wait for everything in flight. */
function fontsReady() {
  if (!document.fonts) return Promise.resolve()
  const faces = [
    'italic 340 1em "Fraunces Variable"',
    '340 1em "Fraunces Variable"',
    '400 1em "Manrope Variable"',
    '600 1em "Manrope Variable"',
  ]
  return Promise.all(faces.map((f) => document.fonts.load(f).catch(() => undefined)))
    .then(() => document.fonts.ready)
    .then(() => undefined)
    .catch(() => undefined)
}

/** Resolves when the image is in the HTTP cache (or failed — never blocks). */
function preloadImage(url: string) {
  return new Promise<void>((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = img.onerror = () => resolve()
    img.src = url
  })
}

/**
 * First visit per session: an ink panel, the wordmark rising through its mask and a counter
 * driven by real progress (artwork textures + fonts), then a curtain lifts off the page.
 */
export function Preloader() {
  const [active, setActive] = useState(shouldPlay)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active) finishIntro()
  }, [active])

  // Lenis is created in a parent layout effect (after ours), so stop it from a passive effect.
  useEffect(() => {
    if (!active) return
    getLenis()?.stop()
    return () => getLenis()?.start()
  }, [active])

  useLayoutEffect(() => {
    const el = root.current
    if (!active || !el) return
    const html = document.documentElement
    const prevOverflow = html.style.overflow
    html.style.overflow = 'hidden'
    let unlocked = false
    const unlock = () => {
      if (unlocked) return
      unlocked = true
      html.style.overflow = prevOverflow
      getLenis()?.start()
    }

    let cancelled = false
    let exitTl: gsap.core.Timeline | null = null
    let loaded = 0
    let shown = 0
    const start = performance.now()

    // What the first screen will ask for: GL textures on desktop, the card deck's images elsewhere.
    const urls = canRunHeavyGL() ? artworks.map(texture) : artworks.slice(0, 4).map((a) => src(a, 960))
    const total = urls.length + 1
    urls.forEach((u) => preloadImage(u).then(() => !cancelled && loaded++))
    fontsReady().then(() => !cancelled && loaded++)

    const counter = el.querySelector<HTMLElement>('.preloader__count')!
    const bar = el.querySelector<HTMLElement>('.preloader__bar')!

    const ctx = gsap.context(() => {
      const split = SplitText.create('.preloader__word', { type: 'chars', charsClass: 'preloader__char' })
      gsap.set(split.chars, { yPercent: 115, rotate: 6 })
      gsap.set('.preloader__caption, .preloader__foot', { opacity: 0, y: 14 })

      // hold the reveal until the display face is here (capped) so no fallback glyph ever shows
      Promise.race([fontsReady(), wait(700)]).then(() => {
        if (cancelled) return
        gsap.to(split.chars, { yPercent: 0, rotate: 0, duration: 1.3, ease: 'expo.out', stagger: 0.045 })
        gsap.to('.preloader__caption, .preloader__foot', { opacity: 1, y: 0, duration: 1, ease: 'power3.out', delay: 0.35, stagger: 0.08 })
      })

      // runs from the ticker (outside the context), so it's tracked and killed by hand
      const exit = () => {
        gsap.ticker.remove(tick)
        if (cancelled) return
        const tl = (exitTl = gsap.timeline({
          onComplete: () => {
            try {
              sessionStorage.setItem(KEY, '1')
            } catch {
              /* private mode — worst case the intro plays again */
            }
            setActive(false)
          },
        }))
        tl.to(split.chars, { yPercent: -115, rotate: -4, duration: 0.8, ease: 'expo.in', stagger: 0.03 }, 0.1)
          .to('.preloader__caption, .preloader__foot', { opacity: 0, y: -12, duration: 0.5, ease: 'power2.in', stagger: 0.05 }, 0)
          .to('.preloader__panel', { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.15, ease: 'expo.inOut' }, 0.6)
          .to('.preloader__inner', { yPercent: -22, duration: 1.15, ease: 'expo.inOut' }, 0.6)
          .to('.preloader__under', { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.15, ease: 'expo.inOut' }, 0.72)
          // hand over while the curtain is still moving so the page's entrance overlaps it
          .add(() => {
            unlock()
            finishIntro()
          }, 1.05)
      }

      const tick = () => {
        const t = (performance.now() - start) / 1000
        const real = t >= CAP ? 1 : loaded / total
        const goal = Math.min(real, t / MIN)
        shown += (goal - shown) * Math.min(1, 0.09 * gsap.ticker.deltaRatio())
        if (goal >= 1 && shown > 0.995) shown = 1
        counter.textContent = String(Math.round(shown * 100))
        bar.style.transform = `scaleX(${shown})`
        if (shown === 1) exit()
      }
      gsap.ticker.add(tick)
      return () => gsap.ticker.remove(tick)
    }, el)

    return () => {
      cancelled = true
      exitTl?.kill()
      ctx.revert()
      unlock()
    }
  }, [active])

  if (!active) return null
  return (
    <div ref={root} className="preloader" aria-hidden="true">
      <div className="preloader__under" />
      <div className="preloader__panel">
        <div className="preloader__inner">
          <div className="preloader__center">
            <span className="preloader__mask">
              <span className="preloader__word display">
                Softly <em>Drawn</em>
              </span>
            </span>
            <p className="preloader__caption eyebrow">by {site.artist} — hand-drawn character art</p>
          </div>
          <div className="preloader__foot">
            <span className="preloader__note">Every line by hand</span>
            <span className="preloader__counter">
              <span className="preloader__count">0</span>
              <span className="preloader__pct">%</span>
            </span>
          </div>
        </div>
        <span className="preloader__track">
          <span className="preloader__bar" />
        </span>
      </div>
    </div>
  )
}
