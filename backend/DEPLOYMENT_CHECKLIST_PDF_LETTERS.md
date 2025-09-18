# PDF Letters System - Production Deployment Checklist

## ✅ **Storage Persistence Verification**

### **Current Setup (CONFIRMED ✓)**
- PDF letters are stored in `uploads/default-letters/` directory
- Production Docker Compose already mounts `/var/www/uploads:/app/uploads`
- **Result**: PDF letters will persist across Docker rebuilds

### **Directory Structure**
```
/var/www/uploads/
├── default-letters/          # PDF letters (persistent)
├── kyc/                     # KYC documents (existing)
└── [other upload files]     # Other uploads (existing)
```

## 🔧 **Required Database Configurations**

### **1. System Settings**
Ensure these settings exist in `SystemSettings` table:

```sql
-- Default remedy period (16 days)
INSERT INTO "SystemSettings" (key, value, description, "createdAt", "updatedAt") 
VALUES (
    'DEFAULT_REMEDY_DAYS', 
    '16', 
    'Number of days borrowers have to remedy default situation',
    NOW(), 
    NOW()
) ON CONFLICT (key) DO UPDATE SET value = '16', "updatedAt" = NOW();
```

### **2. Company Settings**
Ensure `CompanySettings` table has complete information:

```sql
-- Verify company settings exist
SELECT * FROM "CompanySettings" LIMIT 1;

-- If missing, insert default settings:
INSERT INTO "CompanySettings" (
    "companyName", 
    "companyAddress", 
    "companyRegNo", 
    "licenseNo", 
    "contactPhone", 
    "contactEmail",
    "createdAt", 
    "updatedAt"
) VALUES (
    'OPG Capital Holdings Sdn Bhd',
    'Your Company Address Here',
    '1330677-D (201901021348)',
    '201901021348',
    '+60-XXX-XXXXXXX',
    'info@opgcapital.com',
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;
```

## 🚀 **Deployment Steps**

### **1. Pre-Deployment**
```bash
# 1. Ensure uploads directory exists on VPS
sudo mkdir -p /var/www/uploads/default-letters
sudo chown -R 1000:1000 /var/www/uploads
sudo chmod -R 755 /var/www/uploads

# 2. Backup current database
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup_before_pdf_letters.sql
```

### **2. Deploy Updated Code**
```bash
# 1. Pull latest code
git pull origin main

# 2. Rebuild and restart backend
docker compose -f docker-compose.prod.yml down backend
docker compose -f docker-compose.prod.yml up -d --build backend

# 3. Run database migrations (if any)
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

### **3. Post-Deployment Verification**

#### **A. Directory Permissions**
```bash
# Verify directory exists and has correct permissions
ls -la /var/www/uploads/
# Should show: drwxr-xr-x ... default-letters
```

#### **B. Database Settings**
```bash
# Connect to database and verify settings
docker compose -f docker-compose.prod.yml exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB

# Run these queries:
SELECT key, value FROM "SystemSettings" WHERE key = 'DEFAULT_REMEDY_DAYS';
SELECT "companyName", "contactPhone", "contactEmail" FROM "CompanySettings" LIMIT 1;
```

#### **C. API Endpoints Test**
```bash
# Test borrower info endpoint
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     http://localhost:4001/api/admin/loans/LOAN_ID/borrower-info

# Test PDF generation endpoint
curl -X POST \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"borrowerAddress": "Test Address"}' \
     http://localhost:4001/api/admin/loans/LOAN_ID/generate-pdf-letter
```

## 🔍 **Troubleshooting**

### **Common Issues & Solutions**

#### **1. Permission Denied Errors**
```bash
# Fix directory permissions
sudo chown -R 1000:1000 /var/www/uploads
sudo chmod -R 755 /var/www/uploads
```

#### **2. Missing Company Settings**
```sql
-- Check if company settings exist
SELECT COUNT(*) FROM "CompanySettings";

-- If 0, insert default settings (see SQL above)
```

#### **3. PDF Generation Fails**
```bash
# Check backend logs
docker compose -f docker-compose.prod.yml logs backend | grep -i "pdf\|letter\|error"

# Check if directory is writable
docker compose -f docker-compose.prod.yml exec backend ls -la /app/uploads/
```

#### **4. Audit Trail Not Working**
```sql
-- Check if audit tables exist
SELECT COUNT(*) FROM "LoanDefaultLog";
SELECT COUNT(*) FROM "LoanApplicationHistory";
```

## 📋 **Verification Checklist**

After deployment, verify these items:

- [ ] `/var/www/uploads/default-letters/` directory exists with correct permissions
- [ ] `DEFAULT_REMEDY_DAYS` system setting exists (value: 16)
- [ ] `CompanySettings` table has complete company information
- [ ] PDF generation API endpoint responds successfully
- [ ] Generated PDFs are saved to persistent storage
- [ ] Audit trail entries are created in both tables
- [ ] Admin UI shows borrower information correctly
- [ ] PDF download functionality works
- [ ] Letters contain all required information (IC number, address, remedy period)

## 🔄 **Rollback Plan**

If issues occur:

```bash
# 1. Rollback to previous version
git checkout PREVIOUS_COMMIT_HASH
docker compose -f docker-compose.prod.yml down backend
docker compose -f docker-compose.prod.yml up -d --build backend

# 2. Restore database if needed
docker compose -f docker-compose.prod.yml exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB < backup_before_pdf_letters.sql
```

## 📞 **Support**

If you encounter issues:
1. Check backend logs: `docker compose -f docker-compose.prod.yml logs backend`
2. Verify database connectivity: `docker compose -f docker-compose.prod.yml exec backend npx prisma db pull`
3. Test API endpoints manually using curl or Postman
4. Check file system permissions on the VPS

---

**Last Updated**: $(date)
**Version**: 1.0
