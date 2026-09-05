import { Routes } from '@angular/router';
export const routes: Routes = [
  { path: 'home', loadComponent: () => import('./home/home.page').then(m => m.HomePage) },
  { path: 'content/:id', loadComponent: () => import('./learning/content.page').then(m => m.ContentPage) },
  { path: 'progress', loadComponent: () => import('./learning/progress.page').then(m => m.ProgressPage) },
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: '**', redirectTo: 'home' },
];
