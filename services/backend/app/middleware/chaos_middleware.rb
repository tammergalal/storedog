# frozen_string_literal: true

class ChaosMiddleware
  def initialize(app)
    @app = app
  end

  def call(env)
    chaos_mode = ENV.fetch('SERVICE_CHAOS_MODE', 'false') == 'true'
    delay      = chaos_mode ? rand(0..2000) : ENV.fetch('SERVICE_DELAY_MS', '0').to_i
    error_rate = chaos_mode ? rand          : ENV.fetch('SERVICE_ERROR_RATE', '0.0').to_f

    sleep(delay / 1000.0) if delay > 0

    if rand < error_rate
      return [500, { 'Content-Type' => 'application/json' }, ['{"error":"chaos injection"}']]
    end

    @app.call(env)
  end
end
