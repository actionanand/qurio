interface QurioNativeBridge {
  setDarkMode?(enabled: boolean): void;
  disableBiometric?(): void;
  isBiometricAvailable?(): boolean;
  enableBiometric?(secret: string): void;
  authenticateBiometric?(): void;
  notificationPermissionGranted?(): boolean;
  requestNotificationPermission?(): void;
  scheduleReminder?(hour: number, minute: number, calendarDays: string): void;
  cancelReminder?(): void;
}

interface QurioNativeResult {
  action: string;
  success: boolean;
  data: string;
  message: string;
}

interface Window {
  QurioNative?: QurioNativeBridge;
}
