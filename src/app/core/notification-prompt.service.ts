import { Service, inject } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { I18nService } from './i18n.service';
import { ReminderService } from './reminder.service';
import { SnackbarService } from './snackbar.service';

const promptKey = 'qurio.notificationPromptSeen.v2';

export function shouldPromptForNotifications(nativeAndroid: boolean, prompted: boolean, granted: boolean): boolean {
  return nativeAndroid && !prompted && !granted;
}

@Service()
export class NotificationPromptService {
  private readonly alerts = inject(AlertController);
  private readonly i = inject(I18nService);
  private readonly reminders = inject(ReminderService);
  private readonly snackbar = inject(SnackbarService);
  private prompting = false;

  async promptOnce(): Promise<void> {
    if (!shouldPromptForNotifications(this.reminders.native, this.wasPrompted(), this.reminders.permissionGranted()))
      return;
    if (this.prompting) return;
    this.prompting = true;
    try {
      await this.requestWithExplanation();
      this.markPrompted();
    } finally {
      this.prompting = false;
    }
  }

  async requestWithExplanation(): Promise<boolean> {
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
    if (result.role !== 'confirm') return false;
    const granted = await this.reminders.requestPermission();
    this.snackbar.show(
      this.i.t(granted ? 'notificationsAllowed' : 'notificationsNotAllowed'),
      granted ? 'success' : 'error',
    );
    return granted;
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
