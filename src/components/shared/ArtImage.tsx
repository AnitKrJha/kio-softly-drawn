import { useState, type CSSProperties, type ImgHTMLAttributes } from 'react'
import { src, srcSet, type Artwork } from '../../data/artworks'
import './ArtImage.css'

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  art: Artwork
  /** CSS `sizes` hint — defaults to a sensible responsive value */
  sizes?: string
  /** unique View Transition name so the artwork morphs between pages */
  transitionName?: string
  /** fill the parent (object-fit: cover) instead of using the artwork's own aspect ratio */
  cover?: boolean
  priority?: boolean
}

/** Responsive artwork with a blurred placeholder that dissolves once the real pixels arrive. */
export function ArtImage({ art, sizes = '(max-width: 800px) 100vw, 50vw', transitionName, cover, priority, className = '', style, ...rest }: Props) {
  const [loaded, setLoaded] = useState(false)
  const frameStyle: CSSProperties = {
    backgroundColor: art.color,
    backgroundImage: `url(${art.lqip})`,
    aspectRatio: cover ? undefined : `${art.w} / ${art.h}`,
    viewTransitionName: transitionName,
    ...style,
  }
  return (
    <span className={`art-image ${cover ? 'art-image--cover' : ''} ${loaded ? 'is-loaded' : ''} ${className}`} style={frameStyle}>
      <img
        src={src(art, 960)}
        srcSet={srcSet(art)}
        sizes={sizes}
        width={art.w}
        height={art.h}
        alt={rest.alt ?? `${art.title} — digital illustration by Kio`}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(true)}
        ref={(el) => {
          if (el?.complete && el.naturalWidth) setLoaded(true)
        }}
        {...rest}
      />
    </span>
  )
}
