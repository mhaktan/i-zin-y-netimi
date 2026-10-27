import React from 'react';
import { Navigate } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Claim-based RBAC — keys populated by dataProvider.setAuthToken on login
// ---------------------------------------------------------------------------

const ROLES_KEY = '_roles';
const PERMISSIONS_KEY = '_permissions';

const readArray = (key: string): string[] => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
};

export const getUserRoles = (): string[] => readArray(ROLES_KEY);
export const getUserPermissions = (): string[] => readArray(PERMISSIONS_KEY);

/** Check if user has at least one of the required roles. Empty list = always allowed. */
export const hasRole = (requiredRoles: string[]): boolean => {
  if (!requiredRoles || requiredRoles.length === 0) return true;
  const userRoles = getUserRoles();
  // Admin always wins — protects ops from a misconfigured Admin role missing perms
  if (userRoles.includes('Admin')) return true;
  return requiredRoles.some(r => userRoles.includes(r));
};

/** Check if user has the named permission (e.g. "MaintenanceSchedule.Create"). */
export const hasPermission = (permissionName: string): boolean => {
  if (!permissionName) return true;
  if (getUserRoles().includes('Admin')) return true;
  return getUserPermissions().includes(permissionName);
};

/** Route guard — redirects to home if user lacks required roles */
export const RoleGuard: React.FC<{ roles: string[]; children: React.ReactNode }> = ({ roles, children }) => {
  if (!hasRole(roles)) return <Navigate to="/" replace />;
  return <>{children}</>;
};

/** Conditional render — hides children if user lacks required roles */
export const RoleVisible: React.FC<{ roles: string[]; children: React.ReactNode }> = ({ roles, children }) => {
  if (!hasRole(roles)) return null;
  return <>{children}</>;
};

/** Conditional render — hides children if user lacks the named permission */
export const PermissionVisible: React.FC<{ permission: string; children: React.ReactNode }> = ({ permission, children }) => {
  if (!hasPermission(permission)) return null;
  return <>{children}</>;
};
