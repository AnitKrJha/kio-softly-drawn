import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { useGsap } from '../../lib/useGsap'
import { canRunHeavyGL } from '../../lib/env'
import { getStroke, strokeToSvgPath } from '../../gl/strokePath'
import type { PenGL } from '../../gl/PenGL'
import { Seal } from '../shared/Seal'
import './HandDrawn.css'

gsap.registerPlugin(ScrollTrigger, SplitText)

const PILLARS = [
  { n: 'i', title: 'Sketch', text: 'Gesture and pose come first — loose lines until the character feels right.' },
  { n: 'ii', title: 'Line', text: 'Clean, deliberate linework, drawn over the sketch by hand.' },
  { n: 'iii', title: 'Colour & light', text: 'Soft colour, careful rendering and light, layered in stroke by stroke.' },
]

const VB_W = 1000
const LUT_SIZE = 320

type Mode = 'gl' | 'svg'

/** "No AI" — a pen writes a glowing line as you scroll (WebGL on desktop, SVG everywhere else). */
export function HandDrawn() {
  const root = useRef<HTMLElement>(null)
  const pinRef = useRef<HTMLDivElement>(null)
  const glHost = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const svgWrap = useRef<HTMLDivElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const glowRef = useRef<SVGPathElement>(null)
  const nibRef = useRef<HTMLDivElement>(null)
  const glRef = useRef<PenGL | null>(null)
  const progress = useRef(0)
  const svgState = useRef<{ len: number; lut: Float32Array; scale: number } | null>(null)

  const [mode, setMode] = useState<Mode>(() => (canRunHeavyGL() ? 'gl' : 'svg'))

  const { d, vbH, aspect } = useMemo(() => {
    const stroke = getStroke(260)
    return { d: strokeToSvgPath(stroke, VB_W), vbH: Math.round(stroke.aspect * VB_W * 100) / 100, aspect: stroke.aspect }
  }, [])

  /** push progress (0..1) into whichever renderer is live */
  const apply = (p: number) => {
    progress.current = p
    glRef.current?.setProgress(p)
    const s = svgState.current
    const path = pathRef.current
    const nib = nibRef.current
    if (!s || !path || !nib) return
    const off = s.len * (1 - p)
    path.style.strokeDashoffset = `${off}`
    if (glowRef.current) glowRef.current.style.strokeDashoffset = `${off}`
    const f = p * (LUT_SIZE - 1)
    const i = Math.min(LUT_SIZE - 2, Math.floor(f))
    const t = f - i
    const x = s.lut[i * 2] + (s.lut[i * 2 + 2] - s.lut[i * 2]) * t
    const y = s.lut[i * 2 + 1] + (s.lut[i * 2 + 3] - s.lut[i * 2 + 1]) * t
    // lean the nib a touch against its direction of travel
    const dx = s.lut[i * 2 + 2] - s.lut[i * 2]
    const lean = Math.max(-1, Math.min(1, dx / 8)) * -7
    const lifted = p <= 0.002 || p >= 0.998
    nib.style.transform = `translate3d(${x * s.scale}px, ${y * s.scale}px, 0) rotate(${lean}deg) translate3d(0, ${lifted ? -8 : 0}px, 0)`
    nib.classList.toggle('is-drawing', !lifted)
  }

  // ── WebGL pen (desktop, capable GPUs only) ──
  useEffect(() => {
    if (mode !== 'gl' || !glHost.current) return
    let cancelled = false
    let gl: PenGL | null = null
    import('../../gl/PenGL')
      .then(({ PenGL }) => {
        if (cancelled || !glHost.current) return
        gl = new PenGL({ container: glHost.current, stage: stageRef.current })
        gl.setProgress(progress.current)
        glRef.current = gl
      })
      .catch(() => !cancelled && setMode('svg'))
    return () => {
      cancelled = true
      gl?.dispose()
      glRef.current = null
    }
  }, [mode])

  // ── SVG fallback: measure the path once, keep a point lookup table, track the rendered scale ──
  useEffect(() => {
    if (mode !== 'svg') return
    const path = pathRef.current
    const wrap = svgWrap.current
    if (!path || !wrap) return
    const len = path.getTotalLength()
    const lut = new Float32Array(LUT_SIZE * 2)
    for (let i = 0; i < LUT_SIZE; i++) {
      const pt = path.getPointAtLength((i / (LUT_SIZE - 1)) * len)
      lut[i * 2] = pt.x
      lut[i * 2 + 1] = pt.y
    }
    for (const el of [path, glowRef.current]) {
      if (!el) continue
      el.style.strokeDasharray = `${len}`
      el.style.strokeDashoffset = `${len}`
    }
    const state = { len, lut, scale: 1 }
    svgState.current = state
    const measure = () => {
      state.scale = wrap.clientWidth / VB_W || 1
      wrap.style.setProperty('--hd-scale', state.scale.toFixed(4))
      apply(progress.current)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(wrap)
    return () => {
      ro.disconnect()
      svgState.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // ── scroll choreography ──
  useGsap(
    root,
    () => {
      const mm = gsap.matchMedia()
      mm.add(
        {
          // pin only with a mouse on a wide screen; touch devices scroll straight through (cheaper, no jank)
          pin: '(min-width: 900px) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
          reduce: '(prefers-reduced-motion: reduce)',
        },
        (c) => {
          const { pin, reduce } = c.conditions as Record<string, boolean>
          const scope = root.current!
          const pillars = [...scope.querySelectorAll<HTMLElement>('.handdrawn__pillar')]
          if (reduce) {
            apply(1)
            return
          }

          SplitText.create(titleRef.current, {
            type: 'lines',
            mask: 'lines',
            autoSplit: true,
            onSplit: (self) =>
              gsap.from(self.lines, {
                yPercent: 110,
                duration: 1.3,
                ease: 'expo.out',
                stagger: 0.1,
                scrollTrigger: { trigger: titleRef.current, start: 'top 82%', once: true },
              }),
          })
          gsap.from(scope.querySelectorAll('.handdrawn__reveal'), {
            y: 24,
            opacity: 0,
            duration: 1.1,
            ease: 'power3.out',
            stagger: 0.08,
            scrollTrigger: { trigger: scope.querySelector('.handdrawn__head'), start: 'top 75%', once: true },
          })

          const proxy = { p: 0 }
          const draw = () => apply(proxy.p)

          if (pin) {
            const tl = gsap.timeline({
              defaults: { ease: 'none' },
              scrollTrigger: {
                trigger: pinRef.current,
                start: 'top top',
                end: '+=170%',
                pin: true,
                scrub: 0.6,
                anticipatePin: 1,
                invalidateOnRefresh: true,
              },
            })
            tl.to(proxy, { p: 1, duration: 0.86, onUpdate: draw }, 0.04)
            pillars.forEach((el, i) => {
              tl.fromTo(el, { opacity: 0.3 }, { opacity: 1, duration: 0.1 }, 0.04 + i * 0.3)
              tl.fromTo(el.querySelector('.handdrawn__pillar-rule'), { scaleX: 0 }, { scaleX: 1, duration: 0.26 }, 0.04 + i * 0.3)
            })
            tl.to({}, { duration: 0.06 }) // a beat to admire the finished line before unpinning
          } else {
            gsap.to(proxy, {
              p: 1,
              ease: 'none',
              onUpdate: draw,
              scrollTrigger: { trigger: stageRef.current, start: 'top 88%', end: 'bottom 35%', scrub: 0.5 },
            })
            pillars.forEach((el) => {
              gsap.from(el, {
                opacity: 0,
                y: 28,
                duration: 1,
                ease: 'power3.out',
                scrollTrigger: { trigger: el, start: 'top 90%', once: true },
              })
              gsap.fromTo(
                el.querySelector('.handdrawn__pillar-rule'),
                { scaleX: 0 },
                { scaleX: 1, duration: 1.2, ease: 'power3.inOut', scrollTrigger: { trigger: el, start: 'top 88%', once: true } },
              )
            })
          }
        },
      )
    },
    [],
  )

  return (
    <section ref={root} data-theme="dark" className={`handdrawn handdrawn--${mode}`} aria-labelledby="handdrawn-title">
      <div ref={pinRef} className="handdrawn__pin">
        {mode === 'gl' && <div ref={glHost} className="handdrawn__gl" aria-hidden="true" />}

        <div className="container handdrawn__inner">
          <header className="handdrawn__head">
            <div>
              <p className="eyebrow handdrawn__reveal">Hand-drawn · No AI</p>
              <h2 ref={titleRef} id="handdrawn-title" className="display handdrawn__title">
                Every line,
                <br />
                drawn <em>by hand</em>.
              </h2>
            </div>
            <p className="handdrawn__lede handdrawn__reveal">
              <strong>No AI.</strong> Every piece is drawn stroke by stroke — sketch, line, colour, light.
            </p>
          </header>

          <div ref={stageRef} className="handdrawn__stage" aria-hidden="true">
            {mode === 'svg' && (
              <div ref={svgWrap} className="handdrawn__svg" style={{ aspectRatio: `${VB_W} / ${vbH}`, '--hd-aspect': aspect } as CSSProperties}>
                <svg viewBox={`0 0 ${VB_W} ${vbH}`} preserveAspectRatio="xMidYMid meet" focusable="false">
                  <defs>
                    <linearGradient id="handdrawn-ink" x1="0" y1="0" x2={VB_W} y2="0" gradientUnits="userSpaceOnUse">
                      <stop offset="0" stopColor="var(--candle)" />
                      <stop offset="0.55" stopColor="var(--candle-soft)" />
                      <stop offset="1" stopColor="var(--rose)" />
                    </linearGradient>
                  </defs>
                  <path className="handdrawn__guide" d={d} />
                  <path ref={glowRef} className="handdrawn__glow" d={d} stroke="url(#handdrawn-ink)" />
                  <path ref={pathRef} className="handdrawn__ink" d={d} stroke="url(#handdrawn-ink)" />
                </svg>
                <div ref={nibRef} className="handdrawn__nib">
                  <span className="handdrawn__nib-glow" />
                  <svg viewBox="0 0 40 40" focusable="false">
                    {/* a fountain-pen nib, point at bottom-left */}
                    <path
                      d="M1.5 38.5 L12 17.5 C16 12 22 7.5 28 3.5 L36.5 12 C32.5 18 28 24 22.5 28 Z"
                      fill="var(--candle)"
                    />
                    <path d="M1.5 38.5 L17.5 22.5" stroke="var(--ink)" strokeWidth="1.4" strokeLinecap="round" />
                    <circle cx="19" cy="21" r="2.2" fill="var(--ink)" />
                    <path d="M28 3.5 L36.5 12 L39 9.5 L30.5 1 Z" fill="var(--candle-soft)" />
                  </svg>
                </div>
              </div>
            )}
          </div>

          <footer className="handdrawn__foot">
            <ol className="handdrawn__pillars">
              {PILLARS.map((p) => (
                <li key={p.title} className="handdrawn__pillar">
                  <span className="handdrawn__pillar-rule" aria-hidden="true" />
                  <p className="handdrawn__pillar-title">
                    <span className="handdrawn__pillar-n serif">{p.n}.</span> {p.title}
                  </p>
                  <p className="handdrawn__pillar-text muted">{p.text}</p>
                </li>
              ))}
            </ol>
            <Seal size={104} className="handdrawn__seal" />
          </footer>
        </div>
      </div>
    </section>
  )
}
