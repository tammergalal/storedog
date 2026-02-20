# Stage 1: Build
FROM node:20-slim AS builder

# install datadog-ci for sourcemap upload
RUN npm install -g @datadog/datadog-ci

ARG DD_GIT_REPOSITORY_URL
ARG DD_GIT_COMMIT_SHA

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --frozen-lockfile
COPY . .

# Build-time env vars required by the framework
ENV NEXT_TELEMETRY_DISABLED=1 \
  NEXT_PUBLIC_ADS_ROUTE=/services/ads \
  NEXT_PUBLIC_DISCOUNTS_ROUTE=/services/discounts \
  NEXT_PUBLIC_DBM_ROUTE=/services/dbm \
  NEXT_PUBLIC_FRONTEND_API_ROUTE=http://service-proxy:80 \
  CATALOG_API_HOST=http://service-proxy/services/catalog \
  CART_API_HOST=http://service-proxy/services/cart \
  DD_GIT_REPOSITORY_URL=${DD_GIT_REPOSITORY_URL} \
  DD_GIT_COMMIT_SHA=${DD_GIT_COMMIT_SHA}

RUN npm run build

# Stage 2: Runtime
FROM node:20-slim AS runtime

# install wait-for-it (required by compose command overrides)
RUN apt-get update && apt-get install -y --no-install-recommends wait-for-it \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only what's needed to run
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/datadog-tracer.js ./datadog-tracer.js

# Runtime env vars (overridable at runtime)
ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  CATALOG_API_HOST=http://service-proxy/services/catalog \
  CART_API_HOST=http://service-proxy/services/cart

EXPOSE 3000
CMD ["node", "--require", "./datadog-tracer.js", "./build/server/index.js"]
