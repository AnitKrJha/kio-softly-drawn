import { useSectionThemes } from '../lib/theme'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { Hero } from '../components/home/Hero'
import { Marquee } from '../components/home/Marquee'
import { About } from '../components/home/About'
import { SelectedWorks } from '../components/home/SelectedWorks'
import { HandDrawn } from '../components/home/HandDrawn'
import { Services } from '../components/home/Services'
import { Reviews } from '../components/home/Reviews'
import { Process } from '../components/home/Process'
import { ContactCTA } from '../components/home/ContactCTA'

export function Home() {
  useDocumentTitle()
  useSectionThemes()
  return (
    <>
      <Hero />
      <Marquee />
      <About />
      <SelectedWorks />
      <HandDrawn />
      <Services />
      <Reviews />
      <Process />
      <ContactCTA />
    </>
  )
}
