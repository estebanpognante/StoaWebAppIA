import React from 'react';
import styles from './Button.module.css';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', isLoading, icon, fullWidth, children, disabled, style, ...props }, ref) => {
    const classes = [
      styles.button,
      styles[variant],
      styles[size],
      className
    ].filter(Boolean).join(' ');

    return (
      <button
        ref={ref}
        className={classes}
        disabled={isLoading || disabled}
        style={{ width: fullWidth ? '100%' : undefined, ...style }}
        {...props}
      >
        {isLoading && <Loader2 className={styles.spinner} size={16} />}
        {!isLoading && icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
