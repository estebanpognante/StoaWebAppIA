'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Trash2, Edit2, Plus, Info } from 'lucide-react';
import { getCollection, insertIntoCollection, updateInCollection, deleteFromCollection } from '@/lib/db';

interface DictionaryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  tenantID: string;
  onDataChanged: () => void;
  initialTab?: 'categories' | 'sizes' | 'colors' | 'attributes' | 'modalities';
  entityType?: 'product' | 'service';
}

export function DictionaryManager({ isOpen, onClose, tenantID, onDataChanged, initialTab = 'categories', entityType = 'product' }: DictionaryManagerProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  
  // Data States
  const [categories, setCategories] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [attributes, setAttributes] = useState<any[]>([]);
  const [modalities, setModalities] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({isOpen: false, title: '', message: '', onConfirm: () => {}});

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formParentId, setFormParentId] = useState('');
  const [formType, setFormType] = useState('text'); // For attributes

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      fetchData();
    } else {
      resetForm();
    }
  }, [isOpen, initialTab]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const catCol = entityType === 'product' ? 'productCategories' : 'serviceCategories';
      const [cats, szs, cols, attrs, mods] = await Promise.all([
        getCollection(catCol, tenantID),
        entityType === 'product' ? getCollection('productSizes', tenantID) : Promise.resolve([]),
        entityType === 'product' ? getCollection('productColors', tenantID) : Promise.resolve([]),
        getCollection('tenantAttributes', tenantID),
        entityType === 'service' ? getCollection('serviceModalities', tenantID) : Promise.resolve([]),
      ]);
      setCategories(cats);
      setSizes(szs);
      setColors(cols);
      setAttributes(attrs.filter((a: any) => a.entityType === entityType));
      setModalities(mods);
    } catch (e) {
      console.error('Error fetching dictionaries', e);
    }
    setIsLoading(false);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormName('');
    setFormParentId('');
    setFormType('text');
  };

  const currentCollection = () => {
    if (activeTab === 'categories') return entityType === 'product' ? 'productCategories' : 'serviceCategories';
    if (activeTab === 'sizes') return 'productSizes';
    if (activeTab === 'colors') return 'productColors';
    if (activeTab === 'attributes') return 'tenantAttributes';
    if (activeTab === 'modalities') return 'serviceModalities';
    return '';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    
    setIsLoading(true);
    try {
      const col = currentCollection();
      const payload: any = { name: formName.trim(), tenantID };
      
      if (activeTab === 'categories') {
        payload.parentID = formParentId || null;
      }
      if (activeTab === 'attributes') {
        payload.type = formType;
        payload.entityType = entityType;
      }

      if (editingId) {
        await updateInCollection(col, editingId, payload);
      } else {
        await insertIntoCollection(col, payload);
      }
      
      resetForm();
      await fetchData();
      onDataChanged();
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
    setIsLoading(false);
  };

  const handleDelete = (id: string) => {
    setConfirmModal({
      isOpen: true, 
      title: 'Eliminar Elemento', 
      message: '¿Eliminar este elemento? Podría quedar vacío en los registros que lo usaban.',
      onConfirm: async () => {
        setIsLoading(true);
        try {
          await deleteFromCollection(currentCollection(), id);
          await fetchData();
          onDataChanged();
        } catch (e: any) {
          alert('Error: ' + e.message);
        }
        setIsLoading(false);
      }
    });
  };

  const editItem = (item: any) => {
    setEditingId(item.id);
    setFormName(item.name);
    if (activeTab === 'categories') setFormParentId(item.parentID || '');
    if (activeTab === 'attributes') setFormType(item.type || 'text');
  };

  const mainCategories = categories.filter(c => !c.parentID);

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title={`Gestor de Catálogos (${entityType === 'product' ? 'Productos' : 'Servicios'})`} width="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '600px' }}>
        
        {/* TABS */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
          <button type="button" style={tabStyle(activeTab === 'categories')} onClick={() => { setActiveTab('categories'); resetForm(); }}>Categorías</button>
          {entityType === 'product' && <button type="button" style={tabStyle(activeTab === 'sizes')} onClick={() => { setActiveTab('sizes'); resetForm(); }}>Talles</button>}
          {entityType === 'product' && <button type="button" style={tabStyle(activeTab === 'colors')} onClick={() => { setActiveTab('colors'); resetForm(); }}>Colores / Variantes</button>}
          {entityType === 'service' && <button type="button" style={tabStyle(activeTab === 'modalities')} onClick={() => { setActiveTab('modalities'); resetForm(); }}>Modalidades</button>}
          <button type="button" style={tabStyle(activeTab === 'attributes')} onClick={() => { setActiveTab('attributes'); resetForm(); }}>Atributos Adicionales</button>
        </div>

        <div style={{ display: 'flex', gap: '1.5rem', flex: 1, minHeight: 0 }}>
          
          {/* LIST PANEL */}
          <div style={{ flex: 1, borderRight: '1px solid var(--border-color)', paddingRight: '1rem', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>Elementos Registrados</h3>
            {isLoading && <p style={{ fontSize: '0.875rem' }}>Cargando...</p>}
            
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {!isLoading && activeTab === 'categories' && categories.map(c => (
                <div key={c.id} style={listItemStyle}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{c.name}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{c.parentID ? `Sub-categoría de: ${categories.find(pc=>pc.id===c.parentID)?.name || '?'}` : 'Categoría Principal'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <button onClick={()=>editItem(c)} style={iconBtnStyle}><Edit2 size={14}/></button>
                    <button onClick={()=>handleDelete(c.id)} style={{...iconBtnStyle, color: 'var(--error)'}}><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}

              {!isLoading && activeTab === 'sizes' && sizes.map(s => (
                <div key={s.id} style={listItemStyle}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{s.name}</span>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <button onClick={()=>editItem(s)} style={iconBtnStyle}><Edit2 size={14}/></button>
                    <button onClick={()=>handleDelete(s.id)} style={{...iconBtnStyle, color: 'var(--error)'}}><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}

              {!isLoading && activeTab === 'colors' && colors.map(c => (
                <div key={c.id} style={listItemStyle}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{c.name}</span>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <button onClick={()=>editItem(c)} style={iconBtnStyle}><Edit2 size={14}/></button>
                    <button onClick={()=>handleDelete(c.id)} style={{...iconBtnStyle, color: 'var(--error)'}}><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}

              {!isLoading && activeTab === 'attributes' && attributes.map(a => (
                <div key={a.id} style={listItemStyle}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{a.name}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Tipo: {a.type}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <button onClick={()=>editItem(a)} style={iconBtnStyle}><Edit2 size={14}/></button>
                    <button onClick={()=>handleDelete(a.id)} style={{...iconBtnStyle, color: 'var(--error)'}}><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}

              {!isLoading && activeTab === 'modalities' && modalities.map(m => (
                <div key={m.id} style={listItemStyle}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{m.name}</span>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <button onClick={() => editItem(m)} style={iconBtnStyle}><Edit2 size={14}/></button>
                    <button onClick={() => handleDelete(m.id)} style={{...iconBtnStyle, color: 'var(--error)'}}><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}

               {/* Empty states */}
               {!isLoading && (
                 (activeTab === 'categories' && categories.length === 0) ||
                 (activeTab === 'sizes' && sizes.length === 0) ||
                 (activeTab === 'colors' && colors.length === 0) ||
                 (activeTab === 'modalities' && modalities.length === 0) ||
                 (activeTab === 'attributes' && attributes.length === 0)
               ) && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Lista vacía.</p>}
            </div>
          </div>

          {/* FORM PANEL */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
             <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem' }}>{editingId ? 'Editar Elemento' : 'Nuevo Elemento'}</h3>
             
             <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
               <Input 
                 label="Nombre" 
                 value={formName} 
                 onChange={e => setFormName(e.target.value)} 
                 required 
                 autoFocus
               />

               {activeTab === 'categories' && (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                   <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Es Sub-categoría de: (Opcional)</label>
                   <select 
                     value={formParentId} 
                     onChange={e => setFormParentId(e.target.value)}
                     style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)'}}
                   >
                     <option value="">Ninguna (Es Categoría Principal)</option>
                     {mainCategories.filter(c => c.id !== editingId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                   </select>
                 </div>
               )}

               {activeTab === 'attributes' && (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                   <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Tipo de Dato</label>
                   <select 
                     value={formType} 
                     onChange={e => setFormType(e.target.value)}
                     style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)'}}
                   >
                     <option value="text">Texto Corto (Ej: Algodón)</option>
                     <option value="number">Número (Ej: 100)</option>
                     <option value="boolean">Sí / No</option>
                   </select>
                   <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}><Info size={12} style={{display:'inline', verticalAlign:'middle'}}/> Define cómo se mostrará el input en el formulario de producto.</p>
                 </div>
               )}

               <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                 <Button type="submit" disabled={isLoading}>{editingId ? 'Guardar Cambios' : 'Anadir a la Lista'}</Button>
                 {editingId && <Button type="button" variant="outline" onClick={resetForm}>Cancelar Edit</Button>}
               </div>
             </form>

          </div>
        </div>
      </div>
    </Modal>
    
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
    </>
  );
}

const tabStyle = (active: boolean): React.CSSProperties => ({
  background: 'none',
  border: 'none',
  padding: '0.5rem 0.2rem',
  fontSize: '0.875rem',
  fontWeight: active ? 600 : 500,
  color: active ? 'var(--primary-color)' : 'var(--text-secondary)',
  borderBottom: active ? '2px solid var(--primary-color)' : '2px solid transparent',
  cursor: 'pointer',
  whiteSpace: 'nowrap'
});

const listItemStyle: React.CSSProperties = {
  display: 'flex', 
  justifyContent: 'space-between', 
  alignItems: 'center', 
  padding: '0.6rem', 
  backgroundColor: 'var(--bg-secondary)', 
  borderRadius: '6px',
  border: '1px solid transparent'
};

const iconBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-secondary)',
  padding: '0.2rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};
