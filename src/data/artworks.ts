import manifest from './art-manifest.json'

export type Kind = 'Commission' | 'Personal'
export type Category = 'Fantasy' | 'Couples' | 'Portraits'

export interface Detail {
  /** focal point in % of the image */
  x: number
  y: number
  label: string
}

export interface Artwork {
  slug: string
  title: string
  kind: Kind
  categories: Category[]
  year?: number
  blurb: string
  palette: string[]
  details: Detail[]
  w: number
  h: number
  color: string
  lqip: string
  sizes: number[]
}

type Meta = Omit<Artwork, 'w' | 'h' | 'color' | 'lqip' | 'sizes'>

// Order here is the order everywhere on the site.
const meta: Meta[] = [
  {
    slug: 'vows-in-bloom',
    title: 'Vows in Bloom',
    kind: 'Commission',
    categories: ['Couples'],
    year: 2026,
    blurb:
      'A wedding portrait for a pair of original characters — hand-rendered lace, a bouquet of blush roses and a quiet forehead kiss beneath an arch of blooms.',
    palette: ['#f6eee9', '#e79aa6', '#2a211f', '#c7d6e6'],
    details: [
      { x: 58, y: 13, label: 'The kiss' },
      { x: 29, y: 56, label: 'Bouquet' },
      { x: 42, y: 82, label: 'Lace' },
    ],
  },
  {
    slug: 'witch-knight',
    title: 'Witch Knight of the Glowing Wood',
    kind: 'Commission',
    categories: ['Fantasy'],
    year: 2026,
    blurb:
      'A witch in moonlit plate armour, greatsword drawn, wandering a forest lit by will-o’-wisps. Cold steel highlights against a deep teal atmosphere.',
    palette: ['#0e3a4a', '#58e1ff', '#2a2350', '#e3c26b'],
    details: [
      { x: 43, y: 17, label: 'Expression' },
      { x: 72, y: 24, label: 'Hilt & wings' },
      { x: 50, y: 43, label: 'Armour' },
    ],
  },
  {
    slug: 'candlelit-library',
    title: 'Candlelit Reading Nook',
    kind: 'Personal',
    categories: ['Portraits'],
    blurb:
      'Reading by candlelight in a library that never closes — a study in warm light, knit texture and a still, absorbed expression.',
    palette: ['#1b0f0a', '#f2b35b', '#6b2a1a', '#2b2b2b'],
    details: [
      { x: 55, y: 32, label: 'Face' },
      { x: 38, y: 70, label: 'Hands & book' },
      { x: 88, y: 20, label: 'Candlelight' },
    ],
  },
  {
    slug: 'forest-centaur',
    title: 'Forest Nymph Centaur',
    kind: 'Commission',
    categories: ['Fantasy'],
    year: 2026,
    blurb:
      'A forest centaur in a sunlit glade, green magic in her palms, a bluebird on her shoulder and a curious squirrel at her hooves.',
    palette: ['#f1e27a', '#4f7a2a', '#6b3b22', '#9fe36a'],
    details: [
      { x: 44, y: 16, label: 'Face' },
      { x: 60, y: 24, label: 'Bluebird' },
      { x: 80, y: 90, label: 'Squirrel' },
    ],
  },
  {
    slug: 'hush',
    title: 'Hush',
    kind: 'Personal',
    categories: ['Portraits'],
    blurb:
      'A pastel portrait with a secret. Soft skin rendering, glossy lips, knit texture and hand-doodled hearts drifting around the frame.',
    palette: ['#fbe6ea', '#f06b86', '#f7c948', '#ffffff'],
    details: [
      { x: 36, y: 46, label: 'Eyes' },
      { x: 52, y: 66, label: 'Lips' },
      { x: 66, y: 22, label: 'Ribbon' },
    ],
  },
  {
    slug: 'rose-garden',
    title: 'Tender, in the Rose Garden',
    kind: 'Personal',
    categories: ['Couples'],
    blurb:
      'Two foreheads touching on a path of fallen petals. A cinematic, sun-washed moment rendered in blush pinks and soft greens.',
    palette: ['#f7b6c4', '#5b8a4a', '#4a3226', '#fff4e6'],
    details: [
      { x: 51, y: 32, label: 'The moment' },
      { x: 60, y: 82, label: 'Hands' },
      { x: 15, y: 20, label: 'Roses' },
    ],
  },
]

const m = manifest as Record<string, { w: number; h: number; color: string; lqip: string; sizes: number[] }>

export const artworks: Artwork[] = meta.map((a) => ({ ...a, ...m[a.slug] }))

export const bySlug = (slug?: string) => artworks.find((a) => a.slug === slug)

export const categories: Category[] = ['Fantasy', 'Couples', 'Portraits']

export const src = (a: Artwork, width = 960) => {
  const size = a.sizes.find((s) => s >= width) ?? a.sizes[a.sizes.length - 1]
  return `/art/${a.slug}-${size}.webp`
}

export const srcSet = (a: Artwork) => a.sizes.map((s) => `/art/${a.slug}-${s}.webp ${s}w`).join(', ')

export const texture = (a: Artwork) => `/art/${a.slug}-tex.webp`

export const full = (a: Artwork) => `/art/${a.slug}-${a.sizes[a.sizes.length - 1]}.webp`
