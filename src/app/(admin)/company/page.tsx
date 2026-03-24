'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { getDocument, updateInCollection, insertIntoCollection } from '@/lib/db';
import styles from './Company.module.css';
import { Save } from 'lucide-react';

export default function CompanyPage() {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [docExists, setDocExists] = useState(false);

  const [formData, setFormData] = useState({
    companyName: '',
    legalName: '',
    taxId: '',
    descriptionShort: '',
    phone: '',
    whatsapp: '',
    email: '',
    website: '',
    address: '',
    // SMTP Settings
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPass: '',
    smtpFrom: '',
    utcOffsetMinutes: 0
  });

  useEffect(() => {
    if (user?.tenantID) {
      fetchTenant();
    }
  }, [user]);

  const fetchTenant = async () => {
    setIsLoading(true);
    try {
      const tenantDoc = await getDocument('tenants', user!.tenantID);
      if (tenantDoc) {
        setDocExists(true);
        setFormData({
          companyName: tenantDoc.companyName || '',
          legalName: tenantDoc.legalName || '',
          taxId: tenantDoc.taxId || '',
          descriptionShort: tenantDoc.descriptionShort || '',
          phone: tenantDoc.phone || '',
          whatsapp: tenantDoc.whatsapp || '',
          email: tenantDoc.email || '',
          website: tenantDoc.website || '',
          address: tenantDoc.address || '',
          smtpHost: tenantDoc.smtpHost || '',
          smtpPort: tenantDoc.smtpPort || '587',
          smtpUser: tenantDoc.smtpUser || '',
          smtpPass: tenantDoc.smtpPass || '',
          smtpFrom: tenantDoc.smtpFrom || '',
          utcOffsetMinutes: tenantDoc.utcOffsetMinutes ?? 0
        });
      } else {
        setDocExists(false);
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.tenantID) return;
    
    setIsSaving(true);
    setSuccess(false);

    try {
      if (docExists) {
        await updateInCollection('tenants', user.tenantID, formData);
      } else {
        await updateInCollection('tenants', user.tenantID, { 
          ...formData, tenantID: user.tenantID 
        }).catch(async () => {
           // Fallback if updateDoc fails due to non-existent document
           const { doc, setDoc } = require('firebase/firestore');
           const { db } = require('@/lib/firebase/client');
           await setDoc(doc(db, 'tenants', user.tenantID), {
             ...formData,
             tenantID: user.tenantID
           });
        });
        setDocExists(true);
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      alert('Error al guardar datos');
      console.error(err);
    }
    setIsSaving(false);
  };

  if (isLoading) return <div className={styles.container}>Cargando datos institucionales...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Ficha Institucional</h1>
        <p className={styles.subtitle}>Administra los datos de tu empresa ({user?.tenantID})</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card shadow="md">
          <CardHeader>
            <CardTitle>Información General</CardTitle>
          </CardHeader>
          <CardContent className={styles.formGrid}>
            <Input label="Razón Social / Empresa" name="legalName" value={formData.legalName} onChange={handleChange} required />
            <Input label="Identificación Fiscal (Tax ID)" name="taxId" value={formData.taxId} onChange={handleChange} />
            <Input label="Sitio Web" name="website" type="text" placeholder="www.tuweb.com" value={formData.website} onChange={handleChange} />
          </CardContent>

          <CardHeader className={styles.sectionHeader}>
            <CardTitle>Contacto y Ubicación</CardTitle>
          </CardHeader>
          <CardContent className={styles.formGrid}>
            <Input label="Email de Contacto" name="email" type="email" value={formData.email} onChange={handleChange} />
            <Input label="Celular" name="whatsapp" value={formData.whatsapp} onChange={handleChange} />
            <div className={styles.fullWidth}>
              <Input label="Detalles" name="address" value={formData.address} onChange={handleChange} />
            </div>
          </CardContent>

          <CardHeader className={styles.sectionHeader}>
            <CardTitle>Configuración de Email (SMTP)</CardTitle>
          </CardHeader>
          <CardContent className={styles.formGrid}>
            <Input label="Servidor SMTP" name="smtpHost" placeholder="smtp.ejemplo.com" value={formData.smtpHost} onChange={handleChange} />
            <Input label="Puerto" name="smtpPort" type="number" placeholder="587" value={formData.smtpPort} onChange={handleChange} />
            <Input label="Usuario / Email SMTP" name="smtpUser" value={formData.smtpUser} onChange={handleChange} />
            <Input label="Contraseña SMTP" name="smtpPass" type="password" value={formData.smtpPass} onChange={handleChange} />
            <Input label="Remitente (From)" name="smtpFrom" placeholder="Stoa <no-reply@tuempresa.com>" value={formData.smtpFrom} onChange={handleChange} />
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', gridColumn: 'span 2' }}>
              Estas credenciales se utilizarán para enviar confirmaciones de turnos y recordatorios automáticos a tus clientes.
            </p>
          </CardContent>

          <CardHeader className={styles.sectionHeader}>
            <CardTitle>Zona Horaria del Negocio</CardTitle>
          </CardHeader>
          <CardContent className={styles.formGrid}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Diferencia con UTC (minutos)</label>
              <select
                name="utcOffsetMinutes"
                value={formData.utcOffsetMinutes}
                onChange={e => setFormData({ ...formData, utcOffsetMinutes: Number(e.target.value) })}
                style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)', color: 'var(--text-primary)' }}
              >
                <option value={0}>UTC+0 — Reino Unido, Ghana</option>
                <option value={-60}>UTC-1 — Azores</option>
                <option value={-120}>UTC-2 — Fernando de Noronha</option>
                <option value={-180}>UTC-3 — Argentina, Brasil (BRT)</option>
                <option value={-210}>UTC-3:30 — Ste. John&apos;s</option>
                <option value={-240}>UTC-4 — Chile, Venezuela</option>
                <option value={-300}>UTC-5 — Colombia, Perú, EEUU Este</option>
                <option value={-360}>UTC-6 — México, EEUU Central</option>
                <option value={-420}>UTC-7 — EEUU Montañas</option>
                <option value={-480}>UTC-8 — EEUU Pacífico</option>
                <option value={60}>UTC+1 — España, Francia, Alemania</option>
                <option value={120}>UTC+2 — Grecia, Sudáfrica</option>
                <option value={180}>UTC+3 — Turquía, Arabia Saudita</option>
              </select>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Usada por la IA para interpretar los horarios de turnos correctamente.</p>
            </div>
          </CardContent>

          <CardFooter className={styles.footer}>
            {success && <span className={styles.successMsg}>¡Datos guardados con éxito!</span>}
            <Button type="submit" isLoading={isSaving} icon={<Save size={16} />}>
              Guardar Cambios
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
