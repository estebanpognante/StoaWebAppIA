import React from 'react';
import styles from './Table.module.css';

interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  children: React.ReactNode;
}

export function Table({ children, className = '', ...props }: TableProps) {
  return (
    <div className={styles.container}>
      <table className={`${styles.table} ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children, className = '', ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={className ? `${styles.header} ${className}` : styles.header} {...props}>{children}</thead>;
}

export function TableBody({ children, className = '', ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props}>{children}</tbody>;
}

export function TableRow({ children, className = '', onClick, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr 
      className={`${styles.row} ${onClick ? styles.clickable : ''} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({ children, className = '', ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={`${styles.th} ${className}`} {...props}>{children}</th>;
}

export function TableCell({ children, className = '', ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`${styles.td} ${className}`} {...props}>{children}</td>;
}
