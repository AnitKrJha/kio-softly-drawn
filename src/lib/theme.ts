import { useLayoutEffect } from 'react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export type Theme = 'dark' | 'light'

export const setTheme = (t: Theme) => {
  document.documentElement.dataset.theme = t
}

/**
 * Sections declare `data-theme="dark|light"`; as each one crosses the middle of
 * the viewport the whole page eases into its palette (body bg/fg transition in CSS).
 */
export function useSectionThemes(deps: unknown[] = []) {
  useLayoutEffect(() => {
    setTheme('dark')
    const triggers = [...document.querySelectorAll<HTMLElement>('main [data-theme]')].map((el) =>
      ScrollTrigger.create({
        trigger: el,
        start: 'top 55%',
        end: 'bottom 55%',
        onToggle: (self) => self.isActive && setTheme(el.dataset.theme as Theme),
      }),
    )
    return () => triggers.forEach((t) => t.kill())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
