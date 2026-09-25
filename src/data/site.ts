export const site = {
  name: 'Kio',
  studio: 'Softly Drawn',
  role: 'Digital artist',
  tagline: 'Semi-realistic character art, custom designs & original characters.',
  bio: [
    "Hi! I'm Kio — a digital artist specialising in semi-realistic character art, custom designs and original characters.",
    'My style leans toward soft, detailed visuals with a focus on natural expressions and clean rendering. Feel free to message me anytime.',
  ],
  // TODO(kio): add a public contact email — used by the contact page + footer.
  email: '',
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
  formEndpoint: import.meta.env.VITE_FORM_ENDPOINT ?? '',
} as const
