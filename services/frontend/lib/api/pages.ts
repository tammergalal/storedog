import { catalogRequest } from '@lib/apiClient'
import type { Page } from '@customTypes/page'

export type { Page }

export async function getPages(): Promise<Page[]> {
  return catalogRequest<Page[]>('/cms_pages')
}

export async function getPage(slug: string): Promise<Page> {
  return catalogRequest<Page>(`/cms_pages/${slug}`)
}
