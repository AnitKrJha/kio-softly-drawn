import { useEffect } from 'react'

const BASE = 'Softly Drawn by Kio'

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${BASE}` : `${BASE} · Character art, OCs, book covers & PFP icons`
  }, [title])
}
