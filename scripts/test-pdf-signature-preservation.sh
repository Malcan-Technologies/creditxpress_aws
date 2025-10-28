#!/bin/bash

# Test if qpdf password protection preserves MTSA PKI signatures
# This script tests whether applying password encryption breaks digital signatures

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}PDF Signature Preservation Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if qpdf is installed
if ! command -v qpdf &> /dev/null; then
    echo -e "${RED}Error: qpdf is not installed${NC}"
    echo "Install with: brew install qpdf (macOS) or apt-get install qpdf (Linux)"
    exit 1
fi

# Check if pdfsig is available (from poppler-utils)
if ! command -v pdfsig &> /dev/null; then
    echo -e "${YELLOW}Warning: pdfsig not found${NC}"
    echo "Install poppler-utils for signature verification:"
    echo "  macOS: brew install poppler"
    echo "  Linux: apt-get install poppler-utils"
    echo ""
    PDFSIG_AVAILABLE=false
else
    PDFSIG_AVAILABLE=true
fi

# Test file
TEST_PDF="/tmp/test-signed.pdf"
PROTECTED_PDF="/tmp/test-signed-protected.pdf"
TEST_PASSWORD="123456789012"

if [ ! -f "$TEST_PDF" ]; then
    echo -e "${RED}Error: Test PDF not found at $TEST_PDF${NC}"
    echo "Please run: scp admin-kapital@100.76.8.62:/home/admin-kapital/kapital/agreements/signed/[filename].pdf $TEST_PDF"
    exit 1
fi

echo -e "${GREEN}✓${NC} Found test PDF: $TEST_PDF"
echo ""

# Step 1: Check original PDF signatures
echo -e "${BLUE}Step 1: Analyzing original PDF signatures${NC}"
echo "-------------------------------------------"

if [ "$PDFSIG_AVAILABLE" = true ]; then
    echo "Signatures in ORIGINAL PDF:"
    pdfsig "$TEST_PDF" || echo "(No pdfsig output or error)"
    echo ""
else
    echo "Using qpdf to check original PDF..."
    qpdf --check "$TEST_PDF" && echo -e "${GREEN}✓${NC} Original PDF is valid" || echo -e "${YELLOW}⚠${NC} Original PDF has warnings"
    echo ""
fi

# Check file size
ORIGINAL_SIZE=$(stat -f%z "$TEST_PDF" 2>/dev/null || stat -c%s "$TEST_PDF" 2>/dev/null)
echo "Original file size: $(numfmt --to=iec-i --suffix=B $ORIGINAL_SIZE 2>/dev/null || echo "$ORIGINAL_SIZE bytes")"
echo ""

# Step 2: Apply password protection
echo -e "${BLUE}Step 2: Applying password protection${NC}"
echo "-------------------------------------------"
echo "Password: $TEST_PASSWORD"
echo "Settings:"
echo "  - Print: allowed"
echo "  - Modify: not allowed"
echo "  - Extract: not allowed"
echo "  - Annotate: not allowed"
echo ""

qpdf --encrypt "$TEST_PASSWORD" "$TEST_PASSWORD" 256 \
  --print=full \
  --modify=none \
  --extract=n \
  --annotate=n \
  -- "$TEST_PDF" "$PROTECTED_PDF"

if [ -f "$PROTECTED_PDF" ]; then
    echo -e "${GREEN}✓${NC} Password-protected PDF created: $PROTECTED_PDF"
else
    echo -e "${RED}✗${NC} Failed to create protected PDF"
    exit 1
fi

PROTECTED_SIZE=$(stat -f%z "$PROTECTED_PDF" 2>/dev/null || stat -c%s "$PROTECTED_PDF" 2>/dev/null)
echo "Protected file size: $(numfmt --to=iec-i --suffix=B $PROTECTED_SIZE 2>/dev/null || echo "$PROTECTED_SIZE bytes")"
echo ""

# Step 3: Check protected PDF signatures
echo -e "${BLUE}Step 3: Analyzing protected PDF signatures${NC}"
echo "-------------------------------------------"

if [ "$PDFSIG_AVAILABLE" = true ]; then
    echo "Signatures in PROTECTED PDF:"
    pdfsig "$PROTECTED_PDF" || echo -e "${RED}✗${NC} Cannot read signatures (likely password-protected)"
    echo ""
    
    echo "Attempting to check with password..."
    # pdfsig doesn't support password, so we need to decrypt first
    DECRYPTED_PDF="/tmp/test-signed-decrypted.pdf"
    qpdf --decrypt --password="$TEST_PASSWORD" "$PROTECTED_PDF" "$DECRYPTED_PDF"
    
    if [ -f "$DECRYPTED_PDF" ]; then
        echo ""
        echo "Signatures after decryption:"
        pdfsig "$DECRYPTED_PDF"
        echo ""
    fi
else
    echo "Using qpdf to check protected PDF..."
    qpdf --check "$PROTECTED_PDF" && echo -e "${GREEN}✓${NC} Protected PDF is valid" || echo -e "${YELLOW}⚠${NC} Protected PDF has warnings"
    echo ""
fi

# Step 4: Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ "$PDFSIG_AVAILABLE" = true ]; then
    echo "Analysis method: pdfsig (signature verification tool)"
    echo ""
    echo -e "${YELLOW}MANUAL VERIFICATION REQUIRED:${NC}"
    echo "1. Compare signature counts above"
    echo "2. Check if signatures are marked as 'VALID' or 'INVALID'"
    echo "3. Look for warnings about 'document modified'"
    echo ""
    echo -e "${GREEN}Expected if signatures preserved:${NC}"
    echo "  - Same number of signatures"
    echo "  - All signatures show as VALID"
    echo "  - No 'document modified' warnings"
    echo ""
    echo -e "${RED}Expected if signatures broken:${NC}"
    echo "  - Signatures show as INVALID"
    echo "  - 'Document has been modified' warnings"
    echo "  - Different signature properties"
else
    echo "pdfsig not available - limited analysis"
    echo "Install poppler-utils for full signature verification"
fi

echo ""
echo "Test files created:"
echo "  Original:  $TEST_PDF"
echo "  Protected: $PROTECTED_PDF"
if [ -f "$DECRYPTED_PDF" ]; then
    echo "  Decrypted: $DECRYPTED_PDF"
fi

echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Open both PDFs in Adobe Acrobat Reader"
echo "2. Check signature panel (View > Certificate)"
echo "3. Verify if signatures are still valid"
echo "4. Try to modify the protected PDF (should be prevented)"
echo ""
echo -e "${YELLOW}To test password protection:${NC}"
echo "  open $PROTECTED_PDF"
echo "  (Should ask for password: $TEST_PASSWORD)"
echo ""

# Cleanup option
echo -e "${YELLOW}Keep test files for manual inspection? (y/n)${NC}"
read -r -n 1 CLEANUP
echo ""
if [[ $CLEANUP =~ ^[Nn]$ ]]; then
    rm -f "$PROTECTED_PDF" "$DECRYPTED_PDF"
    echo "Cleaned up test files"
fi



