import { json } from '@remix-run/node'
import type { LoaderFunctionArgs } from '@remix-run/node'

type HealthResponse = {
  service: string
  version: string
  dd_trace_enabled: boolean
  db_connected: boolean | null
}

export async function loader({ request }: LoaderFunctionArgs) {
  const data: HealthResponse = {
    service: process.env.DD_SERVICE || 'store-frontend',
    version: process.env.DD_VERSION || '1.0.0',
    dd_trace_enabled: true,
    db_connected: null,
  }

  return json(data, { status: 200 })
}
