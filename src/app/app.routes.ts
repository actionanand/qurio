import { Routes } from '@angular/router';
import { accountStatusGuard, approvedUserGuard, authPageGuard, ownerGuard, staffGuard } from './services/auth.guards';
export const routes: Routes = [
  {
    path: 'auth/login',
    canActivate: [authPageGuard],
    loadComponent: () => import('./auth/login.page').then(m => m.LoginPage),
  },
  {
    path: 'auth/register',
    canActivate: [authPageGuard],
    loadComponent: () => import('./auth/register.page').then(m => m.RegisterPage),
  },
  { path: 'auth/verify-email', loadComponent: () => import('./auth/verify-email.page').then(m => m.VerifyEmailPage) },
  { path: 'auth/callback', loadComponent: () => import('./auth/callback.page').then(m => m.AuthCallbackPage) },
  {
    path: 'auth/forgot-password',
    canActivate: [authPageGuard],
    loadComponent: () => import('./auth/forgot-password.page').then(m => m.ForgotPasswordPage),
  },
  {
    path: 'auth/update-password',
    loadComponent: () => import('./auth/update-password.page').then(m => m.UpdatePasswordPage),
  },
  {
    path: 'auth/pending',
    canActivate: [accountStatusGuard],
    data: { status: 'pending' },
    loadComponent: () => import('./auth/account-status.page').then(m => m.AccountStatusPage),
  },
  {
    path: 'auth/denied',
    canActivate: [accountStatusGuard],
    data: { status: 'denied' },
    loadComponent: () => import('./auth/account-status.page').then(m => m.AccountStatusPage),
  },
  {
    path: 'auth/suspended',
    canActivate: [accountStatusGuard],
    data: { status: 'suspended' },
    loadComponent: () => import('./auth/account-status.page').then(m => m.AccountStatusPage),
  },
  {
    path: 'home',
    canActivate: [approvedUserGuard],
    loadComponent: () => import('./home/home.page').then(m => m.HomePage),
  },
  {
    path: 'content/:id',
    canActivate: [approvedUserGuard],
    loadComponent: () => import('./learning/content.page').then(m => m.ContentPage),
  },
  {
    path: 'exam-prep',
    canActivate: [approvedUserGuard],
    loadComponent: () => import('./exam-prep/exam-prep.page').then(m => m.ExamPrepPage),
  },
  { path: 'exam-prep/:planId', redirectTo: 'exam-prep/:planId/today', pathMatch: 'full' },
  {
    path: 'exam-prep/:planId/:view',
    canActivate: [approvedUserGuard],
    loadComponent: () => import('./exam-prep/exam-plan.page').then(m => m.ExamPlanPage),
  },
  {
    path: 'progress',
    canActivate: [approvedUserGuard],
    loadComponent: () => import('./learning/progress.page').then(m => m.ProgressPage),
  },
  {
    path: 'settings',
    canActivate: [approvedUserGuard],
    loadComponent: () => import('./settings/settings.page').then(m => m.SettingsPage),
  },
  {
    path: 'admin/users',
    canActivate: [staffGuard],
    loadComponent: () => import('./admin/admin-users.page').then(m => m.AdminUsersPage),
  },
  {
    path: 'admin/audit',
    canActivate: [ownerGuard],
    loadComponent: () => import('./admin/admin-audit.page').then(m => m.AdminAuditPage),
  },
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: '**', redirectTo: 'home' },
];
