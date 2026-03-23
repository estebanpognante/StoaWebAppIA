'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, Scissors, Ban } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { getCollection, insertIntoCollection, updateInCollection, deleteFromCollection } from '@/lib/db';
import styles from './Appointments.module.css';

const START_HOUR = 8;
const END_HOUR = 22;

export default function AppointmentsPage() {
  const { user } = useAuth();
  
  // Vistas y Navegación
  const [view, setView] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Datos
  const [appointments, setAppointments] = useState<any[]>([]);
  const [blockedTimes, setBlockedTimes] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State para Turnos
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({isOpen: false, title: '', message: '', onConfirm: () => {}});
  
  // Modal State para Bloqueos
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [blockFormData, setBlockFormData] = useState({ date: '', professionalId: 'ALL', reason: '' });

  // Form Data
  const [formData, setFormData] = useState({
    professionalId: '',
    serviceId: '',
    variantId: '',
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    date: '', // YYYY-MM-DD
    time: '', // HH:MM
    duration: 60,
    status: 'scheduled'
  });

  useEffect(() => {
    if (user?.tenantID) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setIsLoading(true);
    let profs: any[] = [];
    let srvs: any[] = [];
    let appts: any[] = [];
    let blocks: any[] = [];

    try {
      profs = await getCollection('professionals', user!.tenantID);
      srvs = await getCollection('services', user!.tenantID);
      blocks = await getCollection('blockedTimes', user!.tenantID);
    } catch (e: any) {
      console.error('Error fetching context:', e);
    }
    
    try {
      appts = await getCollection('appointments', user!.tenantID);
    } catch (e: any) {
      console.error('Error fetching appointments. Check Firebase rules.', e);
      if (e.message && e.message.includes('permission')) {
        alert('ADVERTENCIA: Tu cuenta no tiene permiso para leer la colección "appointments". Por favor actualiza tús reglas de Firebase.');
      }
    }

    setProfessionals(profs);
    setServices(srvs);
    setAppointments(appts);
    setBlockedTimes(blocks);
    setIsLoading(false);
  };

  const handlePrev = () => {
    const d = new Date(currentDate);
    if (view === 'daily') d.setDate(d.getDate() - 1);
    if (view === 'weekly') d.setDate(d.getDate() - 7);
    if (view === 'monthly') d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (view === 'daily') d.setDate(d.getDate() + 1);
    if (view === 'weekly') d.setDate(d.getDate() + 7);
    if (view === 'monthly') d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Clic en celda vacía para crear TURNO
  const handleSlotClick = (profId: string, timeString: string, dateString: string) => {
    setEditingId(null);
    setFormData({
      professionalId: profId,
      serviceId: '',
      variantId: '',
      clientName: '',
      clientPhone: '',
      clientEmail: '',
      date: dateString,
      time: timeString,
      duration: 60,
      status: 'scheduled'
    });
    setIsModalOpen(true);
  };

  // Clic en cita existente para editar
  const handleApptClick = (e: React.MouseEvent, appt: any) => {
    e.stopPropagation(); // Prevent triggering slot click behind it
    setEditingId(appt.id);
    
    const dt = new Date(appt.startTime);
    // Ajustar zona horaria local
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    const HH = String(dt.getHours()).padStart(2, '0');
    const Min = String(dt.getMinutes()).padStart(2, '0');
    
    setFormData({
      professionalId: appt.professionalId,
      serviceId: appt.serviceId,
      variantId: appt.variantId || '',
      clientName: appt.clientName,
      clientPhone: appt.clientPhone || '',
      clientEmail: appt.clientEmail || '',
      date: `${yyyy}-${mm}-${dd}`,
      time: `${HH}:${Min}`,
      duration: appt.duration || 60,
      status: appt.status || 'scheduled'
    });
    setIsModalOpen(true);
  };

  const handleSaveAppt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.tenantID) return;
    setIsLoading(true);

    try {
      // Get ID Token for secure API call
      const { auth } = await import('@/lib/firebase/client');
      const token = await auth.currentUser?.getIdToken();

      if (editingId) {
        // En edición no mandamos mail (asumimos que ya se mandó en la creación)
        const startObj = new Date(`${formData.date}T${formData.time}:00`);
        const endObj = new Date(startObj.getTime() + formData.duration * 60000);
        const payload = { ...formData, startTime: startObj.toISOString(), endTime: endObj.toISOString() };
        await updateInCollection('appointments', editingId, payload);
      } else {
        // CREACIÓN: Usar API para gatillar el Email
        const response = await fetch('/api/admin/appointments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(formData)
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Error al agendar');
        }
      }

      setIsModalOpen(false);
      fetchData(); // Reload
      setEditingId(null);
    } catch (e: any) {
      alert('Error guardando turno: ' + e.message);
    }
    setIsLoading(false);
  };

  const requestDeleteAppt = (id: string) => {
    setConfirmModal({
      isOpen: true, 
      title: 'Eliminar Turno', 
      message: '¿Estás seguro de eliminar este turno? El registro se mantendrá en la base de datos marcado como "Cancelado" pero dejará de ocupar lugar en la agenda.',
      onConfirm: async () => {
        try {
          await updateInCollection('appointments', id, { status: 'cancelled' });
          setConfirmModal({...confirmModal, isOpen: false});
          setIsModalOpen(false);
          fetchData();
        } catch(e:any) {
          alert('Error eliminando: ' + e.message);
        }
      }
    });
  };

  // Guardar Bloqueo de Día
  const handleSaveBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.tenantID) return;
    try {
      await insertIntoCollection('blockedTimes', {
        ...blockFormData,
        tenantID: user.tenantID,
        createdAt: new Date().toISOString()
      });
      setIsBlockModalOpen(false);
      fetchData();
    } catch(e:any) {
      alert('Error bloqueando agenda: ' + e.message);
    }
  };

  const requestDeleteBlock = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Desbloquear Día',
      message: '¿Estás seguro de eliminar este bloqueo? El día volverá a estar disponible para reservas.',
      onConfirm: async () => {
        try {
          await deleteFromCollection('blockedTimes', id);
          setConfirmModal({...confirmModal, isOpen: false});
          fetchData();
        } catch(e:any) {
          alert('Error desbloqueando: ' + e.message);
        }
      }
    });
  };

  // -------------------------------------------------------------------------------- //
  //  CALENDAR MATH HELPERS
  // -------------------------------------------------------------------------------- //
  const timeSlots = [];
  for (let i = START_HOUR; i < END_HOUR; i++) {
    timeSlots.push(`${i.toString().padStart(2, '0')}:00`);
    timeSlots.push(`${i.toString().padStart(2, '0')}:30`);
  }

  const getDayStr = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const currentDayStr = getDayStr(currentDate);

  // Weekly Date Array
  const getWeekDates = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Empezar lunes
    const monday = new Date(d.setDate(diff));
    const dates = [];
    for (let i = 0; i < 7; i++) {
       const iter = new Date(monday);
       iter.setDate(monday.getDate() + i);
       dates.push(iter);
    }
    return dates;
  };
  const weekDates = getWeekDates(currentDate);

  // Monthly Matrix
  const generateMonthMatrix = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    let startOffset = firstDay.getDay() - 1; 
    if (startOffset === -1) startOffset = 6; 
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const matrix = [];
    let currentDay = 1 - startOffset;
    
    for (let row = 0; row < 6; row++) {
      const week = [];
      for (let col = 0; col < 7; col++) {
        week.push(new Date(year, month, currentDay));
        currentDay++;
      }
      matrix.push(week);
      if (currentDay > daysInMonth) break;
    }
    return matrix;
  };
  const monthMatrix = generateMonthMatrix(currentDate);

  // Array de dias a renderizar en la grilla de turnos
  const renderDays = view === 'daily' ? [currentDate] : weekDates;
  const numCols = renderDays.length * professionals.length;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Turnos</h1>
          <p className={styles.subtitle}>Gestiona las reservas de tu negocio</p>
        </div>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          <Button variant="outline" onClick={() => { setBlockFormData({...blockFormData, date: getDayStr(currentDate)}); setIsBlockModalOpen(true); }} style={{ gap: '0.3rem' }}>
             <Ban size={16} /> Bloquear Agenda
          </Button>

          <div className={styles.viewToggle}>
            <button className={view === 'daily' ? styles.active : ''} onClick={() => setView('daily')}>Diaria</button>
            <button className={view === 'weekly' ? styles.active : ''} onClick={() => setView('weekly')}>Semanal</button>
            <button className={view === 'monthly' ? styles.active : ''} onClick={() => setView('monthly')}>Mensual</button>
          </div>
        </div>
      </header>

      <div className={styles.toolbar}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
           <Button variant="outline" onClick={handleToday}>Hoy</Button>
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button className={styles.iconBtn} onClick={handlePrev}><ChevronLeft size={20} /></button>
              <h2 style={{ fontSize: '1.1rem', margin: 0, minWidth: '180px', textAlign: 'center' }}>
                {view === 'daily' && currentDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}
                {view === 'weekly' && `Semana del ${weekDates[0].getDate()} ${weekDates[0].toLocaleString('es-ES', { month: 'short'})}`}
                {view === 'monthly' && currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
              </h2>
              <button className={styles.iconBtn} onClick={handleNext}><ChevronRight size={20} /></button>
           </div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando agenda...</div>
      ) : professionals.length === 0 ? (
        <div className={styles.emptyState}>No tienes profesionales cargados. Ve a "Profesionales" para registrar tu equipo.</div>
      ) : view === 'monthly' ? (
        <div className={styles.monthGrid}>
           {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d=><div key={d} className={styles.monthHeaderCell}>{d}</div>)}
           {monthMatrix.map((week, i) => (
             <React.Fragment key={i}>
               {week.map((date, j) => {
                  const dateStr = getDayStr(date);
                  const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                  const isToday = dateStr === getDayStr(new Date());
                  const dayAppts = appointments.filter(a => a.startTime.startsWith(dateStr) && a.status !== 'cancelled');
                  const dayBlocks = blockedTimes.filter(b => b.date === dateStr);
                  
                  return (
                    <div 
                      key={j} 
                      className={`${styles.monthCell} ${!isCurrentMonth ? styles.dimmed : ''} ${isToday ? styles.today : ''}`} 
                      onClick={() => { setCurrentDate(date); setView('daily'); }}
                    >
                       <div className={styles.monthDate}>{date.getDate()}</div>
                       {dayAppts.length > 0 && <div className={styles.monthPill}>{dayAppts.length} turnos</div>}
                       {dayBlocks.length > 0 && <div className={styles.monthPill} style={{backgroundColor: 'var(--text-muted)', marginTop: '4px'}}>Bloqueado</div>}
                    </div>
                  )
               })}
             </React.Fragment>
           ))}
        </div>
      ) : (
        <div className={styles.gridContainer} style={{ overflowX: view === 'weekly' ? 'auto' : 'visible' }}>
          <div className={styles.gridScrollArea} style={{ minWidth: view === 'weekly' ? '1200px' : '100%' }}>
            
            {/* Header: Días y Profesionales */}
            <div className={styles.gridHeader}>
               <div className={styles.timeColumnHeader}>Hora</div>
               <div className={styles.daysHeaderGroup}>
                 {renderDays.map(date => (
                   <div key={date.toISOString()} className={styles.dayColGroup}>
                     <div className={styles.dayTitle}>
                        {date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}
                     </div>
                     <div className={styles.profTitlesContainer}>
                        {professionals.map(p => (
                          <div key={p.id} className={styles.profTitleCell}>
                             <div className={styles.profName}>{p.name}</div>
                          </div>
                        ))}
                     </div>
                   </div>
                 ))}
               </div>
            </div>
            
            {/* Cuerpo de la Grilla (Celdas) */}
            <div className={styles.gridBody}>
               {timeSlots.map(time => (
                 <div key={time} className={styles.gridRow}>
                   <div className={styles.timeCell}>{time}</div>
                   <div className={styles.daysRowGroup}>
                     {renderDays.map(date => {
                       const dateStr = getDayStr(date);
                       return (
                         <div key={dateStr} className={styles.dayColGroupSlots}>
                            {professionals.map(prof => (
                               <div 
                                 key={`${dateStr}-${prof.id}-${time}`} 
                                 className={styles.slotCell}
                                 onClick={() => handleSlotClick(prof.id, time, dateStr)}
                               />
                            ))}
                         </div>
                       );
                     })}
                   </div>
                 </div>
               ))}
               
               {/* OVERLAYS: BLOCKS & APPOINTMENTS */}
               <div className={styles.overlayContainer}>
                 
                 {/* BLOCKED TIMES OVERLAYS */}
                 {blockedTimes.map(b => {
                    const dayIndex = renderDays.findIndex(d => getDayStr(d) === b.date);
                    if (dayIndex === -1) return null; // Not in view
                    
                    const totalProfCols = renderDays.length * professionals.length;
                    
                    if (b.professionalId === 'ALL') {
                       // Overlay full day (spans all professionals of that day)
                       const globalProfIndexStart = dayIndex * professionals.length;
                       const widthProfCols = professionals.length;
                       return (
                         <div 
                           key={b.id} className={styles.blockOverlay}
                           style={{
                             top: '0px',
                             height: `${(END_HOUR - START_HOUR) * 60}px`,
                             left: `calc(60px + (${globalProfIndexStart} * (100% - 60px) / ${totalProfCols}))`,
                             width: `calc((${widthProfCols} * (100% - 60px) / ${totalProfCols}))`
                           }}
                           onClick={(e) => { e.stopPropagation(); requestDeleteBlock(b.id); }}
                         >
                            <div className={styles.blockText}>CERRADO <br/><span style={{fontWeight:400, fontSize:'0.75rem'}}>{b.reason}</span></div>
                         </div>
                       );
                    } else {
                       // Overlay partial day (only spans 1 professional)
                       const profIndexWithinDay = professionals.findIndex(x => x.id === b.professionalId);
                       if (profIndexWithinDay === -1) return null;
                       const globalProfIndex = (dayIndex * professionals.length) + profIndexWithinDay;
                       return (
                         <div 
                           key={b.id} className={styles.blockOverlay}
                           style={{
                             top: '0px',
                             height: `${(END_HOUR - START_HOUR) * 60}px`,
                             left: `calc(60px + (${globalProfIndex} * (100% - 60px) / ${totalProfCols}))`,
                             width: `calc(((100% - 60px) / ${totalProfCols}))`
                           }}
                           onClick={(e) => { e.stopPropagation(); requestDeleteBlock(b.id); }}
                         >
                            <div className={styles.blockText}>AUSENTE <br/><span style={{fontWeight:400, fontSize:'0.75rem'}}>{b.reason}</span></div>
                         </div>
                       );
                    }
                 })}

                 {/* APPOINTMENTS OVERLAYS */}
                 {appointments.map(appt => {
                    if (appt.status === 'cancelled') return null; // Soft delete visual filtering

                    // Check if date is currently in view
                    const dt = new Date(appt.startTime);
                    const apptDateStr = getDayStr(dt);
                    const dayIndex = renderDays.findIndex(d => getDayStr(d) === apptDateStr);
                    
                    if (dayIndex === -1) return null; // Not in this day/week view
                    
                    const h = dt.getHours();
                    const m = dt.getMinutes();
                    if (h < START_HOUR || h >= END_HOUR) return null;
                    
                    const profIndexWithinDay = professionals.findIndex(x => x.id === appt.professionalId);
                    if (profIndexWithinDay === -1) return null;
                    
                    // Top (1 minute = 1 px)
                    const topPx = (h - START_HOUR) * 60 + m;
                    const heightPx = appt.duration || 60;
                    
                    const totalProfCols = renderDays.length * professionals.length;
                    const globalProfIndex = (dayIndex * professionals.length) + profIndexWithinDay;
                    
                    return (
                      <div 
                        key={appt.id} 
                        className={styles.appointmentBlock}
                        style={{
                          top: `${topPx}px`,
                          height: `${heightPx}px`,
                          left: `calc(60px + (${globalProfIndex} * (100% - 60px) / ${totalProfCols}))`,
                          width: `calc(((100% - 60px) / ${totalProfCols}) - 4px)`
                        }}
                        onClick={(e) => handleApptClick(e, appt)}
                      >
                         <div className={styles.apptTime}>{dt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                         <div className={styles.apptClient}>{appt.clientName}</div>
                      </div>
                    );
                 })}

               </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Bloquear Día */}
      <Modal isOpen={isBlockModalOpen} onClose={() => setIsBlockModalOpen(false)} title="Bloquear Agenda">
        <form onSubmit={handleSaveBlock} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Utiliza esta función para anular días completos (Feriados, Vacaciones, Licencias).</p>
          
          <Input type="date" label="Fecha a Bloquear" value={blockFormData.date} onChange={e => setBlockFormData({...blockFormData, date: e.target.value})} required />
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>¿A quién aplica?</label>
            <select 
              value={blockFormData.professionalId} 
              onChange={e => setBlockFormData({...blockFormData, professionalId: e.target.value})}
              style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)'}}
              required
            >
              <option value="ALL">A TODO EL LOCAL (Ej: Feriado Nacional)</option>
              <optgroup label="Profesionales Individuales">
                {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </optgroup>
            </select>
          </div>

          <Input label="Motivo (Opcional, visible para ti)" placeholder="Ej: Feriado, Vacaciones, Licencia Médica..." value={blockFormData.reason} onChange={e => setBlockFormData({...blockFormData, reason: e.target.value})} />

          <Button type="submit" style={{ width: '100%', marginTop: '0.5rem' }}>Confirmar Bloqueo de Agenda</Button>
        </form>
      </Modal>

      {/* Modal de Registro / Edición (Turnos manuales) */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Editar Turno' : 'Nuevo Turno Manual'} width="sm">
        <form onSubmit={handleSaveAppt} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Input type="date" label="Fecha" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
            <Input type="time" label="Hora" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} required />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Profesional</label>
            <select 
              value={formData.professionalId} 
              onChange={e => setFormData({...formData, professionalId: e.target.value})}
              style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)'}}
              required
            >
              <option value="">Selecciona profesional...</option>
              {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Servicio a Realizar</label>
            <select 
              value={formData.serviceId} 
              onChange={e => {
                const srv = services.find(s=>s.id === e.target.value);
                setFormData({
                  ...formData, 
                  serviceId: e.target.value, 
                  duration: srv && (!srv.variants || srv.variants.length === 0) ? (srv.duration || 60) : formData.duration,
                  variantId: ''
                });
              }}
              style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)'}}
              required
            >
              <option value="">Selecciona servicio...</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.name} {s.variants?.length ? '(Agrupador)' : ''}</option>)}
            </select>
          </div>

          {(() => {
             const selectedSrv = services.find(s=>s.id === formData.serviceId);
             if (selectedSrv && selectedSrv.variants && selectedSrv.variants.length > 0) {
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Modalidad Exacta</label>
                    <select 
                      value={formData.variantId} 
                      onChange={e => {
                        const v = selectedSrv.variants.find((x:any) => x.id === e.target.value);
                        setFormData({...formData, variantId: e.target.value, duration: v ? v.duration : formData.duration});
                      }}
                      style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)'}}
                      required
                    >
                      <option value="">Obligatorio: Selecciona variante...</option>
                      {selectedSrv.variants.map((v:any) => <option key={v.id} value={v.id}>{v.name} ({v.duration} min)</option>)}
                    </select>
                  </div>
                )
             }
             return null;
          })()}

          <div style={{ display: 'flex', gap: '1rem' }}>
             <Input label="Duración (Minutos)" type="number" value={formData.duration} onChange={e => setFormData({...formData, duration: Number(e.target.value)})} required />
             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1}}>
               <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Estado</label>
               <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)'}}>
                 <option value="scheduled">Agendado</option>
                 <option value="completed">Completado</option>
                 <option value="cancelled">Cancelado</option>
                 <option value="no-show">No Asistió</option>
               </select>
             </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <Input label="Nombre del Cliente" value={formData.clientName} onChange={e => setFormData({...formData, clientName: e.target.value})} required />
            <Input label="Email del Cliente" type="email" value={formData.clientEmail} onChange={e => setFormData({...formData, clientEmail: e.target.value})} required />
          </div>
          <Input label="Teléfono (Opcional)" value={formData.clientPhone} onChange={e => setFormData({...formData, clientPhone: e.target.value})} />

          <div style={{ display: 'flex', gap: '0.5rem' }}>
             <Button type="submit" style={{ flex: 1 }}>{editingId ? 'Actualizar Turno' : 'Agendar Manual'}</Button>
             {editingId && (
               <Button type="button" variant="outline" onClick={() => requestDeleteAppt(editingId)} style={{ color: 'var(--error)', borderColor: 'var(--error)' }}>
                 Eliminar
               </Button>
             )}
          </div>
        </form>
      </Modal>

      {/* Modal Genéico de Confirmación */}
      <Modal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal({...confirmModal, isOpen: false})} title={confirmModal.title} width="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{confirmModal.message}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button variant="outline" onClick={() => setConfirmModal({...confirmModal, isOpen: false})}>Regresar</Button>
            <Button variant="danger" onClick={() => {
              confirmModal.onConfirm();
            }}>Confirmar</Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
