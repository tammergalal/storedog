import cn from 'clsx'
import s from './ProductTag.module.css'

interface ProductTagProps {
  className?: string
  name: string
  price: string
  fontSize?: number
  variant?: 'default' | 'new'
}

const ProductTag: React.FC<ProductTagProps> = ({
  name,
  price,
  className = '',
  variant = 'default',
}) => {
  return (
    <div className={cn(s.root, { [s.new]: variant === 'new' }, className)}>
      <h3 className={s.name}>
        <span>{name}</span>
      </h3>
      <div className={s.price}>{price}</div>
    </div>
  )
}

export default ProductTag
