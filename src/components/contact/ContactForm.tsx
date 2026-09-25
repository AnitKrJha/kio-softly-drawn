import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowUpRight, Copy, LoaderCircle, X } from 'lucide-react'
import { SiFiverr, SiThreads } from 'react-icons/si'
import { site } from '../../data/site'
import { bySlug, src } from '../../data/artworks'
import { getLenis } from '../../lib/scroll'
import { TLink } from '../../lib/transition'
import { Field, fieldId } from './Field'
import { Flourish } from './Flourish'
import {
  EMPTY,
  FIELD_ORDER,
  REQUEST_TYPES,
  composeNote,
  copyText,
  isRequestType,
  mailtoHref,
  payloadFor,
  todayISO,
  validate,
  type Enquiry,
  type FieldName,
} from './enquiry'
import './ContactForm.css'

// Widen the `as const` literals so both branches stay type-safe once Kio fills them in.
const ENDPOINT: string = site.formEndpoint
const EMAIL: string = site.email

// TODO(kio): add email or VITE_FORM_ENDPOINT — until one exists the form prepares a note to paste into Threads/Fiverr.
type Mode = 'endpoint' | 'email' | 'none'
const MODE: Mode = ENDPOINT ? 'endpoint' : EMAIL ? 'email' : 'none'

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'error'; message: string }
  | { kind: 'sent' }
  | { kind: 'mailto' }
  | { kind: 'copied'; ok: boolean; note: string }

const SUBMIT_LABEL: Record<Mode, string> = {
  endpoint: 'Send my note',
  email: 'Send via email',
  none: 'Copy my note',
}

function ElsewhereLinks() {
  return (
    <div className="contact-form__elsewhere">
      <a className="btn btn--ghost" href={site.threads.url} target="_blank" rel="noreferrer" data-cursor="Open">
        <SiThreads size={15} aria-hidden="true" /> Message on Threads
      </a>
      <a className="btn btn--ghost" href={site.fiverr.url} target="_blank" rel="noreferrer" data-cursor="Open">
        <SiFiverr size={17} aria-hidden="true" /> Message on Fiverr
      </a>
    </div>
  )
}

export function ContactForm() {
  const [params] = useSearchParams()
  const qType = params.get('type')
  const qRef = params.get('ref')

  const [values, setValues] = useState<Enquiry>(() => ({ ...EMPTY, type: isRequestType(qType) ? qType : '' }))
  const [refSlug, setRefSlug] = useState(() => (bySlug(qRef ?? undefined) ? qRef! : ''))
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({})
  const [attempted, setAttempted] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [honey, setHoney] = useState('')
  const [announce, setAnnounce] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const doneHeadingRef = useRef<HTMLHeadingElement>(null)

  // Arriving again with new params (e.g. from a piece page while already here) updates the prefill.
  useEffect(() => {
    if (isRequestType(qType)) setValues((v) => ({ ...v, type: qType }))
  }, [qType])
  useEffect(() => {
    if (qRef && bySlug(qRef)) setRefSlug(qRef)
  }, [qRef])

  const ref = bySlug(refSlug || undefined)
  const errors = validate(values)
  const shownError = (n: FieldName) => (attempted || touched[n] ? errors[n] : undefined)

  const setValue = (name: FieldName, value: string) => {
    setValues((v) => ({ ...v, [name]: value }))
    if (status.kind === 'error') setStatus({ kind: 'idle' })
  }
  // only judge a field once someone has actually written in it (empty-field errors wait for submit)
  const commit = (name: FieldName) => {
    if (values[name].trim()) setTouched((t) => ({ ...t, [name]: true }))
  }

  const isDone = status.kind === 'sent' || status.kind === 'mailto' || status.kind === 'copied'

  // When the letter turns into its thank-you card: bring it into view, move focus to it, re-measure triggers.
  useEffect(() => {
    if (!isDone) return
    const el = rootRef.current
    if (el) {
      const top = el.getBoundingClientRect().top
      if (top < 0 || top > window.innerHeight * 0.6) {
        const lenis = getLenis()
        if (lenis) lenis.scrollTo(el, { offset: -120, duration: 1.2 })
        else el.scrollIntoView({ block: 'start' })
      }
    }
    doneHeadingRef.current?.focus({ preventScroll: true })
    requestAnimationFrame(() => ScrollTrigger.refresh())
  }, [isDone])

  const focusField = (name: FieldName) => {
    requestAnimationFrame(() => {
      const el = document.getElementById(fieldId(name))
      if (!el) return
      const lenis = getLenis()
      if (lenis) lenis.scrollTo(el, { offset: -180, duration: 0.9 })
      el.focus({ preventScroll: !!lenis })
    })
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (status.kind === 'sending') return
    setAttempted(true)

    const errs = validate(values)
    const invalid = FIELD_ORDER.filter((n) => errs[n])
    if (invalid.length) {
      setAnnounce(invalid.length === 1 ? 'One field needs a second look.' : `${invalid.length} fields need a second look.`)
      focusField(invalid[0])
      return
    }
    setAnnounce('')

    // A filled honeypot means a bot — thank it politely and send nothing.
    if (honey) return setStatus({ kind: 'sent' })

    if (MODE === 'endpoint') {
      setStatus({ kind: 'sending' })
      try {
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payloadFor(values, ref)),
        })
        if (!res.ok) {
          let detail = ''
          try {
            const data = (await res.json()) as { errors?: { message?: string }[] }
            detail = data.errors?.map((x) => x.message).filter(Boolean).join(' ') ?? ''
          } catch {
            /* non-JSON error body */
          }
          throw new Error(detail)
        }
        setStatus({ kind: 'sent' })
      } catch (err) {
        const detail = err instanceof Error ? err.message : ''
        setStatus({ kind: 'error', message: detail })
      }
      return
    }

    if (MODE === 'email') {
      window.location.href = mailtoHref(EMAIL, values, ref)
      setStatus({ kind: 'mailto' })
      return
    }

    // No inbox yet: turn the letter into text they can paste into a Threads/Fiverr message.
    const note = composeNote(values, ref)
    const ok = await copyText(note)
    setStatus({ kind: 'copied', ok, note })
  }

  const reset = () => {
    setValues({ ...EMPTY })
    setRefSlug('')
    setTouched({})
    setAttempted(false)
    setStatus({ kind: 'idle' })
  }

  const firstName = values.name.trim().split(/\s+/)[0]

  if (isDone) {
    return (
      <div className="contact-form contact-form--done" ref={rootRef}>
        <Flourish className="contact-form__flourish" />
        {status.kind === 'sent' && (
          <>
            <h2 className="contact-form__done-title serif" tabIndex={-1} ref={doneHeadingRef}>
              Thank you{firstName ? `, ${firstName}` : ''} — I’ll get back to you soon.
            </h2>
            <p className="contact-form__done-text muted">Your note is on its way to me.</p>
          </>
        )}
        {status.kind === 'mailto' && (
          <>
            <h2 className="contact-form__done-title serif" tabIndex={-1} ref={doneHeadingRef}>
              Thank you — I’ll get back to you soon.
            </h2>
            <p className="contact-form__done-text muted">
              Your email app should have opened with everything filled in — just press send. If nothing happened, write to me at{' '}
              <a className="link accent-ink" href={`mailto:${EMAIL}`}>
                {EMAIL}
              </a>
              .
            </p>
          </>
        )}
        {status.kind === 'copied' && (
          <>
            <h2 className="contact-form__done-title serif" tabIndex={-1} ref={doneHeadingRef}>
              {status.ok ? 'Your note is copied.' : 'Your note is ready.'}
            </h2>
            <p className="contact-form__done-text muted">
              {status.ok
                ? 'Paste it into a message on Threads or Fiverr and I’ll take it from there — thank you for writing.'
                : 'Copy it from below and paste it into a message on Threads or Fiverr — thank you for writing.'}
            </p>
            {!status.ok && (
              <textarea
                className="contact-form__note"
                readOnly
                value={status.note}
                rows={8}
                aria-label="Your note"
                data-lenis-prevent=""
                onFocus={(e) => e.currentTarget.select()}
              />
            )}
            <ElsewhereLinks />
          </>
        )}
        <div className="contact-form__done-actions">
          <button type="button" className="contact-form__again" onClick={status.kind === 'sent' ? reset : () => setStatus({ kind: 'idle' })}>
            <span className="link">{status.kind === 'sent' ? 'Write another note' : 'Back to my note'}</span>
          </button>
          <TLink to="/work" className="contact-form__again" data-cursor="View">
            <span className="link">Browse the work</span>
          </TLink>
        </div>
      </div>
    )
  }

  const sending = status.kind === 'sending'

  return (
    <div className="contact-form" ref={rootRef}>
      <form className="contact-form__letter" onSubmit={onSubmit} noValidate aria-describedby="contact-form-intro">
        <p className="contact-form__salutation serif" id="contact-form-intro">
          <span aria-hidden="true">Dear Kio,</span>
          <span className="visually-hidden">Commission enquiry form. Fields marked optional can be left empty.</span>
        </p>

        <div className="contact-form__row">
          <Field
            name="name"
            label="Your name"
            value={values.name}
            onValue={setValue}
            onCommit={commit}
            error={shownError('name')}
            inputProps={{ type: 'text', autoComplete: 'name', autoCapitalize: 'words', required: true, enterKeyHint: 'next' }}
          />
          <Field
            name="email"
            label="Email"
            value={values.email}
            onValue={setValue}
            onCommit={commit}
            error={shownError('email')}
            inputProps={{ type: 'email', autoComplete: 'email', inputMode: 'email', autoCapitalize: 'off', spellCheck: false, required: true, enterKeyHint: 'next' }}
          />
        </div>

        <fieldset className="contact-form__types">
          <legend className="contact-form__legend">What would you like?</legend>
          <div className="contact-form__chips">
            {REQUEST_TYPES.map((t, i) => (
              <label key={t.value} className="contact-chip">
                <input
                  type="radio"
                  name="type"
                  id={i === 0 ? fieldId('type') : undefined}
                  value={t.value}
                  checked={values.type === t.value}
                  onChange={() => setValue('type', t.value)}
                />
                <span className="contact-chip__face">{t.label}</span>
              </label>
            ))}
          </div>
          {ref && (
            <div className="contact-ref">
              <img className="contact-ref__thumb" src={src(ref, 480)} alt="" width={40} height={40} loading="lazy" decoding="async" />
              <span className="contact-ref__text">
                <span className="muted">Inspired by</span> <span className="contact-ref__title">{ref.title}</span>
              </span>
              <button type="button" className="contact-ref__remove" onClick={() => setRefSlug('')} aria-label={`Remove “${ref.title}” as inspiration`}>
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          )}
        </fieldset>

        <div className="contact-form__row">
          <Field
            name="budget"
            label="Budget"
            optional
            value={values.budget}
            onValue={setValue}
            onCommit={commit}
            inputProps={{ type: 'text', autoComplete: 'off', enterKeyHint: 'next' }}
          />
          <Field
            name="deadline"
            label="Deadline"
            optional
            pinnedLabel
            value={values.deadline}
            onValue={setValue}
            onCommit={commit}
            error={shownError('deadline')}
            inputProps={{ type: 'date', min: todayISO() }}
          />
        </div>

        <Field
          name="message"
          label="Tell me about your character"
          multiline
          rows={4}
          value={values.message}
          onValue={setValue}
          onCommit={commit}
          error={shownError('message')}
          hint="Who they are, the mood, outfit, pose, the moment you’d like to keep — rough ideas are welcome."
        />

        <Field
          name="references"
          label="Reference links"
          optional
          multiline
          value={values.references}
          onValue={setValue}
          onCommit={commit}
          hint="Pinterest boards, Toyhouse, Google Drive — one per line."
        />

        {/* honeypot — invisible to people, irresistible to bots */}
        <div className="contact-form__hp" aria-hidden="true">
          <label>
            Leave this empty
            <input type="text" name="_gotcha" tabIndex={-1} autoComplete="off" value={honey} onChange={(e) => setHoney(e.target.value)} />
          </label>
        </div>

        {MODE === 'none' && (
          <div className="contact-form__notice">
            <p>
              My inbox isn’t connected here just yet — for now the quickest way to reach me is a message on Threads or Fiverr. Write your note below and
              tap <strong>Copy my note</strong> to paste it straight in.
            </p>
            <ElsewhereLinks />
          </div>
        )}

        {status.kind === 'error' && (
          <div className="contact-form__alert" role="alert">
            <p>
              That didn’t go through{status.message ? ` (${status.message})` : ''} — your note is still here. Please try again, or reach me on{' '}
              <a className="link" href={site.threads.url} target="_blank" rel="noreferrer">
                Threads
              </a>{' '}
              or{' '}
              <a className="link" href={site.fiverr.url} target="_blank" rel="noreferrer">
                Fiverr
              </a>
              .
            </p>
          </div>
        )}

        <div className="contact-form__footer">
          <p className="contact-form__signoff" aria-hidden="true">
            <span className="contact-form__signoff-label">Warmly,</span>
            <span className={`contact-form__signature serif ${firstName ? 'is-signed' : ''}`}>
              {values.name.trim() || 'you'}
            </span>
          </p>
          <button type="submit" className="btn contact-form__submit" disabled={sending} aria-busy={sending || undefined}>
            {sending ? (
              <>
                <LoaderCircle size={18} className="contact-form__spinner" aria-hidden="true" /> Sending…
              </>
            ) : (
              <>
                {SUBMIT_LABEL[MODE]}
                {MODE === 'none' ? <Copy size={17} aria-hidden="true" /> : <ArrowUpRight size={18} aria-hidden="true" />}
              </>
            )}
          </button>
        </div>

        <p className="visually-hidden" role="status" aria-live="polite">
          {announce}
        </p>
      </form>
    </div>
  )
}
