import { Service, inject } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { I18nService } from './i18n.service';
import { ReminderService } from './reminder.service';
import { SnackbarService } from './snackbar.service';

const promptKey = 'qurio.notificationPrompted.v1';

@Service()
export class NotificationPromptService {
  private readonly alerts = inject(AlertController);
  private readonly i = inject(I18nService);
  private readonly reminders = inject(ReminderService);
  private readonly snackbar = inject(SnackbarService);

  async promptOnce(): Promise<void> {
    if (!this.reminders.native || this.wasPrompted() || this.reminders.permissionGranted()) return;
    const alert = await this.alerts.create({
      header: this.i.t('allowPracticeReminders'),
      message: this.i.t('notificationPermissionIntro'),
      cssClass: 'qurio-confirmation',
      buttons: [
        { text: this.i.t('notNow'), role: 'cancel' },
        { text: this.i.t('allowNotifications'), role: 'confirm' },
      ],
    });
    await alert.present();
    const result = await alert.onDidDismiss();
    this.markPrompted();
    if (result.role !== 'confirm') return;
    const granted = await this.reminders.requestPermission();
    this.snackbar.show(
      this.i.t(granted ? 'notificationsAllowed' : 'notificationsNotAllowed'),
      granted ? 'success' : 'error',
    );
  }

  private wasPrompted(): boolean {
    try {
      return localStorage.getItem(promptKey) === '1';
    } catch {
      return false;
    }
  }

  private markPrompted(): void {
    try {
      localStorage.setItem(promptKey, '1');
    } catch {
      return;
    }
  }
}
