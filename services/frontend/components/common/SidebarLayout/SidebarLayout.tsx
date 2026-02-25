import React, { FC } from 'react'
import { Cross, ChevronLeft } from '@components/icons'
import { UserNav } from '@components/common'
import cn from 'clsx'
import s from './SidebarLayout.module.css'

type ComponentProps = { className?: string } & (
  | { handleClose: () => any; handleBack?: never }
  | { handleBack: () => any; handleClose?: never }
)

const SidebarLayout: FC<ComponentProps> = ({
  children,
  className,
  handleBack,
  handleClose,
  ...props
}) => {
  return (
    <div className={cn(s.root, className)} {...props}>
      <header className={s.header}>
        {handleClose && (
          <button
            onClick={handleClose}
            aria-label="Close"
            id="close-sidebar"
            className="hover:text-accent-5 transition ease-in-out duration-150 flex items-center focus:outline-none"
          >
            <Cross className="h-5 w-5" style={{ color: 'var(--text-muted)' }} />
          </button>
        )}
        {handleBack && (
          <button
            onClick={handleBack}
            aria-label="Go back"
            className="hover:text-accent-5 transition ease-in-out duration-150 flex items-center focus:outline-none"
          >
            <ChevronLeft className="h-5 w-5" style={{ color: 'var(--text-muted)' }} />
            <span className="ml-1 text-sm" style={{ color: 'var(--text-muted)' }}>Back</span>
          </button>
        )}

        <UserNav />
      </header>
      <div className={s.container}>{children}</div>
    </div>
  )
}

export default SidebarLayout
