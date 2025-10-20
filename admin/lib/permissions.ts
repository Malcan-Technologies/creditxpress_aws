/**
 * Role-based Access Control (RBAC) System
 * 
 * This module provides a modular, scalable permissions system for the admin panel.
 * It supports multiple roles and can be easily extended with new roles and permissions.
 */

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
  
  // Audit logs
  VIEW_AUDIT_LOGS: 'view_audit_logs',
  EXPORT_AUDIT_LOGS: 'export_audit_logs',
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
    PERMISSIONS.VIEW_AUDIT_LOGS,
    PERMISSIONS.EXPORT_AUDIT_LOGS,
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

// Navigation route permissions mapping
export const ROUTE_PERMISSIONS: Record<string, Permission[]> = {
  // Dashboard routes
  '/dashboard': [PERMISSIONS.VIEW_DASHBOARD],
  '/dashboard/analytics': [PERMISSIONS.VIEW_ANALYTICS],
  
  // User management
  '/dashboard/users': [PERMISSIONS.VIEW_USERS],
  
  // Application management
  '/dashboard/applications': [PERMISSIONS.VIEW_APPLICATIONS],
  '/dashboard/applications/workflow': [PERMISSIONS.VIEW_APPLICATIONS],
  
  // Loan management
  '/dashboard/loans': [PERMISSIONS.VIEW_LOANS],
  
  // Payment management
  '/dashboard/payments': [PERMISSIONS.VIEW_PAYMENTS],
  
  // Attestation and signing
  '/dashboard/live-attestations': [PERMISSIONS.VIEW_ATTESTATIONS],
  '/dashboard/settings/signing': [PERMISSIONS.VIEW_DIGITAL_SIGNING],
  
  // Reports
  '/dashboard/reports': [PERMISSIONS.VIEW_REPORTS],
  
  // Settings
  '/dashboard/settings': [PERMISSIONS.VIEW_SETTINGS],
  '/dashboard/products': [PERMISSIONS.MANAGE_PRODUCTS],
  '/dashboard/notifications': [PERMISSIONS.VIEW_NOTIFICATIONS],
  
  // Late fees
  '/dashboard/late-fees': [PERMISSIONS.VIEW_LATE_FEES],
  
  // Audit logs
  '/dashboard/audit-logs/access': [PERMISSIONS.VIEW_AUDIT_LOGS],
  '/dashboard/audit-logs/documents': [PERMISSIONS.VIEW_AUDIT_LOGS],
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
 * Check if a user role can access a specific route
 */
export function canAccessRoute(userRole: string, route: string): boolean {
  const requiredPermissions = ROUTE_PERMISSIONS[route];
  if (!requiredPermissions || requiredPermissions.length === 0) {
    return true; // No specific permissions required
  }
  return hasAnyPermission(userRole, requiredPermissions);
}

/**
 * Get all permissions for a specific role
 */
export function getRolePermissions(userRole: string): Permission[] {
  return ROLE_PERMISSIONS[userRole as UserRole] || [];
}

/**
 * Get all accessible routes for a specific role
 */
export function getAccessibleRoutes(userRole: string): string[] {
  return Object.keys(ROUTE_PERMISSIONS).filter(route => 
    canAccessRoute(userRole, route)
  );
}

/**
 * Check if a role is an admin-level role (has elevated privileges)
 */
export function isAdminRole(userRole: string): boolean {
  return userRole === ROLES.ADMIN || userRole === ROLES.ATTESTOR;
}

/**
 * Check if a role can access the admin panel
 */
export function canAccessAdminPanel(userRole: string): boolean {
  return isAdminRole(userRole);
}

/**
 * Navigation items configuration with role-based visibility
 */
export interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  requiredPermissions: Permission[];
  subItems?: NavigationItem[];
}

export const NAVIGATION_CONFIG: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: 'HomeIcon',
    requiredPermissions: [PERMISSIONS.VIEW_DASHBOARD],
  },
  {
    name: 'Loan Workflow',
    href: '#',
    icon: 'ArrowPathIcon',
    requiredPermissions: [PERMISSIONS.VIEW_APPLICATIONS, PERMISSIONS.VIEW_LOANS],
    subItems: [
      {
        name: 'All Applications',
        href: '/dashboard/applications',
        icon: 'DocumentTextIcon',
        requiredPermissions: [PERMISSIONS.VIEW_APPLICATIONS],
        subItems: [
          {
            name: 'Pending Approval',
            href: '/dashboard/applications?filter=pending-approval',
            icon: 'ClockIcon',
            requiredPermissions: [PERMISSIONS.VIEW_APPLICATIONS],
          },
          {
            name: 'Pending Disbursement',
            href: '/dashboard/applications?filter=pending-disbursement',
            icon: 'CheckCircleIcon',
            requiredPermissions: [PERMISSIONS.VIEW_APPLICATIONS],
          },
        ],
      },
      {
        name: 'All Loans',
        href: '/dashboard/loans',
        icon: 'BanknotesIcon',
        requiredPermissions: [PERMISSIONS.VIEW_LOANS],
        subItems: [
          {
            name: 'Pending Discharge',
            href: '/dashboard/loans?filter=pending_discharge',
            icon: 'ClockIcon',
            requiredPermissions: [PERMISSIONS.VIEW_LOANS],
          },
        ],
      },
      {
        name: 'Live Attestations',
        href: '/dashboard/live-attestations',
        icon: 'VideoCameraIcon',
        requiredPermissions: [PERMISSIONS.VIEW_ATTESTATIONS],
      },
      {
        name: 'Workflow Overview',
        href: '/dashboard/applications/workflow',
        icon: 'ArrowPathIcon',
        requiredPermissions: [PERMISSIONS.VIEW_APPLICATIONS],
      },
    ],
  },
  {
    name: 'Payments',
    href: '#',
    icon: 'CreditCardIcon',
    requiredPermissions: [PERMISSIONS.VIEW_PAYMENTS],
    subItems: [
      {
        name: 'All Payments',
        href: '/dashboard/payments',
        icon: 'CreditCardIcon',
        requiredPermissions: [PERMISSIONS.VIEW_PAYMENTS],
      },
      {
        name: 'Pending Approval',
        href: '/dashboard/payments?filter=pending',
        icon: 'ClockIcon',
        requiredPermissions: [PERMISSIONS.VIEW_PAYMENTS],
      },
      {
        name: 'Processing',
        href: '/dashboard/payments?filter=processing',
        icon: 'ArrowPathIcon',
        requiredPermissions: [PERMISSIONS.VIEW_PAYMENTS],
      },
      {
        name: 'Receipts',
        href: '/dashboard/receipts',
        icon: 'ReceiptPercentIcon',
        requiredPermissions: [PERMISSIONS.VIEW_PAYMENTS],
      },
      {
        name: 'Late Fees',
        href: '/dashboard/late-fees',
        icon: 'ExclamationTriangleIcon',
        requiredPermissions: [PERMISSIONS.VIEW_LATE_FEES],
      },
    ],
  },
  {
    name: 'Management',
    href: '#',
    icon: 'Cog6ToothIcon',
    requiredPermissions: [
      PERMISSIONS.VIEW_USERS,
      PERMISSIONS.MANAGE_PRODUCTS,
      PERMISSIONS.VIEW_NOTIFICATIONS,
      PERMISSIONS.VIEW_REPORTS,
      PERMISSIONS.VIEW_DIGITAL_SIGNING,
      PERMISSIONS.VIEW_SETTINGS,
    ],
    subItems: [
      {
        name: 'Users',
        href: '/dashboard/users',
        icon: 'UserGroupIcon',
        requiredPermissions: [PERMISSIONS.VIEW_USERS],
      },
      {
        name: 'Products',
        href: '/dashboard/products',
        icon: 'CubeIcon',
        requiredPermissions: [PERMISSIONS.MANAGE_PRODUCTS],
      },
      {
        name: 'Notifications',
        href: '/dashboard/notifications',
        icon: 'BellIcon',
        requiredPermissions: [PERMISSIONS.VIEW_NOTIFICATIONS],
      },
      {
        name: 'Reports',
        href: '/dashboard/reports',
        icon: 'ChartBarIcon',
        requiredPermissions: [PERMISSIONS.VIEW_REPORTS],
      },
      {
        name: 'Digital Signing',
        href: '/dashboard/settings/signing',
        icon: 'ShieldCheckIcon',
        requiredPermissions: [PERMISSIONS.VIEW_DIGITAL_SIGNING],
      },
      {
        name: 'Settings',
        href: '/dashboard/settings',
        icon: 'Cog6ToothIcon',
        requiredPermissions: [PERMISSIONS.VIEW_SETTINGS],
      },
    ],
  },
];

/**
 * Filter navigation items based on user role
 */
export function getFilteredNavigation(userRole: string): NavigationItem[] {
  const filterItems = (items: NavigationItem[]): NavigationItem[] => {
    return items
      .filter(item => hasAnyPermission(userRole, item.requiredPermissions))
      .map(item => ({
        ...item,
        subItems: item.subItems ? filterItems(item.subItems) : undefined,
      }))
      .filter(item => !item.subItems || item.subItems.length > 0);
  };

  return filterItems(NAVIGATION_CONFIG);
}
