import { FC, ReactNode } from 'react'

interface OgImage {
  url?: string
  width?: string
  height?: string
  alt?: string
}

interface Props {
  title?: string
  description?: string
  robots?: string
  openGraph?: {
    title?: string
    type?: string
    locale?: string
    description?: string
    site_name?: string
    url?: string
    images?: OgImage[]
  }
  children?: ReactNode
}

// In Remix, meta tags are handled by each route's `meta` export.
// This component is kept as a no-op to avoid breaking callers.
const SEO: FC<Props> = () => {
  return null
}

export default SEO
