import { type FC, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/auth';
import { adminLogin } from '../api/client';
import BrandLogo from '../components/BrandLogo';

const AdminLoginPage: FC = () => {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="login-page">
        <div className="spinner" />
      </div>
    );
  }

  // Already logged in — redirect
  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} replace />;
  }

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await adminLogin(email, password);
      localStorage.setItem('jappy_token', res.token);
      // Force a full page reload so AuthContext picks up the new token
      window.location.href = '/admin';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo */}
        <BrandLogo title="Jappy Admin" size="login" subtitle="Administrator login" admin />

        {/* Error */}
        {error && (
          <div className="login-error">{error}</div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="login-form">
          <div className="login-field">
            <label htmlFor="admin-email">Email</label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              autoFocus
            />
          </div>
          <div className="login-field">
            <label htmlFor="admin-password">Password</label>
            <div className="password-input-wrap">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((show) => !show)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-blue login-submit" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Login as Admin'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
          <a href="/login" style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}>
            ← Back to student login
          </a>
        </p>

        <p className="login-footer-credit">Made for Hoomans by Aman Bangera</p>
      </div>
    </div>
  );
};

export default AdminLoginPage;