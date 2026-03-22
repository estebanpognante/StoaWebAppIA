const admin = require('firebase-admin');
const path = require('path');

let serviceAccount;
try {
  serviceAccount = require(path.join(process.cwd(), 'firebase-service-account.json'));
} catch (e) {
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

const deleteCollection = async (collectionPath) => {
  const collectionRef = db.collection(collectionPath);
  const snapshot = await collectionRef.get();
  
  if (snapshot.size === 0) {
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  // Recursively delete until empty (if it exceeds batch limit)
  if (snapshot.size >= 500) {
    await deleteCollection(collectionPath);
  }
};

const deleteDummyData = async () => {
  console.log('--- Eliminando todas las entidades mockeadas de Firestore ---');
  
  const collectionsToWipe = [
    'tenants', 
    'products', 
    'services', 
    'professionals', 
    'publicCatalogCache',
    'productCategories',
    'serviceCategories',
    'productVariants'
  ];

  for (const coll of collectionsToWipe) {
    console.log(`Borrando colección: ${coll}...`);
    await deleteCollection(coll);
  }

  // Delete all users in tenantUsers EXCEPT himaltia
  console.log(`Borrando perfiles en tenantUsers (excepto superadmin)...`);
  const usersSnap = await db.collection('tenantUsers').get();
  const batch = db.batch();
  usersSnap.docs.forEach(doc => {
    if (doc.data().email !== 'himaltia@gmail.com') {
      batch.delete(doc.ref);
    }
  });
  await batch.commit();

  console.log('--- Limpieza exitosa. BD en blanco (solo quedó tu Superadmin global). ---');
  process.exit(0);
};

deleteDummyData().catch(console.error);
