import { json } from '@remix-run/node'
import type { LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { Text } from '@components/ui'
import { getPage, getPages } from '@lib/api/pages'
import type { Page } from '@customTypes/page'

export async function loader({ params }: LoaderFunctionArgs) {
  const slug = params['*'] ?? ''

  let page
  try {
    page = await getPage(slug)
  } catch {
    throw json(null, { status: 404 })
  }

  const pages = await getPages()

  return json({ page, pages })
}

export default function CatchAllPage() {
  const { page } = useLoaderData<typeof loader>()

  return (
    <div className="max-w-2xl mx-8 sm:mx-auto py-20">
      {page?.content && <Text html={page.content} />}
    </div>
  )
}
