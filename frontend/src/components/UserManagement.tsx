/// <reference types="vite/client" />

import React, { useState, useEffect } from 'react';
import { User, Role } from '../types';
import { getAvailableUsers, getCurrentUser, switchUser, logout } from '../services/authService';
import { getRoleById } from '../services/metadataService';
import ChangePasswordModal from './ChangePasswordModal';

interface UserManagementProps {
  onUserChange?: () => void;
}

const UserManagement: React.FC<UserManagementProps> = ({ onUserChange }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const { loadMetadata } = await import('../services/metadataService');
        await loadMetadata();
        await loadUserData();
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const loadUserData = async () => {
    const user = await getCurrentUser();
    setCurrentUser(user);
    
    if (user) {
      const role = getRoleById(user.role);
      setCurrentRole(role || null);
    }
    
    const users = getAvailableUsers();
    setAvailableUsers(users);
  };

  const handleUserSwitch = async (username: string) => {
    const success = await switchUser(username);
    if (success) {
      loadUserData();
      setIsOpen(false);
      onUserChange?.();
    }
  };

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
    setCurrentRole(null);
    setIsOpen(false);
    onUserChange?.();
    window.location.href = '/login';
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center text-slate-500 dark:text-slate-400">Loading user data...</div>
    );
  }

  if (!currentUser) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-700 dark:text-red-300 text-sm">
          No user logged in. Please refresh the page to initialize authentication.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
      >
        {currentUser?.avatar ? (
          <img
            src={currentUser.avatar?.replace('s96-c', 's256-c')}
            alt="User avatar"
            className="w-6 h-6 rounded-full object-cover border-2 border-slate-200 shadow-sm"
            style={{ background: '#f3f4f6' }}
          />
        ) : (
          <div className="w-6 h-6 bg-sky-500 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-slate-200 shadow-sm">
            {currentUser?.username ? currentUser.username.charAt(0).toUpperCase() : '?'}
        </div>
        )}
        <span>{currentUser.username}</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg z-50">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center space-x-3">
              {currentUser?.avatar ? (
                <img
                  src={currentUser.avatar?.replace('s96-c', 's256-c')}
                  alt="User avatar"
                  className="w-10 h-10 rounded-full object-cover border-2 border-slate-200 shadow"
                  style={{ background: '#f3f4f6' }}
                />
              ) : (
                <div className="w-10 h-10 bg-sky-500 rounded-full flex items-center justify-center text-white font-bold border-2 border-slate-200 shadow">
                  {currentUser?.username ? currentUser.username.charAt(0).toUpperCase() : '?'}
              </div>
              )}
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {currentUser.username}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {currentUser.email}
                </p>
                {currentRole && (
                  <p className="text-xs text-sky-600 dark:text-sky-400 font-medium">
                    {currentRole.name}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="p-4">
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">
              Switch User (RBAC Testing)
            </h3>
            <div className="space-y-2">
              {availableUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleUserSwitch(user.username)}
                  disabled={user.id === currentUser.id}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    user.id === currentUser.id
                      ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 cursor-not-allowed'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{user.username}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {getRoleById(user.role)?.name || user.role}
                      </p>
                    </div>
                    {user.id === currentUser.id && (
                      <span className="text-xs bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 px-2 py-1 rounded">
                        Current
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setIsChangePasswordOpen(true)}
                className="w-full px-3 py-2 text-sm font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-md hover:bg-sky-100 dark:hover:bg-sky-900/30 transition-colors mb-2"
              >
                Change Password
              </button>
              <button
                onClick={handleLogout}
                className="w-full px-3 py-2 text-sm font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
      <ChangePasswordModal isOpen={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)} />
    </div>
  );
};

export default UserManagement;