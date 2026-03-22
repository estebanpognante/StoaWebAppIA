'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardTitle, CardHeader } from '@/components/ui/Card';
import { Package, Briefcase, Users, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { getCollection } from '@/lib/db';
import styles from './Dashboard.module.css';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    products: 0,
    outOfStockProducts: 0,
    services: 0,
    professionals: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.tenantID) {
      if (user.role === 'super_admin') {
        setLoading(false);
      } else {
        fetchStats();
      }
    }
  }, [user]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [products, services, professionals] = await Promise.all([
        getCollection('products', user!.tenantID),
        getCollection('services', user!.tenantID),
        getCollection('professionals', user!.tenantID)
      ]);

      const outOfStockCount = products.filter((p: any) => {
        if (p.variants && p.variants.length > 0) {
          const totalStock = p.variants.reduce((acc: number, v: any) => acc + (Number(v.stock) || 0), 0);
          return totalStock <= 0;
        }
        return (Number(p.stock) || 0) <= 0;
      }).length;

      setStats({
        products: products.length,
        outOfStockProducts: outOfStockCount,
        services: services.length,
        professionals: professionals.length
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
    setLoading(false);
  };

  if (loading) {
    return <div className={styles.loading}>Cargando métricas de Firestore...</div>;
  }

  // Super Admin view
  if (user?.role === 'super_admin') {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Hola, Super Administrador</h1>
          <p className={styles.subtitle}>Ve a la pestaña "Gestión de Red" para administrar Empresas y Usuarios.</p>
        </header>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Hola, {user?.displayName || 'Usuario'}</h1>
        <p className={styles.subtitle}>Resumen en tiempo real de tu catálogo y equipo</p>
      </header>

      <div className={styles.grid}>
        <Card padding="md">
          <CardHeader className={styles.cardHeader}>
            <CardTitle className={styles.cardTitle}>Catálogo de Productos</CardTitle>
            <div className={`${styles.iconWrapper} ${styles.blue}`}><Package size={20} /></div>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '0.5rem' }}>
              <div>
                <div className={styles.value}>{stats.products}</div>
                <p className={styles.statDesc}>Total registrados</p>
              </div>
              <div style={{ textAlign: 'right', paddingBottom: '0.1rem' }}>
                <div style={{ 
                  color: stats.outOfStockProducts > 0 ? 'var(--error)' : 'var(--text-secondary)', 
                  fontSize: '1.25rem', 
                  fontWeight: 600, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.3rem',
                  justifyContent: 'flex-end'
                }}>
                   {stats.outOfStockProducts > 0 && <AlertTriangle size={16} />}
                   {stats.outOfStockProducts}
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Sin stock</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card padding="md">
          <CardHeader className={styles.cardHeader}>
            <CardTitle className={styles.cardTitle}>Servicios</CardTitle>
            <div className={`${styles.iconWrapper} ${styles.green}`}><Briefcase size={20} /></div>
          </CardHeader>
          <CardContent>
            <div className={styles.value}>{stats.services}</div>
            <p className={styles.statDesc}>Tipos configurados</p>
          </CardContent>
        </Card>

        <Card padding="md">
          <CardHeader className={styles.cardHeader}>
            <CardTitle className={styles.cardTitle}>Profesionales</CardTitle>
            <div className={`${styles.iconWrapper} ${styles.purple}`}><Users size={20} /></div>
          </CardHeader>
          <CardContent>
            <div className={styles.value}>{stats.professionals}</div>
            <p className={styles.statDesc}>Integrantes en nómina</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
