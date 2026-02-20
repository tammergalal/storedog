module Spree
  module OrderDecorator
    def self.prepended(base)
      base.state_machine.after_transition to: :complete, do: :log_successful_checkout
    end
    
    def log_successful_checkout
      # Add Datadog span tags for checkout completion
      Datadog::Tracing.active_span&.tap do |span|
        span.set_tag('order.id', number)
        span.set_tag('cart.total', total.to_f)
        span.set_tag('cart.item_count', item_count)
      end

      Rails.logger.info({
        message: 'Order completed successfully',
        event: 'checkout_success',
        id: id,
        order_number: number,
        user_email: email,
        order_total: total,
        state: state,
        timestamp: completed_at,
        created_at: created_at,
        item_count: item_count,
        item_total: item_total
      }.to_json)
    end
  end

  Order.prepend(OrderDecorator)
end