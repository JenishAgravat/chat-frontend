import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import Chat from './pages/Chat';

const isTokenValid = () => {
  const token = localStorage.getItem('token');
  if (!token || token === 'undefined') return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
};

const PrivateRoute = ({ children }) => {
  if (!isTokenValid()) {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    return <Navigate to="/signin" />;
  }
  return children;
};

const PublicRoute = ({ children }) => {
  return isTokenValid() ? <Navigate to="/chat" /> : children;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/signin" element={<PublicRoute><SignIn /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><SignUp /></PublicRoute>} />
        <Route path="/chat" element={<PrivateRoute><Chat /></PrivateRoute>} />
        <Route path="*" element={<Navigate to={isTokenValid() ? "/chat" : "/signin"} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
