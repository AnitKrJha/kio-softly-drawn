import manifest from './art-manifest.json'

export type Kind = 'Commission' | 'Personal'
export type Category = 'Portraits' | 'Couples' | 'Scenes' | 'Book covers' | 'Icons & chibi'
/** Matches the services on the home page and `/contact?type=` */
export type Service = 'character-art' | 'original-character' | 'book-cover' | 'pfp-icon'

export interface Detail {
  /** focal point in % of the image */
  x: number
  y: number
  label: string
}

export interface Artwork {
  slug: string
  title: string
  /** only set when we actually know — never guessed */
  kind?: Kind
  categories: Category[]
  service: Service
  year?: number
  blurb: string
  details: Detail[]
  w: number
  h: number
  color: string
  palette: string[]
  lqip: string
  sizes: number[]
}

type Meta = Omit<Artwork, 'w' | 'h' | 'color' | 'palette' | 'lqip' | 'sizes'>

// Every image is one of Kio's untouched originals (images/Originals) — only framing crops, no enhancement.
// Order here is the order everywhere on the site.
// TODO(kio): mark which pieces were commissions vs personal work, and add years.
const meta: Meta[] = [
  {
    slug: 'autumn-beanie',
    title: 'Autumn Beanie',
    categories: ['Portraits'],
    service: 'character-art',
    blurb:
      'A semi-realistic portrait — a slouchy grey beanie, candy-coloured hair clips, a dusting of freckles and glossy lips above a chunky orange knit. Soft skin, natural light, every strand of the bob drawn in.',
    details: [
      { x: 56, y: 33, label: 'Eyes & freckles' },
      { x: 46, y: 18, label: 'Hair clips' },
      { x: 57, y: 55, label: 'Lips & nails' },
    ],
  },
  {
    slug: 'vows-in-bloom',
    title: 'Vows in Bloom',
    kind: 'Commission',
    categories: ['Couples'],
    service: 'original-character',
    year: 2026,
    blurb:
      'A wedding portrait for a pair of original characters — a forehead kiss beneath an arch of roses, a lace gown drawn stitch by stitch, a bouquet of peach roses and the cake waiting in the wings.',
    details: [
      { x: 51, y: 24, label: 'The kiss' },
      { x: 32, y: 68, label: 'Bouquet' },
      { x: 91, y: 53, label: 'Wedding cake' },
    ],
  },
  {
    slug: 'moonlit-pond',
    title: 'By the Moonlit Pond',
    categories: ['Scenes'],
    service: 'character-art',
    blurb:
      'Knees drawn up at the water’s edge under a crescent moon — peach hair tied with a ribbon, a lavender slip dress, bellflowers hanging overhead, butterflies, and a single lotus drifting by.',
    details: [
      { x: 49, y: 37, label: 'Sleeping face' },
      { x: 86, y: 16, label: 'Bellflowers' },
      { x: 15, y: 89, label: 'Lotus' },
    ],
  },
  {
    // The title is spelled "Sentinal" on the cover artwork itself.
    // TODO(kio): confirm the book's title spelling.
    slug: 'celestial-sentinel',
    title: 'Celestial Sentinal',
    categories: ['Book covers'],
    service: 'book-cover',
    blurb:
      'Cover art for “A Magical Girl Saga” — a pink-haired heroine in white and violet, crystal staff raised, drifting through pastel clouds and small orbiting planets, with the title set into the sky.',
    details: [
      { x: 53, y: 35, label: 'Heroine' },
      { x: 23, y: 39, label: 'Crystal staff' },
      { x: 57, y: 51, label: 'Heart brooch' },
    ],
  },
  {
    slug: 'tulip',
    title: 'Tulip',
    categories: ['Portraits'],
    service: 'character-art',
    blurb:
      'Long, softly layered hair, a beauty mark, parted glossy lips and a single pink tulip — a quiet semi-realistic portrait in blush and taupe.',
    details: [
      { x: 60, y: 30, label: 'Face' },
      { x: 83, y: 47, label: 'Tulip' },
      { x: 78, y: 76, label: 'Hand' },
    ],
  },
  {
    slug: 'candlelit-library',
    title: 'Candlelit Reading Nook',
    categories: ['Scenes'],
    service: 'character-art',
    blurb:
      'Lost in a book in a library that never closes — a black knit sweater, a plaid armchair, and shelves of candlelight glowing behind him.',
    details: [
      { x: 54, y: 32, label: 'Face' },
      { x: 38, y: 67, label: 'Hands & book' },
      { x: 92, y: 36, label: 'Candlelight' },
    ],
  },
  {
    slug: 'sketchbook-nook',
    title: 'The Sketchbook',
    categories: ['Scenes'],
    service: 'character-art',
    blurb:
      'A companion to the Candlelit Reading Nook — the same armchair and library, a different reader: knees drawn up, a sketchbook held close, a cable-knit sweater and a plaid skirt in the glow of the fire.',
    details: [
      { x: 51, y: 38, label: 'Face' },
      { x: 50, y: 52, label: 'Sketchbook' },
      { x: 13, y: 88, label: 'Fireplace' },
    ],
  },
  {
    slug: 'rose-garden',
    title: 'Tender, in the Rose Garden',
    categories: ['Couples', 'Scenes'],
    service: 'character-art',
    blurb:
      'Two foreheads touching on a path of fallen petals — a cable-knit sweater, long pink waves and a sun-washed rose garden, soft as a held breath.',
    details: [
      { x: 51, y: 33, label: 'The moment' },
      { x: 58, y: 85, label: 'Hands' },
      { x: 16, y: 18, label: 'Roses' },
    ],
  },
  {
    slug: 'beneath-the-minarets',
    title: 'Beneath the Minarets',
    categories: ['Portraits', 'Scenes'],
    service: 'character-art',
    blurb:
      'A mauve scarf and a mint robe edged with gold brocade, a book and prayer beads held close — framed by a carved arch against a starlit sky and distant minarets.',
    details: [
      { x: 48, y: 19, label: 'Face' },
      { x: 42, y: 54, label: 'Book & prayer beads' },
      { x: 24, y: 55, label: 'Minaret' },
    ],
  },
  {
    // TODO(kio): this piece shows the client's reference photo in the corner — ok to show publicly?
    slug: 'school-sweethearts',
    title: 'School Sweethearts',
    categories: ['Couples', 'Portraits'],
    service: 'character-art',
    blurb:
      'A webtoon-style couple portrait drawn from a photo — the same playful pose, school blazers in beige and burgundy, Korean title lettering and chalky doodled stars on crumpled blue paper.',
    details: [
      { x: 32, y: 62, label: 'Her' },
      { x: 67, y: 37, label: 'Him' },
      { x: 28, y: 17, label: 'Lettering' },
    ],
  },
  {
    slug: 'starclip',
    title: 'Starclip',
    categories: ['Icons & chibi'],
    service: 'pfp-icon',
    blurb: 'An icon-ready portrait in glowing pink linework — star hair clips, a chrome heart and a sprinkle of glitter on the shoulder.',
    details: [
      { x: 48, y: 43, label: 'Eyes' },
      { x: 15, y: 38, label: 'Star clip' },
      { x: 8, y: 90, label: 'Chrome heart' },
    ],
  },
  {
    slug: 'strawberry-sweet',
    title: 'Strawberry Sweet',
    categories: ['Icons & chibi'],
    service: 'pfp-icon',
    blurb:
      'A chibi character in soft pastels — big green eyes, a starfish clip, pearl hair ties and ruffled layers, set against a playful strawberry-pop backdrop.',
    details: [
      { x: 53, y: 33, label: 'Face' },
      { x: 37, y: 19, label: 'Starfish clip' },
      { x: 58, y: 62, label: 'Ruffles' },
    ],
  },
]

const m = manifest as Record<string, { w: number; h: number; color: string; palette: string[]; lqip: string; sizes: number[] }>

export const artworks: Artwork[] = meta.map((a) => ({ ...a, ...m[a.slug] }))

export const bySlug = (slug?: string) => artworks.find((a) => a.slug === slug)

export const categories: Category[] = ['Portraits', 'Couples', 'Scenes', 'Book covers', 'Icons & chibi']

/** Short label shown in captions: the kind when known, otherwise the first category. */
export const caption = (a: Artwork) => [a.kind ?? a.categories[0], a.year].filter(Boolean).join(' · ')

export const serviceLabel: Record<Service, string> = {
  'character-art': 'Character art',
  'original-character': 'Original characters',
  'book-cover': 'Book covers',
  'pfp-icon': 'PFP & icons',
}

/** Other pieces that share a category — for "more like this". */
export const related = (a: Artwork, n = 3) => {
  const others = artworks.filter((o) => o.slug !== a.slug)
  const score = (o: Artwork) => o.categories.filter((c) => a.categories.includes(c)).length * 2 + (o.service === a.service ? 1 : 0)
  return [...others].sort((x, y) => score(y) - score(x)).slice(0, n)
}

export const src = (a: Artwork, width = 960) => {
  const size = a.sizes.find((s) => s >= width) ?? a.sizes[a.sizes.length - 1]
  return `/art/${a.slug}-${size}.webp`
}

export const srcSet = (a: Artwork) => a.sizes.map((s) => `/art/${a.slug}-${s}.webp ${s}w`).join(', ')

export const texture = (a: Artwork) => `/art/${a.slug}-tex.webp`

export const full = (a: Artwork) => `/art/${a.slug}-${a.sizes[a.sizes.length - 1]}.webp`
