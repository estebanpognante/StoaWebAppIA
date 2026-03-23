import React, { useState, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import * as xlsx from 'xlsx';

interface ImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (rows: any[]) => void;
  entityType: 'product' | 'service';
  isLoading?: boolean;
}

export function ImportExcelModal({ isOpen, onClose, onImport, entityType, isLoading }: ImportExcelModalProps) {
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [validRows, setValidRows] = useState<any[]>([]);
  const [invalidRows, setInvalidRows] = useState<any[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const requiredCols = entityType === 'product' 
    ? ['marca', 'nombre', 'descripcion', 'precio', 'stock']
    : ['marca', 'nombre', 'descripcion', 'precio'];

  const resetState = () => {
    setParsedRows([]);
    setValidRows([]);
    setInvalidRows([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const cleanKey = (k: string) => k.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = xlsx.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = xlsx.utils.sheet_to_json(ws);

        const valid: any[] = [];
        const invalid: any[] = [];

        data.forEach((row: any, index: number) => {
          // Normalizar las llaves para que case insensitive y sin acentos
          const normRow: any = {};
          Object.keys(row).forEach(k => {
            normRow[cleanKey(k)] = row[k];
          });

          // Verificar requeridos
          const missing = requiredCols.filter(col => normRow[col] === undefined || normRow[col] === '');
          
          const rawItem = { ...row };
          if (missing.length > 0) {
            invalid.push({ row: index + 2, raw: rawItem, missing });
          } else {
            // Construir el payload de importacion
            const payload: any = {
              brand: normRow['marca'],
              name: normRow['nombre'],
              description: normRow['descripcion'],
              price: Number(normRow['precio']),
              attributes: {}
            };
            if (entityType === 'product') {
              payload.stock = Number(normRow['stock'] || 0);
            }

            // Los campos extra van a attributes (excluyendo requeridos)
            Object.keys(row).forEach(originalKey => {
               const cleanCol = cleanKey(originalKey);
               if (!requiredCols.includes(cleanCol)) {
                 payload.attributes[originalKey.trim()] = String(row[originalKey]);
               }
            });

            valid.push(payload);
          }
        });

        setParsedRows(data);
        setValidRows(valid);
        setInvalidRows(invalid);
      } catch (err) {
        console.error("Error parsing excel", err);
        alert("Error procesando el archivo Excel. Revisa el formato.");
      }
      setIsParsing(false);
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = () => {
    onImport(validRows);
    resetState();
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Importar desde Excel" width="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {!parsedRows.length && (
          <div style={{ border: '2px dashed var(--border-color)', borderRadius: '8px', padding: '3rem 1rem', textAlign: 'center' }}>
            <Upload size={32} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Sube tu planilla Excel (.xlsx, .xls)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Columnas requeridas: {requiredCols.join(', ')}.<br/>
              Las demás columnas se guardarán automáticamente como características dinámicas.
            </p>
            <Button onClick={() => fileInputRef.current?.click()} isLoading={isParsing}>Seleccionar Archivo</Button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls, .csv" style={{ display: 'none' }} />
          </div>
        )}

        {parsedRows.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
             <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1, padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)' }}>
                    <CheckCircle2 size={20} />
                    <span style={{ fontWeight: 600 }}>Filas válidas ({validRows.length})</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem'}}>Listas para ser importadas al sistema.</p>
                </div>
                <div style={{ flex: 1, padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--error)' }}>
                    <AlertCircle size={20} />
                    <span style={{ fontWeight: 600 }}>Filas con error ({invalidRows.length})</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem'}}>Omitidas por falta de campos obligatorios.</p>
                </div>
             </div>

             {invalidRows.length > 0 && (
               <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem' }}>
                 <p style={{ fontSize: '0.85rem', fontWeight: 600, padding: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>Detalle de Errores:</p>
                 {invalidRows.map((inv, idx) => (
                   <div key={idx} style={{ padding: '0.5rem', fontSize: '0.85rem', borderBottom: '1px solid var(--border-color)' }}>
                     <strong>Fila Excel {inv.row}:</strong> Faltan columnas ({inv.missing.join(', ')})
                   </div>
                 ))}
               </div>
             )}

             <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
               <Button variant="outline" onClick={resetState}>Subir otro archivo</Button>
               {validRows.length > 0 && (
                 <Button onClick={handleImport} isLoading={isLoading}>Importar {validRows.length} Registros</Button>
               )}
             </div>
          </div>
        )}

      </div>
    </Modal>
  );
}
