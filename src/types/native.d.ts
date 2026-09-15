interface QurioNativeBridge {
  disableBiometric?(): void;
  isBiometricAvailable?(): boolean;
  enableBiometric?(secret: string): void;
  authenticateBiometric?(): void;
  notificationPermissionGranted?(): boolean;
  requestNotificationPermission?(): void;
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
