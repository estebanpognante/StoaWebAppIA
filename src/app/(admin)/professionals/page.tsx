'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { getCollection, insertIntoCollection, updateInCollection, deleteFromCollection } from '@/lib/db';
import styles from '../products/Products.module.css';

const defaultWorkingHours = {
  monday: { isActive: true, start: '09:00', end: '18:00' },
  tuesday: { isActive: true, start: '09:00', end: '18:00' },
  wednesday: { isActive: true, start: '09:00', end: '18:00' },
  thursday: { isActive: true, start: '09:00', end: '18:00' },
  friday: { isActive: true, start: '09:00', end: '18:00' },
  saturday: { isActive: false, start: '09:00', end: '13:00' },
  sunday: { isActive: false, start: '09:00', end: '13:00' },
};

const daysMap = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' }
];

export default function ProfessionalsPage() {
  const { user } = useAuth();
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProf, setEditingProf] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({isOpen: false, title: '', message: '', onConfirm: () => {}});

  const [formData, setFormData] = useState({ 
    name: '', 
    role: '', 
    email: '', 
    isActive: true,
    services: [] as string[],
    workingHours: defaultWorkingHours
  });

  useEffect(() => {
    if (user?.tenantID) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [profs, srvs] = await Promise.all([
        getCollection('professionals', user!.tenantID),
        getCollection('services', user!.tenantID)
      ]);
      setProfessionals(profs);
      setServices(srvs);
    } catch (e) { console.error(e); }
    setIsLoading(false);
  };

  const handleEdit = (prof: any) => {
    setEditingProf(prof);
    setFormData({
      name: prof.name || '',
      role: prof.role || '',
      email: prof.email || '',
      isActive: prof.isActive !== undefined ? prof.isActive : true,
      services: prof.services || [],
      workingHours: prof.workingHours || defaultWorkingHours
    });
    setIsModalOpen(true);
  };

  const handleNew = () => {
    setEditingProf(null);
    setFormData({ 
      name: '', role: '', email: '', isActive: true, 
      services: [], workingHours: defaultWorkingHours 
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!user?.tenantID) return;
    try {
      if (editingProf) {
        await updateInCollection('professionals', editingProf.id, formData);
      } else {
        await insertIntoCollection('professionals', { ...formData, tenantID: user.tenantID });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (e) {
      alert('Error guardando profesional');
    }
  };

  const requestDelete = (id: string) => {
    setConfirmModal({
      isOpen: true, title: 'Eliminar Profesional', message: '¿Seguro quieres eliminar a este profesional del sistema?',
      onConfirm: async () => {
        try { await deleteFromCollection('professionals', id); fetchData(); } catch(e){console.error(e);}
      }
    });
  };

  const toggleService = (srv: any) => {
    const hasVariants = srv.variants && srv.variants.length > 0;
    
    if (hasVariants) {
      const variantKeys = srv.variants.map((v:any) => `${srv.id}|${v.id}`);
      const allChecked = variantKeys.every((vk:string) => formData.services.includes(vk));
      
      if (allChecked) {
        setFormData({...formData, services: formData.services.filter(id => !variantKeys.includes(id))});
      } else {
        const newServices = new Set([...formData.services, ...variantKeys]);
        setFormData({...formData, services: Array.from(newServices)});
      }
    } else {
      if (formData.services.includes(srv.id)) {
        setFormData({...formData, services: formData.services.filter(id => id !== srv.id)});
      } else {
        setFormData({...formData, services: [...formData.services, srv.id]});
      }
    }
  };

  const toggleVariant = (variantKey: string) => {
    if (formData.services.includes(variantKey)) {
      setFormData({...formData, services: formData.services.filter(id => id !== variantKey)});
    } else {
      setFormData({...formData, services: [...formData.services, variantKey]});
    }
  };

  const handleHourChange = (dayKey: string, field: 'isActive'|'start'|'end', val: any) => {
    setFormData({
      ...formData,
      workingHours: {
        ...formData.workingHours,
        [dayKey]: { 
          ...(formData.workingHours as any)[dayKey], 
          [field]: val 
        }
      }
    });
  };

  const getAssignedNames = (assignedIds: string[]) => {
    if (!assignedIds || assignedIds.length === 0) return 'Ninguno';
    const names = assignedIds.map(key => {
      if (key.includes('|')) {
        const [sId, vId] = key.split('|');
        const srv = services.find(s => s.id === sId);
        const vrnt = srv?.variants?.find((v:any) => v.id === vId);
        return srv && vrnt ? `${srv.name} (${vrnt.name})` : 'Servicio Eliminado';
      } else {
        const srv = services.find(s => s.id === key);
        return srv ? srv.name : 'Servicio Eliminado';
      }
    });
    return names.join(', ');
  };

  const filtered = professionals.filter(p => p.name?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Profesionales</h1>
          <p className={styles.subtitle}>Equipo, servicios y agenda de disponibilidad</p>
        </div>
        <Button onClick={handleNew}>
          <Plus size={18} />
          Nuevo Profesional
        </Button>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={18} className={styles.searchIcon} />
          <input 
            type="text" 
            placeholder="Buscar profesional..." 
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Rol/Título</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Servicios Asignados</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className={styles.textRight}>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
             <TableRow><TableCell colSpan={6}>Cargando catálogo...</TableCell></TableRow>
          ) : filtered.length === 0 ? (
             <TableRow><TableCell colSpan={6}>Sin profesionales aún.</TableCell></TableRow>
          ) : filtered.map((p) => (
            <TableRow key={p.id}>
              <TableCell className={styles.fontWeightMedium}>{p.name}</TableCell>
              <TableCell>{p.role}</TableCell>
              <TableCell>{p.email}</TableCell>
              <TableCell maxWidth="250px">
                 <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)'}}>
                   {getAssignedNames(p.services)}
                 </span>
              </TableCell>
              <TableCell>
                <Badge variant={p.isActive ? 'success' : 'error'}>
                  {p.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
              </TableCell>
              <TableCell className={styles.textRight}>
                <div className={styles.actions}>
                  <button onClick={() => handleEdit(p)} className={styles.iconBtn}><Edit2 size={16} /></button>
                  <button onClick={() => requestDelete(p.id)} className={`${styles.iconBtn} ${styles.danger}`}><Trash2 size={16} /></button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingProf ? 'Editar Profesional' : 'Nuevo Profesional'}
        width="lg"
      >
        <div className={styles.formGrid}>
          {/* Datos Personales */}
          <div className={styles.fullWidth} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Datos Personales</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Input label="Nombre Completo" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} fullWidth={false} />
              <Input label="Rol Comercial / Especialidad" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} fullWidth={false} />
              <Input label="Email de Contacto" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} fullWidth={false} />
            </div>
          </div>

          {/* Grid de 2 Columnas para Servicios y Agenda */}
          <div className={styles.fullWidth} style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr) 1.5fr', gap: '2rem', paddingBottom: '1rem' }}>
            
            {/* Columna Izquierda: Servicios y Variantes */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Servicios que Realiza</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.4' }}>Selecciona los servicios específicos y modalidades que atiende.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '280px', overflowY: 'auto', padding: '0.8rem', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                 {services.length === 0 ? (
                   <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No hay servicios creados en el sistema.</p>
                 ) : services.map(srv => {
                   const hasVariants = srv.variants && srv.variants.length > 0;
                   let isParentChecked = false;
                   if (hasVariants) {
                     const variantKeys = srv.variants.map((v:any) => `${srv.id}|${v.id}`);
                     isParentChecked = variantKeys.length > 0 && variantKeys.every((vk:string) => formData.services.includes(vk));
                   } else {
                     isParentChecked = formData.services.includes(srv.id);
                   }

                   return (
                     <div key={srv.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                       <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', color: hasVariants ? 'var(--text-secondary)' : 'inherit' }}>
                         <input 
                           type="checkbox" 
                           checked={isParentChecked}
                           onChange={() => toggleService(srv)}
                         />
                         {srv.name} {hasVariants ? <Badge variant="outline" style={{marginLeft: '0.3rem', fontSize: '0.65rem'}}>Agrupador</Badge> : ''}
                       </label>
                       
                       {/* Lista indentada de Variantes (Modalidades) */}
                       {hasVariants && srv.variants.map((v: any) => {
                         const variantKey = `${srv.id}|${v.id}`;
                         return (
                           <label key={variantKey} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', marginLeft: '1.5rem', color: 'var(--text-primary)' }}>
                             <input 
                               type="checkbox" 
                               checked={formData.services.includes(variantKey)}
                               onChange={() => toggleVariant(variantKey)}
                             />
                             {v.name}
                           </label>
                         );
                       })}
                     </div>
                   );
                 })}
              </div>
            </div>

            {/* Columna Derecha: Agenda de Trabajo */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Horario Semanal</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.4' }}>Días que trabaja en la tienda/consultorio.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {daysMap.map(day => {
                  const dayData = (formData.workingHours as any)[day.key];
                  return (
                    <div key={day.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', backgroundColor: dayData.isActive ? 'var(--bg-secondary)' : 'transparent', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}>
                        <input 
                          type="checkbox"
                          checked={dayData.isActive}
                          onChange={e => handleHourChange(day.key, 'isActive', e.target.checked)}
                        />
                        {day.label}
                      </label>
                      
                      {dayData.isActive ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>De</span>
                          <input 
                            type="time" 
                            value={dayData.start}
                            onChange={e => handleHourChange(day.key, 'start', e.target.value)}
                            style={{ padding: '0.2rem 0.2rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                          />
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>a</span>
                          <input 
                            type="time" 
                            value={dayData.end}
                            onChange={e => handleHourChange(day.key, 'end', e.target.value)}
                            style={{ padding: '0.2rem 0.2rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                          />
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No trabaja</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            
          </div>

          <div className={styles.fullWidth} style={{ marginTop: '0.5rem' }}>
             <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
               <input 
                 type="checkbox" 
                 checked={formData.isActive}
                 onChange={e => setFormData({...formData, isActive: e.target.checked})}
               />
               Profesional Activo (Visible en el sistema y agenda)
             </label>
          </div>
          <div className={styles.fullWidth} style={{ marginTop: '0.5rem' }}>
            <Button fullWidth onClick={handleSave}>Guardar Perfil</Button>
          </div>
        </div>
      </Modal>

      {/* Modal Genérico de Confirmación */}
      <Modal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal({...confirmModal, isOpen: false})} title={confirmModal.title} width="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{confirmModal.message}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button variant="outline" onClick={() => setConfirmModal({...confirmModal, isOpen: false})}>Cancelar</Button>
            <Button variant="danger" onClick={() => {
              confirmModal.onConfirm();
              setConfirmModal({...confirmModal, isOpen: false});
            }}>Sí, Eliminar</Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
