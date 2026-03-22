'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import styles from './Login.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  
  const { login, user, resetPassword } = useAuth();
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setMessage('');

    try {
      if (isResetMode) {
        await resetPassword(email);
        setMessage('Si el email existe, recibirás un enlace para recuperar tu contraseña.');
        setIsSubmitting(false);
        // We voluntarily do not redirect or switch mode immediately so they can read the message
      } else {
        await login(email, password);
        // On success, useEffect will trigger redirection
      }
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential') {
         setError('Credenciales inválidas. Verifica tu email y contraseña.');
      } else if (err.code === 'auth/user-not-found') {
         setError('No existe una cuenta con este correo.');
      } else {
         setError(err.message || 'Error al procesar la solicitud.');
      }
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <Card className={styles.loginCard}>
        <CardHeader>
          <div className={styles.logoContainer}>
            <div className={styles.logo}>S</div>
          </div>
          <CardTitle className={styles.title}>
            {isResetMode ? 'Recuperar Contraseña' : 'Iniciar Sesión'}
          </CardTitle>
          <p className={styles.subtitle}>
            {isResetMode 
              ? 'Ingresa tu correo para recibir un enlace de recuperación' 
              : 'Ingresa a tu cuenta de Stoa'}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className={styles.form}>
            {error && <div className={styles.error}>{error}</div>}
            {message && <div className={styles.successMessage}>{message}</div>}

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              fullWidth
            />

            {!isResetMode && (
              <Input
                label="Contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                fullWidth
              />
            )}

            <Button
              type="submit"
              fullWidth
              isLoading={isSubmitting}
            >
              {isResetMode ? 'Enviar Enlace' : 'Ingresar'}
            </Button>
            
            <div className={styles.toggleMode}>
              <button 
                type="button" 
                className={styles.textButton}
                onClick={() => {
                  setIsResetMode(!isResetMode);
                  setError('');
                  setMessage('');
                }}
              >
                {isResetMode ? 'Volver al Inicio de Sesión' : '¿Olvidaste tu contraseña?'}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
