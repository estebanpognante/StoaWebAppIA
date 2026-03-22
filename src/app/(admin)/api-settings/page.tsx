'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/lib/auth';
import { getDocument, updateInCollection } from '@/lib/db';
import { Key, RotateCcw, Copy, ExternalLink, Check } from 'lucide-react';
import styles from './ApiSettings.module.css';

interface TenantData {
  publicApiKeyPrefix?: string;
  publicApiEnabled?: boolean;
}

export default function ApiSettingsPage() {
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState('...');
  const [apiEnabled, setApiEnabled] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user?.tenantID) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      const doc = await getDocument<TenantData>('tenants', user!.tenantID);
      if (doc) {
        setApiKey(doc.publicApiKeyPrefix || 'Genera una llave nueva para empezar');
        setApiEnabled(doc.publicApiEnabled || false);
      }
    } catch(e) { console.error(e); }
  };

  const rotateKey = async () => {
    if (!user?.tenantID) return;
    setIsRotating(true);
    try {
      const newKey = `sk_live_${Math.random().toString(36).substring(2, 15)}`;
      await updateInCollection('tenants', user.tenantID, {
        publicApiKeyPrefix: newKey,
        publicApiEnabled: true
      });
      setApiKey(newKey);
      setApiEnabled(true);
    } catch(e) { console.error(e); }
    setIsRotating(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const codeSnippet = `
const response = await fetch('http://localhost:3000/api/public/catalog', {
  headers: {
    'x-tenant-id': '${user?.tenantID || 'your_tenant_id'}',
    'x-api-key': 'YOUR_API_KEY'
  }
});

const data = await response.json();
console.log(data);
  `.trim();

  if (user?.role === 'super_admin') {
    return <div className={styles.container}>El Super Administrador no posee API estática. Dirígete a un Tenant.</div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Configuración de API</h1>
        <p className={styles.subtitle}>Conecta tu plataforma externa al catálogo público de tu negocio</p>
      </header>

      <div className={styles.grid}>
        <Card shadow="md">
          <CardHeader>
            <CardTitle className={styles.flexCenter}>
              <Key size={20} className={styles.iconPrimary} />
              API Key Pública
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={styles.description}>
              Usa esta llave para autenticar requests de solo-lectura contra el endpoint público.
              La clave actual se guardará en tu base de datos de Tenants.
            </p>
            
            <div className={styles.keyBox}>
              <div className={styles.keyValue}>{apiKey}</div>
              <div className={styles.keyActions}>
                <button onClick={copyToClipboard} className={styles.iconBtn} title="Copiar">
                  {copied ? <Check size={18} className={styles.successColor} /> : <Copy size={18} />}
                </button>
              </div>
            </div>

            <div className={styles.actions} style={{ marginTop: '1rem' }}>
              <Button onClick={rotateKey} variant="outline" isLoading={isRotating} icon={<RotateCcw size={16} />}>
                Generar / Rotar API Key
              </Button>
            </div>
            <div className={styles.statusBox} style={{ marginTop: '1rem' }}>
              Status actual: <Badge variant={apiEnabled ? 'success' : 'error'}>{apiEnabled ? 'Activa' : 'Inactiva'}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card shadow="md">
          <CardHeader>
            <CardTitle className={styles.flexCenter}>
              <ExternalLink size={20} className={styles.iconPrimary} />
              Endpoint de Catálogo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={styles.description}>
              Llamada GET para obtener la última versión de tu catálogo expuesto.
            </p>
            
            <div className={styles.codeSnippet}>
              <pre><code>{codeSnippet}</code></pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
