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
    address: ''
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
          address: tenantDoc.address || ''
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
