#!/usr/bin/env bash
set -euo pipefail

# seed-demo-data.sh — Inserts demo data for DBM-scale testing.
# Idempotent: safe to run multiple times (uses ON CONFLICT DO NOTHING).

PGHOST="${PGHOST:-localhost}"
PGUSER="${PGUSER:-postgres}"
PGPASSWORD="${PGPASSWORD:-postgres}"
PGDATABASE="${PGDATABASE:-storedog_db}"

export PGHOST PGUSER PGPASSWORD PGDATABASE

readonly ORDER_COUNT=1100
readonly DISCOUNT_USAGE_COUNT=550

# ---------------------------------------------------------------------------
# Helper: run psql quietly, stop on error
# ---------------------------------------------------------------------------
run_psql() {
  psql -X -q -v ON_ERROR_STOP=1 "$@"
}

# ---------------------------------------------------------------------------
# 1. Seed spree_orders
#    The 'number' column has a UNIQUE index, so ON CONFLICT DO NOTHING
#    makes this idempotent.
# ---------------------------------------------------------------------------
seed_orders() {
  local existing_count
  existing_count="$(run_psql -t -A -c "SELECT COUNT(*) FROM public.spree_orders;")"

  if [[ "${existing_count}" -ge "${ORDER_COUNT}" ]]; then
    echo "Orders: ${existing_count} already exist (>= ${ORDER_COUNT}). Skipping."
    return
  fi

  echo "Orders: inserting up to ${ORDER_COUNT} seed orders..."

  # Build a batch INSERT inside a transaction for speed.
  {
    echo "BEGIN;"

    # Ensure the sequence is high enough to avoid PK collisions with seed IDs.
    echo "SELECT setval('public.spree_orders_id_seq', GREATEST(nextval('public.spree_orders_id_seq'), 100000));"

    local i
    for i in $(seq 1 "${ORDER_COUNT}"); do
      local number
      number="$(printf 'R%09d' "$((900000000 + i))")"

      local state
      case "$((i % 5))" in
        0) state="complete" ;;
        1) state="payment"  ;;
        2) state="cart"     ;;
        3) state="address"  ;;
        4) state="delivery" ;;
      esac

      local item_total
      item_total="$(( (i % 500) + 1 )).$(printf '%02d' "$((i % 100))")"

      local total="${item_total}"
      local email="seed-user-${i}@example.com"
      local now="NOW() - (interval '1 day' * ${i})"
      local completed_at="NULL"
      if [[ "${state}" == "complete" ]]; then
        completed_at="${now}"
      fi

      # Minimal INSERT covering required NOT NULL columns.
      # Columns with server defaults are omitted where possible.
      cat <<SQL
INSERT INTO public.spree_orders
  (number, item_total, total, state, adjustment_total, completed_at,
   email, created_at, updated_at, currency, channel,
   shipment_total, included_tax_total, state_lock_version,
   taxable_adjustment_total, non_taxable_adjustment_total)
VALUES
  ('${number}', ${item_total}, ${total}, '${state}', 0.00, ${completed_at},
   '${email}', ${now}, ${now}, 'USD', 'spree',
   0.00, 0.00, 0,
   0.00, 0.00)
ON CONFLICT (number) DO NOTHING;
SQL
    done

    echo "COMMIT;"
  } | run_psql

  local new_count
  new_count="$(run_psql -t -A -c "SELECT COUNT(*) FROM public.spree_orders;")"
  echo "Orders: total rows now ${new_count}."
}

# ---------------------------------------------------------------------------
# 2. Seed discount usage records
#    The discounts service (Flask/SQLAlchemy) manages its own tables in the
#    postgres database. Tables: discount, discount_type, influencer.
#    We insert usage-tracking rows into a dedicated discount_usage table.
#    If the table doesn't exist we create it first.
# ---------------------------------------------------------------------------
seed_discount_usage() {
  local discount_db="${PGUSER}"

  local existing_count
  existing_count="$(PGDATABASE="${discount_db}" run_psql -t -A -c \
    "SELECT COUNT(*) FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'discount_usage';" 2>/dev/null || echo "0")"

  if [[ "${existing_count}" == "0" ]]; then
    echo "Discount usage: creating discount_usage table..."
    PGDATABASE="${discount_db}" run_psql <<'SQL'
CREATE TABLE IF NOT EXISTS public.discount_usage (
  id SERIAL PRIMARY KEY,
  discount_id INTEGER NOT NULL,
  order_number VARCHAR(32) NOT NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (discount_id, order_number)
);
SQL
  fi

  local usage_count
  usage_count="$(PGDATABASE="${discount_db}" run_psql -t -A -c \
    "SELECT COUNT(*) FROM public.discount_usage;")"

  if [[ "${usage_count}" -ge "${DISCOUNT_USAGE_COUNT}" ]]; then
    echo "Discount usage: ${usage_count} already exist (>= ${DISCOUNT_USAGE_COUNT}). Skipping."
    return
  fi

  echo "Discount usage: inserting up to ${DISCOUNT_USAGE_COUNT} records..."

  # Get max discount ID available (discounts service seeds ~103 on boot).
  local max_discount_id
  max_discount_id="$(PGDATABASE="${discount_db}" run_psql -t -A -c \
    "SELECT COALESCE(MAX(id), 0) FROM public.discount;" 2>/dev/null || echo "0")"

  if [[ "${max_discount_id}" -eq 0 ]]; then
    echo "Discount usage: no discounts found in ${discount_db}.discount table. Skipping."
    return
  fi

  {
    echo "BEGIN;"

    local i
    for i in $(seq 1 "${DISCOUNT_USAGE_COUNT}"); do
      local discount_id="$(( (i % max_discount_id) + 1 ))"
      local order_number
      order_number="$(printf 'R%09d' "$((900000000 + i))")"
      local applied_at="NOW() - (interval '1 hour' * ${i})"

      cat <<SQL
INSERT INTO public.discount_usage (discount_id, order_number, applied_at)
VALUES (${discount_id}, '${order_number}', ${applied_at})
ON CONFLICT (discount_id, order_number) DO NOTHING;
SQL
    done

    echo "COMMIT;"
  } | PGDATABASE="${discount_db}" run_psql

  local new_count
  new_count="$(PGDATABASE="${discount_db}" run_psql -t -A -c \
    "SELECT COUNT(*) FROM public.discount_usage;")"
  echo "Discount usage: total rows now ${new_count}."
}

# ---------------------------------------------------------------------------
# 3. Ad click seeding — DEFERRED to Phase 3.3
#    The ad_clicks table does not exist yet. It will be created as part of the
#    ads service analytics work in Phase 3.3.
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
echo "=== Storedog seed-demo-data ==="
echo "Target host: ${PGHOST}, user: ${PGUSER}"

seed_orders
seed_discount_usage

echo "=== Seeding complete ==="
