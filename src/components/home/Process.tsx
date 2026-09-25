import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { Clock } from 'lucide-react'
import { useGsap } from '../../lib/useGsap'
import './Process.css'

gsap.registerPlugin(ScrollTrigger, SplitText)

// Generic by design — no invented revision counts, deposits or prices.
// TODO(kio): confirm the steps match how you work (e.g. whether you share the sketch for feedback, file formats).
const STEPS = [
  { title: 'Brief', text: 'You share your character, references, pose and mood — anything that helps me see them the way you do.' },
  { title: 'Sketch', text: 'A loose sketch of the pose and composition: the foundation everything else is built on.' },
  { title: 'Line & colour', text: 'Clean linework over the sketch, then colour to set the palette and the mood.' },
  { title: 'Render & light', text: 'Soft rendering, detail and light — the stage where the character really comes alive.' },
  { title: 'Delivery', text: 'Your finished piece, sent to you as a digital file.' },
]

/** How working together works — five steps on a line that draws itself as you scroll. */
export function Process() {
  const root = useRef<HTMLElement>(null)

  useGsap(
    root,
    () => {
      const scope = root.current!
      const title = scope.querySelector('.process__title')
      const timeline = scope.querySelector<HTMLElement>('.process__timeline')!
      const line = scope.querySelector<HTMLElement>('.process__line')!
      const steps = [...scope.querySelectorAll<HTMLElement>('.process__step')]
      const mm = gsap.matchMedia()

      mm.add(
        {
          desktop: '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
          mobile: '(max-width: 1023.98px) and (prefers-reduced-motion: no-preference)',
        },
        (c) => {
          const { desktop } = c.conditions as Record<string, boolean>

          SplitText.create(title, {
            type: 'lines',
            mask: 'lines',
            autoSplit: true,
            onSplit: (self) =>
              gsap.from(self.lines, {
                yPercent: 110,
                duration: 1.3,
                ease: 'expo.out',
                stagger: 0.1,
                scrollTrigger: { trigger: title, start: 'top 85%', once: true },
              }),
          })
          gsap.from(scope.querySelectorAll('.process__intro'), {
            y: 20,
            opacity: 0,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: { trigger: title, start: 'top 80%', once: true },
          })

          if (desktop) {
            // one scrubbed timeline: the line draws left → right and each step lights as it's reached
            const tl = gsap.timeline({
              defaults: { ease: 'none' },
              scrollTrigger: { trigger: timeline, start: 'top 78%', end: 'bottom 45%', scrub: 0.6 },
            })
            tl.fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: 1 }, 0)
            steps.forEach((step, i) => {
              const at = (i / steps.length) * 0.92
              tl.fromTo(step.querySelector('.process__dot i'), { scale: 0 }, { scale: 1, duration: 0.06 }, at)
              tl.fromTo(
                step.querySelector('.process__card'),
                { opacity: 0, y: 40 },
                { opacity: 1, y: 0, duration: 0.16, ease: 'power2.out' },
                at,
              )
            })
          } else {
            gsap.fromTo(
              line,
              { scaleY: 0 },
              {
                scaleY: 1,
                ease: 'none',
                scrollTrigger: { trigger: timeline, start: 'top 70%', end: 'bottom 70%', scrub: 0.4 },
              },
            )
            steps.forEach((step) => {
              const st = { trigger: step, start: 'top 72%', once: true }
              gsap.fromTo(step.querySelector('.process__dot i'), { scale: 0 }, { scale: 1, duration: 0.6, ease: 'back.out(3)', scrollTrigger: st })
              gsap.from(step.querySelector('.process__card'), { opacity: 0, y: 30, duration: 1, ease: 'power3.out', scrollTrigger: { ...st, start: 'top 85%' } })
            })
          }
        },
      )
    },
    [],
  )

  return (
    <section ref={root} data-theme="dark" className="section process" aria-labelledby="process-title">
      <div className="container">
        <header className="process__head">
          <div>
            <p className="eyebrow process__intro">Process</p>
            <h2 id="process-title" className="display process__title">
              How we work <em>together</em>
            </h2>
          </div>
          <p className="process__lede process__intro">
            From your first message to the finished file, this is how a piece comes together.
          </p>
        </header>

        <div className="process__timeline">
          <div className="process__track" aria-hidden="true">
            <span className="process__line" />
          </div>
          <ol className="process__steps">
            {STEPS.map((s, i) => (
              <li key={s.title} className="process__step">
                <span className="process__dot" aria-hidden="true">
                  <i />
                </span>
                <div className="process__card">
                  <span className="process__num display" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="process__step-title serif">{s.title}</h3>
                  <p className="process__step-text">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <p className="process__note">
          <Clock size={16} aria-hidden="true" />
          Past orders were delivered in 3–7 days.
        </p>
      </div>
    </section>
  )
}
