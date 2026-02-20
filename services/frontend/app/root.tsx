import {
  json,
  type LoaderFunctionArgs,
} from '@remix-run/node'
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  isRouteErrorResponse,
  useRouteError,
  type MetaFunction,
  type LinksFunction,
} from '@remix-run/react'
import { CartProvider, useCart } from '@lib/CartContext'
import { ManagedUIContext } from '@components/ui/context'
import { datadogRum } from '@datadog/browser-rum'
import { useEffect } from 'react'
import type { ReactNode } from 'react'

import mainStyles from '~/styles/main.css?url'
import chromeBugStyles from '~/styles/chrome-bug.css?url'
import keenSliderCss from 'keen-slider/keen-slider.min.css?url'

declare global {
  interface Window {
    ENV: {
      DD_APPLICATION_ID: string
      DD_CLIENT_TOKEN: string
      DD_SITE: string
      DD_SERVICE: string
      DD_VERSION: string
      DD_ENV: string
    }
  }
}

export const meta: MetaFunction = () => [
  { charset: 'utf-8' },
  { name: 'viewport', content: 'width=device-width, initial-scale=1' },
]

export const links: LinksFunction = () => [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap',
  },
  { rel: 'stylesheet', href: mainStyles },
  { rel: 'stylesheet', href: chromeBugStyles },
  { rel: 'stylesheet', href: keenSliderCss },
]

export async function loader() {
  // NOTE: NEXT_PUBLIC_* env var names are legacy from the Next.js migration.
  // They will be renamed in a future cleanup; coordinating that requires
  // updating Dockerfile and docker-compose env declarations at the same time.
  return json({
    ENV: {
      DD_APPLICATION_ID: process.env.NEXT_PUBLIC_DD_APPLICATION_ID || 'DD_APPLICATION_ID_PLACEHOLDER',
      DD_CLIENT_TOKEN: process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN || 'DD_CLIENT_TOKEN_PLACEHOLDER',
      DD_SITE: process.env.NEXT_PUBLIC_DD_SITE || 'datadoghq.com',
      DD_SERVICE: process.env.NEXT_PUBLIC_DD_SERVICE_FRONTEND || 'store-frontend',
      DD_VERSION: process.env.NEXT_PUBLIC_DD_VERSION_FRONTEND || '1.0.0',
      DD_ENV: process.env.NEXT_PUBLIC_DD_ENV || 'development',
    },
  })
}

function CartWatcher() {
  const { cart } = useCart()
  useEffect(() => {
    if (!cart) {
      return
    }

    datadogRum.setGlobalContextProperty('cart_status', {
      cartTotal: cart.total,
    })
  }, [cart])

  return null
}

function AppInit() {
  useEffect(() => {
    document.body.classList?.remove('loading')
    if (window?.location.search.includes('end_session=true')) {
      datadogRum.stopSession()
    }
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    if (ref) {
      localStorage.setItem('storedog_referral', ref)
    }
  }, [])

  return null
}

export default function Root() {
  const { ENV } = useLoaderData<typeof loader>()

  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
      </head>
      <body className="loading">
        <script
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(ENV)}`,
          }}
        />
        <CartProvider>
          <ManagedUIContext>
            <CartWatcher />
            <AppInit />
            <Outlet />
          </ManagedUIContext>
        </CartProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export function ErrorBoundary() {
  const error = useRouteError()

  if (isRouteErrorResponse(error)) {
    return (
      <html lang="en">
        <head>
          <Meta />
          <Links />
        </head>
        <body>
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <h1>{error.status === 404 ? 'Not Found' : `Error ${error.status}`}</h1>
            <p>{error.statusText || 'An unexpected error occurred.'}</p>
          </div>
          <Scripts />
        </body>
      </html>
    )
  }

  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h1>Something went wrong</h1>
          <p>{error instanceof Error ? error.message : 'An unexpected error occurred.'}</p>
        </div>
        <Scripts />
      </body>
    </html>
  )
}
