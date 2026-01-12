# 📋 CTOS B2B Credit Check - QA Testing Documentation

> **Last Updated:** {{ Current Date }}  
> **Feature Version:** v1.0  
> **Environment:** Production / UAT

---

## 📑 Table of Contents

1. [Overview](#overview)
2. [Feature Summary](#feature-summary)
3. [User Flow Walkthrough](#user-flow-walkthrough)
4. [Test Scenarios](#test-scenarios)
5. [Test Data](#test-data)
6. [API Endpoints](#api-endpoints)
7. [UI Components & Interactions](#ui-components--interactions)
8. [Expected Behaviors](#expected-behaviors)
9. [Error Handling](#error-handling)
10. [Edge Cases & Special Scenarios](#edge-cases--special-scenarios)
11. [Performance & Load Testing](#performance--load-testing)

---

## 🎯 Overview

The CTOS B2B Credit Check feature allows admin users to fetch comprehensive credit reports for loan applicants directly from CTOS (Credit Tip-Off Service) B2B API. This feature provides critical credit information including CTOS Score, Due Diligent Index (DDI), Risk Grade, Litigation Index, CCRIS data, and legal records to support informed loan approval decisions.

### Key Capabilities

- ✅ **Request Fresh Credit Reports** - Initiate new credit report requests from CTOS
- ✅ **View Cached Reports** - Access previously fetched reports without additional charges
- ✅ **Two-Step Process** - Request → Confirm workflow for credit report retrieval
- ✅ **Comprehensive Data Display** - Visual representation of credit scores, risk indicators, and financial information
- ✅ **PDF Export** - Download credit reports as PDF documents
- ✅ **Auto-Load Cached Reports** - Automatically displays cached reports when available

---

## 📊 Feature Summary

### Main Features

| Feature | Description | Status |
|---------|-------------|--------|
| **Request Fresh Report** | Initiate new credit report request from CTOS B2B API | ✅ Active |
| **Reload Cached Report** | Refresh and reload previously cached credit report | ✅ Active |
| **View Credit Score** | Display CTOS Score (FICO-based, 300-850 range) with visual gauge | ✅ Active |
| **View Risk Indicators** | Display DDI, Risk Grade, Litigation Index | ✅ Active |
| **CCRIS Data** | Show banking payment history, credit facilities, and liabilities | ✅ Active |
| **Legal Information** | Display legal cases, bankruptcy records, litigation index | ✅ Active |
| **PDF Download** | Export credit report as PDF document | ✅ Active |
| **Error Handling** | Graceful handling of API errors and data unavailability | ✅ Active |

### Integration Points

- **Backend API:** `/api/admin/credit-reports/*`
- **Frontend Component:** `CreditReportCard.tsx`
- **CTOS B2B Service:** `ctosB2BService.ts`
- **Database:** `CreditReport` and `CreditReportLog` tables

---

## 🚶 User Flow Walkthrough

### Scenario 1: Requesting a Fresh Credit Report (First Time)

#### Step-by-Step Process

1. **Navigate to Application Details**
   - Log in to Admin Portal
   - Go to **Dashboard** → **Applications**
   - Select a loan application to view details
   - Scroll to the **Credit Report (CTOS)** section

2. **Verify Prerequisites**
   - ✅ Application must exist
   - ✅ User must have IC Number in profile
   - ✅ Admin must have proper permissions
   - ✅ IC Number must be in valid format (12 digits)

3. **Request Fresh Report**
   - Click **"Request Fresh Report"** button
   - Confirm the action in the confirmation dialog
   - System shows loading state: **"Requesting..."**

4. **Two-Step Process**
   - **Step 1 (Request):** System calls CTOS B2B API to create a request
   - **Step 2 (Confirm):** System automatically confirms and fetches the report
   - Report status changes: `PENDING_REQUEST` → `COMPLETED`

5. **View Results**
   - Credit report card expands automatically
   - Credit Score gauge displays (300-850 range)
   - Key metrics show: DDI, Risk Grade, Litigation Index
   - Click **"Show Details"** to view comprehensive information

### Scenario 2: Viewing Cached Report

#### Step-by-Step Process

1. **Navigate to Application**
   - Open application that has a previously fetched credit report
   - Credit report card automatically loads cached report

2. **View Cached Data**
   - Report displays with timestamp: **"Last fetched: X minutes/hours/days ago"**
   - All credit information is visible immediately
   - No additional API calls are made

3. **Reload Report (Optional)**
   - Click **"Reload Report"** button to refresh cached data
   - System fetches the same cached report from database
   - No new CTOS API call is made

### Scenario 3: Requesting Fresh Report When Cache Exists

#### Step-by-Step Process

1. **View Existing Cached Report**
   - System shows cached report automatically

2. **Request New Report**
   - Click **"Request Fresh Report"** button
   - Confirm the action (this will charge company credits)
   - New report is fetched from CTOS
   - Old cached report is replaced with new data

---

## 🧪 Test Scenarios

### Test Case 1: Successful Fresh Report Request

**Objective:** Verify that a fresh credit report can be successfully requested and displayed.

**Preconditions:**
- Admin user is logged in
- Application exists with valid user
- User has IC Number in profile
- IC Number format is valid (12 digits)

**Test Steps:**
1. Navigate to application details page
2. Locate Credit Report (CTOS) section
3. Click "Request Fresh Report" button
4. Confirm the action in dialog
5. Wait for report to load

**Expected Results:**
- ✅ Confirmation dialog appears before request
- ✅ Loading state shows "Requesting..." with spinner
- ✅ Report displays successfully after completion
- ✅ Credit Score gauge shows value between 300-850
- ✅ All key metrics (DDI, Risk Grade, Litigation Index) are displayed
- ✅ "Show Details" button is available
- ✅ Report status shows "COMPLETED"
- ✅ Timestamp shows current date/time

**Test Data:**
- Use valid IC Number from test data section
- Use valid full name matching IC Number

---

### Test Case 2: View Cached Report

**Objective:** Verify that cached reports are automatically loaded and displayed.

**Preconditions:**
- Application has a previously fetched credit report
- Report exists in database with status "COMPLETED"

**Test Steps:**
1. Navigate to application details page
2. Scroll to Credit Report (CTOS) section
3. Observe the report card

**Expected Results:**
- ✅ Report loads automatically without clicking any button
- ✅ "Last fetched" timestamp is displayed
- ✅ All credit information is visible
- ✅ "Reload Report" button is available
- ✅ "Request Fresh Report" button is available
- ✅ No loading spinner appears (instant load)

---

### Test Case 3: Reload Cached Report

**Objective:** Verify that cached reports can be reloaded from database.

**Preconditions:**
- Application has a cached credit report
- Report is visible on the page

**Test Steps:**
1. Click "Reload Report" button
2. Wait for reload to complete

**Expected Results:**
- ✅ Loading state shows "Reloading..." with spinner
- ✅ Same cached report data is displayed
- ✅ Timestamp remains unchanged
- ✅ No new CTOS API call is made
- ✅ Report data refreshes from database

---

### Test Case 4: Request Fresh Report Without IC Number

**Objective:** Verify error handling when IC Number is missing.

**Preconditions:**
- Application exists
- User profile does not have IC Number

**Test Steps:**
1. Navigate to application details page
2. Click "Request Fresh Report" button

**Expected Results:**
- ✅ Error message displays: "IC number is required to request credit report"
- ✅ "Request Fresh Report" button is disabled
- ✅ No API call is made
- ✅ Error is displayed in red alert box

---

### Test Case 5: Invalid IC Number Format

**Objective:** Verify validation of IC Number format.

**Preconditions:**
- Application exists
- User has IC Number but format is invalid (not 12 digits)

**Test Steps:**
1. Navigate to application details page
2. Attempt to request credit report with invalid IC

**Expected Results:**
- ✅ System validates IC Number format
- ✅ Error message indicates invalid format
- ✅ Request is rejected before API call
- ✅ Clear error message is displayed

---

### Test Case 6: CTOS API Error Handling

**Objective:** Verify graceful handling of CTOS API errors.

**Preconditions:**
- Application exists with valid IC Number
- CTOS API is unavailable or returns error

**Test Steps:**
1. Request fresh credit report
2. Observe error handling

**Expected Results:**
- ✅ Error message is displayed clearly
- ✅ Error indicates CTOS API issue
- ✅ Report status shows "FAILED" if applicable
- ✅ User can retry the request
- ✅ No partial data is displayed
- ✅ Error is logged for debugging

---

### Test Case 7: No Credit Data Available

**Objective:** Verify handling when CTOS returns no credit data.

**Preconditions:**
- Application exists with valid IC Number
- IC Number has no credit history in CTOS database

**Test Steps:**
1. Request fresh credit report for IC with no data
2. Observe the response

**Expected Results:**
- ✅ Special error state is displayed
- ✅ Message: "No Credit Data Available"
- ✅ Explanation provided:
  - IC number not registered in CTOS database
  - CCRIS service unavailable
  - Individual has no credit history
- ✅ "Try Request Again" button is available
- ✅ Report has `hasDataError: true` flag

---

### Test Case 8: PDF Download

**Objective:** Verify that credit reports can be downloaded as PDF.

**Preconditions:**
- Application has a completed credit report
- Report has base64-encoded PDF data

**Test Steps:**
1. View credit report with details expanded
2. Scroll to bottom of report
3. Click "Download PDF Report" button
4. Wait for download to complete

**Expected Results:**
- ✅ PDF download button is visible
- ✅ Clicking button triggers download
- ✅ File name format: `credit-report-{ICNumber}-{Date}.pdf`
- ✅ PDF contains all credit report information
- ✅ Download completes successfully
- ✅ File opens correctly in PDF viewer

---

### Test Case 9: Credit Score Gauge Display

**Objective:** Verify credit score gauge displays correctly with color coding.

**Preconditions:**
- Application has credit report with credit score

**Test Steps:**
1. View credit report
2. Observe credit score gauge

**Expected Results:**
- ✅ Gauge displays credit score value (300-850)
- ✅ Color coding is correct:
  - Red: 300-527 (Poor)
  - Orange: 528-649 (Low)
  - Yellow: 650-695 (Fair)
  - Light Green: 696-716 (Good)
  - Green: 717-742 (Very Good)
  - Dark Green: 743-850 (Excellent)
- ✅ Gauge pointer points to correct value
- ✅ Score number is clearly visible

---

### Test Case 10: Risk Grade Color Coding

**Objective:** Verify risk grade displays with appropriate color coding.

**Preconditions:**
- Application has credit report with risk grade

**Test Steps:**
1. View credit report
2. Observe risk grade display

**Expected Results:**
- ✅ Risk Grade displays: A, B, C, D, or E
- ✅ Color coding:
  - Green: A (Excellent/Low Risk)
  - Yellow: B (Good/Moderate Risk)
  - Orange: C (Fair/Moderate-High Risk)
  - Red: D (Poor/High Risk) or E (Very Poor/Very High Risk)
- ✅ Grade is clearly visible and readable

---

### Test Case 11: Litigation Index Display

**Objective:** Verify litigation index displays correctly with color coding.

**Preconditions:**
- Application has credit report with litigation index

**Test Steps:**
1. View credit report
2. Expand details section
3. Observe litigation index gauge

**Expected Results:**
- ✅ Litigation Index displays as 4-digit number (0000-9999)
- ✅ Gauge shows value with color coding:
  - Green: 0-100 (Very Low Risk)
  - Light Green: 101-500 (Low Risk)
  - Yellow: 501-2000 (Moderate Risk)
  - Orange: 2001-5000 (High Risk)
  - Red: 5001-9999 (Very High Risk)
- ✅ Description text is displayed if available

---

### Test Case 12: CCRIS Data Display

**Objective:** Verify CCRIS banking payment history displays correctly.

**Preconditions:**
- Application has credit report with CCRIS data

**Test Steps:**
1. View credit report
2. Expand details section
3. Scroll to "Banking Payment History (CCRIS Summary)" section
4. Expand "Banking Payment History (CCRIS Details)" section

**Expected Results:**
- ✅ CCRIS Summary shows:
  - Credit Applications (Total, Approved, Pending)
  - Liabilities (As Borrower, As Guarantor, Total)
  - Legal Action Taken (YES/NO)
  - Special Attention Account (YES/NO)
- ✅ CCRIS Details shows individual accounts:
  - Approval Date
  - Capacity (Borrower/Guarantor)
  - Lender Type
  - Credit Limit
  - Sub-accounts with facility details
- ✅ Sub-accounts can be expanded to view monthly history
- ✅ All amounts display in RM currency format

---

### Test Case 13: Expandable Details Section

**Objective:** Verify that report details can be expanded and collapsed.

**Preconditions:**
- Application has credit report

**Test Steps:**
1. View credit report (collapsed by default)
2. Click "Show Details" button
3. Observe expanded content
4. Click "Hide Details" button

**Expected Results:**
- ✅ Report is collapsed by default
- ✅ "Show Details" button is visible
- ✅ Clicking expands all detailed sections:
  - Credit Info at a Glance
  - CTOS Litigation Index
  - Banking Payment History (CCRIS Summary)
  - Banking Payment History (CCRIS Details)
  - CCRIS Derivatives
  - Financial Information
  - Legal Information
  - Credit Score Factors
  - Identity Verification
- ✅ "Hide Details" button collapses the section
- ✅ Smooth transition animation

---

### Test Case 14: Sub-Account Expansion

**Objective:** Verify that CCRIS sub-accounts can be expanded to view monthly history.

**Preconditions:**
- Application has credit report with CCRIS accounts
- Account has sub-accounts with multiple positions

**Test Steps:**
1. View credit report
2. Expand details section
3. Navigate to CCRIS Details section
4. Find account with sub-accounts
5. Click "View More" button on sub-account

**Expected Results:**
- ✅ "View More" button appears for sub-accounts with multiple positions
- ✅ Button shows count: "View More (X months)"
- ✅ Clicking expands monthly repayment history
- ✅ Each month shows:
  - Position Date
  - Status
  - Balance
  - Installment Amount
  - Installment Arrears
  - Monthly Arrears
  - Rescheduled Date (if applicable)
  - Restructured Date (if applicable)
- ✅ "Show Less" button collapses the history

---

### Test Case 15: Concurrent Report Requests

**Objective:** Verify system handles multiple simultaneous report requests.

**Preconditions:**
- Multiple applications exist
- Admin has access to multiple applications

**Test Steps:**
1. Open multiple application detail pages in different tabs
2. Request fresh reports for different applications simultaneously
3. Observe system behavior

**Expected Results:**
- ✅ Each request is processed independently
- ✅ No interference between concurrent requests
- ✅ All reports load successfully
- ✅ No race conditions occur
- ✅ Database updates are consistent

---

### Test Case 16: Report Status Transitions

**Objective:** Verify report status transitions correctly through workflow.

**Preconditions:**
- Application exists with valid IC Number

**Test Steps:**
1. Request fresh credit report
2. Observe status changes during process
3. Verify final status

**Expected Results:**
- ✅ Initial: No report (or cached report visible)
- ✅ During Request: Status shows "PENDING_REQUEST"
- ✅ After Confirmation: Status shows "COMPLETED"
- ✅ On Error: Status shows "FAILED"
- ✅ Status badge displays with appropriate color:
  - Green: COMPLETED
  - Yellow: PENDING_REQUEST
  - Red: FAILED

---

### Test Case 17: Tooltip Information

**Objective:** Verify that information tooltips provide helpful context.

**Preconditions:**
- Application has credit report

**Test Steps:**
1. View credit report
2. Hover over information icons (ℹ️) next to:
   - Credit Report header
   - CTOS Credit Score
   - Due Diligent Index
   - Risk Grade
   - Litigation Index
   - All section headers

**Expected Results:**
- ✅ Tooltip appears on hover
- ✅ Tooltip contains relevant explanation:
   - What the metric means
   - How it's calculated
   - What the values indicate
   - Score ranges and interpretations
- ✅ Tooltip is readable and well-formatted
- ✅ Tooltip disappears when mouse leaves

---

### Test Case 18: Mobile Responsiveness

**Objective:** Verify credit report displays correctly on mobile devices.

**Preconditions:**
- Application has credit report
- Access from mobile device or browser dev tools

**Test Steps:**
1. Open application detail page on mobile
2. View credit report section
3. Test all interactions:
   - Expand/collapse details
   - View gauges
   - Scroll through data
   - Download PDF

**Expected Results:**
- ✅ Report card is responsive
- ✅ Gauges scale appropriately
- ✅ Text is readable
- ✅ Buttons are tappable
- ✅ Tables scroll horizontally if needed
- ✅ All information is accessible
- ✅ No horizontal scrolling issues

---

## 📸 Test Data

> **Note:** Test data information will be provided as an image. Please refer to the attached image for:
> - Valid IC Numbers for testing
> - Test user names
> - Expected credit scores and risk grades
> - Sample CCRIS data
> - Edge case scenarios

### Test Data Image Placeholder

```
[IMAGE WILL BE INSERTED HERE]
```

### Test Data Categories

1. **Valid IC Numbers**
   - IC with excellent credit (Score 740+)
   - IC with good credit (Score 700-739)
   - IC with fair credit (Score 650-699)
   - IC with poor credit (Score 600-649)
   - IC with very poor credit (Score <600)
   - IC with no credit history

2. **Edge Cases**
   - IC with bankruptcy records
   - IC with legal cases
   - IC with high litigation index
   - IC with special attention accounts
   - IC with no CCRIS data

3. **Error Scenarios**
   - Invalid IC format
   - IC not in CTOS database
   - IC with API errors

---

## 🔌 API Endpoints

### 1. Request Fresh Credit Report (Two-Step Process)

**Endpoint:** `POST /api/admin/credit-reports/request-and-confirm`

**Description:** Single endpoint that handles both request and confirm steps automatically.

**Request Body:**
```json
{
  "applicationId": "string",
  "userId": "string",
  "icNumber": "string",
  "fullName": "string"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "id": "report-id",
    "userId": "user-id",
    "applicationId": "app-id",
    "reportType": "INDIVIDUAL",
    "icNumber": "123456789012",
    "fullName": "John Doe",
    "creditScore": 750,
    "dueDiligentIndex": "0000",
    "riskGrade": "A",
    "litigationIndex": "0000",
    "requestStatus": "COMPLETED",
    "fetchedAt": "2024-01-15T10:30:00Z",
    "fetchedBy": "admin-user-id"
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Error message here"
}
```

---

### 2. Get Cached Report

**Endpoint:** `GET /api/admin/credit-reports/cache/{userId}`

**Description:** Retrieves the most recent cached credit report for a user.

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "id": "report-id",
    "creditScore": 750,
    "dueDiligentIndex": "0000",
    "riskGrade": "A",
    "fetchedAt": "2024-01-15T10:30:00Z"
  }
}
```

**Response (Not Found):**
```json
{
  "success": false,
  "message": "No cached report found",
  "status": 404
}
```

---

### 3. Download PDF Report

**Endpoint:** `GET /api/admin/credit-reports/pdf/{reportId}`

**Description:** Downloads credit report as PDF document.

**Response:**
- Content-Type: `application/pdf`
- File download with name: `credit-report-{ICNumber}-{Date}.pdf`

---

## 🎨 UI Components & Interactions

### Credit Report Card Component

**Location:** `admin/app/components/CreditReportCard.tsx`

**Key Elements:**

1. **Header Section**
   - Title: "Credit Report (CTOS)"
   - Info icon with tooltip
   - Action buttons:
     - "Reload Report" (green)
     - "Request Fresh Report" (blue)

2. **Credit Score Gauge**
   - Visual gauge component (react-gauge-component)
   - Score range: 300-850
   - Color-coded segments
   - Large score number display

3. **Key Metrics Grid**
   - Due Diligent Index (DDI)
   - Risk Grade
   - Litigation Index
   - Summary Status

4. **Expandable Details Section**
   - "Show Details" / "Hide Details" toggle
   - Multiple data sections:
     - Credit Info at a Glance
     - CTOS Litigation Index
     - Banking Payment History (CCRIS)
     - Financial Information
     - Legal Information
     - Credit Score Factors
     - Identity Verification

5. **PDF Download Button**
   - Located at bottom of expanded details
   - Purple gradient styling
   - Downloads PDF report

### Button States

| Button | Default | Hover | Disabled | Loading |
|--------|---------|-------|----------|---------|
| Request Fresh Report | Blue | Darker Blue | Gray (opacity 50%) | Spinner + "Requesting..." |
| Reload Report | Green | Darker Green | Gray (opacity 50%) | Spinner + "Reloading..." |
| Show/Hide Details | Gray text | White text | N/A | N/A |
| Download PDF | Purple gradient | Darker purple | N/A | N/A |

### Color Coding

**Credit Score:**
- 300-527: Red (#EF4444)
- 528-649: Orange (#F97316)
- 650-695: Yellow (#EAB308)
- 696-716: Light Green (#84CC16)
- 717-742: Green (#22C55E)
- 743-850: Dark Green (#16A34A)

**Risk Grade:**
- A: Green
- B: Yellow
- C: Orange
- D/E: Red

**Litigation Index:**
- 0-100: Green
- 101-500: Light Green
- 501-2000: Yellow
- 2001-5000: Orange
- 5001-9999: Red

---

## ✅ Expected Behaviors

### Auto-Load Behavior

- ✅ Cached reports automatically load when component mounts
- ✅ No user interaction required to view cached data
- ✅ Loading state only shows during initial fetch
- ✅ If no cache exists, card shows empty state

### Request Behavior

- ✅ Confirmation dialog appears before requesting
- ✅ Dialog warns about credit charges
- ✅ Request cannot be cancelled once confirmed
- ✅ Loading state persists until completion
- ✅ Error handling for API failures

### Data Display Behavior

- ✅ All numeric values formatted with proper currency (RM)
- ✅ Dates formatted as: "DD MMM YYYY, HH:MM"
- ✅ Large numbers use thousand separators
- ✅ Percentages show 1 decimal place
- ✅ Status badges use appropriate colors

### Error Display Behavior

- ✅ Errors shown in red alert box
- ✅ Error messages are user-friendly
- ✅ Technical errors logged to console
- ✅ Users can retry after errors
- ✅ No partial data shown on error

---

## ⚠️ Error Handling

### Error Types & Messages

| Error Type | User Message | Technical Log |
|------------|--------------|---------------|
| Missing IC Number | "IC number is required to request credit report" | Validation error |
| Invalid IC Format | "Invalid IC number format" | Format validation error |
| CTOS API Error | "Failed to request credit report: [error details]" | Full API error response |
| No Credit Data | "No Credit Data Available" | CTOS returned empty data |
| Authentication Error | "CTOS authentication failed" | Login/Token error |
| Network Error | "Network error. Please try again." | Axios network error |
| Timeout Error | "Request timed out. Please try again." | API timeout |

### Error States

1. **No Data Error**
   - Special error display with icon
   - Explanation of possible reasons
   - "Try Request Again" button

2. **API Error**
   - Red alert box
   - Error message
   - Retry capability

3. **Validation Error**
   - Inline error message
   - Button disabled
   - Clear indication of issue

---

## 🔍 Edge Cases & Special Scenarios

### Edge Case 1: IC Number with Spaces/Dashes

**Scenario:** User IC Number stored with spaces or dashes (e.g., "1234 56 7890 12")

**Expected Behavior:**
- ✅ System automatically removes spaces/dashes before API call
- ✅ IC Number normalized to 12 digits
- ✅ Display shows cleaned format

---

### Edge Case 2: Multiple Reports for Same User

**Scenario:** User has multiple credit reports in database

**Expected Behavior:**
- ✅ System loads most recent COMPLETED report
- ✅ Older reports remain in database for audit
- ✅ Only latest report is displayed

---

### Edge Case 3: Report in PENDING_REQUEST Status

**Scenario:** Previous request was made but not confirmed

**Expected Behavior:**
- ✅ System should handle pending reports
- ✅ User can retry confirmation
- ✅ Or request new report (replaces pending)

---

### Edge Case 4: Very Large Credit Scores

**Scenario:** Credit score at maximum (850) or minimum (300)

**Expected Behavior:**
- ✅ Gauge displays correctly at extremes
- ✅ Color coding appropriate
- ✅ No visual overflow

---

### Edge Case 5: Missing Optional Data Fields

**Scenario:** CTOS returns report but some fields are missing

**Expected Behavior:**
- ✅ Available fields display normally
- ✅ Missing fields don't show (no empty sections)
- ✅ No errors for missing optional data
- ✅ Report still usable

---

### Edge Case 6: Rapid Button Clicks

**Scenario:** User clicks "Request Fresh Report" multiple times quickly

**Expected Behavior:**
- ✅ Button disabled after first click
- ✅ Only one request is processed
- ✅ No duplicate reports created
- ✅ Loading state prevents multiple clicks

---

### Edge Case 7: Browser Back/Forward Navigation

**Scenario:** User navigates away and returns to page

**Expected Behavior:**
- ✅ Report reloads automatically
- ✅ Cached data still available
- ✅ No duplicate requests
- ✅ State preserved correctly

---

### Edge Case 8: Session Expiry During Request

**Scenario:** Admin session expires while credit report is being fetched

**Expected Behavior:**
- ✅ Request fails gracefully
- ✅ Error message indicates authentication issue
- ✅ User redirected to login if needed
- ✅ No partial data saved

---

## ⚡ Performance & Load Testing

### Performance Benchmarks

| Action | Expected Time | Maximum Acceptable |
|--------|---------------|-------------------|
| Load Cached Report | < 500ms | 1 second |
| Request Fresh Report | 5-15 seconds | 30 seconds |
| Reload Cached Report | < 500ms | 1 second |
| PDF Download | 2-5 seconds | 10 seconds |
| Expand Details | < 100ms | 500ms |

### Load Testing Scenarios

1. **Multiple Concurrent Requests**
   - Test with 5, 10, 20 simultaneous requests
   - Verify no performance degradation
   - Check database connection pooling

2. **Large Report Data**
   - Test with reports containing many CCRIS accounts
   - Verify rendering performance
   - Check memory usage

3. **Rapid Reloads**
   - Test rapid clicking of "Reload Report"
   - Verify no duplicate requests
   - Check state management

---

## 📝 Testing Checklist

### Pre-Testing Setup

- [ ] Admin account with proper permissions
- [ ] Test applications created
- [ ] Test IC Numbers available
- [ ] CTOS B2B API credentials configured
- [ ] Database access for verification
- [ ] Browser dev tools ready for network inspection

### Functional Testing

- [ ] Request fresh report (first time)
- [ ] View cached report (auto-load)
- [ ] Reload cached report
- [ ] Request fresh report when cache exists
- [ ] Error: Missing IC Number
- [ ] Error: Invalid IC Format
- [ ] Error: CTOS API failure
- [ ] Error: No credit data available
- [ ] PDF download functionality
- [ ] Credit score gauge display
- [ ] Risk grade color coding
- [ ] Litigation index display
- [ ] CCRIS data display
- [ ] Expand/collapse details
- [ ] Sub-account expansion
- [ ] Tooltip information
- [ ] Mobile responsiveness

### Integration Testing

- [ ] API endpoint responses
- [ ] Database record creation
- [ ] Audit log entries
- [ ] Error logging
- [ ] PDF generation

### Regression Testing

- [ ] Existing cached reports still work
- [ ] No breaking changes to UI
- [ ] Backward compatibility maintained

---

## 🐛 Known Issues & Limitations

### Current Limitations

1. **Two-Step Process**
   - Currently automated, but CTOS API requires two steps
   - If Step 1 succeeds but Step 2 fails, manual retry needed

2. **Cache Invalidation**
   - Cached reports don't auto-expire
   - Manual "Request Fresh Report" needed for latest data

3. **PDF Generation**
   - PDF only available if CTOS returns base64-encoded PDF
   - Some reports may not have PDF data

### Known Issues

- None currently reported

---

## 📞 Support & Escalation

### For QA Issues

1. **Document the issue** with:
   - Steps to reproduce
   - Expected vs Actual behavior
   - Screenshots/videos
   - Browser console logs
   - Network request/response logs

2. **Check logs:**
   - Backend logs: `backend/logs/`
   - Browser console: F12 → Console tab
   - Network tab: F12 → Network tab

3. **Escalate to:**
   - Development team for technical issues
   - Product team for feature requests
   - CTOS support for API-related issues

---

## 📚 Additional Resources

- **CTOS Technical Spec:** `CTOS_ENQWS_v5.11.0_Report_Technical_Spec.pdf`
- **Component Code:** `admin/app/components/CreditReportCard.tsx`
- **Service Code:** `backend/src/lib/ctosB2BService.ts`
- **API Routes:** `backend/src/api/admin.ts` (credit-reports endpoints)

---

**Document Version:** 1.0  
**Last Updated:** {{ Current Date }}  
**Maintained By:** Development Team

