import React, { FC } from 'react'
import cn from 'clsx'
import { Link } from '@remix-run/react'
import { Container } from '@components/ui'
import s from './Footer.module.css'

import { Page } from '@customTypes/page'

interface Props {
  className?: string
  children?: any
  pages?: Page[]
}

const Footer: FC<Props> = ({ className, pages = [] }) => {
  const rootClassName = cn(s.root, className)

  return (
    <footer className={rootClassName}>
      <Container>
        <div className={s.grid}>
          {/* Column 1: Brand */}
          <div className={s.brandCol}>
            <span className={s.wordmark}>Storedog</span>
            <p className={s.tagline}>Gear for the trail ahead.</p>
          </div>

          {/* Column 2: Navigation */}
          <div className={s.navCol}>
            <span className={s.navHeading}>Shop</span>
            <Link to="/products" className={`${s.navLink} footer-link`}>
              Products
            </Link>
            <Link to="/taxonomies/categories/bestsellers" className={`${s.navLink} footer-link`}>
              Bestsellers
            </Link>
            <Link to="/taxonomies/categories/new" className={`${s.navLink} footer-link`}>
              New
            </Link>
            <Link to="/taxonomies/categories/tops" className={`${s.navLink} footer-link`}>
              Tops
            </Link>
          </div>

          {/* Column 3: Newsletter signup (visual only) */}
          <div className={s.signupCol}>
            <span className={s.signupHeading}>Stay in the loop</span>
            <div className={s.signupForm}>
              <input
                type="email"
                className={s.signupInput}
                placeholder="Enter your email"
                aria-label="Email for newsletter"
              />
              <button type="button" className={s.signupButton}>
                Subscribe
              </button>
            </div>
          </div>
        </div>

        <div className={s.bottomBar}>
          <span className={s.copyright}>
            &copy; {new Date().getFullYear()} Storedog, Inc. All rights reserved.
          </span>
          <span className={s.disclaimer}>
            Datadog training demo application &mdash; nothing here is actually for sale.{' '}
            <a href="https://datadoghq.com" target="_blank" rel="noreferrer">
              datadoghq.com
            </a>
          </span>
        </div>
      </Container>
    </footer>
  )
}

export default Footer
