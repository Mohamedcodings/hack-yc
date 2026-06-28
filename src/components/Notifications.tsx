import { useEffect, useState } from 'react'
import { X, Zap } from 'lucide-react'

type Tone = 'warn' | 'bad' | 'info'

type Notice = {
  id: string
  tone: Tone
  icon: typeof Zap
  eyebrow: string
  title: string
  body: string
  cta: string
}

// Demo-only: a single "out of satellite tokens" pop-up.
const NOTICES: Notice[] = [
  {
    id: 'sat',
    tone: 'warn',
    icon: Zap,
    eyebrow: 'Usage alert',
    title: 'Satellite imagery quota reached',
    body: 'Your Copernicus Sentinel-2 token bucket is empty. Live NDVI refreshes are paused across all 5 fields. Top up to resume imagery.',
    cta: 'Top up tokens',
  },
]

const FIRST_DELAY = 6000
const STAGGER = 3600

export function DemoNotifications() {
  const [shown, setShown] = useState<string[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    const timers = NOTICES.map((notice, index) =>
      window.setTimeout(() => {
        setShown((current) => (current.includes(notice.id) ? current : [...current, notice.id]))
      }, FIRST_DELAY + index * STAGGER),
    )

    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [])

  const dismiss = (id: string) => setDismissed((current) => new Set(current).add(id))

  const visible = NOTICES.filter((notice) => shown.includes(notice.id) && !dismissed.has(notice.id))

  if (visible.length === 0) {
    return null
  }

  return (
    <div className="toast-stack" role="region" aria-label="Account notifications">
      {visible.map((notice) => (
        <article key={notice.id} className={`toast toast--${notice.tone}`}>
          <span className="toast__bar" aria-hidden="true" />
          <notice.icon className="toast__icon" size={18} />
          <div className="toast__body">
            <span className="eyebrow eyebrow--plain toast__eyebrow">{notice.eyebrow}</span>
            <b>{notice.title}</b>
            <p>{notice.body}</p>
            <button type="button" className="toast__cta" onClick={() => dismiss(notice.id)}>
              {notice.cta}
            </button>
          </div>
          <button type="button" className="toast__close" aria-label="Dismiss" onClick={() => dismiss(notice.id)}>
            <X size={15} />
          </button>
        </article>
      ))}
    </div>
  )
}
