'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Plus, Building, UserPlus, Link as LinkIcon, AlertCircle } from 'lucide-react';
import { getCollection } from '@/lib/db';
import { auth } from '@/lib/firebase/client';
import { sendPasswordResetEmail } from 'firebase/auth';
import styles from './Tenants.module.css';

export default function TenantsPage() {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [isTenantModalOpen, setTenantModalOpen] = useState(false);
  const [isUserModalOpen, setUserModalOpen] = useState(false);
  
  // Forms
  const [tenantForm, setTenantForm] = useState({ companyName: '', adminEmail: '' });
  const [userForm, setUserForm] = useState({ email: '', displayName: '', role: 'end_user', tenantID: '' });
  
  const [inviteResult, setInviteResult] = useState<{ link: string, email: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user?.role === 'super_admin') {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const t = await getCollection('tenants');
      const u = await getCollection('tenantUsers');
      setTenants(t);
      setUsers(u);
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  if (user?.role !== 'super_admin') {
    return <div className={styles.container}>Acceso denegado. Solo para Super Admin.</div>;
  }

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'tenant_admin',
          email: tenantForm.adminEmail,
          companyName: tenantForm.companyName
        })
      });
      const data = await res.json();
      if (data.success) {
        try {
          // Disparamos el correo real desde el cliente de Firebase
          await sendPasswordResetEmail(auth, tenantForm.adminEmail);
        } catch (e) { console.error('Error enviando correo:', e); }

        setInviteResult({ link: data.link, email: tenantForm.adminEmail });
        setTenantModalOpen(false);
        fetchData();
      } else {
        alert(data.error);
      }
    } catch(e) { console.error(e); }
    setIsSubmitting(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm)
      });
      const data = await res.json();
      if (data.success) {
        try {
          // Disparamos el correo real desde el cliente de Firebase
          await sendPasswordResetEmail(auth, userForm.email);
        } catch (e) { console.error('Error enviando correo:', e); }

        setInviteResult({ link: data.link, email: userForm.email });
        setUserModalOpen(false);
        fetchData();
      } else {
        alert(data.error);
      }
    } catch(e) { console.error(e); }
    setIsSubmitting(false);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Gestión de Red</h1>
          <p className={styles.subtitle}>Superadministrador - Empresas y Usuarios</p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="outline" onClick={() => setUserModalOpen(true)}>
            <UserPlus size={18} /> Invitar Usuario
          </Button>
          <Button onClick={() => setTenantModalOpen(true)}>
            <Building size={18} /> Crear Empresa
          </Button>
        </div>
      </header>

      {inviteResult && (
        <Card className={styles.inviteSuccess} padding="md">
          <CardContent className={styles.flexCenterAlert}>
            <AlertCircle className={styles.successColor} size={24} />
            <div>
              <h3>¡Usuario invitado con éxito!</h3>
              <p>Envía este enlace a <strong>{inviteResult.email}</strong> para que configure su contraseña.</p>
              <div className={styles.copyBox}>
                <LinkIcon size={14} /> 
                <span className={styles.linkText} onClick={() => navigator.clipboard.writeText(inviteResult.link)}>
                  {inviteResult.link}
                </span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setInviteResult(null)}>Cerrar</Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? <p>Cargando datos...</p> : (
        <div className={styles.grid}>
          <Card padding="none">
            <CardHeader className={styles.pMargin}>
              <CardTitle>Empresas (Tenants)</CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant ID</TableHead>
                  <TableHead>Nombre Comercial</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map(t => (
                  <TableRow key={t.id}>
                    <TableCell><code className={styles.code}>{t.tenantID}</code></TableCell>
                    <TableCell><strong>{t.companyName}</strong></TableCell>
                    <TableCell><Badge variant="success">{t.status || 'Activo'}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <Card padding="none">
            <CardHeader className={styles.pMargin}>
              <CardTitle>Usuarios del Sistema</CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Tenant ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === 'super_admin' ? 'error' : (u.role === 'tenant_admin' ? 'warning' : 'outline')}>
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell><code className={styles.code}>{u.tenantID}</code></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* Modal Crear empresa */}
      <Modal isOpen={isTenantModalOpen} onClose={() => setTenantModalOpen(false)} title="Crear Empresa y Admin">
        <form onSubmit={handleCreateTenant} className={styles.formContent}>
          <Input 
            label="Nombre de la Empresa" 
            required
            value={tenantForm.companyName} 
            onChange={e => setTenantForm({...tenantForm, companyName: e.target.value})} 
          />
          <Input 
            label="Email del Tenant Admin" 
            type="email" 
            required
            placeholder="admin@empresa.com"
            value={tenantForm.adminEmail} 
            onChange={e => setTenantForm({...tenantForm, adminEmail: e.target.value})} 
          />
          <Button fullWidth isLoading={isSubmitting} type="submit">Generar Tenant e Invitación</Button>
        </form>
      </Modal>

      {/* Modal Crear Usuario */}
      <Modal isOpen={isUserModalOpen} onClose={() => setUserModalOpen(false)} title="Invitar Usuario Final / Admin">
        <form onSubmit={handleCreateUser} className={styles.formContent}>
          <Input 
            label="Email" 
            type="email" 
            required
            value={userForm.email} 
            onChange={e => setUserForm({...userForm, email: e.target.value})} 
          />
          <Input 
            label="Nombre a mostrar" 
            value={userForm.displayName} 
            onChange={e => setUserForm({...userForm, displayName: e.target.value})} 
          />
          <div className={styles.inputGroup}>
            <label className={styles.label}>Rol</label>
            <select 
              className={styles.select} 
              value={userForm.role}
              onChange={e => setUserForm({...userForm, role: e.target.value})}
            >
              <option value="end_user">End User (Usuario final)</option>
              <option value="tenant_admin">Tenant Admin (Administrador)</option>
            </select>
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Asignar a Empresa (Tenant ID)</label>
            <select 
              className={styles.select}
              required
              value={userForm.tenantID}
              onChange={e => setUserForm({...userForm, tenantID: e.target.value})}
            >
              <option value="">Selecciona Empresa...</option>
              {tenants.map(t => (
                <option key={t.id} value={t.tenantID}>{t.companyName} [{t.tenantID}]</option>
              ))}
            </select>
          </div>
          <Button fullWidth isLoading={isSubmitting} type="submit">Invitar Usuario</Button>
        </form>
      </Modal>
    </div>
  );
}
