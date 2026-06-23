import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/auth';

interface Props {
  children: ReactNode;
  role?: 'student' | 'admin';
}

export default function ProtectedRoute({ children, role }: Props) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontFamily: 'var(--font)', color: 'var(--text-secondary)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" />
          <p style={{ marginTop: 12 }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role && user.role !== role) {
    const redirect = user.role === 'admin' ? '/admin' : '/student';
    return <Navigate to={redirect} replace />;
  }

  return <>{children}</>;
}