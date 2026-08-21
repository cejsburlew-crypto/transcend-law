// Alert primitives. See ui/card.tsx for why these exist.

import React from 'react';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive' | 'warning' | 'success';
}

const join = (...parts: Array<string | undefined>) => parts.filter(Boolean).join(' ');

export const Alert = ({ className, variant = 'default', ...props }: AlertProps) => (
  <div role="alert" className={join('ui-alert', `ui-alert--${variant}`, className)} {...props} />
);

export const AlertTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h5 className={join('ui-alert-title', className)} {...props} />
);

export const AlertDescription = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={join('ui-alert-description', className)} {...props} />
);
