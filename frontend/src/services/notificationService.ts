import { NotificationMessage } from '../types';

type NotificationType = NotificationMessage['type'];

class NotificationService {
  private addNotificationCallback: ((message: string, type: NotificationType) => void) | null = null;

  /**
   * Set the callback function for adding notifications
   * This should be called from the main App component
   */
  setAddNotificationCallback(callback: (message: string, type: NotificationType) => void) {
    this.addNotificationCallback = callback;
  }

  /**
   * Add a notification
   */
  addNotification(message: string, type: NotificationType) {
    if (this.addNotificationCallback) {
      this.addNotificationCallback(message, type);
    } else {
      // Fallback to console if no callback is set
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Add a success notification
   */
  success(message: string) {
    this.addNotification(message, 'success');
  }

  /**
   * Add an error notification
   */
  error(message: string) {
    this.addNotification(message, 'error');
  }

  /**
   * Add a warning notification
   */
  warning(message: string) {
    this.addNotification(message, 'warning');
  }

  /**
   * Add an info notification
   */
  info(message: string) {
    this.addNotification(message, 'info');
  }
}

export const notificationService = new NotificationService();