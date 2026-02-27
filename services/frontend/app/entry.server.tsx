import { PassThrough } from 'node:stream'
import React from 'react'
import type { EntryContext } from '@remix-run/node'
import { createReadableStreamFromReadable } from '@remix-run/node'
import { RemixServer } from '@remix-run/react'
import { isbot } from 'isbot'
import { renderToPipeableStream } from 'react-dom/server'

const ABORT_DELAY = 5_000
const ERROR_RATE = parseFloat(process.env.UPSTREAM_API_FAILURE_RATE || '0')
const DELAY_MS = parseInt(process.env.UPSTREAM_API_TIMEOUT_MS || '0', 10)

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  const url = new URL(request.url)

  if (url.pathname.startsWith('/api/')) {
    if (DELAY_MS > 0) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS))
    }
    if (Math.random() < ERROR_RATE) {
      return new Response(
        JSON.stringify({ error: 'Upstream service unavailable', upstream: 'store-catalog' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  const userAgent = request.headers.get('user-agent') ?? ''
  const callbackName = isbot(userAgent) ? 'onAllReady' : 'onShellReady'

  return new Promise((resolve, reject) => {
    let didError = false

    const { pipe, abort } = renderToPipeableStream(
      <RemixServer context={remixContext} url={request.url} abortDelay={ABORT_DELAY} />,
      {
        [callbackName]() {
          const body = new PassThrough()
          responseHeaders.set('Content-Type', 'text/html')
          resolve(
            new Response(createReadableStreamFromReadable(body), {
              headers: responseHeaders,
              status: didError ? 500 : responseStatusCode,
            })
          )
          pipe(body)
        },
        onShellError(error: unknown) {
          reject(error)
        },
        onError(error: unknown) {
          didError = true
          console.error(error)
        },
      }
    )

    setTimeout(abort, ABORT_DELAY)
  })
}
