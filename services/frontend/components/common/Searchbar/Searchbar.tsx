import { FC, memo } from 'react'
import cn from 'clsx'
import s from './Searchbar.module.css'
import { useNavigate, useLocation } from '@remix-run/react'

interface Props {
  className?: string
  id?: string
}

const Searchbar: FC<Props> = ({ className, id = 'search' }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault()

    if (e.key === 'Enter') {
      const q = e.currentTarget.value
      navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search')
    }
  }

  return (
    <div className={cn(s.root, className)}>
      <div className={s.iconContainer}>
        <svg className={s.icon} fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
          />
        </svg>
      </div>
      <label className="hidden" htmlFor={id}>
        Search
      </label>
      <input
        id={id}
        className={s.input}
        placeholder="Search for products..."
        defaultValue={searchParams.get('q') || ''}
        onKeyUp={handleKeyUp}
      />
    </div>
  )
}

export default memo(Searchbar)
