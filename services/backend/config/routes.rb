require 'sidekiq/web'

Rails.application.routes.draw do
  # Health check endpoint
  get '/health', to: 'health#show'

  # Spree routes
  mount Spree::Core::Engine, at: '/'

  # Sidekiq web UI (protected with HTTP Basic Auth)
  Sidekiq::Web.use Rack::Auth::Basic do |username, password|
    username == Rails.application.secrets.sidekiq_username &&
      password == Rails.application.secrets.sidekiq_password
  end
  mount Sidekiq::Web, at: '/sidekiq'
end
