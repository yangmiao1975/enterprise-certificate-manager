/// <reference types="vite/client" />
import { NotificationSettings } from '../types';

// ... existing code ... 

const NOTIFICATION_SETTINGS_KEY = 'notificationSettings';

export function loadNotificationSettings(): NotificationSettings {
  const stored = localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as NotificationSettings;
    } catch (e) {
      // Fallback to default if parsing fails
    }
  }
  // Default settings (should match DEFAULT_NOTIFICATION_SETTINGS)
  return {
    recipientEmail: '',
    thresholds: [5, 10, 30],
    notificationsEnabled: true,
  };
}

export function saveNotificationSettings(settings: NotificationSettings): void {
  localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
} 