import { Routes } from '@angular/router';
export const routes: Routes = [
  { path: 'home', loadComponent: () => import('./home/home.page').then(m => m.HomePage) },
  { path: 'content/:id', loadComponent: () => import('./learning/content.page').then(m => m.ContentPage) },
  { path: 'exam-prep', loadComponent: () => import('./exam-prep/exam-prep.page').then(m => m.ExamPrepPage) },
  { path: 'exam-prep/:planId', redirectTo: 'exam-prep/:planId/today', pathMatch: 'full' },
  {
    path: 'exam-prep/:planId/:view',
    loadComponent: () => import('./exam-prep/exam-plan.page').then(m => m.ExamPlanPage),
  },
  { path: 'progress', loadComponent: () => import('./learning/progress.page').then(m => m.ProgressPage) },
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: '**', redirectTo: 'home' },
];
