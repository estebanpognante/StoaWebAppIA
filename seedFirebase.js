const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
let serviceAccount;
try {
  serviceAccount = require(path.join(process.cwd(), 'firebase-service-account.json'));
} catch (e) {
  console.error("No se encontró firebase-service-account.json");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

const seedData = async () => {
  console.log('Iniciando Seeding de Firebase...');
  const tenantID = 'stoa_demo_t1';

  // 1. Crear Tenant
  console.log('1. Creando Tenant...');
  await db.collection('tenants').doc(tenantID).set({
    tenantID,
    companyName: 'Stoa Demo SaaS',
    legalName: 'Stoa Inc.',
    taxId: '123456789',
    email: 'contacto@stoa.com',
    phone: '+1 234 567 8900',
    whatsapp: '+1 234 567 8900',
    website: 'https://stoa.app',
    descriptionShort: 'Soluciones geniales B2B',
    descriptionLong: 'Una plataforma con sede en SF.',
    publicApiEnabled: true,
    publicApiKeyPrefix: 'sk_live_',
    publicApiKeyHash: 'hashed_api_key_placeholder',
    status: 'active',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // 2. Crear Usuarios en Firebase Auth y tenantUsers
  console.log('2. Creando usuarios en Auth...');
  const usersToCreate = [
    { email: 'super@admin.com', password: 'password123', role: 'super_admin', displayName: 'Stoa Super' },
    { email: 'admin@tenant.com', password: 'password123', role: 'tenant_admin', displayName: 'Admin Empresa' },
    { email: 'user@end.com', password: 'password123', role: 'end_user', displayName: 'Cliente Final' }
  ];

  for (const u of usersToCreate) {
    try {
      // Check if user exists
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(u.email);
        console.log(`El usuario ${u.email} ya existe, actualizando password...`);
        await auth.updateUser(userRecord.uid, { password: u.password });
      } catch (e) {
        userRecord = await auth.createUser({
          email: u.email,
          password: u.password,
          displayName: u.displayName
        });
        console.log(`Usuario creado: ${u.email}`);
      }

      // Add to tenantUsers collection
      await db.collection('tenantUsers').doc(userRecord.uid).set({
        tenantID: u.role === 'super_admin' ? 'global' : tenantID,
        uid: userRecord.uid,
        role: u.role,
        email: u.email,
        displayName: u.displayName,
        status: 'active',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Set Custom Claims for security rules (optional but recommended)
      await auth.setCustomUserClaims(userRecord.uid, {
        tenantID: u.role === 'super_admin' ? 'global' : tenantID,
        role: u.role
      });

    } catch (err) {
      console.error(`Error procesando ${u.email}:`, err.message);
    }
  }

  // 3. Crear Productos
  console.log('3. Creando Productos...');
  const products = [
    { name: 'Zapatillas Stoa Pro', categoryName: 'Calzado', basePrice: 120, totalStock: 45, isPublished: true },
    { name: 'Remera Deportiva V2', categoryName: 'Indumentaria', basePrice: 35.5, totalStock: 120, isPublished: true },
    { name: 'Botella Térmica 1L', categoryName: 'Accesorios', basePrice: 25, totalStock: 0, isPublished: false }
  ];

  const batchList = [];
  for (const p of products) {
    const docRef = db.collection('products').doc();
    batchList.push(docRef.set({
      tenantID,
      categoryID: 'cat_' + p.categoryName.toLowerCase(),
      categoryName: p.categoryName,
      name: p.name,
      basePrice: p.basePrice,
      totalStock: p.totalStock,
      isPublished: p.isPublished,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }));
  }
  await Promise.all(batchList);

  // 4. Update Catalog Cache
  console.log('4. Generando publicCatalogCache...');
  await db.collection('publicCatalogCache').doc(tenantID).set({
    tenantID,
    company: {
      companyName: 'Stoa Demo SaaS',
      descriptionShort: 'Soluciones geniales B2B'
    },
    products: products.filter(p => p.isPublished),
    services: [],
    professionals: [],
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    version: 1,
  });

  console.log('¡Seeding completado con éxito!');
  process.exit(0);
};

seedData().catch(console.error);
