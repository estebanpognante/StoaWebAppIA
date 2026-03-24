'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ImportExcelModal } from '@/components/ImportExcelModal';
import { DictionaryManager } from '@/components/DictionaryManager';
import { Plus, Search, Edit2, Trash2, Settings, Upload } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { getCollection, insertIntoCollection, updateInCollection, deleteFromCollection } from '@/lib/db';
import styles from '../products/Products.module.css';

export default function ServicesPage() {
  const { user } = useAuth();
  const [services, setServices] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [attributes, setAttributes] = useState<any[]>([]); // For modalities
  const [dbAttributes, setDbAttributes] = useState<any[]>([]); // For flexible attributes
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDictionaryOpen, setIsDictionaryOpen] = useState(false);
  const [dictionaryTab, setDictionaryTab] = useState<'categories' | 'attributes'>('categories');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrValue, setNewAttrValue] = useState('');

  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({isOpen: false, title: '', message: '', onConfirm: () => {}});

  // Form states
  interface ServiceVariant { id: string; name: string; description: string; attributeId: string; price: number; duration: number; }
  const [formData, setFormData] = useState({ 
    name: '', description: '', categoryId: '', subcategoryId: '', price: 0, duration: 60, status: 'active',
    variants: [] as ServiceVariant[],
    attributes: {} as Record<string, string>
  });

  useEffect(() => {
    if (user?.tenantID) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [srvs, cats, attrs, flexAttrs] = await Promise.all([
        getCollection('services', user!.tenantID),
        getCollection('serviceCategories', user!.tenantID),
        getCollection('serviceAttributes', user!.tenantID),
        getCollection('tenantAttributes', user!.tenantID)
      ]);
      setServices(srvs);
      setCategories(cats);
      setAttributes(attrs);
      setDbAttributes(flexAttrs.filter((a: any) => a.entityType === 'service'));
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  const handleEdit = (service: any) => {
    setEditingService(service);
    setFormData({
      name: service.name || '',
      description: service.description || '',
      categoryId: service.categoryId || '',
      subcategoryId: service.subcategoryId || '',
      price: service.price || service.priceFrom || 0,
      duration: service.duration || 60,
      status: service.status || 'active',
      variants: service.variants || [],
      attributes: service.attributes || {}
    });
    setIsModalOpen(true);
  };

  const handleNew = () => {
    setEditingService(null);
    setFormData({ name: '', description: '', categoryId: '', subcategoryId: '', price: 0, duration: 60, status: 'active', variants: [], attributes: {} });
    setNewAttrKey('');
    setNewAttrValue('');
    setIsModalOpen(true);
  };

  const openDictionary = (tab: 'categories' | 'attributes') => {
    setDictionaryTab(tab);
    setIsDictionaryOpen(true);
  };

  const handleSave = async () => {
    if (!user?.tenantID) return;
    try {
      if (editingService) {
        await updateInCollection('services', editingService.id, formData);
      } else {
        await insertIntoCollection('services', { ...formData, tenantID: user.tenantID });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (e: any) {
      alert('Error guardando servicio. Revisa tus reglas de Firebase. Detalle: ' + e.message);
    }
  };

  const handleImportExcel = async (rows: any[]) => {
    if (!user?.tenantID) return;
    try {
      setIsLoading(true);
      setIsImportOpen(false);

      const newAttrNames = new Set<string>();
      rows.forEach(r => {
         if (r.attributes) {
            Object.keys(r.attributes).forEach(k => {
               if (!dbAttributes.find((a: any) => a.name.toLowerCase() === k.toLowerCase())) {
                   newAttrNames.add(k);
               }
            });
         }
      });

      const attrPromises = Array.from(newAttrNames).map(name => 
          insertIntoCollection('tenantAttributes', { name, type: 'text', entityType: 'service', tenantID: user.tenantID })
      );
      await Promise.all(attrPromises);

      const batchPromises = rows.map(r => insertIntoCollection('services', { ...r, tenantID: user.tenantID, status: 'active', variants: [] }));
      await Promise.all(batchPromises);
      fetchData();
    } catch(e:any) {
      alert("Error importando servicios: " + e.message);
      setIsLoading(false);
    }
  };

  const requestDelete = (id: string) => {
    setConfirmModal({
      isOpen: true, title: 'Eliminar Servicio', message: '¿Seguro quieres eliminar este servicio de forma permanente?',
      onConfirm: async () => {
        try { await deleteFromCollection('services', id); fetchData(); } catch(e:any){alert(e.message);}
      }
    });
  };

  const addVariant = () => {
    setFormData({
      ...formData, 
      variants: [...formData.variants, { id: Math.random().toString(), name: '', description: '', attributeId: '', price: formData.price, duration: formData.duration }]
    });
  };
  const updateVariant = (id: string, field: keyof ServiceVariant, value: any) => {
    setFormData({
      ...formData,
      variants: formData.variants.map(v => v.id === id ? { ...v, [field]: value } : v)
    });
  };
  const removeVariant = (id: string) => {
    setFormData({...formData, variants: formData.variants.filter(v => v.id !== id)});
  };

  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || '---';
  const filtered = services.filter(s => s.name?.toLowerCase().includes(searchTerm.toLowerCase()));
  const mainCategories = categories.filter(c => !c.parentID);
  const subCategories = formData.categoryId ? categories.filter(c => c.parentID === formData.categoryId) : [];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Servicios</h1>
          <p className={styles.subtitle}>Gestiona tus servicios y sus modalidades</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
           <Button variant="outline" onClick={() => setIsImportOpen(true)}>
             <Upload size={18} />
             Importar Excel
           </Button>
           <Button variant="outline" onClick={() => openDictionary('categories')}>
             <Settings size={18} />
             Gestor de Catálogos
           </Button>
           <Button onClick={handleNew}>
             <Plus size={18} />
             Nuevo Servicio
           </Button>
        </div>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={18} className={styles.searchIcon} />
          <input 
            type="text" placeholder="Buscar servicios..." className={styles.searchInput}
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Precio Base</TableHead>
            <TableHead>Duración</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className={styles.textRight}>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={6}>Cargando catálogo...</TableCell></TableRow>
          ) : filtered.length === 0 ? (
            <TableRow><TableCell colSpan={6}>Sin servicios aún.</TableCell></TableRow>
          ) : filtered.flatMap((s) => {
            const hasVariants = s.variants && s.variants.length > 0;
            const rows = [];
            
            const displayPrice = hasVariants ? `$${Math.min(...s.variants.map((v:any)=>v.price)).toFixed(2)}` : `$${Number(s.price || s.priceFrom || 0).toFixed(2)}`;

            rows.push(
              <TableRow key={s.id}>
                <TableCell className={styles.fontWeightMedium}>
                  <div style={{ color: hasVariants ? 'var(--text-secondary)' : 'inherit', display: 'flex', alignItems: 'center' }}>
                    {s.name} {hasVariants && <Badge variant="outline" style={{marginLeft: '0.5rem', fontSize: '0.65rem'}}>Agrupador</Badge>}
                  </div>
                  {s.description && <div style={{fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{s.description}</div>}
                  
                  {s.attributes && Object.keys(s.attributes).length > 0 && (
                     <div style={{ display: 'flex', gap: '0.2rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                        {Object.entries(s.attributes).slice(0, 3).map(([k,v]) => <span key={k} style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>{k}: {v as string}</span>)}
                        {Object.keys(s.attributes).length > 3 && <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', color: 'var(--text-muted)' }}>+{Object.keys(s.attributes).length - 3}</span>}
                     </div>
                  )}
                </TableCell>
                <TableCell>
                  {getCategoryName(s.categoryId)}
                  {s.subcategoryId && <span style={{color:'var(--text-secondary)', fontSize:'0.8em'}}> {'>'} {getCategoryName(s.subcategoryId)}</span>}
                </TableCell>
                <TableCell>
                  {hasVariants ? <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Múltiples</span> : displayPrice}
                </TableCell>
                <TableCell>
                  {hasVariants ? <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Ver modalidades ↓</span> : `${s.duration} min`}
                </TableCell>
                <TableCell>
                  <Badge variant={s.status === 'active' || s.status === 'published' ? 'success' : 'default'}>
                    {s.status === 'active' || s.status === 'published' ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
                <TableCell className={styles.textRight}>
                  <div className={styles.actions}>
                    <button onClick={() => handleEdit(s)} className={styles.iconBtn}><Edit2 size={16} /></button>
                    <button onClick={() => requestDelete(s.id)} className={`${styles.iconBtn} ${styles.danger}`}><Trash2 size={16} /></button>
                  </div>
                </TableCell>
              </TableRow>
            );

            // Sub-rows
            if (hasVariants) {
              s.variants.forEach((v: any) => {
                rows.push(
                  <TableRow key={`${s.id}-${v.id}`} style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <TableCell style={{ paddingLeft: '2rem' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                         <span style={{ color: 'var(--text-secondary)' }}>↳</span>
                         <span>{v.name}</span>
                       </div>
                       {v.description && <div style={{fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', marginLeft: '1.2rem', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{v.description}</div>}
                    </TableCell>
                    <TableCell style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{attributes.find(a=>a.id===v.attributeId)?.name || 'Opción'}</TableCell>
                    <TableCell>${Number(v.price).toFixed(2)}</TableCell>
                    <TableCell>{v.duration} min</TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                );
              });
            }

            return rows;
          })}
        </TableBody>
      </Table>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingService ? 'Editar Servicio' : 'Nuevo Servicio'}
        width="lg"
      >
        <div className={styles.formGrid}>
          <div className={styles.fullWidth}>
            <Input label="Nombre del Servicio (Obligatorio)" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required fullWidth />
          </div>

          <div className={styles.fullWidth} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
             <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Descripción (Para web y asistentes de IA)</label>
             <textarea 
               value={formData.description}
               onChange={e => setFormData({...formData, description: e.target.value})}
               placeholder="Describe las características principales del servicio, qué incluye, ventajas..."
               style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', resize: 'vertical', minHeight: '60px', fontFamily: 'inherit' }}
             />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
             <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Categoría Principal</label>
             <div style={{ display: 'flex', gap: '0.5rem' }}>
               <select value={formData.categoryId} onChange={e => setFormData({...formData, categoryId: e.target.value, subcategoryId: ''})} style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)'}}>
                 <option value="">Selecciona...</option>
                 {mainCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
               </select>
               <Button variant="outline" onClick={() => openDictionary('categories')} type="button" style={{ padding: '0 0.5rem' }}>+</Button>
             </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
             <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Sub-Categoría</label>
             <div style={{ display: 'flex', gap: '0.5rem' }}>
               <select value={formData.subcategoryId} onChange={e => setFormData({...formData, subcategoryId: e.target.value})} style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)'}} disabled={!formData.categoryId}>
                 <option value="">Selecciona...</option>
                 {subCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
               </select>
               <Button variant="outline" onClick={() => openDictionary('categories')} type="button" disabled={!formData.categoryId} style={{ padding: '0 0.5rem' }}>+</Button>
             </div>
          </div>

          {formData.variants.length === 0 && (
            <>
              <Input label="Precio Base ($)" type="number" value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} />
              <Input label="Duración (Minutos)" type="number" value={formData.duration} onChange={e => setFormData({...formData, duration: Number(e.target.value)})} />
            </>
          )}

          {/* Bloque de Modalidades / Variantes Avanzadas */}
          <div className={styles.fullWidth} style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <label style={{ fontSize: '1rem', fontWeight: 600 }}>Modalidades / Variantes</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button size="sm" type="button" onClick={addVariant}>+ Añadir Modalidad</Button>
                </div>
             </div>
             
             {formData.variants.length > 0 ? (
               <div style={{ overflowX: 'auto' }}>
                 <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                   <thead>
                     <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                       <th style={{ padding: '0.5rem', width: '20%' }}>Nombre (Ej: Básico)</th>
                       <th style={{ padding: '0.5rem', width: '25%' }}>Descripción Breve</th>
                       <th style={{ padding: '0.5rem', width: '15%' }}>Atributo DB</th>
                       <th style={{ padding: '0.5rem', width: '15%' }}>Precio ($)</th>
                       <th style={{ padding: '0.5rem', width: '15%' }}>Duración (min)</th>
                       <th style={{ width: '10%' }}></th>
                     </tr>
                   </thead>
                   <tbody>
                     {formData.variants.map((v) => (
                       <tr key={v.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                         <td style={{ padding: '0.5rem' }}>
                           <input type="text" value={v.name} onChange={e=>updateVariant(v.id,'name',e.target.value)} placeholder="Ej: Facial" style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
                         </td>
                         <td style={{ padding: '0.5rem' }}>
                           <input type="text" value={v.description} onChange={e=>updateVariant(v.id,'description',e.target.value)} placeholder="Ej: Incluye cremas..." style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
                         </td>
                         <td style={{ padding: '0.5rem' }}>
                           <select value={v.attributeId} onChange={e=>updateVariant(v.id,'attributeId',e.target.value)} style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                             <option value="">Ninguno</option>
                             {attributes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                           </select>
                         </td>
                         <td style={{ padding: '0.5rem' }}>
                           <input type="number" value={v.price} onChange={e=>updateVariant(v.id,'price',Number(e.target.value))} style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
                         </td>
                         <td style={{ padding: '0.5rem' }}>
                           <input type="number" value={v.duration} onChange={e=>updateVariant(v.id,'duration',Number(e.target.value))} style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
                         </td>
                         <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                           <button type="button" onClick={()=>removeVariant(v.id)} style={{ color: 'red', background: 'none', border:'none', cursor:'pointer' }}><Trash2 size={16}/></button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             ) : (
               <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>No hay modalidades dinámicas. El servicio utilizará el Precio base y Duración base.</p>
             )}
          </div>

          {/* Dynamic Attributes Section */}
          <div className={styles.fullWidth} style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
             <label style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>Características Adicionales (Flexible)</label>
             <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Añade atributos libres no obligatorios sobre el servicio.</p>
             
             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
               {Object.entries(formData.attributes).map(([key, value]) => (
                  <div key={key} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ flex: 1, padding: '0.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500 }}>{key}</span>
                    <span style={{ flex: 2, padding: '0.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '0.85rem' }}>{value}</span>
                    <button type="button" onClick={() => {
                      const newAttrs = {...formData.attributes};
                      delete newAttrs[key];
                      setFormData({...formData, attributes: newAttrs});
                    }} style={{ color: 'var(--error)', background: 'none', border:'none', cursor:'pointer' }}><Trash2 size={16}/></button>
                  </div>
               ))}
             </div>

             <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
               <div style={{ flex: 1 }}>
                 <label style={{ fontSize: '0.75rem', fontWeight: 500, display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '2px' }}>
                   Característica
                   <Button variant="outline" size="sm" type="button" onClick={() => openDictionary('attributes')} style={{padding:'0 4px', height: '18px', fontSize: '10px'}}>+</Button>
                 </label>
                 <select value={newAttrKey} onChange={e => setNewAttrKey(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                   <option value="">Seleccionar...</option>
                   {dbAttributes.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                 </select>
               </div>
               <div style={{ flex: 2 }}>
                 <label style={{ fontSize: '0.75rem', fontWeight: 500 }}>Valor ({dbAttributes.find(a=>a.name===newAttrKey)?.type === 'number' ? 'Numérico' : dbAttributes.find(a=>a.name===newAttrKey)?.type === 'boolean' ? 'Sí/No' : 'Texto'})</label>
                 {dbAttributes.find(a=>a.name===newAttrKey)?.type === 'boolean' ? (
                   <select value={newAttrValue} onChange={e => setNewAttrValue(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                     <option value=""></option>
                     <option value="Sí">Sí</option>
                     <option value="No">No</option>
                   </select>
                 ) : (
                   <input type={dbAttributes.find(a=>a.name===newAttrKey)?.type === 'number' ? 'number' : 'text'} value={newAttrValue} onChange={e => setNewAttrValue(e.target.value)} placeholder="Ingresar valor..." style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
                 )}
               </div>
               <Button type="button" variant="outline" onClick={() => {
                 if (newAttrKey.trim() && newAttrValue.trim()) {
                   setFormData({...formData, attributes: {...formData.attributes, [newAttrKey.trim()]: newAttrValue.trim()}});
                   setNewAttrKey('');
                   setNewAttrValue('');
                 }
               }}>Añadir</Button>
             </div>
          </div>

          <div className={styles.fullWidth} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '1rem'}}>
             <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Estado Publicación</label>
             <select 
               value={formData.status} 
               onChange={e => setFormData({...formData, status: e.target.value})}
               style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)'}}
             >
               <option value="active">Activo</option>
               <option value="inactive">Inactivo</option>
             </select>
          </div>
          <div className={styles.fullWidth}>
            <Button fullWidth onClick={handleSave}>Guardar Servicio</Button>
          </div>
        </div>
      </Modal>

      <DictionaryManager 
        isOpen={isDictionaryOpen} 
        onClose={() => setIsDictionaryOpen(false)} 
        tenantID={user?.tenantID!} 
        onDataChanged={fetchData} 
        initialTab={dictionaryTab} 
        entityType="service" 
      />

      {/* Modal Genéico de Confirmación */}
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

      <ImportExcelModal 
        isOpen={isImportOpen} 
        onClose={() => setIsImportOpen(false)} 
        onImport={handleImportExcel} 
        entityType="service"
        isLoading={isLoading} 
      />

    </div>
  );
}
