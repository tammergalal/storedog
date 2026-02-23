module DatadogSpanTags
  extend ActiveSupport::Concern

  included do
    after_action :set_cart_span_tags, only: [:add_item, :set_quantity, :remove_line_item]
    after_action :set_coupon_span_tags, only: [:apply_coupon_code]
  end

  private

  def set_cart_span_tags
    return unless response.successful?

    order = current_order_safe
    return unless order

    Datadog::Tracing.active_span&.tap do |span|
      span.set_tag('cart.item_count', order.item_count)
      span.set_tag('cart.total', order.total.to_f)
    end
  end

  def set_coupon_span_tags
    return unless response.successful?

    order = current_order_safe
    return unless order

    Datadog::Tracing.active_span&.tap do |span|
      span.set_tag('discount.code', params[:coupon_code]) if params[:coupon_code]
      span.set_tag('cart.total', order.total.to_f)
    end
  end

  def current_order_safe
    spree_current_order
  rescue StandardError
    nil
  end
end
