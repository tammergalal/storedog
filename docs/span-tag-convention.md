# Span Tag Convention

Cross-service semantic tag standard for Storedog. All services must follow this spec when adding custom span tags.

## Naming Rules

- **Separator:** dot-separated (e.g., `cart.total`, `discount.code`)
- **Case:** lowercase throughout; use `snake_case` after the dot for multi-word segments (e.g., `cart.item_count`, `search.results_count`)
- **Types:** use the correct type for the value -- strings for identifiers, integers for counts, floats for monetary values

## Tag Table

| Tag Name | Type | Example Value | Services That Use It |
|---|---|---|---|
| `cart.total` | float | `42.99` | store-frontend, store-backend |
| `cart.item_count` | int | `3` | store-frontend, store-backend |
| `discount.code` | string | `BRONZE10` | store-frontend, store-discounts, store-backend |
| `discount.tier` | string | `bronze` | store-discounts, store-frontend |
| `discount.value` | float | `10.0` | store-discounts, store-backend |
| `ad.id` | int | `4` | store-ads |
| `ad.ab_group` | string | `control` | store-ads, store-frontend |
| `campaign.id` | int | `2` | store-ads |
| `order.id` | string | `R123456789` | store-backend, store-frontend |
| `user.id` | string | `42` | store-frontend, store-backend |
| `search.query` | string | `hat` | store-search |
| `search.results_count` | int | `5` | store-search |
| `inventory.variant_id` | int | `12` | store-inventory |
| `inventory.available` | int | `8` | store-inventory |

## Setting Tags by Language

### Node.js (dd-trace)

Used by: `store-frontend`

```javascript
const tracer = require('dd-trace');

// Within an active span
const span = tracer.scope().active();
if (span) {
  span.setTag('cart.total', 42.99);
  span.setTag('cart.item_count', 3);
}

// Or when creating a span
tracer.trace('checkout.apply-discount', (span) => {
  span.setTag('discount.code', 'BRONZE10');
  span.setTag('discount.tier', 'bronze');
  span.setTag('discount.value', 10.0);
  // ... operation logic
});
```

### Ruby (ddtrace)

Used by: `store-backend`, `store-worker`

```ruby
require 'datadog/tracing'

# Within an active span
span = Datadog::Tracing.active_span
if span
  span.set_tag('cart.total', 42.99)
  span.set_tag('cart.item_count', 3)
end

# Or when creating a span
Datadog::Tracing.trace('checkout.apply-discount') do |span|
  span.set_tag('discount.code', 'BRONZE10')
  span.set_tag('discount.tier', 'bronze')
  span.set_tag('discount.value', 10.0)
  # ... operation logic
end
```

### Python (ddtrace)

Used by: `store-discounts`

```python
from ddtrace import tracer

# Within an active span
span = tracer.current_span()
if span:
    span.set_tag('discount.code', 'BRONZE10')
    span.set_tag('discount.tier', 'bronze')

# Or when creating a span
with tracer.trace('discount.validate') as span:
    span.set_tag('discount.code', 'BRONZE10')
    span.set_tag('discount.tier', 'bronze')
    span.set_tag('discount.value', 10.0)
    # ... operation logic
```

### Java (dd-trace)

Used by: `store-ads`

```java
import io.opentracing.Span;
import io.opentracing.util.GlobalTracer;

// Within an active span
Span span = GlobalTracer.get().activeSpan();
if (span != null) {
    span.setTag("ad.id", 4);
    span.setTag("ad.ab_group", "control");
    span.setTag("campaign.id", 2);
}

// Or with the Datadog API directly
import datadog.trace.api.Trace;
import datadog.trace.api.GlobalTracer;

@Trace(operationName = "ads.serve")
public Advertisement serveAd() {
    var span = GlobalTracer.get().activeSpan();
    span.setTag("ad.id", ad.getId());
    span.setTag("ad.ab_group", ad.getAbGroup());
    span.setTag("campaign.id", ad.getCampaignId());
    return ad;
}
```

## Datadog Value

Consistent tags across all services enable:

- **Trace Explorer filtering:** filter traces by `discount.tier:gold` or `cart.total:>100` across the entire service map
- **Dashboard queries:** build widgets using `@cart.total` or `@discount.code` facets
- **Monitors:** alert on specific tag values (e.g., error rate where `discount.tier:gold`)
- **Analytics:** aggregate and group trace data by business-meaningful dimensions
