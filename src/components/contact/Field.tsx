import { useLayoutEffect, useRef, type InputHTMLAttributes } from 'react'
import type { FieldName } from './enquiry'

type Props = {
  name: FieldName
  label: string
  value: string
  onValue: (name: FieldName, value: string) => void
  onCommit?: (name: FieldName) => void
  error?: string
  hint?: string
  optional?: boolean
  /** auto-growing textarea instead of a single-line input */
  multiline?: boolean
  rows?: number
  /** label stays up (for inputs that always render their own placeholder, e.g. date) */
  pinnedLabel?: boolean
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, 'name' | 'value' | 'onChange' | 'id'>
}

export const fieldId = (name: FieldName) => `contact-${name}`

/** Floating-label field on a ruled line — the underline inks in on focus. */
export function Field({ name, label, value, onValue, onCommit, error, hint, optional, multiline, rows = 1, pinnedLabel, inputProps }: Props) {
  const id = fieldId(name)
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined
  const taRef = useRef<HTMLTextAreaElement>(null)

  // auto-grow: let the textarea be exactly as tall as what's been written
  useLayoutEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    // scrollHeight excludes the border — add it back so no phantom scrollbar appears
    ta.style.height = `${ta.scrollHeight + ta.offsetHeight - ta.clientHeight}px`
  }, [value, multiline])

  const shared = {
    id,
    name,
    value,
    className: 'field__control',
    placeholder: ' ',
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    onBlur: () => onCommit?.(name),
  } as const

  return (
    <div
      className={`field ${multiline ? 'field--multiline' : ''} ${value ? 'is-filled' : ''} ${pinnedLabel ? 'field--pinned' : ''} ${error ? 'has-error' : ''}`}
    >
      <label className="field__label" htmlFor={id}>
        {label}
        {optional && <span className="visually-hidden"> (optional)</span>}
      </label>
      {optional && (
        <span className="field__optional" aria-hidden="true">
          Optional
        </span>
      )}
      {multiline ? (
        <textarea {...shared} ref={taRef} rows={rows} data-lenis-prevent="" onChange={(e) => onValue(name, e.target.value)} />
      ) : (
        <input {...inputProps} {...shared} onChange={(e) => onValue(name, e.target.value)} />
      )}
      <span className="field__line" aria-hidden="true" />
      {error && (
        <p className="field__error" id={errorId}>
          {error}
        </p>
      )}
      {hint && (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  )
}
