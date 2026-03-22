'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from './firebase/client';
import { 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged, 
  sendPasswordResetEmail,
  User as FirebaseUser 
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export interface AppUser {
  uid: string;
  email: string | null;
  role: 'super_admin' | 'tenant_admin' | 'end_user';
  tenantID: string;
  displayName?: string | null;
}

interface AuthContextProps {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Fetch user doc from Firestore to get role and tenantID
          const userDocRef = doc(db, 'tenantUsers', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: data.role,
              tenantID: data.tenantID,
              displayName: firebaseUser.displayName || data.displayName
            });
          } else {
            // Fallback for missing document
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: 'end_user',
              tenantID: 'default',
              displayName: firebaseUser.displayName
            });
          }
        } catch (error) {
          console.error("Error fetching user profile", error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = () => {
    firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, resetPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
