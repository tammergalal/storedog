import tracer from 'dd-trace'

export function setSpanTags(tags: Record<string, string | number | boolean>) {
  const span = tracer.scope().active()
  if (span) Object.entries(tags).forEach(([k, v]) => span.setTag(k, v))
}
