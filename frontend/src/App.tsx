import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './auth/LoginPage';
import { RequireAuth } from './auth/RequireAuth';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { NotebookPage } from './features/notebook/NotebookPage';

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/notebooks/:id"
          element={
            <RequireAuth>
              <NotebookPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
