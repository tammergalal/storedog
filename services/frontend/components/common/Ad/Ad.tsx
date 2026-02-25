import React, { useState, useEffect, useCallback } from 'react'
import { datadogRum } from '@datadog/browser-rum'
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
  try {
    if (typeof document !== 'undefined') {
      const match = document.cookie
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith('dd_rum_session='))
      if (match) {
        return match.split('=')[1]
      }
    }

    if (typeof sessionStorage !== 'undefined') {
      let stored = sessionStorage.getItem('storedog_session_id')
      if (!stored) {
        stored = crypto.randomUUID()
        sessionStorage.setItem('storedog_session_id', stored)
      }
      return stored
    }
  } catch {
    // ignore storage errors (e.g. Safari private mode)
  }

  return ''
}

// Advertisement banner
function Ad() {
  const [data, setData] = useState<Advertisement | null>(null)
  const [status, setStatus] = useState<string>('idle')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setStatus('loading')
      try {
        const adsPath =
          (typeof window !== 'undefined' ? window.ENV?.ADS_ROUTE : undefined) ||
          '/services/ads'

        // Read the error-tracking flag directly from the local config
        const flagEntry = Array.isArray(config)
          ? (config as Array<{ name: string; active: boolean }>).find(
              (f) => f.name === 'error-tracking'
            )
          : null
        const flag = flagEntry?.active ?? false

        const sessionId = getOrCreateSessionId()
        const headers: Record<string, string> = {
          'X-Throw-Error': `${flag}`,
          'X-Error-Rate': '0.25',
        }
        if (sessionId) headers['X-Session-Id'] = sessionId

        const res = await fetch(`${adsPath}/ads?t=${Date.now()}`, { headers })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const adsData: Advertisement[] = await res.json()
        if (!adsData || adsData.length === 0) throw new Error('empty response')

        const sortedAds = [...adsData].sort((a, b) => a.id - b.id)
        const adIndex = Math.floor(new Date().getSeconds() / 5) % sortedAds.length
        const selected = sortedAds[adIndex]

        sortedAds.forEach((ad) => {
          datadogRum.addAction('Ad Served', {
            ad_id: ad.id,
            ab_group: ad.resolvedAbGroup,
          })
        })

        if (!cancelled) {
          setData(selected)
          setStatus('ok')
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e)
          setStatus(`error: ${msg}`)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const handleAdClick = useCallback(async () => {
    if (!data?.id) return
    const adsPath =
      (typeof window !== 'undefined' ? window.ENV?.ADS_ROUTE : undefined) ||
      '/services/ads'
    const sessionId = getOrCreateSessionId()
    const clickHeaders: Record<string, string> = {}
    if (sessionId) clickHeaders['X-Session-Id'] = sessionId

    try {
      const res = await fetch(`${adsPath}/click/${data.id}`, {
        method: 'GET',
        headers: clickHeaders,
        redirect: 'manual',
      })
      const destination =
        res.headers.get('Location') || res.url || data.clickUrl || '/'
      window.location.href = destination
    } catch {
      window.location.href = data.clickUrl || '/'
    }
  }, [data])

  if (status === 'loading')
    return (
      <div style={{ padding: '40px 24px', backgroundColor: 'var(--surface)', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', height: '140px', background: 'var(--surface-alt)', borderRadius: '12px' }} />
      </div>
    )

  if (!data)
    return (
      <div style={{ padding: '4px', fontSize: '11px', color: '#c00', textAlign: 'center' }}>
        {status === 'idle' ? '' : status}
      </div>
    )

  const adsPath =
    (typeof window !== 'undefined' ? window.ENV?.ADS_ROUTE : undefined) ||
    '/services/ads'

  return (
    <div className="advertisement-wrapper" style={{ padding: '40px 24px', backgroundColor: 'var(--surface)', borderTop: '1px solid var(--border-subtle)' }}>
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>
        {/* Sponsored badge — top right, unobtrusive */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6px' }}>
          <span style={{
            fontSize: '10px',
            fontFamily: 'var(--font-sans)',
            color: 'var(--text-muted)',
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            border: '1px solid var(--border-subtle)',
            borderRadius: '3px',
            padding: '2px 7px',
          }}>Sponsored</span>
        </div>

        {/* Horizontal split card — image left, copy right */}
        <div
          className="advertisement-banner"
          onClick={handleAdClick}
          style={{
            display: 'flex',
            alignItems: 'stretch',
            background: '#ffffff',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            cursor: 'pointer',
            transition: 'box-shadow 200ms ease, transform 200ms ease',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLDivElement
            el.style.boxShadow = '0 6px 20px rgba(0,0,0,0.10)'
            el.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLDivElement
            el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'
            el.style.transform = 'translateY(0)'
          }}
        >
          {/* Image panel */}
          <div style={{ flex: '0 0 52%', maxWidth: '52%', position: 'relative', overflow: 'hidden' }}>
            <picture title={`Click to see ${data.name}`}>
              <source srcSet={`${adsPath}/banners/${data.path}`} type="image/webp" />
              <img
                src={`${adsPath}/banners/${data.path}`}
                alt={data.name || 'Advertisement'}
                style={{ display: 'block', width: '100%', height: '148px', objectFit: 'cover', objectPosition: 'center' }}
              />
            </picture>
          </div>

          {/* Content panel */}
          <div style={{
            flex: 1,
            padding: '24px 28px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '10px',
            borderLeft: '1px solid var(--border-subtle)',
          }}>
            <h3 style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '19px',
              fontWeight: 700,
              color: 'var(--text-base)',
              margin: 0,
              letterSpacing: '-0.01em',
            }}>{data.name}</h3>
            <p style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              color: 'var(--text-muted)',
              margin: 0,
              lineHeight: 1.55,
            }}>
              Curated picks — discover the collection.
            </p>
            <div>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'var(--brand)',
                color: '#ffffff',
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                fontWeight: 600,
                padding: '8px 18px',
                borderRadius: '6px',
                letterSpacing: '0.01em',
              }}>
                Shop Now
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2.5 6h7M6.5 2.5L10 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Ad
