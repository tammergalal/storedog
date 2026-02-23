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
  const discountPath = process.env.NEXT_PUBLIC_DISCOUNTS_ROUTE

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
      <div className="w-full flex flex-row justify-between items-center py-2 px-4 bg-brand text-white flash-sale-banner">
        <span>
          ⚡ Flash Sale! Use code <strong>{flashSale.code}</strong> — {timeRemaining} remaining
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(flashSale.code)
              datadogRum.addAction('Flash Sale Code Copied', { code: flashSale.code })
            }}
            className="px-2 py-1 text-sm border border-white rounded hover:bg-white hover:text-brand transition-colors"
            aria-label="Copy discount code"
          >
            Copy Code
          </button>
          <button onClick={handleDismiss} aria-label="Dismiss flash sale">
            ×
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full flex flex-row justify-center py-2 px-4 bg-surface-alt border-b border-border-subtle discount-wrapper">
      <span>
        Save 10% with code <strong>BRONZE10</strong>
      </span>
    </div>
  )
}

export default Discount
