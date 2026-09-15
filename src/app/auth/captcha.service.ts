import { Service } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../environments/environment';
import {
  hostedChallengeUrl,
  isOfficialHostedLocation,
  officialAppOrigin,
  validateTurnstileConfiguration,
} from './hosted-auth.util';

@Service()
export class CaptchaService {
  readonly enabled = environment.turnstile.enabled;
  readonly siteKey = environment.turnstile.siteKey;
  readonly native = Capacitor.isNativePlatform();
  readonly challengeUrl = hostedChallengeUrl();
  readonly officialOrigin = officialAppOrigin();
  readonly officialAppUrl = environment.appUrl;
  readonly nativeWebViewOrigin = environment.androidApp.webViewOrigin;

  constructor() {
    validateTurnstileConfiguration(environment);
  }

  authAllowed(location: Location = window.location): boolean {
    return !environment.production || this.native || isOfficialHostedLocation(location);
  }

  canSubmit(token: string): boolean {
    return this.enabled && token.trim().length > 0;
  }
}
