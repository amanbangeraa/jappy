import { type FC } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/auth';

const LandingPage: FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="login-page">
        <div className="spinner" />
      </div>
    );
  }

  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} replace />;
  }

  return <Navigate to="/login" replace />;
};

export default LandingPage;