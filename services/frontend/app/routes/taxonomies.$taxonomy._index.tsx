import { json } from '@remix-run/node'
import type { LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData, Link } from '@remix-run/react'
import { Container } from '@components/ui'
import { getTaxon, getTaxons } from '@lib/api/taxons'

export async function loader({ params }: LoaderFunctionArgs) {
  const [taxon, taxons] = await Promise.all([
    getTaxon({ id: params.taxonomy! }),
    getTaxons(),
  ])

  return json({ taxon, taxons })
}

export default function TopLevelTaxonomyPage() {
  const { taxon, taxons } = useLoaderData<typeof loader>()

  function renderTaxonsList(taxonsData: any) {
    return Object.keys(taxonsData).map((key) => {
      const t = taxonsData[key]
      return (
        <li
          className={
            t.children?.length ? 'list-none' : 'list-disc'
          }
          key={t.id}
        >
          <Link to={`/taxonomies/${t.permalink}`}>
            {t.name}
          </Link>
          {t.children?.length > 0 && (
            <ul className="ps-5 mt-2 space-y-1 list-disc list-inside">
              {renderTaxonsList(t.children)}
            </ul>
          )}
        </li>
      )
    })
  }

  return (
    <Container>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-3 mb-20">
        <div className="col-span-8 lg:col-span-2 order-1 lg:order-none">
          <ul className="space-y-4 text-gray-500 list-disc list-inside dark:text-gray-400">
            {renderTaxonsList(taxons)}
          </ul>
        </div>
        <div className="col-span-8 order-3 lg:order-none">
          <h1 className="text-4xl font-bold mb-4">
            {taxon.name}
          </h1>
          <div className="grid grid-cols-1 gap-4">
            {taxon?.children ? (
              taxon.children.map((child: any) => (
                <Link
                  to={`/taxonomies/${child.permalink}`}
                  key={child.id}
                >
                  <div className="bg-black text-white p-4 cursor-pointer ">
                    <h2 className="text-2xl font-bold">{child.name}</h2>
                    <p>{child.pretty_name}</p>
                  </div>
                </Link>
              ))
            ) : (
              <div>
                <p>No {taxon.name} found!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Container>
  )
}
