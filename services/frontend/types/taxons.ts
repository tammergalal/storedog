export interface Taxon {
  id: number
  name: string
  permalink: string
  pretty_name: string | null
  children: Taxon[]
}
