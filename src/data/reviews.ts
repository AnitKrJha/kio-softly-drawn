export interface Review {
  author: string
  country: string
  rating: number
  when: string
  duration: string
  text: string
  art?: string
}

// Verbatim from fiverr.com/ethereallogo — keep these word-for-word.
export const reviews: Review[] = [
  {
    author: 'destinydarlingg',
    country: 'United States',
    rating: 5,
    when: 'Sep 2026',
    duration: '3 days',
    art: 'vows-in-bloom',
    text: "Honestly, I commissioned them and received some of the most beautiful artwork I've ever seen. It's my favourite! I highly recommend commissioning them—they deliver quickly, and they're patient and understanding throughout the process. I'll definitely go back to them for future projects related to these specific OC's. Their pricing is fair, and they pay close attention to detail, which really shows in their work.",
  },
  {
    author: 'meg_coffeefirst',
    country: 'United States',
    rating: 5,
    when: 'Mar 2026',
    duration: '4 days',
    art: 'forest-centaur',
    text: 'Working with Kio was super easy. She is very fast and delivers exceptional work!',
  },
  {
    author: 'wildfangdefeat',
    country: 'United States',
    rating: 5,
    when: 'Mar 2026',
    duration: '7 days',
    art: 'witch-knight',
    text: 'easy to work with',
  },
  {
    author: 'thebookishbreez',
    country: 'India',
    rating: 4,
    when: 'Jun 2026',
    duration: '3 days',
    text: 'It was so great to work with them.',
  },
]
