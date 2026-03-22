'use client';

import React from 'react';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/components/ThemeProvider';
import { Sun, Moon, LogOut, User } from 'lucide-react';
import styles from './Header.module.css';

export function Header() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {/* Mobile menu toggle would go here */}
      </div>

      <div className={styles.right}>
        <div className={styles.tenantBadge}>
          ID: {user?.tenantID}
        </div>

        <button onClick={toggleTheme} className={styles.iconBtn} aria-label="Toggle Theme">
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        <div className={styles.userMenu}>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user?.displayName}</span>
            <span className={styles.userRole}>{user?.role}</span>
          </div>
          <div className={styles.avatar}>
            <User size={18} />
          </div>
        </div>

        <button onClick={logout} className={styles.iconBtn} aria-label="Logout" title="Cerrar sesión">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
