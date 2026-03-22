'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import styles from './Sidebar.module.css';
import { 
  Building2, 
  LayoutDashboard, 
  Package, 
  Settings2, 
  Users, 
  Briefcase,
  Globe,
  Calendar
} from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  
  const role = user?.role || '';

  const routes = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['super_admin', 'tenant_admin', 'end_user'] },
    // Super admin exclusive:
    { name: 'Gestión Red', path: '/tenants', icon: Globe, roles: ['super_admin'] },
    // Tenant standard:
    { name: 'Empresa', path: '/company', icon: Building2, roles: ['super_admin', 'tenant_admin'] },
    { name: 'Turnos', path: '/appointments', icon: Calendar, roles: ['super_admin', 'tenant_admin'] },
    { name: 'Productos', path: '/products', icon: Package, roles: ['super_admin', 'tenant_admin'] },
    { name: 'Servicios', path: '/services', icon: Briefcase, roles: ['super_admin', 'tenant_admin'] },
    { name: 'Profesionales', path: '/professionals', icon: Users, roles: ['super_admin', 'tenant_admin'] },
    { name: 'API Settings', path: '/api-settings', icon: Settings2, roles: ['super_admin', 'tenant_admin'] },
  ];

  const filteredRoutes = routes.filter(route => route.roles.includes(role));

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoContainer}>
        <div className={styles.logo}>S</div>
        <span className={styles.brandName}>Stoa</span>
      </div>
      
      <nav className={styles.nav}>
        <ul>
          {filteredRoutes.map((route) => {
            const isActive = pathname.startsWith(route.path);
            const Icon = route.icon;
            
            return (
              <li key={route.path}>
                <Link href={route.path} className={`${styles.link} ${isActive ? styles.active : ''}`}>
                  <Icon size={20} className={styles.icon} />
                  <span>{route.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
