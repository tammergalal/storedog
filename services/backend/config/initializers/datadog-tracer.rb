is_worker = ENV['WORKER'] == 'true'

Datadog.configure do |c|
  c.service = ENV['DD_SERVICE'] || (is_worker ? 'store-worker' : 'store-backend')
  c.tracing.propagation_style = ['tracecontext', 'datadog']
  c.tracing.instrument :pg
  c.tracing.instrument :active_support
  c.tracing.instrument :redis
  c.tracing.instrument :sidekiq, tag_args: true if is_worker
end

unless is_worker
  # Include custom span tags concern in Spree cart controller
  Rails.application.config.to_prepare do
    Spree::Api::V2::Storefront::CartController.include(DatadogSpanTags)
  end
end
