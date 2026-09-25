import { useId } from 'react'
import './Seal.css'

/** Rotating circular "Hand-drawn · No AI" stamp. Quiet, but it's always there. */
export function Seal({ size = 116, className = '' }: { size?: number; className?: string }) {
  const text = 'HAND-DRAWN · NO AI · EVERY LINE BY HAND · '
  // unique per instance: several seals can share a page (a duplicate id would bind every
  // textPath to the first one, which may sit in a display:none subtree and not render)
  const pathId = `seal-circle-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <div className={`seal ${className}`} style={{ width: size, height: size }} role="img" aria-label="Hand-drawn, no AI art">
      <svg viewBox="0 0 100 100" className="seal__ring" aria-hidden="true">
        <defs>
          <path id={pathId} d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0" />
        </defs>
        <text>
          <textPath href={`#${pathId}`} textLength="238">
            {text}
          </textPath>
        </text>
      </svg>
      <svg viewBox="0 0 24 24" className="seal__mark" aria-hidden="true">
        {/* a brush nib */}
        <path d="M18.4 2.6c.8-.8 2.2-.8 3 0s.8 2.2 0 3L12 15l-3-3 9.4-9.4Z" fill="currentColor" />
        <path d="M8 13l3 3c0 3-2.4 5.4-5.4 5.4H2.4s1.2-1.2 1.2-3C3.6 15.6 5.4 13 8 13Z" fill="currentColor" opacity=".7" />
      </svg>
    </div>
  )
}
