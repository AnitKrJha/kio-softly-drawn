import type { Artwork } from '../../data/artworks'

/** What people can ask for. `value` is what `/contact?type=` accepts. */
export const REQUEST_TYPES = [
  { value: 'character-art', label: 'Character art' },
  { value: 'original-character', label: 'Original character (OC)' },
  { value: 'book-cover', label: 'Book cover' },
  { value: 'pfp-icon', label: 'PFP / icon' },
  { value: 'collaboration', label: 'Collaboration' },
  { value: 'other', label: 'Something else' },
] as const

export type RequestType = (typeof REQUEST_TYPES)[number]['value']

export const isRequestType = (v: string | null | undefined): v is RequestType => REQUEST_TYPES.some((t) => t.value === v)

export const typeLabel = (v: RequestType | '') => REQUEST_TYPES.find((t) => t.value === v)?.label ?? ''

export interface Enquiry {
  name: string
  email: string
  type: RequestType | ''
  budget: string
  deadline: string
  message: string
  references: string
}

export type FieldName = keyof Enquiry
export type Errors = Partial<Record<FieldName, string>>

/** DOM order — the first invalid field in this order receives focus. */
export const FIELD_ORDER: FieldName[] = ['name', 'email', 'type', 'budget', 'deadline', 'message', 'references']

export const EMPTY: Enquiry = { name: '', email: '', type: '', budget: '', deadline: '', message: '', references: '' }

/** Today as YYYY-MM-DD in the visitor's own timezone (what `<input type="date">` speaks). */
export function todayISO() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validate(v: Enquiry): Errors {
  const e: Errors = {}
  if (!v.name.trim()) e.name = 'Please tell me your name.'
  if (!v.email.trim()) e.email = 'I’ll need an email to write back to you.'
  else if (!EMAIL_RE.test(v.email.trim())) e.email = 'That email doesn’t look quite right.'
  if (v.deadline && v.deadline < todayISO()) e.deadline = 'Please choose a date that hasn’t passed yet.'
  if (!v.message.trim()) e.message = 'A few words about what you have in mind, please.'
  else if (v.message.trim().length < 10) e.message = 'Just a little more — a sentence or two is perfect.'
  return e
}

export function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

export const subjectFor = (v: Enquiry) => {
  const t = typeLabel(v.type)
  return t ? `Work enquiry — ${t}` : 'Work enquiry'
}

const pieceUrl = (a: Artwork) => `${window.location.origin}/work/${a.slug}`

/** The whole enquiry as a plain-text letter — used for mailto bodies and the copy-to-clipboard fallback. */
export function composeNote(v: Enquiry, ref?: Artwork) {
  const lines: string[] = ['Hi Kio,', '', v.message.trim(), '']
  const row = (label: string, value?: string) => {
    if (value) lines.push(`${label}: ${value}`)
  }
  row('Name', v.name.trim())
  row('Email', v.email.trim())
  row('Looking for', typeLabel(v.type))
  if (ref) row('Inspired by', `${ref.title} (${pieceUrl(ref)})`)
  row('Budget', v.budget.trim())
  row('Deadline', v.deadline ? formatDate(v.deadline) : '')
  if (v.references.trim()) lines.push('', 'References:', v.references.trim())
  return lines.join('\n')
}

export const mailtoHref = (to: string, v: Enquiry, ref?: Artwork) =>
  `mailto:${to}?subject=${encodeURIComponent(subjectFor(v))}&body=${encodeURIComponent(composeNote(v, ref))}`

/** JSON body for Formspree-compatible endpoints (`email` doubles as reply-to there). */
export function payloadFor(v: Enquiry, ref?: Artwork) {
  return {
    name: v.name.trim(),
    email: v.email.trim(),
    type: typeLabel(v.type) || 'Not specified',
    inspiredBy: ref ? `${ref.title} — ${pieceUrl(ref)}` : '',
    budget: v.budget.trim(),
    deadline: v.deadline ? formatDate(v.deadline) : '',
    message: v.message.trim(),
    references: v.references.trim(),
    _subject: subjectFor(v),
  }
}

/** Clipboard with a legacy fallback for older/in-app browsers. Call from inside a user gesture. */
export async function copyText(text: string) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}
