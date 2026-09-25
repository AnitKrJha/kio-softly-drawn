import { useRef, type CSSProperties } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { ArrowUpRight } from 'lucide-react'
import { useGsap } from '../../lib/useGsap'
import { TLink } from '../../lib/transition'
import { site } from '../../data/site'
import { reviews, type Review } from '../../data/reviews'
import { bySlug } from '../../data/artworks'
import { ArtImage } from '../shared/ArtImage'
import './Reviews.css'

gsap.registerPlugin(ScrollTrigger, SplitText)

// the featured review, plus the one phrase we lift visually (the words themselves are never changed)
const FEATURED_AUTHOR = 'destinydarlingg'
const HIGHLIGHT = "some of the most beautiful artwork I've ever seen"

const STAR = 'M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.57L12 17.56l-5.9 3.1 1.13-6.57L2.45 9.44l6.6-.96L12 2.5z'

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  const row = (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
          <path d={STAR} />
        </svg>
      ))}
    </>
  )
  return (
    <span className="stars" role="img" aria-label={`Rated ${value} out of 5`} style={{ '--pct': `${(value / 5) * 100}%` } as CSSProperties}>
      <span className="stars__base">{row}</span>
      <span className="stars__fill">{row}</span>
    </span>
  )
}

/** renders review text verbatim, optionally wrapping one exact phrase in <em> */
function Verbatim({ text, highlight }: { text: string; highlight?: string }) {
  const at = highlight ? text.indexOf(highlight) : -1
  if (!highlight || at < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      <em className="reviews__em">{highlight}</em>
      {text.slice(at + highlight.length)}
    </>
  )
}

function Meta({ r }: { r: Review }) {
  return (
    <div className="reviews__meta">
      <span className="reviews__avatar" aria-hidden="true">
        {r.author.charAt(0).toUpperCase()}
      </span>
      <div className="reviews__who">
        <p className="reviews__author">{r.author}</p>
        <p className="reviews__country">{r.country}</p>
      </div>
      <Stars value={r.rating} />
    </div>
  )
}

function Facts({ r }: { r: Review }) {
  return (
    <dl className="reviews__facts">
      <div>
        <dt>Reviewed</dt>
        <dd>{r.when}</dd>
      </div>
      <div>
        <dt>Duration</dt>
        <dd>{r.duration}</dd>
      </div>
    </dl>
  )
}

function Card({ r }: { r: Review }) {
  const art = bySlug(r.art)
  const focal = art?.details[0]
  return (
    <li className={`reviews__card ${art ? '' : 'reviews__card--type'}`}>
      {art ? (
        <TLink to={`/work/${art.slug}`} className="reviews__thumb" data-cursor="View" aria-label={`View ${art.title}`}>
          <ArtImage
            art={art}
            cover
            sizes="(max-width: 900px) 80vw, 30vw"
            style={{ '--fx': `${focal?.x ?? 50}%`, '--fy': `${focal?.y ?? 30}%` } as CSSProperties}
          />
          <span className="reviews__thumb-label">{art.title}</span>
        </TLink>
      ) : (
        <span className="reviews__mark serif" aria-hidden="true">
          “
        </span>
      )}
      <figure className="reviews__card-body">
        <blockquote className="reviews__card-text serif">
          <p>{r.text}</p>
        </blockquote>
        <figcaption>
          <Meta r={r} />
          <Facts r={r} />
        </figcaption>
      </figure>
    </li>
  )
}

/** Kind words — verbatim Fiverr reviews, presented quietly. */
export function Reviews() {
  const root = useRef<HTMLElement>(null)
  const featured = reviews.find((r) => r.author === FEATURED_AUTHOR) ?? reviews[0]
  const others = reviews.filter((r) => r !== featured)
  const featuredArt = bySlug(featured.art)
  const { fiverr } = site

  useGsap(
    root,
    () => {
      const scope = root.current!
      const q = <T extends Element = HTMLElement>(s: string) => scope.querySelector<T>(s)
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const title = q('.reviews__title')
        SplitText.create(title, {
          type: 'lines',
          mask: 'lines',
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.lines, {
              yPercent: 110,
              duration: 1.3,
              ease: 'expo.out',
              stagger: 0.1,
              scrollTrigger: { trigger: title, start: 'top 85%', once: true },
            }),
        })

        // the score rises into place, the breakdown bars fill to their value
        const score = q('.reviews__score-num')
        gsap.from(score, {
          yPercent: 105,
          duration: 1.4,
          ease: 'expo.out',
          scrollTrigger: { trigger: score, start: 'top 88%', once: true },
        })
        gsap.from(scope.querySelectorAll('.reviews__bar i'), {
          scaleX: 0,
          duration: 1.4,
          ease: 'power3.inOut',
          stagger: 0.1,
          scrollTrigger: { trigger: q('.reviews__breakdown'), start: 'top 88%', once: true },
        })

        // featured words brighten as you read down the quote
        const quote = q('.reviews__quote p')
        if (quote) {
          SplitText.create(quote, {
            type: 'words',
            autoSplit: true,
            onSplit: (self) =>
              gsap.fromTo(
                self.words,
                { opacity: 0.16 },
                {
                  opacity: 1,
                  ease: 'none',
                  stagger: 0.05,
                  scrollTrigger: { trigger: quote, start: 'top 78%', end: 'bottom 55%', scrub: 0.4 },
                },
              ),
          })
        }
        const art = q('.reviews__featured-art')
        if (art) {
          gsap.fromTo(
            art,
            { clipPath: 'inset(12% 8% 12% 8% round 20px)' },
            {
              clipPath: 'inset(0% 0% 0% 0% round 20px)',
              ease: 'none',
              scrollTrigger: { trigger: art, start: 'top 90%', end: 'center 55%', scrub: 0.5 },
            },
          )
        }

        gsap.from(scope.querySelectorAll('.reviews__card'), {
          y: 50,
          opacity: 0,
          duration: 1.1,
          ease: 'power3.out',
          stagger: 0.1,
          scrollTrigger: { trigger: q('.reviews__cards'), start: 'top 85%', once: true },
        })
      })
    },
    [],
  )

  return (
    <section ref={root} data-theme="light" className="section reviews" aria-labelledby="reviews-title">
      <div className="container">
        <header className="reviews__head">
          <div>
            <p className="eyebrow">Reviews</p>
            <h2 id="reviews-title" className="display reviews__title">
              Kind <em>words</em>
            </h2>
          </div>

          <div className="reviews__rating">
            <p className="reviews__score">
              <span className="reviews__score-num display" aria-hidden="true">
                {fiverr.rating.toFixed(1)}
              </span>
              <span className="visually-hidden">
                Rated {fiverr.rating} out of 5 from {fiverr.reviewCount} reviews on Fiverr
              </span>
            </p>
            <div className="reviews__score-side" aria-hidden="true">
              <Stars value={fiverr.rating} size={16} />
              <p className="reviews__score-caption">from {fiverr.reviewCount} reviews on Fiverr</p>
            </div>
            <dl className="reviews__breakdown">
              {fiverr.breakdown.map((b) => (
                <div key={b.label} className="reviews__row">
                  <dt>{b.label}</dt>
                  <dd>
                    <span className="reviews__bar" aria-hidden="true">
                      <i style={{ width: `${(b.value / 5) * 100}%` }} />
                    </span>
                    {b.value.toFixed(1)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </header>

        <div className="reviews__featured">
          {featuredArt && (
            <TLink
              to={`/work/${featuredArt.slug}`}
              className="reviews__featured-art"
              data-cursor="View"
              aria-label={`View ${featuredArt.title}, the piece this review is about`}
            >
              <ArtImage art={featuredArt} sizes="(max-width: 900px) 80vw, 36vw" />
            </TLink>
          )}
          <figure className="reviews__featured-body">
            <blockquote className="reviews__quote serif">
              <p>
                <Verbatim text={featured.text} highlight={HIGHLIGHT} />
              </p>
            </blockquote>
            <figcaption>
              <Meta r={featured} />
              <Facts r={featured} />
              {featuredArt && (
                <p className="reviews__about">
                  On <TLink to={`/work/${featuredArt.slug}`} className="link" data-cursor="View">{featuredArt.title}</TLink>
                </p>
              )}
            </figcaption>
          </figure>
        </div>

        <ul className="reviews__cards" aria-label="More reviews">
          {others.map((r) => (
            <Card key={r.author} r={r} />
          ))}
        </ul>

        <p className="reviews__all">
          <a href={fiverr.url} target="_blank" rel="noreferrer" className="link" data-cursor="Open">
            Read all reviews on Fiverr <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </p>
      </div>
    </section>
  )
}
