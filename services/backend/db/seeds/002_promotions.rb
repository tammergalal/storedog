store = Spree::Store.default

promotion_data = [
  { name: 'Bronze Discount', code: 'BRONZE10', description: '10% off order total' },
  { name: 'Silver Discount', code: 'SILVER20', description: '20% off order total' },
  { name: 'Gold Discount',   code: 'GOLD30',   description: '30% off order total' },
  { name: 'Free Shipping',   code: 'FREESHIP',  description: 'Free shipping on any order' },
]

promotion_data.each do |data|
  promo = Spree::Promotion.find_or_create_by!(code: data[:code]) do |p|
    p.name = data[:name]
    p.description = data[:description]
  end

  promo.stores << store unless promo.stores.include?(store)

  if data[:code] == 'FREESHIP'
    unless promo.actions.where(type: 'Spree::Promotion::Actions::FreeShipping').exists?
      promo.actions.create!(type: 'Spree::Promotion::Actions::FreeShipping')
    end
  else
    unless promo.actions.where(type: 'Spree::Promotion::Actions::CreateAdjustment').exists?
      percent = data[:code].scan(/\d+/).first.to_f
      action = promo.actions.create!(type: 'Spree::Promotion::Actions::CreateAdjustment')
      calculator = Spree::Calculator::FlatPercentItemTotal.new(preferred_flat_percent: percent)
      action.calculator = calculator
      action.save!
    end
  end

  puts "  Seeded promotion: #{data[:name]} (#{data[:code]})"
end
