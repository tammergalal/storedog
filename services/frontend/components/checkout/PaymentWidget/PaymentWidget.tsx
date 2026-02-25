import { FC } from 'react'
import s from './PaymentWidget.module.css'
import { ChevronRight, CreditCard, Check } from '@components/icons'

interface ComponentProps {
  onClick?: () => any
  isValid?: boolean
}

const PaymentWidget: FC<ComponentProps> = ({ onClick, isValid }) => {
  return (
    <div onClick={onClick} className={s.root}>
      <div className="flex flex-1 items-center">
        <CreditCard className="w-5 flex" />
        <span className="ml-5 text-sm text-center font-medium">
          {isValid ? 'John Doe — •••• •••• ••••• 12345' : 'Add Payment Method'}
        </span>
      </div>
      <div>{isValid ? <Check /> : <ChevronRight />}</div>
    </div>
  )
}

export default PaymentWidget
