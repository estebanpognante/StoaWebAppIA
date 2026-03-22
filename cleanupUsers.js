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
const auth = admin.auth();

const cleanup = async () => {
  console.log('--- Iniciando limpieza de usuarios de prueba ---');
  const emailsToDelete = ['super@admin.com', 'admin@tenant.com', 'user@end.com'];
  
  for (const email of emailsToDelete) {
    try {
      const user = await auth.getUserByEmail(email);
      await auth.deleteUser(user.uid);
      await db.collection('tenantUsers').doc(user.uid).delete();
      console.log(`Eliminado: ${email}`);
    } catch (e) {
      console.log(`Omitido (no encontrado): ${email}`);
    }
  }

  console.log('--- Creando Superadmin Oficial ---');
  const superEmail = 'himaltia@gmail.com';
  let superUser;
  
  try {
    superUser = await auth.getUserByEmail(superEmail);
    console.log(`El usuario ${superEmail} ya existía en Auth. Actualizando claims.`);
  } catch (e) {
    superUser = await auth.createUser({
      email: superEmail,
      displayName: 'Stoa Superadmin'
      // No password is set, the user can reset it via "Forgot Password" or we can send a link
    });
    console.log(`Creado usuario en Auth: ${superEmail}`);
  }

  // Generate a password generation link just in case
  const link = await auth.generatePasswordResetLink(superEmail);

  // Firestore profile
  await db.collection('tenantUsers').doc(superUser.uid).set({
    uid: superUser.uid,
    tenantID: 'global',
    email: superEmail,
    role: 'super_admin',
    displayName: superUser.displayName || 'Superadmin',
    status: 'active',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  // Custom Claims for Admin SDK
  await auth.setCustomUserClaims(superUser.uid, {
    role: 'super_admin',
    tenantID: 'global'
  });

  console.log('--- Limpieza completada ---');
  console.log('\\n\\n=== IMPORTANTE ===');
  console.log('Enlace de acceso para configurar la clave de himaltia@gmail.com:');
  console.log(link);
  console.log('==================\\n\\n');

  process.exit(0);
};

cleanup().catch(console.error);
