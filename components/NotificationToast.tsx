
import React, { useEffect } from 'react';
import { NotificationMessage } from '../types';
import { ICONS } from '../constants';

interface NotificationToastProps {
  notification: NotificationMessage;
  onDismiss: (id: string) => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ notification, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(notification.id);
    }, 5000); // Auto-dismiss after 5 seconds

    return () => clearTimeout(timer);
  }, [notification.id, onDismiss]);

  const iconMap = {
    success: ICONS.success,
    warning: ICONS.warning,
    error: ICONS.error,
    info: ICONS.info,
  };

  const colorClasses = {
    success: 'bg-green-500 border-green-600',
    warning: 'bg-yellow-500 border-yellow-600',
    error: 'bg-red-500 border-red-600',
    info: 'bg-sky-500 border-sky-600',
  };

  return (
    <div
      className={`max-w-sm w-full ${colorClasses[notification.type]} text-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 p-4 my-2 transition-all duration-300 ease-in-out transform animate-toast-in`}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0 pt-0.5">
          {iconMap[notification.type]}
        </div>
        <div className="ml-3 flex-1">
          <p className="text-sm font-medium">{notification.message}</p>
        </div>
        <div className="ml-4 flex-shrink-0 flex">
          <button
            onClick={() => onDismiss(notification.id)}
            className="inline-flex text-white hover:text-gray-200 focus:outline-none"
          >
            <span className="sr-only">Close</span>
            {ICONS.close}
          </button>
        </div>
      </div>
    </div>
  );
};

// Add keyframes for toast animation
const style = document.createElement('style');
style.textContent = `
  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .animate-toast-in {
    animation: toast-in 0.3s ease-out forwards;
  }
`;
document.head.appendChild(style);


export default NotificationToast;
