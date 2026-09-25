/** A hand-inked tick with a trailing swash — draws itself in, stroke by stroke. */
export function Flourish({ className = '' }: { className?: string }) {
  return (
    <svg className={`flourish ${className}`} viewBox="0 0 220 120" fill="none" aria-hidden="true">
      <path
        className="flourish__stroke flourish__stroke--tick"
        pathLength={1}
        d="M16 58C26 56 38 70 50 86C53 90 56 91 58 88C80 56 110 30 150 14"
      />
      <path
        className="flourish__stroke flourish__stroke--swash"
        pathLength={1}
        d="M40 108C80 100 130 98 170 102C184 103 196 100 200 94C203 89 198 84 192 87C186 90 188 99 198 101"
      />
      <circle className="flourish__dot" cx="166" cy="12" r="3.2" />
    </svg>
  )
}
