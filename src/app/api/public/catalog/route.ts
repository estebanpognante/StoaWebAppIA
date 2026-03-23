import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(request: Request) {
  const tenantId = request.headers.get('x-tenant-id');
  const apiKey = request.headers.get('x-api-key');

  if (!tenantId || !apiKey) {
    return NextResponse.json({ error: 'Missing x-tenant-id or x-api-key headers' }, { status: 401 });
  }

  try {
    const tenantDoc = await adminDb.collection('tenants').doc(tenantId).get();
    if (!tenantDoc.exists) {
      console.warn(`Tenant not found: ${tenantId}`);
      return NextResponse.json({ error: 'Tenant not found or Invalid ID' }, { status: 404 });
    }

    const tenantData = tenantDoc.data();
    if (!tenantData?.publicApiEnabled) {
      return NextResponse.json({ error: 'Public API is disabled for this tenant' }, { status: 403 });
    }

    // MANDATORY: Check if the provided API Key matches the one stored in DB
    if (tenantData.publicApiKeyPrefix !== apiKey) {
      return NextResponse.json({ error: 'Invalid API Key' }, { status: 401 });
    }

    // A real AI endpoints needs *Lively* mapped data, not just raw DB tables.
    // Fetch all active products, services, and their relational dictionaries.
    const [productsSnap, servicesSnap, prodCatsSnap, prodSizesSnap, srvCatsSnap, srvAttrsSnap] = await Promise.all([
      adminDb.collection('products').where('tenantID', '==', tenantId).where('status', 'in', ['active','published']).get(),
      adminDb.collection('services').where('tenantID', '==', tenantId).where('status', 'in', ['active','published']).get(),
      adminDb.collection('productCategories').where('tenantID', '==', tenantId).get(),
      adminDb.collection('productSizes').where('tenantID', '==', tenantId).get(),
      adminDb.collection('serviceCategories').where('tenantID', '==', tenantId).get(),
      adminDb.collection('serviceAttributes').where('tenantID', '==', tenantId).get()
    ]);

    // Build Maps for O(1) resolution
    const pCats = new Map(prodCatsSnap.docs.map(d => [d.id, d.data().name]));
    const pSizes = new Map(prodSizesSnap.docs.map(d => [d.id, d.data().name]));
    const sCats = new Map(srvCatsSnap.docs.map(d => [d.id, d.data().name]));
    const sAttrs = new Map(srvAttrsSnap.docs.map(d => [d.id, d.data().name]));

    // Format Products for AI reading
    const productsCatalog = productsSnap.docs.map(doc => {
      const p = doc.data();
      return {
        id: doc.id,
        name: p.name,
        description: p.description || '',
        category: pCats.get(p.categoryId) || null,
        subCategory: pCats.get(p.subcategoryId) || null,
        basePrice: p.price || 0,
        baseStock: p.stock || 0,
        isConfigurable: p.variants && p.variants.length > 0,
        variants: (p.variants || []).map((v: any) => ({
          variantId: v.id,
          nameOrColor: v.color || '',
          description: v.description || '',
          size: pSizes.get(v.sizeId) || null,
          price: v.price || p.price || 0,
          stock: v.stock || 0,
          available: v.stock > 0
        }))
      };
    });

    // Format Services for AI reading
    const servicesCatalog = servicesSnap.docs.map(doc => {
      const s = doc.data();
      return {
        id: doc.id,
        name: s.name,
        description: s.description || '',
        category: sCats.get(s.categoryId) || null,
        subCategory: sCats.get(s.subcategoryId) || null,
        basePrice: s.price || 0,
        baseDurationMinutes: s.duration || 60,
        hasModalities: s.variants && s.variants.length > 0,
        modalities: (s.variants || []).map((v: any) => ({
          modalityId: v.id,
          name: v.name || '',
          description: v.description || '',
          attributeType: sAttrs.get(v.attributeId) || null,
          price: v.price || s.price || 0,
          durationMinutes: v.duration || s.duration || 60
        }))
      };
    });

    const aiOptimizedCatalog = {
      tenant: {
        id: tenantDoc.id,
        businessName: tenantData?.businessName || '',
        schemaVersion: 'v2-ai-optimized'
      },
      catalog: {
        products: productsCatalog,
        services: servicesCatalog
      }
    };

    return NextResponse.json(aiOptimizedCatalog);

  } catch (error: any) {
    console.error('API Error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
