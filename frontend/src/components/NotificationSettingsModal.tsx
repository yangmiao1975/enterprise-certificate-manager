/// <reference types="vite/client" />

import React, { useState, useEffect } from 'react';
import { NotificationSettings } from '../types';
import { AVAILABLE_NOTIFICATION_THRESHOLDS, DEFAULT_NOTIFICATION_SETTINGS } from '../constants';

interface NotificationSettingsModalProps {
  currentSettings: NotificationSettings;
  onSave: (settings: NotificationSettings) => void;
  onClose: () => void;
}

const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({ currentSettings, onSave, onClose }) => {
  const [recipientEmail, setRecipientEmail] = useState(currentSettings.recipientEmail);
  const [selectedThresholds, setSelectedThresholds] = useState<number[]>(currentSettings.thresholds);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(currentSettings.notificationsEnabled);

  useEffect(() => {
    setRecipientEmail(currentSettings.recipientEmail);
    setSelectedThresholds(currentSettings.thresholds);
    setNotificationsEnabled(currentSettings.notificationsEnabled);
  }, [currentSettings]);

  const handleThresholdChange = (threshold: number) => {
    setSelectedThresholds(prev =>
      prev.includes(threshold) ? prev.filter(t => t !== threshold) : [...prev, threshold].sort((a,b) => a-b)
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      recipientEmail,
      thresholds: selectedThresholds,
      notificationsEnabled,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="notificationsEnabled" className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            id="notificationsEnabled"
            checked={notificationsEnabled}
            onChange={(e) => setNotificationsEnabled(e.target.checked)}
            className="h-4 w-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500"
          />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Enable Email Notifications (Simulated)</span>
        </label>
         <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            If enabled, the application will simulate sending emails by logging to the console and showing an in-app toast.
          </p>
      </div>

      <div className={!notificationsEnabled ? 'opacity-50' : ''}>
        <div>
          <label htmlFor="recipientEmail" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Recipient Email Address (for simulation)
          </label>
          <input
            type="email"
            id="recipientEmail"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm dark:bg-slate-700 dark:text-slate-100 disabled:opacity-70"
            placeholder="e.g., admin@example.com"
            disabled={!notificationsEnabled}
            required={notificationsEnabled}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Notify Days Before Expiry (select multiple)
          </label>
          <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2">
            {AVAILABLE_NOTIFICATION_THRESHOLDS.map(threshold => (
              <label
                key={threshold}
                className={`flex items-center space-x-2 p-2 border rounded-md cursor-pointer transition-colors
                  ${selectedThresholds.includes(threshold) ? 'bg-sky-100 dark:bg-sky-700 border-sky-500 dark:border-sky-400' : 'border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}
                  ${!notificationsEnabled ? 'opacity-70 cursor-not-allowed' : ''}
                `}
              >
                <input
                  type="checkbox"
                  checked={selectedThresholds.includes(threshold)}
                  onChange={() => handleThresholdChange(threshold)}
                  disabled={!notificationsEnabled}
                  className="h-4 w-4 text-sky-600 border-slate-300 rounded focus:ring-sky-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">{threshold} days</span>
              </label>
            ))}
          </div>
           <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            A simulated email will be triggered when a certificate is within these many days of expiring.
          </p>
        </div>
      </div>
      
      <div className="border-t dark:border-slate-700 pt-4 text-xs text-slate-500 dark:text-slate-400">
        <strong>Note:</strong> Email sending is simulated. Actual emails are not sent from this frontend application. Notifications will appear as console logs and in-app messages.
      </div>

      <div className="flex justify-end space-x-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-600 hover:bg-slate-200 dark:hover:bg-slate-500 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition"
        >
          Save Settings
        </button>
      </div>
    </form>
  );
};

export default NotificationSettingsModal; 