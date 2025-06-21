
import { NotificationSettings } from '../types';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../constants';

const SETTINGS_KEY = 'certificateManagerNotificationSettings';

export const loadNotificationSettings = (): NotificationSettings => {
  try {
    const storedSettings = localStorage.getItem(SETTINGS_KEY);
    if (storedSettings) {
      const parsed = JSON.parse(storedSettings);
      // Ensure all keys are present, merge with defaults if adding new settings later
      return { ...DEFAULT_NOTIFICATION_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.error("Failed to load notification settings from localStorage:", error);
  }
  return DEFAULT_NOTIFICATION_SETTINGS;
};

export const saveNotificationSettings = (settings: NotificationSettings): void => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("Failed to save notification settings to localStorage:", error);
  }
};
