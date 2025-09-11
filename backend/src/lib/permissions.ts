/**
 * Backend Role-based Access Control (RBAC) System
 * 
 * This module provides middleware and utilities for role-based permissions
 * in the backend API routes.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { prisma } from './prisma';

// Define all available roles
export const ROLES = {
  ADMIN: 'ADMIN',
  ATTESTOR: 'ATTESTOR',
  USER: 'USER',
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];

// Define all available permissions/actions
export const PERMISSIONS = {
  // Dashboard permissions
  VIEW_DASHBOARD: 'view_dashboard',
  VIEW_ANALYTICS: 'view_analytics',
  
  // User management
  VIEW_USERS: 'view_users',
  MANAGE_USERS: 'manage_users',
  
  // Application management
  VIEW_APPLICATIONS: 'view_applications',
  MANAGE_APPLICATIONS: 'manage_applications',
  APPROVE_APPLICATIONS: 'approve_applications',
  
  // Loan management
  VIEW_LOANS: 'view_loans',
  MANAGE_LOANS: 'manage_loans',
  DISBURSE_LOANS: 'disburse_loans',
  
  // Payment management
  VIEW_PAYMENTS: 'view_payments',
  MANAGE_PAYMENTS: 'manage_payments',
  APPROVE_PAYMENTS: 'approve_payments',
  
  // Attestation and signing
  VIEW_ATTESTATIONS: 'view_attestations',
  MANAGE_ATTESTATIONS: 'manage_attestations',
  VIEW_DIGITAL_SIGNING: 'view_digital_signing',
  MANAGE_DIGITAL_SIGNING: 'manage_digital_signing',
  
  // Reports and analytics
  VIEW_REPORTS: 'view_reports',
  EXPORT_REPORTS: 'export_reports',
  
  // System settings
  VIEW_SETTINGS: 'view_settings',
  MANAGE_SETTINGS: 'manage_settings',
  MANAGE_PRODUCTS: 'manage_products',
  
  // Notifications
  VIEW_NOTIFICATIONS: 'view_notifications',
  MANAGE_NOTIFICATIONS: 'manage_notifications',
  
  // Late fees
  VIEW_LATE_FEES: 'view_late_fees',
  MANAGE_LATE_FEES: 'manage_late_fees',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Role-based permissions mapping
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [ROLES.ADMIN]: [
    // Admin has access to everything
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.VIEW_APPLICATIONS,
    PERMISSIONS.MANAGE_APPLICATIONS,
    PERMISSIONS.APPROVE_APPLICATIONS,
    PERMISSIONS.VIEW_LOANS,
    PERMISSIONS.MANAGE_LOANS,
    PERMISSIONS.DISBURSE_LOANS,
    PERMISSIONS.VIEW_PAYMENTS,
    PERMISSIONS.MANAGE_PAYMENTS,
    PERMISSIONS.APPROVE_PAYMENTS,
    PERMISSIONS.VIEW_ATTESTATIONS,
    PERMISSIONS.MANAGE_ATTESTATIONS,
    PERMISSIONS.VIEW_DIGITAL_SIGNING,
    PERMISSIONS.MANAGE_DIGITAL_SIGNING,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.VIEW_SETTINGS,
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.MANAGE_PRODUCTS,
    PERMISSIONS.VIEW_NOTIFICATIONS,
    PERMISSIONS.MANAGE_NOTIFICATIONS,
    PERMISSIONS.VIEW_LATE_FEES,
    PERMISSIONS.MANAGE_LATE_FEES,
  ],
  
  [ROLES.ATTESTOR]: [
    // Attestor has limited access - only digital signing and related functions
    PERMISSIONS.VIEW_ATTESTATIONS,
    PERMISSIONS.MANAGE_ATTESTATIONS,
    PERMISSIONS.VIEW_DIGITAL_SIGNING,
    PERMISSIONS.MANAGE_DIGITAL_SIGNING,
    // Basic view permissions for context
    PERMISSIONS.VIEW_APPLICATIONS, // To see applications that need attestation
    PERMISSIONS.VIEW_LOANS, // To see loans that need signing
  ],
  
  [ROLES.USER]: [
    // Regular users have no admin permissions
  ],
};

/**
 * Check if a user role has a specific permission
 */
export function hasPermission(userRole: string, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[userRole as UserRole];
  return permissions ? permissions.includes(permission) : false;
}

/**
 * Check if a user role has any of the specified permissions
 */
export function hasAnyPermission(userRole: string, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(userRole, permission));
}

/**
 * Check if a user role has all of the specified permissions
 */
export function hasAllPermissions(userRole: string, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(userRole, permission));
}

/**
 * Check if a role can access the admin panel
 */
export function canAccessAdminPanel(userRole: string): boolean {
  return userRole === ROLES.ADMIN || userRole === ROLES.ATTESTOR;
}

/**
 * Middleware factory for role-based access control
 */
export function requireRole(...allowedRoles: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized"
        });
      }

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { role: true, fullName: true }
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found"
        });
      }

      // Check if user has required role
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
        });
      }

      // Add user role to request for use in route handlers
      req.user.role = user.role;
      req.user.fullName = user.fullName || undefined;

      return next();
    } catch (error) {
      console.error("Role check error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error"
      });
    }
  };
}

/**
 * Middleware factory for permission-based access control
 */
export function requirePermission(...requiredPermissions: Permission[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized"
        });
      }

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { role: true, fullName: true }
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found"
        });
      }

      // Check if user has required permissions
      if (!hasAnyPermission(user.role, requiredPermissions)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required permission: ${requiredPermissions.join(' or ')}`
        });
      }

      // Add user role to request for use in route handlers
      req.user.role = user.role;
      req.user.fullName = user.fullName || undefined;

      return next();
    } catch (error) {
      console.error("Permission check error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error"
      });
    }
  };
}

/**
 * Convenience middleware for admin-only routes
 */
export const requireAdmin = requireRole(ROLES.ADMIN);

/**
 * Convenience middleware for admin or attestor routes
 */
export const requireAdminOrAttestor = requireRole(ROLES.ADMIN, ROLES.ATTESTOR);

/**
 * Convenience middleware for attestor-only routes
 */
export const requireAttestor = requireRole(ROLES.ATTESTOR);

/**
 * Legacy compatibility middleware (replaces the old adminOnlyMiddleware)
 * @deprecated Use requireAdmin instead
 */
export const adminOnlyMiddleware = requireAdmin;

/**
 * Utility function to check user permissions in route handlers
 */
export async function checkUserPermissions(
  userId: string, 
  requiredPermissions: Permission[]
): Promise<{ hasAccess: boolean; userRole?: string; message?: string }> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user) {
      return { hasAccess: false, message: "User not found" };
    }

    const hasAccess = hasAnyPermission(user.role, requiredPermissions);
    
    return { 
      hasAccess, 
      userRole: user.role,
      message: hasAccess ? undefined : "Insufficient permissions"
    };
  } catch (error) {
    console.error("Permission check error:", error);
    return { hasAccess: false, message: "Internal server error" };
  }
}
