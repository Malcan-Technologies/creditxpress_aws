# CreditXpress Documentation

This folder contains all documentation for the CreditXpress platform.

## 📁 Documentation Structure

```
docs/
├── getting-started/          # Onboarding & setup guides
├── api/                      # API documentation & authentication
├── features/                 # Feature-specific documentation
│   ├── kyc/                  # KYC & CTOS integration
│   ├── notifications/        # WhatsApp & email notifications
│   └── signing/              # DocuSeal, PKI, MTSA integration
├── infrastructure/           # Server & cloud infrastructure
│   ├── security/             # SSL certificates
│   └── ssh/                  # SSH access management
└── security/                 # Security assessments & compliance
```

---

## 🚀 Getting Started

| Document | Description |
|----------|-------------|
| [QUICKSTART_DEV.md](getting-started/QUICKSTART_DEV.md) | Developer setup guide - get running locally |
| [NEW_CLIENT_GUIDE.md](getting-started/NEW_CLIENT_GUIDE.md) | Full client onboarding checklist |
| [THIRD_PARTY_INTEGRATIONS.md](getting-started/THIRD_PARTY_INTEGRATIONS.md) | External service setup (Resend, WhatsApp, CTOS) |

---

## 📡 API Documentation

| Document | Description |
|----------|-------------|
| [API_ENDPOINTS_PENTEST.md](api/API_ENDPOINTS_PENTEST.md) | Complete API endpoint reference |
| [API_ENDPOINTS_SPREADSHEET.md](api/API_ENDPOINTS_SPREADSHEET.md) | API endpoints in spreadsheet format |
| [AUTHENTICATION_DOCUMENTATION.md](api/AUTHENTICATION_DOCUMENTATION.md) | Authentication & token handling |
| [MOBILE_APP_AUTH_API_DOCUMENTATION.md](api/MOBILE_APP_AUTH_API_DOCUMENTATION.md) | Mobile app authentication API |
| [MOBILE_LOGIN_SECURITY_INTEGRATION.md](api/MOBILE_LOGIN_SECURITY_INTEGRATION.md) | Mobile login security implementation |
| [LOGIN_SECURITY_IMPLEMENTATION_SUMMARY.md](api/LOGIN_SECURITY_IMPLEMENTATION_SUMMARY.md) | Login security features summary |
| [API_UPDATES_MOBILE_APP.md](api/API_UPDATES_MOBILE_APP.md) | Mobile app API updates |

---

## ✨ Features

### KYC & Identity Verification

| Document | Description |
|----------|-------------|
| [CTOS_EKYC_DOCUMENTATION.md](features/kyc/CTOS_EKYC_DOCUMENTATION.md) | CTOS eKYC integration guide |
| [CTOS_B2B_DOCUMENTATION.md](features/kyc/CTOS_B2B_DOCUMENTATION.md) | CTOS B2B API documentation |

### Notifications

| Document | Description |
|----------|-------------|
| [WHATSAPP_NOTIFICATIONS_SUMMARY.md](features/notifications/WHATSAPP_NOTIFICATIONS_SUMMARY.md) | WhatsApp notification implementation |

### Document Signing & PKI

| Document | Description |
|----------|-------------|
| [DOCUSEAL_MTSA_PKI_INTEGRATION_PLAN.md](features/signing/DOCUSEAL_MTSA_PKI_INTEGRATION_PLAN.md) | DocuSeal + MTSA PKI integration plan |
| [STAMPING_FLOW_COMPLETE.md](features/signing/STAMPING_FLOW_COMPLETE.md) | Stamp certificate workflow implementation |
| [PKI_EMAIL_IMPLEMENTATION_SUMMARY.md](features/signing/PKI_EMAIL_IMPLEMENTATION_SUMMARY.md) | PKI signing email notifications |
| [DOCUSEAL_URL_CONFIGURATION_FIX.md](features/signing/DOCUSEAL_URL_CONFIGURATION_FIX.md) | DocuSeal URL configuration |

---

## 🏗️ Infrastructure

| Document | Description |
|----------|-------------|
| [AWS_SETUP_GUIDE.md](infrastructure/AWS_SETUP_GUIDE.md) | AWS infrastructure setup |

### SSH Access Management

| Document | Description |
|----------|-------------|
| [SSH_ACCESS_SETUP_GUIDE.md](infrastructure/ssh/SSH_ACCESS_SETUP_GUIDE.md) | Complete SSH access guide |
| [SSH_QUICK_REFERENCE.md](infrastructure/ssh/SSH_QUICK_REFERENCE.md) | SSH quick reference card |

### Security & SSL

| Document | Description |
|----------|-------------|
| [SSL_CERT_AUDIT_GUIDE.md](infrastructure/security/SSL_CERT_AUDIT_GUIDE.md) | SSL certificate management |

---

## 🔐 Security & Compliance

| Document | Description |
|----------|-------------|
| [Pentest_Remediation_Report.md](security/Pentest_Remediation_Report.md) | Security assessment remediation |
| [OPG_2025_Pentest_Findings_Summary.md](security/OPG_2025_Pentest_Findings_Summary.md) | Penetration test findings |
| [AUDIT_SHARING_GUIDELINES.md](security/AUDIT_SHARING_GUIDELINES.md) | Audit report sharing guidelines |

---

## 📚 Other Documentation

Additional documentation exists in component-specific locations:

| Location | Description |
|----------|-------------|
| `backend/docs/` | Backend-specific documentation |
| `frontend/docs/` | Frontend documentation (brand guide) |
| `on-prem/` | On-premises deployment guides |
| `scripts/` | Script documentation |

---

## Quick Links

- **Project Overview**: See [`AGENTS.md`](../AGENTS.md) in root
- **Backend API**: See `backend/docs/API_DOCUMENTATION.md`
- **SSH Scripts**: See `scripts/README_SSH_TOOLS.md`
