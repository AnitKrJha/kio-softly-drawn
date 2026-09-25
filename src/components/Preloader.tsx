// STUB — to be replaced.
import { useEffect } from 'react'
import { finishIntro } from '../lib/intro'
export function Preloader() {
  useEffect(() => finishIntro(), [])
  return null
}
