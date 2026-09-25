import { useEffect } from 'react'

const BASE = 'Kio — Softly Drawn'

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${BASE}` : `${BASE} · Semi-realistic character art & original characters`
  }, [title])
}
