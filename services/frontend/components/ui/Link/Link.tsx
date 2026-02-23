import { Link as RemixLink } from '@remix-run/react'
import type { LinkProps as RemixLinkProps } from '@remix-run/react'

type LinkProps = Omit<RemixLinkProps, 'to'> & { href?: string; to?: string }

const Link: React.FC<LinkProps> = ({ href, to, children, ...props }) => {
  return (
    <RemixLink to={to || href || '#'} {...props}>
      {children}
    </RemixLink>
  )
}

export default Link
