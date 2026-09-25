export const site = {
  name: 'Kio',
  studio: 'Softly Drawn',
  role: 'Digital artist',
  tagline: 'Semi-realistic character art, original characters, book covers & icons.',
  bio: [
    "Hi! I'm Kio — a digital artist specialising in semi-realistic character art, custom designs and original characters.",
    'My style leans toward soft, detailed visuals with a focus on natural expressions and clean rendering. Feel free to message me anytime.',
  ],
  email: 'jhaanushka493@gmail.com',
  status: 'Open for commissions',
  threads: { label: 'Threads', handle: '@softlydrawn_', url: 'https://www.threads.com/@softlydrawn_' },
  fiverr: {
    label: 'Fiverr',
    handle: 'ethereallogo',
    url: 'https://www.fiverr.com/ethereallogo',
    rating: 4.8,
    reviewCount: 4,
    breakdown: [
      { label: 'Communication', value: 4.8 },
      { label: 'Quality of delivery', value: 4.8 },
      { label: 'Value', value: 4.8 },
    ],
  },
  credit: { label: 'Anit', url: 'https://anit.dev' },
  formEndpoint: import.meta.env.VITE_FORM_ENDPOINT ?? '',
} as const
