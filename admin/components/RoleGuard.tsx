'use client';

import { ReactNode } from 'react';
import { 
  hasPermission, 
  hasAnyPermission, 
  hasAllPermissions, 
  canAccessRoute,
  Permission,
  UserRole 
} from '../lib/permissions';

interface RoleGuardProps {
  children: ReactNode;
  userRole: string;
  fallback?: ReactNode;
}

interface PermissionGuardProps extends RoleGuardProps {
  permission: Permission;
}

interface MultiPermissionGuardProps extends RoleGuardProps {
  permissions: Permission[];
  requireAll?: boolean; // If true, user must have ALL permissions. If false (default), user needs ANY permission
}

interface RouteGuardProps extends RoleGuardProps {
  route: string;
}

/**
 * Component that conditionally renders children based on user permissions
 */
export function PermissionGuard({ 
  children, 
  userRole, 
  permission, 
  fallback = null 
}: PermissionGuardProps) {
  if (!hasPermission(userRole, permission)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

/**
 * Component that conditionally renders children based on multiple permissions
 */
export function MultiPermissionGuard({ 
  children, 
  userRole, 
  permissions, 
  requireAll = false,
  fallback = null 
}: MultiPermissionGuardProps) {
  const hasAccess = requireAll 
    ? hasAllPermissions(userRole, permissions)
    : hasAnyPermission(userRole, permissions);
    
  if (!hasAccess) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

/**
 * Component that conditionally renders children based on route access
 */
export function RouteGuard({ 
  children, 
  userRole, 
  route, 
  fallback = null 
}: RouteGuardProps) {
  if (!canAccessRoute(userRole, route)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

/**
 * Higher-order component for role-based access control
 */
export function withRoleGuard<P extends object>(
  Component: React.ComponentType<P>,
  permission: Permission,
  fallback?: ReactNode
) {
  return function GuardedComponent(props: P & { userRole: string }) {
    const { userRole, ...componentProps } = props;
    
    return (
      <PermissionGuard 
        userRole={userRole} 
        permission={permission} 
        fallback={fallback}
      >
        <Component {...(componentProps as P)} />
      </PermissionGuard>
    );
  };
}

/**
 * Hook for checking permissions in components
 */
export function usePermissions(userRole: string) {
  return {
    hasPermission: (permission: Permission) => hasPermission(userRole, permission),
    hasAnyPermission: (permissions: Permission[]) => hasAnyPermission(userRole, permissions),
    hasAllPermissions: (permissions: Permission[]) => hasAllPermissions(userRole, permissions),
    canAccessRoute: (route: string) => canAccessRoute(userRole, route),
  };
}

/**
 * Component for displaying role-based content with different variants
 */
interface RoleBasedContentProps {
  userRole: string;
  children: ReactNode;
  adminContent?: ReactNode;
  attestorContent?: ReactNode;
  fallback?: ReactNode;
}

export function RoleBasedContent({ 
  userRole, 
  children, 
  adminContent, 
  attestorContent, 
  fallback = null 
}: RoleBasedContentProps) {
  switch (userRole) {
    case 'ADMIN':
      return <>{adminContent || children}</>;
    case 'ATTESTOR':
      return <>{attestorContent || children}</>;
    default:
      return <>{fallback}</>;
  }
}

/**
 * Simple role check component
 */
interface RoleCheckProps extends RoleGuardProps {
  allowedRoles: string[];
}

export function RoleCheck({ 
  children, 
  userRole, 
  allowedRoles, 
  fallback = null 
}: RoleCheckProps) {
  if (!allowedRoles.includes(userRole)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

/**
 * Admin-only guard component
 */
export function AdminOnly({ children, userRole, fallback = null }: RoleGuardProps) {
  return (
    <RoleCheck 
      userRole={userRole} 
      allowedRoles={['ADMIN']} 
      fallback={fallback}
    >
      {children}
    </RoleCheck>
  );
}

/**
 * Attestor or Admin guard component
 */
export function AttestorOrAdmin({ children, userRole, fallback = null }: RoleGuardProps) {
  return (
    <RoleCheck 
      userRole={userRole} 
      allowedRoles={['ADMIN', 'ATTESTOR']} 
      fallback={fallback}
    >
      {children}
    </RoleCheck>
  );
}
