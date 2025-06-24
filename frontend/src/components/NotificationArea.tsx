/// <reference types="vite/client" />

import React from 'react';
import { NotificationMessage } from '../types';
import NotificationToast from './NotificationToast';

interface NotificationAreaProps {
  notifications: NotificationMessage[];
  onDismissNotification: (id: string) => void;
}

const NotificationArea: React.FC<NotificationAreaProps> = ({ notifications, onDismissNotification }) => {
  return (
    <div className="fixed top-20 right-4 z-[1000] w-full max-w-sm space-y-2">
      {notifications.map((notification) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={onDismissNotification}
        />
      ))}
    </div>
  );
};

export default NotificationArea; 