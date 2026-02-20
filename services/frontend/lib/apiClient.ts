const CATALOG_API_HOST = process.env.CATALOG_API_HOST || 'http://localhost:8000'
const CART_API_HOST = process.env.CART_API_HOST || 'http://localhost:8001'

export async function catalogRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${CATALOG_API_HOST}${path}`
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(5000),
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!response.ok) {
    const body = await response.text()
    console.error(`Catalog API error body: ${body}`)
    throw new Error(`Catalog API error: ${response.status}`)
  }
  return response.json()
}

export async function cartRequest<T>(
  path: string,
  orderToken?: string | null,
  options?: RequestInit
): Promise<T> {
  const url = `${CART_API_HOST}${path}`
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(5000),
    headers: {
      'Content-Type': 'application/json',
      ...(orderToken ? { 'X-Spree-Order-Token': orderToken } : {}),
      ...options?.headers,
    },
  })
  if (!response.ok) {
    const body = await response.text()
    console.error(`Cart API error body: ${body}`)
    throw new Error(`Cart API error: ${response.status}`)
  }
  return response.json()
}
