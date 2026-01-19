# DocuSeal Templates

This directory contains the base templates for the loan agreement signing workflow.

## Files

| File | Description |
|------|-------------|
| `Jadual-J-KPKT.pdf` | Source PDF document (Jadual J Official - Malaysian loan agreement form) |
| `jadual-j-template.json` | Exported DocuSeal template configuration with field positions |

## Template Details

**Name:** Jadual J (Official)  
**Template ID:** 2 (creditxpress production)  
**Exported:** January 2026  

### Submitter Roles

| Role | Description |
|------|-------------|
| Company | Lender company representative - signs first |
| Borrower | Loan applicant - signs second |
| Witness | Legal representative/witness - signs last |

### Fields

The template contains the following pre-configured fields:

**Company (pre-filled by system):**
- `payment_day` - Day of month for payments
- `first_payment_date` - Date of first payment
- `loan_term` - Loan duration in months
- `company_name` - Lender company name
- `company_registration` - Company registration number
- `company_details` - Full company address and details
- `agreement_date` - Date of agreement
- `borrower_details` - Borrower name, IC, and address
- `principal_text` - Principal amount in words (Malay)
- `principal_number` - Principal amount in figures
- `interest_text` - Interest rate in words
- `interest_number` - Interest rate in figures
- `total_loan` - Total loan amount in words and figures
- `monthly_installment` - Monthly payment in words and figures
- `ip_address` - Digital signature metadata (appears on all pages)
- `company_signature` - Company signature field

**Borrower:**
- `borrower_name` - Borrower's full name
- `borrower_ic` - Borrower's IC number
- Signature field (unnamed)

**Witness:**
- Signature field (unnamed)

## Usage for New Clients

### Option 1: Clone Template via API

Use the `setup-docuseal-template.sh` script to upload and configure the template:

```bash
cd on-prem/scripts
./setup-docuseal-template.sh
```

### Option 2: Manual Upload

1. Log into DocuSeal admin (`https://sign.newclient.com`)
2. Go to Templates → New Template
3. Upload `Jadual-J-KPKT.pdf`
4. Configure fields manually or import from JSON
5. Note the template ID and update `client.json`

## Field Coordinates

The `jadual-j-template.json` contains exact pixel coordinates for all fields. These are relative values (0-1 range) representing:
- `x` - Horizontal position from left edge
- `y` - Vertical position from top edge
- `w` - Width of field
- `h` - Height of field
- `page` - Page number (0-indexed)

These coordinates ensure consistent field placement across deployments.
