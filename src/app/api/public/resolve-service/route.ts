import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * GET /api/public/resolve-service
 *
 * Resolves a service progressively using up to 3 classification layers:
 *   Layer 1 - domain:    Top-level category (parentID == null)
 *   Layer 2 - specialty: Sub-category under domain
 *   Layer 3 - modality:  Variant within the resolved service
 *
 * Returns either a fully resolved serviceId/variantId pair,
 * or a list of options for the next unresolved layer.
 *
 * Required headers: x-tenant-id, x-api-key
 * Optional query params: domain, specialty, modality
 */

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function matches(stored: string, query: string): boolean {
  return normalize(stored).includes(normalize(query));
}

export async function GET(request: Request) {
  const tenantId = request.headers.get('x-tenant-id');
  const apiKey = request.headers.get('x-api-key');

  if (!tenantId || !apiKey) {
    return NextResponse.json(
      { error: 'Faltan los headers x-tenant-id y x-api-key' },
      { status: 401 }
    );
  }

  try {
    // --- Auth check ---
    const tenantDoc = await adminDb.collection('tenants').doc(tenantId).get();
    if (!tenantDoc.exists) {
      return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 });
    }
    const tenantData = tenantDoc.data()!;
    if (!tenantData.publicApiEnabled) {
      return NextResponse.json({ error: 'API pública deshabilitada para este tenant' }, { status: 403 });
    }
    if (tenantData.publicApiKeyPrefix !== apiKey) {
      return NextResponse.json({ error: 'API Key inválida' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const domainQ    = searchParams.get('domain') || '';
    const specialtyQ = searchParams.get('specialty') || '';
    const modalityQ  = searchParams.get('modality') || '';

    // --- Fetch all categories and active services for this tenant ---
    const [catsSnap, servicesSnap] = await Promise.all([
      adminDb.collection('serviceCategories').where('tenantID', '==', tenantId).get(),
      adminDb.collection('services')
        .where('tenantID', '==', tenantId)
        .where('status', 'in', ['active', 'published'])
        .get(),
    ]);

    const allCats = catsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    const allServices = servicesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

    // Layer 1 — Domain: top-level categories (no parentID)
    const domains = allCats.filter((c: any) => !c.parentID);

    if (!domainQ) {
      // Nothing provided: return all domains so the AI can ask
      return NextResponse.json({
        resolved: false,
        level: 'domain',
        message: '¿Qué tipo de servicio buscas?',
        options: domains.map((d: any) => ({ id: d.id, name: d.name })),
      });
    }

    // Try to match domain by name
    const matchedDomain = domains.find((d: any) => matches(d.name, domainQ));
    if (!matchedDomain) {
      return NextResponse.json({
        resolved: false,
        ambiguous: true,
        level: 'domain',
        message: `No se encontró el tipo de servicio "${domainQ}". Opciones disponibles:`,
        options: domains.map((d: any) => ({ id: d.id, name: d.name })),
      });
    }

    // Layer 2 — Specialty: sub-categories whose parentID == matchedDomain.id
    const specialties = allCats.filter((c: any) => c.parentID === matchedDomain.id);

    if (!specialtyQ) {
      return NextResponse.json({
        resolved: false,
        level: 'specialty',
        domain: { id: matchedDomain.id, name: matchedDomain.name },
        message: `Dentro de "${matchedDomain.name}", ¿qué servicio necesitás?`,
        options: specialties.map((s: any) => ({ id: s.id, name: s.name })),
      });
    }

    // Match specialty
    const matchedSpecialty = specialties.find((s: any) => matches(s.name, specialtyQ));
    if (!matchedSpecialty) {
      return NextResponse.json({
        resolved: false,
        ambiguous: true,
        level: 'specialty',
        domain: { id: matchedDomain.id, name: matchedDomain.name },
        message: `No se encontró "${specialtyQ}" en "${matchedDomain.name}". Opciones:`,
        options: specialties.map((s: any) => ({ id: s.id, name: s.name })),
      });
    }

    // Find services matching this specialty (by categoryId or subcategoryId)
    const candidateServices = allServices.filter(
      (s: any) => s.categoryId === matchedSpecialty.id || s.subcategoryId === matchedSpecialty.id
    );

    if (candidateServices.length === 0) {
      return NextResponse.json({
        resolved: false,
        ambiguous: false,
        level: 'specialty',
        message: `No hay servicios activos para "${matchedSpecialty.name}"`,
        options: [],
      });
    }

    // If only one service and it has no variants → fully resolved
    if (candidateServices.length === 1 && (!candidateServices[0].variants || candidateServices[0].variants.length === 0)) {
      const svc = candidateServices[0];
      return NextResponse.json({
        resolved: true,
        serviceId: svc.id,
        variantId: null,
        name: svc.name,
        durationMinutes: svc.duration || 60,
        basePrice: svc.price || 0,
        ambiguous: false,
      });
    }

    // Layer 3 — Modality: try to match variant within candidate services
    // Collect all variants from all candidates
    const allVariants: { serviceId: string; serviceName: string; variantId: string; name: string; duration: number; price: number }[] = [];
    for (const svc of candidateServices) {
      if (svc.variants && svc.variants.length > 0) {
        for (const v of svc.variants) {
          allVariants.push({
            serviceId: svc.id,
            serviceName: svc.name,
            variantId: v.id,
            name: v.name,
            duration: v.duration || svc.duration || 60,
            price: v.price || svc.price || 0,
          });
        }
      } else {
        // Service has no variants — treat the service itself as an option
        allVariants.push({
          serviceId: svc.id,
          serviceName: svc.name,
          variantId: '',
          name: svc.name,
          duration: svc.duration || 60,
          price: svc.price || 0,
        });
      }
    }

    if (!modalityQ) {
      return NextResponse.json({
        resolved: false,
        level: 'modality',
        domain: { id: matchedDomain.id, name: matchedDomain.name },
        specialty: { id: matchedSpecialty.id, name: matchedSpecialty.name },
        message: `¿Qué modalidad de "${matchedSpecialty.name}" necesitás?`,
        options: allVariants.map(v => ({
          serviceId: v.serviceId,
          variantId: v.variantId || null,
          name: v.name,
          durationMinutes: v.duration,
          basePrice: v.price,
        })),
      });
    }

    // Try to match modality
    const matchedVariant = allVariants.find(v => matches(v.name, modalityQ));
    if (!matchedVariant) {
      return NextResponse.json({
        resolved: false,
        ambiguous: true,
        level: 'modality',
        message: `No se encontró "${modalityQ}". Modalidades disponibles:`,
        options: allVariants.map(v => ({
          serviceId: v.serviceId,
          variantId: v.variantId || null,
          name: v.name,
          durationMinutes: v.duration,
          basePrice: v.price,
        })),
      });
    }

    // Fully resolved
    return NextResponse.json({
      resolved: true,
      serviceId: matchedVariant.serviceId,
      variantId: matchedVariant.variantId || null,
      name: matchedVariant.name,
      durationMinutes: matchedVariant.duration,
      basePrice: matchedVariant.price,
      ambiguous: false,
    });

  } catch (error: any) {
    console.error('Resolve-Service API Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
