import { db } from './firebase/client';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';

// In a real application, you'd add stronger types and error handling

export const getCollection = async (collectionName: string, tenantId?: string) => {
  const collRef = collection(db, collectionName);
  let q = query(collRef);
  
  if (tenantId && tenantId !== 'global') {
    q = query(collRef, where('tenantID', '==', tenantId));
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getDocument = async <T = any>(collectionName: string, docId: string): Promise<(T & { id: string }) | null> => {
  const docRef = doc(db, collectionName, docId);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() } as T & { id: string };
  }
  return null;
};

export const insertIntoCollection = async (collectionName: string, data: any) => {
  const collRef = collection(db, collectionName);
  const docRef = await addDoc(collRef, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return { id: docRef.id, ...data };
};

export const updateInCollection = async (collectionName: string, docId: string, updates: any) => {
  const docRef = doc(db, collectionName, docId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
  return { id: docId, ...updates };
};

export const deleteFromCollection = async (collectionName: string, docId: string) => {
  const docRef = doc(db, collectionName, docId);
  await deleteDoc(docRef);
  return true;
};
