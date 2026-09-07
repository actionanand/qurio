import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

async function liveProfile() {
  const auth = inject(AuthService);
  await auth.waitUntilInitialized();
  return { auth, profile: auth.authenticated() ? await auth.refreshProfile() : null };
}

export const approvedUserGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const { auth, profile } = await liveProfile();
  return profile?.status === 'approved' ? true : router.createUrlTree([auth.routeForProfile(profile)]);
};

export const staffGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const { auth, profile } = await liveProfile();
  if (profile?.status !== 'approved') return router.createUrlTree([auth.routeForProfile(profile)]);
  return profile.role === 'owner' || profile.role === 'admin' ? true : router.createUrlTree(['/home']);
};

export const ownerGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const { auth, profile } = await liveProfile();
  if (profile?.status !== 'approved') return router.createUrlTree([auth.routeForProfile(profile)]);
  return profile.role === 'owner' ? true : router.createUrlTree(['/admin/users']);
};

export const authPageGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const { auth, profile } = await liveProfile();
  return auth.authenticated() ? router.createUrlTree([auth.routeForProfile(profile)]) : true;
};

export const accountStatusGuard: CanActivateFn = async route => {
  const router = inject(Router);
  const { auth, profile } = await liveProfile();
  if (!auth.authenticated()) return router.createUrlTree(['/auth/login']);
  const expected = route.data['status'];
  return (!profile && expected === 'pending') || profile?.status === expected
    ? true
    : router.createUrlTree([auth.routeForProfile(profile)]);
};
