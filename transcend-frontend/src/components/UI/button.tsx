// Button primitive. See ui/card.tsx for why these exist.

import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary' | 'link';
  size?: 'sm' | 'default' | 'lg' | 'icon';
}

const join = (...parts: Array<string | undefined>) => parts.filter(Boolean).join(' ');

export const Button = ({ className, variant = 'default', size = 'default', ...props }: ButtonProps) => (
  <button
    type={props.type ?? 'button'}
    className={join('ui-button', `ui-button--${variant}`, `ui-button--${size}`, className)}
    {...props}
  />
);

export default Button;
