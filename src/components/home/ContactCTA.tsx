import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { ArrowUpRight } from 'lucide-react'
import { useGsap } from '../../lib/useGsap'
import { TLink } from '../../lib/transition'
import { site } from '../../data/site'
import { Socials } from '../shared/Socials'
import './ContactCTA.css'

gsap.registerPlugin(ScrollTrigger, SplitText)

/** The last word on the home page — a big invitation, a magnetic button and a candle glow that follows you. */
export function ContactCTA() {
  const root = useRef<HTMLElement>(null)

  useGsap(
    root,
    () => {
      const scope = root.current!
      const title = scope.querySelector<HTMLElement>('.cta__title')!
      const glow = scope.querySelector<HTMLElement>('.cta__glow')!
      const magnet = scope.querySelector<HTMLElement>('.cta__magnet')!
      const btn = scope.querySelector<HTMLElement>('.cta__btn')!
      const label = scope.querySelector<HTMLElement>('.cta__btn-label')!
      const mm = gsap.matchMedia()

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        SplitText.create(title, {
          type: 'lines',
          mask: 'lines',
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.lines, {
              yPercent: 115,
              duration: 1.5,
              ease: 'expo.out',
              stagger: 0.12,
              scrollTrigger: { trigger: title, start: 'top 82%', once: true },
            }),
        })
        gsap.from(scope.querySelectorAll('.cta__reveal'), {
          y: 24,
          opacity: 0,
          duration: 1.1,
          ease: 'power3.out',
          stagger: 0.08,
          scrollTrigger: { trigger: title, start: 'top 82%', once: true },
        })
        gsap.from(btn, {
          scale: 0.6,
          opacity: 0,
          duration: 1.4,
          ease: 'expo.out',
          scrollTrigger: { trigger: magnet, start: 'top 90%', once: true },
        })
      })

      // pointer-driven niceties: desktop mouse only
      mm.add('(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)', () => {
        // candle glow: lerp toward the pointer, written as CSS custom properties that drive a transform
        const g = { x: 0, y: 0, tx: 0, ty: 0 }
        let raf = 0
        const loop = () => {
          g.x += (g.tx - g.x) * 0.08
          g.y += (g.ty - g.y) * 0.08
          glow.style.setProperty('--gx', `${g.x.toFixed(1)}px`)
          glow.style.setProperty('--gy', `${g.y.toFixed(1)}px`)
          raf = Math.abs(g.tx - g.x) + Math.abs(g.ty - g.y) > 0.3 ? requestAnimationFrame(loop) : 0
        }
        const onMove = (e: PointerEvent) => {
          const r = scope.getBoundingClientRect()
          // offsets from the glow's resting centre (50% / 55% of the section)
          g.tx = e.clientX - r.left - r.width * 0.5
          g.ty = e.clientY - r.top - r.height * 0.55
          if (!raf) raf = requestAnimationFrame(loop)
        }
        const onLeave = () => {
          g.tx = 0
          g.ty = 0
          if (!raf) raf = requestAnimationFrame(loop)
        }
        scope.addEventListener('pointermove', onMove, { passive: true })
        scope.addEventListener('pointerleave', onLeave)

        // magnetic button
        const bx = gsap.quickTo(btn, 'x', { duration: 0.8, ease: 'power3.out' })
        const by = gsap.quickTo(btn, 'y', { duration: 0.8, ease: 'power3.out' })
        const lx = gsap.quickTo(label, 'x', { duration: 0.8, ease: 'power3.out' })
        const ly = gsap.quickTo(label, 'y', { duration: 0.8, ease: 'power3.out' })
        const onMagnet = (e: PointerEvent) => {
          const r = btn.getBoundingClientRect()
          const dx = e.clientX - (r.left + r.width / 2)
          const dy = e.clientY - (r.top + r.height / 2)
          bx(dx * 0.35)
          by(dy * 0.35)
          lx(dx * 0.15)
          ly(dy * 0.15)
        }
        const onMagnetLeave = () => {
          bx(0)
          by(0)
          lx(0)
          ly(0)
        }
        magnet.addEventListener('pointermove', onMagnet, { passive: true })
        magnet.addEventListener('pointerleave', onMagnetLeave)

        return () => {
          cancelAnimationFrame(raf)
          scope.removeEventListener('pointermove', onMove)
          scope.removeEventListener('pointerleave', onLeave)
          magnet.removeEventListener('pointermove', onMagnet)
          magnet.removeEventListener('pointerleave', onMagnetLeave)
          glow.style.removeProperty('--gx')
          glow.style.removeProperty('--gy')
        }
      })
    },
    [],
  )

  return (
    <section ref={root} data-theme="dark" className="section cta" aria-labelledby="cta-title">
      <div className="cta__glow" aria-hidden="true" />
      <div className="container cta__inner">
        <p className="eyebrow cta__eyebrow cta__reveal">
          <span className="dot-live" aria-hidden="true" />
          {site.status}
        </p>

        <h2 id="cta-title" className="display cta__title">
          Let’s draw
          <br />
          your <em>character.</em>
        </h2>

        <div className="cta__row">
          <div className="cta__copy">
            <p className="cta__lede cta__reveal">
              Tell me about them — who they are, the mood, the moment you’d love to see. Send references if you have them; I’ll take it
              from there.
            </p>
            <div className="cta__socials cta__reveal">
              <Socials />
            </div>
          </div>

          <div className="cta__magnet">
            <TLink to="/contact" className="cta__btn" aria-label="Start a commission">
              <span className="cta__btn-label">
                Start a<br />
                commission
                <ArrowUpRight size={20} aria-hidden="true" />
              </span>
            </TLink>
          </div>
        </div>
      </div>
    </section>
  )
}
