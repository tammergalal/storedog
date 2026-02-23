# frozen_string_literal: true

class HealthController < ActionController::API
  def show
    db_connected = ActiveRecord::Base.connection.active?
  rescue StandardError
    db_connected = false
  ensure
    render json: {
      service: ENV['DD_SERVICE'],
      version: ENV['DD_VERSION'],
      dd_trace_enabled: true,
      db_connected: db_connected
    }, status: db_connected ? :ok : :service_unavailable
  end
end
