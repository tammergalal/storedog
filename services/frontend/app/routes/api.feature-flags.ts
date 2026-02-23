import { json } from '@remix-run/node'
import type { LoaderFunctionArgs } from '@remix-run/node'

type FeatureFlags = {
  dbm: boolean
  errorTracking: boolean
  brokenDiscounts: boolean
  adsEnabled: boolean
  discountsEnabled: boolean
}

type Response = {
  flags: FeatureFlags
}

export async function loader({ request }: LoaderFunctionArgs) {
  const flags: FeatureFlags = {
    dbm: process.env.FEATURE_FLAG_DBM === 'true',
    errorTracking: process.env.FEATURE_FLAG_ERROR_TRACKING === 'true',
    brokenDiscounts: process.env.FEATURE_FLAG_BROKEN_DISCOUNTS === 'true',
    adsEnabled: process.env.FEATURE_FLAG_ADS_ENABLED !== 'false',
    discountsEnabled: process.env.FEATURE_FLAG_DISCOUNTS_ENABLED !== 'false',
  }

  const data: Response = { flags }
  return json(data, { status: 200 })
}
