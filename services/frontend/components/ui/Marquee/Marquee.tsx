import cn from 'clsx'
import s from './Marquee.module.css'
import React, { FC, ReactNode, Component, Children } from 'react'
import FastMarqueeImport from 'react-fast-marquee'
// CJS interop: react-fast-marquee bundles its component as `exports.default`,
// so Vite's ESM wrapper makes the whole `module.exports` the default import.
// Fall back to .default when the top-level import is a plain object, not a component.
const FastMarquee: React.ComponentType<any> =
  (FastMarqueeImport as any).default ?? FastMarqueeImport

interface MarqueeProps {
  className?: string
  children?: ReactNode[] | Component[] | any[]
  variant?: 'primary' | 'secondary'
}

const Marquee: FC<MarqueeProps> = ({
  className = '',
  children,
  variant = 'primary',
}) => {
  const rootClassName = cn(
    s.root,
    {
      [s.primary]: variant === 'primary',
      [s.secondary]: variant === 'secondary',
    },
    className
  )

  return (
    <FastMarquee gradient={false} className={rootClassName}>
      {Children.map(children, (child) =>
        React.cloneElement(child as React.ReactElement<any>, {
          className: cn((child as React.ReactElement<any>).props.className, `${variant}`),
        })
      )}
    </FastMarquee>
  )
}

export default Marquee
