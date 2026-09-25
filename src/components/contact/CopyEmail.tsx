import { Copy } from 'lucide-react'
import { copyText } from './enquiry'
import { useToast } from './Toast'
import './CopyEmail.css'

/** The address as a mailto link, with a small copy button beside it (and a toast to say it worked). */
export function CopyEmail({ email }: { email: string }) {
  const [toast, showToast] = useToast()
  const copy = async () => {
    const ok = await copyText(email)
    showToast(ok ? 'Email address copied' : `Couldn’t copy — it’s ${email}`)
  }
  return (
    <div className="copy-email">
      <a className="copy-email__address serif link" href={`mailto:${email}`}>
        {email}
      </a>
      <button type="button" className="copy-email__button" onClick={copy} aria-label={`Copy ${email} to clipboard`}>
        <Copy size={15} aria-hidden="true" />
        <span>Copy</span>
      </button>
      {toast}
    </div>
  )
}
