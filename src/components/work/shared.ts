import { artworks, caption, categories, type Artwork } from '../../data/artworks'
import { introDone } from '../../lib/intro'

/** 1 → "01" */
export const pad = (n: number) => String(n).padStart(2, '0')

export const total = artworks.length
export const wrapIndex = (i: number) => (i + total) % total

export const eyebrowFor = caption

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

/* ───────── filters — derived from the data, never hard-coded ───────── */
export interface Filter {
  id: string
  label: string
  count: number
  test: (a: Artwork) => boolean
}

export const filters: Filter[] = [
  { id: 'all', label: 'All', test: () => true },
  ...categories
    .filter((c) => artworks.some((a) => a.categories.includes(c)))
    .map((c) => ({ id: slugify(c), label: c, test: (a: Artwork) => a.categories.includes(c) })),
].map((f) => ({ ...f, count: artworks.filter(f.test).length }))

/* ───────── view-transition bookkeeping ─────────
 * `art-${slug}` may live on exactly one element per page. The gallery only names the card of the
 * piece you just came back from (so it morphs home); the clicked card is named at click time. */
let lastViewed: string | null = null
export const getLastViewed = () => lastViewed
export const setLastViewed = (slug: string) => {
  lastViewed = slug
}

export const vtName = (slug: string) => `art-${slug}`

/** Resolve an anchor click to a same-origin pathname (or null). */
export function clickedPath(e: MouseEvent): string | null {
  const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
  if (!a) return null
  const url = new URL(a.href, location.href)
  return url.origin === location.origin ? url.pathname : null
}

/* ───────── entrance timing ───────── */
let introFinished = false
introDone.then(() => (introFinished = true))

/**
 * Run `fn` once the preloader has finished (immediately if it already has).
 * A generous fallback guarantees content never stays hidden. Returns a cancel function.
 */
export function afterIntro(fn: () => void, fallbackMs = 6000): () => void {
  if (introFinished) {
    fn()
    return () => {}
  }
  let alive = true
  const run = () => {
    if (!alive) return
    alive = false
    window.clearTimeout(timer)
    fn()
  }
  const timer = window.setTimeout(run, fallbackMs)
  introDone.then(run)
  return () => {
    alive = false
    window.clearTimeout(timer)
  }
}
