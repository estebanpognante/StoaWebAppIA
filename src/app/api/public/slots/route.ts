import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

const getWeekdayKey = (date: Date) => {
  const map = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return map[date.getDay()];
};

function timeToMinutes(timeStr: string) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const serviceId = searchParams.get('serviceId');
    const variantId = searchParams.get('variantId');
    const dateStr = searchParams.get('date'); // Opcional (Si es null, calcula "Próximos 3 días reales")
    const filterProfId = searchParams.get('professionalId'); // Opcional: filtrar por profesional

    const tenantId = req.headers.get('x-tenant-id');
    const apiKey = req.headers.get('x-api-key');

    if (!tenantId || !apiKey) {
      return NextResponse.json({ error: 'Missing x-tenant-id or x-api-key headers' }, { status: 401 });
    }

    if (!serviceId) {
      return NextResponse.json({ error: 'Missing serviceId parameter' }, { status: 400 });
    }

    // Read tenant timezone offset
    const tenantDoc2 = await adminDb.collection('tenants').doc(tenantId).get();
    const utcOffsetMinutes: number = (tenantDoc2.data()?.utcOffsetMinutes) ?? 0;

    // 1. Obtener la Duración del Servicio
    const serviceDoc = await adminDb.collection('services').doc(serviceId).get();
    if (!serviceDoc.exists || serviceDoc.data()?.tenantID !== tenantId) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }
    const serviceData = serviceDoc.data()!;
    let duration = serviceData.duration || 60;

    if (variantId && serviceData.variants) {
      const variant = serviceData.variants.find((v:any) => v.id === variantId);
      if (variant) duration = variant.duration || duration;
    }

    // 2. Obtener Profesionales que brindan este servicio
    const serviceKey = variantId ? `${serviceId}|${variantId}` : serviceId;
    const profsSnapshot = await adminDb.collection('professionals')
      .where('tenantID', '==', tenantId)
      .where('isActive', '==', true)
      .get(); 

    const allProfs = profsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    let assignedProfs = allProfs.filter(p => {
        if (!p.services) return false;
        return p.services.includes(serviceKey) || p.services.includes(serviceId);
    });

    // Si se pasa un professionalId específico, filtrar solo ese profesional
    if (filterProfId) {
      assignedProfs = assignedProfs.filter(p => p.id === filterProfId);
    }

    if (assignedProfs.length === 0) {
      return NextResponse.json({ type: dateStr ? 'single' : 'next3', days: [] });
    }

    // ---- FUNCIÓN NÚCLEO: Calcular disponibilidad de 1 día exacto ---- //
    const getSlotsForDate = async (targetDate: Date) => {
        const yyyy = targetDate.getFullYear();
        const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
        const dd = String(targetDate.getDate()).padStart(2, '0');
        const localDateStr = `${yyyy}-${mm}-${dd}`;
        const weekday = getWeekdayKey(targetDate);
        
        // Descartar si ningún profesional trabaja ese día de la semana
        const availableProfs = assignedProfs.filter(p => p.workingHours && p.workingHours[weekday] && p.workingHours[weekday].isActive);
        if (availableProfs.length === 0) return null;
        
        // Buscar citas de ese día para todos los profesionales
        const startOfDay = new Date(new Date(`${localDateStr}T00:00:00Z`).getTime() - utcOffsetMinutes * 60000).toISOString();
        const endOfDay = new Date(new Date(`${localDateStr}T23:59:59Z`).getTime() - utcOffsetMinutes * 60000).toISOString();
        const apptsSnapshot = await adminDb.collection('appointments')
          .where('tenantID', '==', tenantId)
          .where('status', 'in', ['scheduled', 'completed']) 
          .where('startTime', '>=', startOfDay)
          .where('startTime', '<=', endOfDay)
          .get();
          
        const blocksSnapshot = await adminDb.collection('blockedTimes')
          .where('tenantID', '==', tenantId)
          .where('date', '==', localDateStr)
          .get();
          
        const existingBlocks = blocksSnapshot.docs.map(doc => doc.data());
        if (existingBlocks.some(b => b.professionalId === 'ALL')) {
            return null; // Local Cerrado completo ese día
        }

        const existingAppts = apptsSnapshot.docs.map(doc => doc.data());
        
        const dayResult = availableProfs.map(prof => {
            if (existingBlocks.some(b => b.professionalId === prof.id)) {
                return null; // Este profesional puntual está de vacaciones hoy
            }

            const workingDay = prof.workingHours[weekday];
            const slots = [];
            const startMinutes = timeToMinutes(workingDay.start);
            const endMinutes = timeToMinutes(workingDay.end);
            const profAppts = existingAppts.filter(a => a.professionalId === prof.id);

            // Calcular franjas de 30 minutos
            for (let min = startMinutes; min + duration <= endMinutes; min += 30) {
                 const slotStartObj = new Date(targetDate.getTime() + min * 60000);
                 
                 // Descartar horarios que ya pasaron HOY (si están buscando turnos en el día actual)
                 if (slotStartObj.getTime() < new Date().getTime()) continue; 
                 
                 const slotStartStr = slotStartObj.toISOString();
                 const slotEndStr = new Date(targetDate.getTime() + (min + duration) * 60000).toISOString();
                 
                 // Comprobar Colisión
                 const hasCollision = profAppts.some(appt => {
                    const apptStart = new Date(appt.startTime).getTime();
                    const apptEnd = new Date(appt.endTime).getTime();
                    const sStart = slotStartObj.getTime();
                    const sEnd = new Date(slotEndStr).getTime();
                    return (sStart < apptEnd && sEnd > apptStart);
                 });

                 if (!hasCollision) {
                   const hh = Math.floor(min / 60).toString().padStart(2, '0');
                   const mm = (min % 60).toString().padStart(2, '0');
                   slots.push(`${hh}:${mm}`);
                 }
            }

            if (slots.length === 0) return null;
            
            // Agrupar en Mañana (< 13:00) y Tarde (>= 13:00) para simplificarle la vida a la IA
            const shifts = { morning: [] as string[], afternoon: [] as string[] };
            slots.forEach(time => {
                const hour = parseInt(time.split(':')[0], 10);
                if (hour < 13) shifts.morning.push(time);
                else shifts.afternoon.push(time);
            });
            
            return {
                professionalId: prof.id,
                professionalName: prof.name,
                shifts
            };
        }).filter(Boolean);
        
        if (dayResult.length === 0) return null;
        
        return {
            date: localDateStr,
            serviceDuration: duration,
            professionals: dayResult
        };
    };

    // ---------------- LÓGICA DE RESPUESTA ---------------- //
    
    if (dateStr) {
       // A. Petición de un DÍA EXACTO
       const naiveMidnight = new Date(`${dateStr}T00:00:00Z`);
       const targetDate = new Date(naiveMidnight.getTime() - utcOffsetMinutes * 60000);
       if (isNaN(targetDate.getTime())) return NextResponse.json({error: 'Invalid date format'}, {status: 400});
       
       const result = await getSlotsForDate(targetDate);
       return NextResponse.json({
           type: 'single',
           days: result ? [result] : []
       });
       
    } else {
       // B. Petición Libre ("Los Próximos 3 días laborables")
       const days = [];
       const iterDate = new Date(); // Empezamos a revisar desde HOY (incluye turnos de última hora)
       iterDate.setHours(0,0,0,0);
       
       // Evaluamos hasta 14 días mirando al futuro, hasta encontrar 3 días que tengan AL MENOS UN HUECO.
       // Así evitamos escenarios donde el local esté cerrado 5 días por bloqueos o feriados.
       for (let i = 0; i < 14; i++) {
           const d = new Date(iterDate);
           d.setDate(d.getDate() + i);
           
           const result = await getSlotsForDate(d);
           if (result) {
               days.push(result);
           }
           
           if (days.length === 3) break; // Detenemos la búsqueda cuando tenemos 3 días repletos de opciones
       }
       
       return NextResponse.json({
           type: 'next3',
           days
       });
    }

  } catch (error: any) {
    console.error('API Slots Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
