'use client';

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ImportExcelModal } from '@/components/ImportExcelModal';
import { DictionaryManager } from '@/components/DictionaryManager';
import { Plus, Search, Edit2, Trash2, Settings, Upload, Download } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { getCollection, insertIntoCollection, updateInCollection, deleteFromCollection } from '@/lib/db';
import styles from './Products.module.css';

export default function ProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [dbAttributes, setDbAttributes] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDictionaryOpen, setIsDictionaryOpen] = useState(false);
  const [dictionaryTab, setDictionaryTab] = useState<'categories' | 'sizes' | 'colors' | 'attributes'>('categories');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrValue, setNewAttrValue] = useState('');

  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({isOpen: false, title: '', message: '', onConfirm: () => {}});

  // Form states
  interface Variant { id: string; color: string; sizeId: string; description: string; price: number; stock: number; }
  const [formData, setFormData] = useState({ 
    name: '', brand: '', description: '', categoryId: '', subcategoryId: '', price: 0, stock: 0, status: 'active',
    variants: [] as Variant[],
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
      const [prods, cats, szs, cols, attrs] = await Promise.all([
        getCollection('products', user!.tenantID),
        getCollection('productCategories', user!.tenantID),
        getCollection('productSizes', user!.tenantID),
        getCollection('productColors', user!.tenantID),
        getCollection('tenantAttributes', user!.tenantID)
      ]);
      setProducts(prods);
      setCategories(cats);
      setSizes(szs);
      setColors(cols);
      setDbAttributes(attrs.filter((a: any) => a.entityType === 'product'));
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      brand: product.brand || '',
      description: product.description || '',
      categoryId: product.categoryId || '',
      subcategoryId: product.subcategoryId || '',
      price: product.price || 0,
      stock: product.stock || 0,
      status: product.status || 'active',
      variants: product.variants || [],
      attributes: product.attributes || {}
    });
    setIsModalOpen(true);
  };

  const handleNew = () => {
    setNewAttrKey('');
    setNewAttrValue('');
    setIsModalOpen(true);
  };

  const openDictionary = (tab: 'categories' | 'sizes' | 'colors' | 'attributes') => {
    setDictionaryTab(tab);
    setIsDictionaryOpen(true);
  };

  const handleSave = async () => {
    if (!user?.tenantID) return;
    try {
      if (editingProduct) {
        await updateInCollection('products', editingProduct.id, formData);
      } else {
        await insertIntoCollection('products', { ...formData, tenantID: user.tenantID });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (e: any) {
      alert('Error guardando producto. Detalle: ' + e.message);
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
          insertIntoCollection('tenantAttributes', { name, type: 'text', entityType: 'product', tenantID: user.tenantID })
      );
      await Promise.all(attrPromises);

      const batchPromises = rows.map(r => insertIntoCollection('products', { ...r, tenantID: user.tenantID, status: 'active', variants: [] }));
      await Promise.all(batchPromises);
      fetchData();
    } catch(e:any) {
      alert("Error importando productos: " + e.message);
      setIsLoading(false);
    }
  };

  const requestDelete = (id: string) => {
    setConfirmModal({
      isOpen: true, title: 'Eliminar Producto', message: '¿Seguro quieres eliminar este producto de forma permanente?',
      onConfirm: async () => {
        try { await deleteFromCollection('products', id); fetchData(); } catch(e:any){alert(e.message);}
      }
    });
  };

  const addVariant = () => {
    setFormData({
      ...formData, 
      variants: [...formData.variants, { id: Math.random().toString(), color: '', sizeId: '', description: '', price: formData.price, stock: 0 }]
    });
  };
  const updateVariant = (id: string, field: keyof Variant, value: any) => {
    setFormData({
      ...formData,
      variants: formData.variants.map(v => v.id === id ? { ...v, [field]: value } : v)
    });
  };
  const removeVariant = (id: string) => {
    setFormData({...formData, variants: formData.variants.filter(v => v.id !== id)});
  };

  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || '---';
  const filtered = products.filter(p => p.name?.toLowerCase().includes(searchTerm.toLowerCase()));
  const mainCategories = categories.filter(c => !c.parentID);
  const subCategories = formData.categoryId ? categories.filter(c => c.parentID === formData.categoryId) : [];

  const exportToExcel = () => {
    const rows = products.map(p => ({
      marca: p.brand || '',
      nombre: p.name || '',
      descripcion: p.description || '',
      precio: p.price || 0,
      stock: p.stock || 0,
      categoria: getCategoryName(p.categoryId),
      subcategoria: p.subcategoryId ? getCategoryName(p.subcategoryId) : '',
    }));
    // If no products, export a template row
    if (rows.length === 0) {
      rows.push({ marca: 'Ejemplo Marca', nombre: 'Ejemplo Nombre', descripcion: 'Descripcion', precio: 0, stock: 0, categoria: '', subcategoria: '' });
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    XLSX.writeFile(wb, 'productos_exportados.xlsx');
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Productos</h1>
          <p className={styles.subtitle}>Gestiona tu catálogo y variantes</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
           <Button variant="outline" onClick={exportToExcel}>
             <Download size={18} />
             Exportar Excel
           </Button>
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
            Nuevo Producto
          </Button>
        </div>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={18} className={styles.searchIcon} />
          <input 
            type="text" placeholder="Buscar productos..." className={styles.searchInput}
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Precio</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className={styles.textRight}>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={6}>Cargando catálogo...</TableCell></TableRow>
          ) : filtered.length === 0 ? (
            <TableRow><TableCell colSpan={6}>Sin productos aún.</TableCell></TableRow>
          ) : filtered.flatMap((p) => {
            const hasVariants = p.variants && p.variants.length > 0;
            const rows = [];
            
            const displayPrice = hasVariants ? `$${Math.min(...p.variants.map((v:any)=>v.price)).toFixed(2)}` : `$${Number(p.price).toFixed(2)}`;
            const displayStock = hasVariants ? p.variants.reduce((acc:number, v:any)=>acc+v.stock, 0) : p.stock;

            // Fila principal
            rows.push(
              <TableRow key={p.id}>
                <TableCell className={styles.fontWeightMedium}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--primary-color)', fontWeight: 700, textTransform: 'uppercase' }}>{p.brand || '---'}</div>
                  <div style={{ color: hasVariants ? 'var(--text-secondary)' : 'inherit', display: 'flex', alignItems: 'center', marginTop: '2px' }}>
                    {p.name} {hasVariants && <Badge variant="outline" style={{marginLeft: '0.5rem', fontSize: '0.65rem'}}>Agrupador</Badge>}
                  </div>
                  {p.description && <div style={{fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{p.description}</div>}
                  
                  {p.attributes && Object.keys(p.attributes).length > 0 && (
                     <div style={{ display: 'flex', gap: '0.2rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                        {Object.entries(p.attributes).slice(0, 3).map(([k,v]) => <span key={k} style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>{k}: {v as string}</span>)}
                        {Object.keys(p.attributes).length > 3 && <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem', color: 'var(--text-muted)' }}>+{Object.keys(p.attributes).length - 3}</span>}
                     </div>
                  )}
                </TableCell>
                <TableCell>
                  {getCategoryName(p.categoryId)}
                  {p.subcategoryId && <span style={{color:'var(--text-secondary)', fontSize:'0.8em'}}> {'>'} {getCategoryName(p.subcategoryId)}</span>}
                </TableCell>
                <TableCell>
                  {hasVariants ? <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Múltiples</span> : displayPrice}
                </TableCell>
                <TableCell>
                  {hasVariants ? <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Ver variantes ↓</span> : (displayStock > 0 ? displayStock : <span className={styles.textError}>Agotado</span>)}
                </TableCell>
                <TableCell>
                  <Badge variant={p.status === 'active' || p.status === 'published' ? 'success' : 'default'}>
                    {p.status === 'active' || p.status === 'published' ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
                <TableCell className={styles.textRight}>
                  <div className={styles.actions}>
                    <button onClick={() => handleEdit(p)} className={styles.iconBtn}><Edit2 size={16} /></button>
                    <button onClick={() => requestDelete(p.id)} className={`${styles.iconBtn} ${styles.danger}`}><Trash2 size={16} /></button>
                  </div>
                </TableCell>
              </TableRow>
            );

            // Filas de Variantes
            if (hasVariants) {
              p.variants.forEach((v: any) => {
                rows.push(
                  <TableRow key={`${p.id}-${v.id}`} style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <TableCell style={{ paddingLeft: '2rem' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                         <span style={{ color: 'var(--text-secondary)' }}>↳</span>
                         <span>
                           {v.color ? `${v.color} ` : ''} 
                           {v.sizeId ? `(Talle: ${sizes.find(s=>s.id===v.sizeId)?.name || 'N/A'})` : ''}
                           {!v.color && !v.sizeId ? 'Variante Sin Nombre' : ''}
                         </span>
                       </div>
                       {v.description && <div style={{fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', marginLeft: '1.2rem', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{v.description}</div>}
                    </TableCell>
                    <TableCell style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Sub-Variante</TableCell>
                    <TableCell>${Number(v.price).toFixed(2)}</TableCell>
                    <TableCell>{v.stock > 0 ? v.stock : <span className={styles.textError}>Agotado</span>}</TableCell>
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
        title={editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
        width="lg"
      >
        <div className={styles.formGrid}>
          <div className={styles.fullWidth} style={{ display: 'flex', gap: '1rem' }}>
            <Input label="Marca (Obligatorio)" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} required style={{ flex: 1 }} />
            <Input label="Nombre del Producto (Obligatorio)" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required style={{ flex: 2 }} />
          </div>

          {/* New Description Field for AI Context */}
          <div className={styles.fullWidth} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
             <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Descripción (Para web y asistentes de IA)</label>
             <textarea 
               value={formData.description}
               onChange={e => setFormData({...formData, description: e.target.value})}
               placeholder="Describe las características principales del producto, material, ventajas..."
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
              <Input label="Stock Disponible" type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: Number(e.target.value)})} />
            </>
          )}

          {/* Bloque de Variantes Avanzado */}
          <div className={styles.fullWidth} style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <label style={{ fontSize: '1rem', fontWeight: 600 }}>Variantes (Talles y Colores)</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button size="sm" type="button" onClick={addVariant}>+ Añadir Variante</Button>
                </div>
             </div>
             
             {formData.variants.length > 0 ? (
               <div style={{ overflowX: 'auto' }}>
                 <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                   <thead>
                     <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                       <th style={{ padding: '0.5rem', width: '20%' }}>
                         Color/Nombre <Button variant="outline" size="sm" type="button" onClick={() => openDictionary('colors')} style={{padding:'0 4px', marginLeft:'4px'}}>+</Button>
                       </th>
                       <th style={{ padding: '0.5rem', width: '25%' }}>Descripción Breve</th>
                       <th style={{ padding: '0.5rem', width: '15%' }}>
                         Talle <Button variant="outline" size="sm" type="button" onClick={() => openDictionary('sizes')} style={{padding:'0 4px', marginLeft:'4px'}}>+</Button>
                       </th>
                       <th style={{ padding: '0.5rem', width: '15%' }}>Precio ($)</th>
                       <th style={{ padding: '0.5rem', width: '15%' }}>Stock</th>
                       <th style={{ width: '10%' }}></th>
                     </tr>
                   </thead>
                   <tbody>
                     {formData.variants.map((v) => (
                       <tr key={v.id} style={{ borderBottom: '1px ' }}>
                         <td style={{ padding: '0.5rem' }}>
                           <select value={v.color} onChange={e=>updateVariant(v.id,'color',e.target.value)} style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                             <option value="">Ninguno</option>
                             {colors.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                           </select>
                         </td>
                         <td style={{ padding: '0.5rem' }}>
                           <input type="text" value={v.description} onChange={e=>updateVariant(v.id,'description',e.target.value)} placeholder="Ej: Tela respirable..." style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
                         </td>
                         <td style={{ padding: '0.5rem' }}>
                           <select value={v.sizeId} onChange={e=>updateVariant(v.id,'sizeId',e.target.value)} style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                             <option value="">Ninguno</option>
                             {sizes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                           </select>
                         </td>
                         <td style={{ padding: '0.5rem' }}>
                           <input type="number" value={v.price} onChange={e=>updateVariant(v.id,'price',Number(e.target.value))} style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
                         </td>
                         <td style={{ padding: '0.5rem' }}>
                           <input type="number" value={v.stock} onChange={e=>updateVariant(v.id,'stock',Number(e.target.value))} style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
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
               <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>No hay variantes. El producto utilizará el Precio base y Stock base.</p>
             )}
          </div>

          {/* Dynamic Attributes Section */}
          <div className={styles.fullWidth} style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
             <label style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>Características Adicionales (Flexible)</label>
             <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Añade atributos libres como Material, Peso, Temporada, etc.</p>
             
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
                 <select value={newAttrKey} onChange={e => setNewAttrKey(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
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
            <Button fullWidth onClick={handleSave}>Guardar Producto</Button>
          </div>
        </div>
      </Modal>

      <DictionaryManager 
        isOpen={isDictionaryOpen} 
        onClose={() => setIsDictionaryOpen(false)} 
        tenantID={user?.tenantID!} 
        onDataChanged={fetchData} 
        initialTab={dictionaryTab} 
        entityType="product" 
      />

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

      <ImportExcelModal 
        isOpen={isImportOpen} 
        onClose={() => setIsImportOpen(false)} 
        onImport={handleImportExcel} 
        entityType="product"
        isLoading={isLoading} 
      />

    </div>
  );
}
