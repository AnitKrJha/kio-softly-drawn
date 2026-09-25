import { useRef, type ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGsap } from '../../lib/useGsap'
import './Marquee.css'

gsap.registerPlugin(ScrollTrigger)

const ROW_A = ['Character art', 'Original characters', 'Book covers', 'PFP & icons', 'Hand-drawn, no AI']
// from Kio's own words: "soft and detailed visuals … natural expressions and clean rendering"
const ROW_B = ['Semi-realistic', 'Soft & detailed', 'Natural expressions', 'Clean rendering']

function Star() {
  return (
    <svg className="marquee__star" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 0c.6 6.4 5.6 11.4 12 12-6.4.6-11.4 5.6-12 12-.6-6.4-5.6-11.4-12-12C6.4 11.4 11.4 6.4 12 0Z" />
    </svg>
  )
}

/** One seamless-loop unit: the phrase set twice so a single group always outspans the viewport. */
function Group({ items, hidden }: { items: string[]; hidden?: boolean }) {
  const words: ReactNode[] = []
  for (let r = 0; r < 2; r++)
    items.forEach((t, i) =>
      words.push(
        <span className="marquee__item" key={`${r}-${i}`}>
          {t}
          <Star />
        </span>,
      ),
    )
  return (
    <span className="marquee__group" aria-hidden={hidden || undefined}>
      {words}
    </span>
  )
}

/**
 * A slim band of what I draw. Both rows loop forever; scroll speed pushes them faster and scroll
 * direction flips them. Velocity comes from ScrollTrigger so it works with Lenis and native touch.
 */
export function Marquee() {
  const root = useRef<HTMLElement>(null)

  useGsap(root, () => {
    const el = root.current
    if (!el) return
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const rows = gsap.utils.toArray<HTMLElement>('.marquee__track', el).map((track, i) => ({
        track,
        group: track.querySelector<HTMLElement>('.marquee__group')!,
        dir: i === 0 ? -1 : 1, // rows travel in opposite directions
        speed: i === 0 ? 55 : 38, // px/s at rest
        skew: i === 0,
        x: 0,
        w: 0,
      }))

      const measure = () =>
        rows.forEach((r) => {
          r.w = r.group.getBoundingClientRect().width
          if (r.w) r.x = gsap.utils.wrap(-r.w, 0, r.x)
        })
      measure()
      if (rows[1]) rows[1].x = -rows[1].w * 0.37 // offset so the rows' stars never line up
      const ro = new ResizeObserver(measure)
      rows.forEach((r) => ro.observe(r.group))

      let vel = 0 // px/s from ScrollTrigger
      let boost = 0
      let skew = 0
      let flow = 1 // +1 scrolling down, -1 scrolling up
      let running = false

      const tick = (_t: number, deltaMs: number) => {
        const dt = Math.min(deltaMs, 64) / 1000
        const f = dt * 60
        vel *= Math.pow(0.9, f) // onUpdate stops firing when scrolling stops — decay to rest
        const targetBoost = Math.min(Math.abs(vel) / 350, 9)
        boost += (targetBoost - boost) * (1 - Math.pow(0.88, f))
        const targetSkew = gsap.utils.clamp(-7, 7, vel / -260)
        skew += (targetSkew - skew) * (1 - Math.pow(0.85, f))
        for (const r of rows) {
          if (!r.w) continue
          r.x = gsap.utils.wrap(-r.w, 0, r.x + r.dir * flow * r.speed * (1 + boost) * dt)
          r.track.style.transform = `translate3d(${r.x.toFixed(2)}px,0,0)${r.skew ? ` skewX(${skew.toFixed(2)}deg)` : ''}`
        }
      }
      const run = (v: boolean) => {
        if (v === running) return
        running = v
        v ? gsap.ticker.add(tick) : gsap.ticker.remove(tick)
      }

      const st = ScrollTrigger.create({
        trigger: el,
        start: 'top bottom',
        end: 'bottom top',
        onToggle: (self) => run(self.isActive),
        onUpdate: (self) => {
          vel = self.getVelocity()
          if (self.direction) flow = self.direction
        },
      })
      run(st.isActive)

      return () => {
        run(false)
        ro.disconnect()
        rows.forEach((r) => (r.track.style.transform = ''))
      }
    })
    return () => mm.revert()
  }, [])

  return (
    <section ref={root} className="marquee" data-theme="dark" aria-label="What I draw">
      <p className="visually-hidden">
        {ROW_A.join(', ')}. {ROW_B.join(', ')}.
      </p>
      <div className="marquee__row marquee__row--a" aria-hidden="true">
        <div className="marquee__track">
          <Group items={ROW_A} />
          <Group items={ROW_A} hidden />
        </div>
      </div>
      <div className="marquee__row marquee__row--b" aria-hidden="true">
        <div className="marquee__track">
          <Group items={ROW_B} />
          <Group items={ROW_B} hidden />
        </div>
      </div>
    </section>
  )
}
