import { useLayoutEffect, type RefObject } from 'react'
import gsap from 'gsap'

/** Scoped gsap.context that reverts every tween/ScrollTrigger on unmount. */
export function useGsap(scope: RefObject<HTMLElement | null>, fn: (ctx: gsap.Context) => void, deps: unknown[] = []) {
  useLayoutEffect(() => {
    if (!scope.current) return
    const ctx = gsap.context((self) => fn(self), scope.current)
    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
