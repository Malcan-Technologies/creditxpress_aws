-- PDF Letters System Setup Script
-- Run this after deployment to ensure all required settings exist

-- 1. Ensure DEFAULT_REMEDY_DAYS setting exists
INSERT INTO "SystemSettings" (key, value, description, "createdAt", "updatedAt") 
VALUES (
    'DEFAULT_REMEDY_DAYS', 
    '16', 
    'Number of days borrowers have to remedy default situation',
    NOW(), 
    NOW()
) ON CONFLICT (key) DO UPDATE SET 
    value = '16', 
    description = 'Number of days borrowers have to remedy default situation',
    "updatedAt" = NOW();

-- 2. Verify company settings exist (insert default if missing)
INSERT INTO "CompanySettings" (
    "companyName", 
    "companyAddress", 
    "companyRegNo", 
    "licenseNo", 
    "contactPhone", 
    "contactEmail",
    "createdAt", 
    "updatedAt"
) 
SELECT 
    'OPG Capital Holdings Sdn Bhd',
    'Please update company address in admin settings',
    '1330677-D (201901021348)',
    '201901021348',
    'Please update phone in admin settings',
    'Please update email in admin settings',
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM "CompanySettings");

-- 3. Display current settings for verification
SELECT 'System Settings:' as info;
SELECT key, value, description FROM "SystemSettings" WHERE key = 'DEFAULT_REMEDY_DAYS';

SELECT 'Company Settings:' as info;
SELECT "companyName", "companyAddress", "contactPhone", "contactEmail" FROM "CompanySettings" LIMIT 1;

-- 4. Show PDF letters directory status (informational)
SELECT 'PDF Letters will be stored in: uploads/default-letters/' as storage_info;
