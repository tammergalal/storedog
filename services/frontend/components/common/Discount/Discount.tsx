import * as React from 'react'
import { datadogRum } from '@datadog/browser-rum'

/** @deprecated Use `string | null` directly; kept for external consumers. */
export interface DiscountCodeResults {
  data: string | null
}

interface FlashSale {
  code: string
  value: number
  end_time: string
}

function Discount() {
  const [flashSale, setFlashSale] = React.useState<FlashSale | null>(null)
  const [dismissed, setDismissed] = React.useState(false)
  const [timeRemaining, setTimeRemaining] = React.useState('')
  const discountPath =
    (typeof window !== 'undefined' ? window.ENV?.DISCOUNTS_ROUTE : undefined) ||
    '/services/discounts'

  // Check sessionStorage for prior dismissal
  React.useEffect(() => {
    if (sessionStorage.getItem('flash_sale_dismissed')) {
      setDismissed(true)
    }
  }, [])

  // Poll /flash-sale every 60 seconds
  React.useEffect(() => {
    function fetchFlashSale() {
      fetch(`${discountPath}/flash-sale`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
          return res.json()
        })
        .then((data) => {
          if (data && data.active) {
            setFlashSale({ code: data.code, value: data.value, end_time: data.end_time })
          } else {
            setFlashSale(null)
          }
        })
        .catch((e) => {
          console.error('An error occurred while fetching flash sale:', e)
        })
    }

    fetchFlashSale()
    const interval = setInterval(fetchFlashSale, 60000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Countdown timer
  React.useEffect(() => {
    if (!flashSale || dismissed) {
      setTimeRemaining('')
      return
    }

    function updateCountdown() {
      const end = new Date(flashSale!.end_time + 'Z').getTime()
      const now = Date.now()
      const diff = Math.max(0, Math.floor((end - now) / 1000))

      if (diff <= 0) {
        setTimeRemaining('00:00')
        setFlashSale(null)
        return
      }

      const hours = Math.floor(diff / 3600)
      const minutes = Math.floor((diff % 3600) / 60)
      const seconds = diff % 60

      const mm = String(minutes).padStart(2, '0')
      const ss = String(seconds).padStart(2, '0')

      if (hours > 0) {
        const hh = String(hours).padStart(2, '0')
        setTimeRemaining(`${hh}:${mm}:${ss}`)
      } else {
        setTimeRemaining(`${mm}:${ss}`)
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [flashSale, dismissed])

  function handleDismiss() {
    if (flashSale) {
      sessionStorage.setItem('flash_sale_dismissed', '1')
      setDismissed(true)
      datadogRum.addAction('Discount Banner Dismissed', { code: flashSale.code })
    }
  }

  if (flashSale && !dismissed && timeRemaining) {
    return (
      <div
        className="flash-sale-banner"
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '16px',
          padding: '8px 16px',
          background: 'var(--brand)',
          color: '#ffffff',
          fontSize: '13px',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <span>
          Flash Sale! Use code <strong>{flashSale.code}</strong> for {flashSale.value}% off &mdash; {timeRemaining} remaining
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => {
              navigator.clipboard.writeText(flashSale.code)
              datadogRum.addAction('Flash Sale Code Copied', { code: flashSale.code })
            }}
            style={{
              padding: '2px 10px',
              fontSize: '12px',
              border: '1px solid rgba(255,255,255,0.6)',
              borderRadius: '4px',
              background: 'transparent',
              color: '#ffffff',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              transition: 'background 200ms ease, color 200ms ease',
            }}
            aria-label="Copy discount code"
          >
            Copy Code
          </button>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss flash sale"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              fontSize: '18px',
              lineHeight: 1,
              padding: '0 4px',
            }}
          >
            &times;
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="discount-wrapper"
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '8px 16px',
        background: 'var(--surface-alt)',
        borderBottom: '1px solid var(--border-subtle)',
        fontSize: '13px',
        fontFamily: 'var(--font-sans)',
        color: 'var(--text-base)',
        height: '40px',
      }}
    >
      <span>
        Save 10% with code <strong>BRONZE10</strong>
      </span>
    </div>
  )
}

export default Discount
