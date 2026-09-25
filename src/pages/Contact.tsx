import { useRef } from 'react'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { site } from '../data/site'
import { introDone } from '../lib/intro'
import { useSectionThemes } from '../lib/theme'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { useGsap } from '../lib/useGsap'
import { Seal } from '../components/shared/Seal'
import { Socials } from '../components/shared/Socials'
import { ContactForm } from '../components/contact/ContactForm'
import { CopyEmail } from '../components/contact/CopyEmail'
import './Contact.css'

gsap.registerPlugin(SplitText)

const EMAIL: string = site.email

export function Contact() {
  useDocumentTitle('Contact')
  useSectionThemes()
  const root = useRef<HTMLElement>(null)

  useGsap(root, () => {
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', (ctx) => {
      const title = root.current?.querySelector<HTMLElement>('.contact__title')
      const items = gsap.utils.toArray<HTMLElement>('[data-reveal]', root.current)
      if (!title) return
      // hide before first paint (this runs in a layout effect) so nothing flashes before the preloader lifts
      gsap.set(title, { autoAlpha: 0 })
      gsap.set(items, { autoAlpha: 0, y: 28 })

      let alive = true
      let split: SplitText | undefined
      Promise.all([introDone, document.fonts?.ready]).then(() => {
        if (!alive) return
        ctx.add(() => {
          split = SplitText.create(title, {
            type: 'lines,words',
            mask: 'lines',
            autoSplit: true,
            onSplit: (self) => {
              gsap.set(title, { autoAlpha: 1 })
              return gsap.from(self.lines, { yPercent: 115, rotate: 2, duration: 1.4, ease: 'expo.out', stagger: 0.09 })
            },
          })
          gsap.to(items, { autoAlpha: 1, y: 0, duration: 1.2, ease: 'power3.out', stagger: 0.07, delay: 0.3, clearProps: 'transform' })
        })
      })
      return () => {
        alive = false
        split?.revert()
      }
    })
    return () => mm.revert()
  })

  return (
    <section ref={root} data-theme="light" className="contact container" aria-labelledby="contact-title">
      <header className="contact__head">
        <p className="eyebrow contact__eyebrow" data-reveal>
          Commissions &amp; enquiries
        </p>
        <h1 id="contact-title" className="contact__title display">
          Let’s make something <em>soft</em>.
        </h1>
      </header>

      <div className="contact__grid">
        <aside className="contact__aside">
          <p className="contact__intro serif" data-reveal>
            Tell me about your character — who they are, the mood you’re after, the moment you’d like to keep. Rough ideas are more than welcome; we’ll
            shape the rest together.
          </p>
          <p className="contact__note muted" data-reveal>
            Every piece is drawn by hand, from the first sketch to the final render. No AI.
          </p>

          <p className="chip contact__status" data-reveal>
            <span className="dot-live" aria-hidden="true" />
            {site.status}
          </p>

          {EMAIL && (
            <div className="contact__block" data-reveal>
              <p className="eyebrow">Write to me</p>
              <CopyEmail email={EMAIL} />
            </div>
          )}

          <div className="contact__block" data-reveal>
            <p className="eyebrow">{EMAIL ? 'Elsewhere' : 'Find me on'}</p>
            <Socials className="contact__socials" />
          </div>

          <div className="contact__seal" data-reveal>
            <Seal size={112} />
          </div>
        </aside>

        <div className="contact__main" data-reveal>
          <ContactForm />
        </div>
      </div>
    </section>
  )
}
