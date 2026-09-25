import { SiFiverr, SiThreads } from 'react-icons/si'
import { Mail } from 'lucide-react'
import { site } from '../../data/site'

/** Threads · Fiverr · Email — present, never shouting. */
export function Socials({ className = '', showLabels = true }: { className?: string; showLabels?: boolean }) {
  const items = [
    { href: site.threads.url, label: site.threads.label, sub: site.threads.handle, Icon: SiThreads },
    { href: site.fiverr.url, label: site.fiverr.label, sub: `★ ${site.fiverr.rating}`, Icon: SiFiverr },
    ...(site.email ? [{ href: `mailto:${site.email}`, label: 'Email', sub: site.email, Icon: Mail }] : []),
  ]
  return (
    <ul className={`socials ${className}`} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
      {items.map(({ href, label, sub, Icon }) => (
        <li key={label}>
          <a
            href={href}
            target={href.startsWith('http') ? '_blank' : undefined}
            rel="noreferrer"
            className="socials__link"
            aria-label={`${label} — ${sub}`}
            data-cursor="Open"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55em' }}
          >
            <Icon size={16} aria-hidden="true" />
            {showLabels && (
              <span className="link">
                {label} <span className="muted">{sub}</span>
              </span>
            )}
          </a>
        </li>
      ))}
    </ul>
  )
}
