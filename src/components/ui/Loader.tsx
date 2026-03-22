import React from 'react';
import { Loader2 } from 'lucide-react';
import styles from './Loader.module.css';

interface LoaderProps {
  size?: number;
  fullScreen?: boolean;
}

export function Loader({ size = 24, fullScreen = false }: LoaderProps) {
  if (fullScreen) {
    return (
      <div className={styles.fullScreen}>
        <Loader2 className={styles.spinner} size={size} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Loader2 className={styles.spinner} size={size} />
    </div>
  );
}
