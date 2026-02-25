import React, { FC } from 'react'
import s from './Quantity.module.css'
import { Cross, Plus, Minus } from '@components/icons'
import cn from 'clsx'
export interface QuantityProps {
  value: number
  increase: () => any
  decrease: () => any
  handleRemove: React.MouseEventHandler<HTMLButtonElement>
  handleChange: React.ChangeEventHandler<HTMLInputElement>
  max?: number
}

const Quantity: FC<QuantityProps> = ({
  value,
  increase,
  decrease,
  handleChange,
  handleRemove,
  max = 6,
}) => {
  return (
    <div className="flex flex-row items-center" style={{ gap: 0 }}>
      <button className={s.actions} onClick={handleRemove}>
        <Cross width={16} height={16} />
      </button>
      <div className="flex items-center ml-2" style={{ gap: 0 }}>
        <button
          type="button"
          onClick={decrease}
          className={s.actions}
          disabled={value <= 1}
        >
          <Minus width={14} height={14} />
        </button>
        <label>
          <input
            className={s.input}
            onChange={(e) =>
              Number(e.target.value) < max + 1 ? handleChange(e) : () => {}
            }
            value={value}
            type="number"
            max={max}
            min="1"
            readOnly
          />
        </label>
        <button
          type="button"
          onClick={increase}
          className={cn(s.actions)}
          disabled={value < 1 || value >= max}
        >
          <Plus width={14} height={14} />
        </button>
      </div>
    </div>
  )
}

export default Quantity
