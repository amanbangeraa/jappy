import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LessonPage from './pages/LessonPage';
import StudyPage from './pages/StudyPage';
import SummaryPage from './pages/SummaryPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/lessons/:id" element={<LessonPage />} />
        <Route path="/study" element={<StudyPage />} />
        <Route path="/summary" element={<SummaryPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
