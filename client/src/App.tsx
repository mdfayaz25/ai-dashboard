import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { FullPageSpinner } from '@/components/ui/Spinner';

const Overview = lazy(() => import('@/pages/Overview'));
const Playground = lazy(() => import('@/pages/Playground'));
const Prompts = lazy(() => import('@/pages/Prompts'));
const History = lazy(() => import('@/pages/History'));
const Auth = lazy(() => import('@/pages/Auth'));

export default function App() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route path="/login" element={<Auth mode="login" />} />
        <Route path="/register" element={<Auth mode="register" />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Overview />} />
            <Route path="playground" element={<Playground />} />
            <Route path="prompts" element={<Prompts />} />
            <Route path="history" element={<History />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
