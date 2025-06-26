import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem('authToken');
  console.log('[ProtectedRoute] Checking authToken:', token);
  if (!token) {
    console.log('[ProtectedRoute] No authToken found. Redirecting to /login');
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export default ProtectedRoute; 