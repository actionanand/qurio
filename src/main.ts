import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { provideHttpClient } from '@angular/common/http';
import { provideMarkdown } from 'ngx-markdown';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(),
    provideMarkdown(),
    provideIonicAngular(),
    provideRouter(routes, withComponentInputBinding()),
  ],
});
