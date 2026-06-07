import { Routes, Route } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import SignIn from './features/auth/SignIn';
import Layout from './components/Layout';

function Home() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-blue-600">SpendShare</h1>
      <p className="mt-4 text-gray-600">No groups yet</p>
    </div>
  );
}

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-600">
        Loading…
      </main>
    );
  }

  if (!user) {
    return <SignIn />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
      </Route>
    </Routes>
  );
}

export default App;
