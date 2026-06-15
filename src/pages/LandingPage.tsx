import { type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { setRole, type Role } from '../utils/role';

const LandingPage: FC = () => {
  const navigate = useNavigate();

  const selectRole = (role: Role) => {
    setRole(role);
    navigate(role === 'student' ? '/student' : '/admin');
  };

  return (
    <div className="landing-page">
      <div className="landing-content anim-fadeInUp">
        {/* Logo */}
        <div className="landing-logo">
          <div className="landing-logo-icon">
            <Icon name="book-open" size={36} strokeWidth={1.8} color="#fff" />
          </div>
          <h1 className="landing-title">Jappy</h1>
          <p className="landing-subtitle">Japanese vocabulary flashcards</p>
        </div>

        {/* Role Cards */}
        <div className="landing-roles">
          <button className="landing-role-card anim-fadeInUp" style={{ animationDelay: '150ms' }} onClick={() => selectRole('student')}>
            <div className="landing-role-icon landing-role-student">
              <Icon name="book-open" size={32} strokeWidth={1.8} color="#58CC02" />
            </div>
            <h2 className="landing-role-title">I'm a Student</h2>
            <p className="landing-role-desc">
              Browse lessons organised by JLPT level (N5–N1) and study with flashcards
            </p>
            <div className="landing-role-badge" style={{ background: '#EDFFD7', color: '#46A302' }}>
              <Icon name="play" size={12} color="#46A302" /> Start learning
            </div>
          </button>

          <button className="landing-role-card anim-fadeInUp" style={{ animationDelay: '250ms' }} onClick={() => selectRole('admin')}>
            <div className="landing-role-icon landing-role-admin">
              <Icon name="upload" size={32} strokeWidth={1.8} color="#1CB0F6" />
            </div>
            <h2 className="landing-role-title">I'm an Admin</h2>
            <p className="landing-role-desc">
              Upload CSV lessons for any JLPT level, manage content, and study
            </p>
            <div className="landing-role-badge" style={{ background: '#DBF0FF', color: '#188FC7' }}>
              <Icon name="upload" size={12} color="#188FC7" /> Manage lessons
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;