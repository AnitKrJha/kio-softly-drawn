// Tiny one-shot signal: the preloader resolves it, entrance animations await it.
let resolve!: () => void
export const introDone = new Promise<void>((r) => (resolve = r))
export const finishIntro = () => resolve()
