// Badge primitive. See ui/card.tsx for why these exist.

import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'success';
}

const join = (...parts: Array<string | undefined>) => parts.filter(Boolean).join(' ');

export const Badge = ({ className, variant = 'default', ...props }: BadgeProps) => (
  <span className={join('ui-badge', `ui-badge--${variant}`, className)} {...props} />
);

export default Badge;
