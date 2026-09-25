import { forwardRef, useCallback, type AnchorHTMLAttributes, type MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { useLocation, useNavigate } from 'react-router'
import { prefersReducedMotion } from './env'
import { scrollToTarget, scrollToTop } from './scroll'

/** Navigate inside a View Transition so pages wipe and shared artwork morphs between routes. */
export function useTransitionNavigate() {
  const navigate = useNavigate()
  const location = useLocation()
  return useCallback(
    (to: string) => {
      const [path, hash] = to.split('#')
      const target = path || location.pathname
      if (target === location.pathname) {
        if (hash) scrollToTarget(`#${hash}`)
        else scrollToTop()
        return
      }
      const go = () => {
        flushSync(() => navigate(to))
        scrollToTop()
        if (hash) requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView())
      }
      if (!document.startViewTransition || prefersReducedMotion()) return go()
      document.startViewTransition(go)
    },
    [navigate, location.pathname],
  )
}

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }

export const TLink = forwardRef<HTMLAnchorElement, Props>(function TLink({ to, onClick, ...rest }, ref) {
  const go = useTransitionNavigate()
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    go(to)
  }
  return <a ref={ref} href={to} onClick={handle} {...rest} />
})
