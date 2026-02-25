import { RemixBrowser } from '@remix-run/react'
import { startTransition, StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { datadogRum } from '@datadog/browser-rum'

datadogRum.init({
  applicationId:
    window.ENV?.DD_APPLICATION_ID || 'DD_APPLICATION_ID_PLACEHOLDER',
  clientToken:
    window.ENV?.DD_CLIENT_TOKEN || 'DD_CLIENT_TOKEN_PLACEHOLDER',
  site: (window.ENV?.DD_SITE || 'datadoghq.com') as
    | 'datadoghq.com'
    | 'datadoghq.eu'
    | 'us3.datadoghq.com'
    | 'us5.datadoghq.com'
    | 'ap1.datadoghq.com',
  service: window.ENV?.DD_SERVICE || 'store-frontend',
  version: window.ENV?.DD_VERSION || '1.0.0',
  env: window.ENV?.DD_ENV || 'development',
  trackUserInteractions: true,
  trackResources: true,
  trackLongTasks: true,
  sessionSampleRate: 100,
  sessionReplaySampleRate: 100,
  silentMultipleInit: true,
  defaultPrivacyLevel: 'mask-user-input',
  allowedTracingUrls: [
    {
      match: /https:\/\/.*\.env.play.instruqt\.com/,
      propagatorTypes: ['tracecontext', 'datadog', 'b3', 'b3multi'],
    },
    {
      match: /^http:\/\/localhost(:\d+)?$/,
      propagatorTypes: ['tracecontext', 'datadog', 'b3', 'b3multi'],
    },
    {
      match: /.*/,
      propagatorTypes: ['tracecontext', 'datadog', 'b3', 'b3multi'],
    },
  ],
  traceSampleRate: 100,
  allowUntrustedEvents: true,
  beforeSend: (event) => {
    if (
      event.type === 'error' &&
      event.error.message ===
        'The resource you were looking for could not be found.'
    ) {
      console.log(event)
      return false
    }
    return true
  },
})

datadogRum.startSessionReplayRecording()

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>
  )
})
