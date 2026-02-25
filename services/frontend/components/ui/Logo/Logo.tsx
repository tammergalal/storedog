import React, { FC } from 'react';

const Logo: FC<{ className?: string; [key: string]: any }> = ({ className = '', ...props }) => (
  <span
    className={className}
    style={{
      fontFamily: 'var(--font-heading)',
      fontWeight: 700,
      fontSize: '22px',
      color: 'var(--brand)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      textDecoration: 'none',
      lineHeight: 1,
    }}
    {...props}
  >
    Storedog
  </span>
);

export default Logo;
