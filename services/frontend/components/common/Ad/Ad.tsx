import { useState, useEffect, useCallback } from 'react'
import { datadogRum } from '@datadog/browser-rum'
import { codeStash } from 'code-stash'
import config from '../../../featureFlags.config.json'

// Proper TypeScript interface for Advertisement object from Java service
export interface Advertisement {
  id: number
  name: string
  path: string
  clickUrl: string
  resolvedAbGroup?: string
}

/**
 * Returns a stable session ID for the current browser session.
 *
 * Resolution order:
 * 1. The DataDog RUM session cookie (`dd_rum_session`)
 * 2. A UUID stored in `sessionStorage` under the key `storedog_session_id`
 *    (generated and persisted on first call)
 */
function getOrCreateSessionId(): string {
  // Attempt to read from the DataDog RUM cookie first
  if (typeof document !== 'undefined') {
    const match = document.cookie
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('dd_rum_session='))
    if (match) {
      return match.split('=')[1]
    }
  }

  // Fall back to sessionStorage-backed UUID
  if (typeof sessionStorage !== 'undefined') {
    let stored = sessionStorage.getItem('storedog_session_id')
    if (!stored) {
      stored = crypto.randomUUID()
      sessionStorage.setItem('storedog_session_id', stored)
    }
    return stored
  }

  return ''
}

// Advertisement banner
function Ad() {
  const [data, setData] = useState<Advertisement | null>(null)
  const [isLoading, setLoading] = useState(false)
  const adsPath = process.env.NEXT_PUBLIC_ADS_ROUTE || `/services/ads`

  const fetchAd = useCallback(async () => {
    setLoading(true)
    const flag = (await codeStash('error-tracking', { file: config })) || false

    const sessionId = getOrCreateSessionId()
    const headers: Record<string, string> = {
      'X-Throw-Error': `${flag}`,
      'X-Error-Rate': process.env.NEXT_PUBLIC_ADS_ERROR_RATE || '0.25',
    }
    if (sessionId) {
      headers['X-Session-Id'] = sessionId
    }

    try {
      // Add cache-busting parameter to ensure fresh data
      const timestamp = Date.now()
      const res = await fetch(`${adsPath}/ads?t=${timestamp}`, { headers })
      if (!res.ok) {
        throw new Error('Error fetching ad')
      }
      const adsData: Advertisement[] = await res.json()
      // Sort ads by ID to ensure consistent ordering
      const sortedAds = adsData.sort((a, b) => a.id - b.id)
      // Use a deterministic selection based on time to show different ads
      // This ensures the visual ad matches the expected click behavior
      const now = new Date()
      const adIndex = Math.floor(now.getSeconds() / 5) % sortedAds.length // Change ad every 5 seconds
      const selectedAd = sortedAds[adIndex]

      // Fire a RUM action for every ad in the response so downstream
      // analytics can correlate impressions with A/B group assignments.
      sortedAds.forEach((ad) => {
        datadogRum.addAction('Ad Served', {
          ad_id: ad.id,
          ab_group: ad.resolvedAbGroup,
        })
      })

      setData(selectedAd)
      setLoading(false)
    } catch (e) {
      console.error(e)
      setLoading(false)
    }
  }, [adsPath])

  const handleAdClick = useCallback(async () => {
    if (!data?.id) return
    const sessionId = getOrCreateSessionId()
    const clickHeaders: Record<string, string> = {}
    if (sessionId) clickHeaders['X-Session-Id'] = sessionId

    try {
      // Fetch the click endpoint with the session header so the server can
      // record the correct A/B group. The endpoint returns a 302 redirect;
      // follow it manually so we control the navigation.
      const res = await fetch(`${adsPath}/click/${data.id}`, {
        method: 'GET',
        headers: clickHeaders,
        redirect: 'manual',
      })
      const destination =
        res.headers.get('Location') || res.url || data.clickUrl || '/'
      window.location.href = destination
    } catch {
      // Fallback: navigate directly if the fetch fails
      window.location.href = data.clickUrl || '/'
    }
  }, [data, adsPath])

  useEffect(() => {
    if (!data) fetchAd()
  }, [data, fetchAd])

  if (isLoading)
    return (
      <div className="flex flex-row justify-center h-10 advertisment-wrapper">
        AD HERE
      </div>
    )
  if (!data)
    return (
      <div className="flex flex-row justify-center h-10 advertisment-wrapper">
        AD DIDN'T LOAD
      </div>
    )

  return (
    <div className="flex flex-row justify-center py-4 advertisement-wrapper">
      <picture 
        className="advertisement-banner cursor-pointer" 
        onClick={handleAdClick}
        title={`Click to see ${data.name}`}
      >
        <source srcSet={`${adsPath}/banners/${data.path}`} type="image/webp" />
        <img 
          src={`${adsPath}/banners/${data.path}`} 
          alt={data.name || "Advertisement"} 
          className="cursor-pointer"
        />
      </picture>
    </div>
  )
}

export default Ad
