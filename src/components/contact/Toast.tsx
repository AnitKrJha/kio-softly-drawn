import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import './Toast.css'

/** A quiet confirmation pill at the bottom of the screen. Always mounted so the live region is announced. */
export function useToast(duration = 2600) {
  const [text, setText] = useState('')
  const [visible, setVisible] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback(
    (message: string) => {
      // clear first so repeating the same message is announced again
      setText('')
      requestAnimationFrame(() => {
        setText(message)
        setVisible(true)
      })
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setVisible(false), duration)
    },
    [duration],
  )

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const node = createPortal(
    <div className={`toast ${visible ? 'is-visible' : ''}`} role="status" aria-live="polite" aria-atomic="true">
      <Check size={15} strokeWidth={2.4} aria-hidden="true" />
      <span>{text}</span>
    </div>,
    document.body,
  )

  return [node, show] as const
}
