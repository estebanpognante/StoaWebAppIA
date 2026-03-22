import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, role, tenantID, displayName, companyName } = body;

    // Simple validation
    if (!email || !role) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    // Determine TenantID
    let finalTenantId = tenantID;

    // If super admin is creating a completely new Tenant + Admin
    if (role === 'tenant_admin' && companyName && !tenantID) {
      finalTenantId = 'tenant_' + Math.random().toString(36).substr(2, 9);
      
      // Create Tenant Document
      await adminDb.collection('tenants').doc(finalTenantId).set({
        tenantID: finalTenantId,
        companyName,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      // Init its catalog cache
      await adminDb.collection('publicCatalogCache').doc(finalTenantId).set({
        tenantID: finalTenantId,
        company: { companyName },
        products: [], services: [], professionals: [],
        version: 1, generatedAt: new Date()
      });
    }

    if (!finalTenantId && role !== 'super_admin') {
      return NextResponse.json({ error: 'tenantID es obligatorio' }, { status: 400 });
    }

    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(email);
    } catch (error) {
      // User doesn't exist, create it
      userRecord = await adminAuth.createUser({
        email,
        displayName: displayName || email.split('@')[0],
      });
    }

    // Save user profile in tenantUsers collection
    await adminDb.collection('tenantUsers').doc(userRecord.uid).set({
      uid: userRecord.uid,
      tenantID: finalTenantId || 'global',
      email,
      role,
      displayName: userRecord.displayName,
      status: 'invited',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Set claims for security rules
    await adminAuth.setCustomUserClaims(userRecord.uid, {
      role,
      tenantID: finalTenantId || 'global'
    });

    // Generate password reset link to act as "Invitation Email"
    const link = await adminAuth.generatePasswordResetLink(email);

    return NextResponse.json({ 
      success: true, 
      user: userRecord.uid, 
      link, 
      tenantID: finalTenantId 
    });

  } catch (error: any) {
    console.error('Error in invite user:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
