// Card primitives.
//
// Several components (RetainerLedger, ComplianceReports, NotificationPreferences)
// imported these from './ui/card', which did not exist - so those modules never
// typechecked. Minimal, unstyled-by-default implementations that accept the
// utility classNames already used at the call sites.

import React from 'react';

type DivProps = React.HTMLAttributes<HTMLDivElement>;

const join = (...parts: Array<string | undefined>) => parts.filter(Boolean).join(' ');

export const Card = ({ className, ...props }: DivProps) => (
  <div className={join('ui-card', className)} {...props} />
);

export const CardHeader = ({ className, ...props }: DivProps) => (
  <div className={join('ui-card-header', className)} {...props} />
);

export const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={join('ui-card-title', className)} {...props} />
);

export const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={join('ui-card-description', className)} {...props} />
);

export const CardContent = ({ className, ...props }: DivProps) => (
  <div className={join('ui-card-content', className)} {...props} />
);

export const CardFooter = ({ className, ...props }: DivProps) => (
  <div className={join('ui-card-footer', className)} {...props} />
);
