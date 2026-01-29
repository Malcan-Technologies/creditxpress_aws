# TrueStack KYC API Documentation

Welcome to the TrueStack KYC API. This guide provides everything you need to integrate identity verification into your application.

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Authentication](#authentication)
4. [End-to-End User Journey](#end-to-end-user-journey)
5. [API Reference](#api-reference)
   - [Create KYC Session](#create-kyc-session)
   - [Get Session Status](#get-session-status)
   - [Refresh Session Status](#refresh-session-status)
6. [Webhooks](#webhooks)
7. [Session States & Results](#session-states--results)
8. [Error Handling](#error-handling)
9. [Rate Limits](#rate-limits)
10. [SDK Examples](#sdk-examples)
11. [Best Practices](#best-practices)
12. [FAQ](#faq)

---

## Overview

TrueStack KYC provides a simple, secure API for verifying user identities. Our service handles the complete verification process including:

- **Document Verification**: MyKad (Malaysian IC) and Passport scanning
- **OCR Extraction**: Automatic extraction of name, IC number, address, and other details
- **Face Matching**: Comparison of selfie with ID photo
- **Liveness Detection**: Anti-spoofing checks to ensure real person presence

### Key Features

| Feature | Description |
|---------|-------------|
| **Simple Integration** | Single API call to initiate verification |
| **Real-time Webhooks** | Instant notification when verification completes |
| **Secure Processing** | Bank-grade encryption and data protection |
| **Multi-platform Support** | Web, iOS, and Android compatible |

---

## Getting Started

### Prerequisites

1. **TrueStack Account**: Contact us to set up your client account
2. **API Key**: Generated in the TrueStack Admin Portal under Client > API Keys
3. **Webhook Endpoint**: A publicly accessible HTTPS endpoint to receive verification results

### Quick Start

```bash
# 1. Create a KYC session
curl -X POST https://api.truestack.my/api/v1/kyc/sessions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "document_name": "Ahmad bin Abdullah",
    "document_number": "901234-56-7890",
    "webhook_url": "https://yourapp.com/webhooks/kyc"
  }'

# 2. Redirect user to the returned onboarding_url
# 3. Receive webhook when verification completes
```

---

## Authentication

All API requests require authentication using your API key in the `Authorization` header:

```
Authorization: Bearer <your_api_key>
```

API keys are prefixed with `ts_live_` for production and `ts_test_` for sandbox environments.

**Important**: Keep your API key secure. Do not expose it in client-side code or public repositories.

---

## End-to-End User Journey

The KYC verification flow involves the following steps:

### Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Your Backend   │────▶│  TrueStack API  │────▶│  Verification   │
│                 │     │                 │     │     Portal      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │ 1. Create Session     │                       │
        │ ─────────────────────▶│                       │
        │                       │                       │
        │ 2. Receive session_id │                       │
        │    + onboarding_url   │                       │
        │ ◀─────────────────────│                       │
        │                       │                       │
        │ 3. Redirect user to onboarding_url            │
        │ ─────────────────────────────────────────────▶│
        │                       │                       │
        │                       │  4. User completes    │
        │                       │     verification:     │
        │                       │     - Scan ID         │
        │                       │     - Take selfie     │
        │                       │     - Liveness check  │
        │                       │                       │
        │                       │ 5. Verification       │
        │                       │◀───────────complete───│
        │                       │                       │
        │ 6. Webhook sent       │  7. User redirected   │
        │    to your endpoint   │     to status page    │
        │ ◀─────────────────────│ ─────────────────────▶│
        │                       │                       │
        │ 8. Update user status │                       │
        │    in your system     │                       │
```

### Step-by-Step Process

#### Step 1: Create a KYC Session

Your backend calls the TrueStack API with the user's document details:

```http
POST /api/v1/kyc/sessions
Authorization: Bearer ts_live_abc123...

{
  "document_name": "Ahmad bin Abdullah",
  "document_number": "901234-56-7890",
  "webhook_url": "https://yourapp.com/webhooks/kyc",
  "metadata": {
    "user_id": "usr_12345"
  }
}
```

#### Step 2: Receive Session Details

The API returns:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "onboarding_url": "https://verify.truestack.my/onboarding/abc123",
  "expires_at": "2026-01-30T12:00:00.000Z",
  "status": "pending"
}
```

#### Step 3: Redirect User

Redirect your user to the `onboarding_url`. This can be done via:

- **Web**: `window.location.href = onboarding_url`
- **Mobile WebView**: Open the URL in a WebView or external browser
- **Mobile App**: Use in-app browser (Safari View Controller / Chrome Custom Tabs)

#### Step 4: User Completes Verification

The user will:

1. **Scan their ID document** (front and back for MyKad)
2. **Take a selfie** for face matching
3. **Complete liveness check** (follow on-screen instructions)

The entire process typically takes 2-3 minutes.

#### Step 5 & 6: Verification Complete

Once the verification is complete (approved or rejected):

- **Webhook**: TrueStack sends a POST request to your `webhook_url` with the results
- **User Redirect**: Depends on your configuration:
  - **Default**: User is redirected to TrueStack's status page showing the verification result
  - **Custom redirect_url**: User is redirected to your specified URL with status query parameters

**Default behavior**: The user sees a branded status page confirming whether their verification was successful. They can then close the window or return to your application.

**Custom redirect_url**: When you provide a `redirect_url`, users are redirected directly to your URL after KYC completion. The URL includes query parameters (`?status=2&result=1`) indicating the outcome. This allows you to show your own branded completion page and seamlessly continue the user's journey in your application.

#### Step 7: Handle Webhook

Your webhook endpoint receives a lightweight notification:

```json
{
  "event": "kyc.session.completed",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "ref_id": "CLI_mkxl2qbq_52c0732a",
  "status": "completed",
  "result": "approved",
  "reject_message": null,
  "document_name": "Ahmad bin Abdullah",
  "document_number": "901234-56-7890",
  "metadata": {
    "user_id": "usr_12345"
  },
  "timestamp": "2026-01-29T10:30:00.000Z"
}
```

**Note**: The webhook contains basic session info. To get full OCR data, verification results, and images, call the [Get Session Status](#get-session-status) or [Refresh Session Status](#refresh-session-status) endpoint.

#### Step 8: Update Your System

Use the `session_id` and `metadata` to identify the user and update their verification status in your system.

---

## API Reference

### Base URL

| Environment | URL |
|-------------|-----|
| **Production** | `https://api.truestack.my` |
| **Sandbox** | Contact us for sandbox access |

---

### Create KYC Session

Creates a new KYC verification session for an end-user.

```http
POST /api/v1/kyc/sessions
```

#### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | `Bearer <api_key>` |
| `Content-Type` | Yes | `application/json` |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `document_name` | string | **Yes** | Full name as it appears on the identity document |
| `document_number` | string | **Yes** | Identity document number (e.g., MyKad number: `901234-56-7890`) |
| `webhook_url` | string | **Yes** | URL to receive webhook notification when verification completes. Must be a valid HTTPS URL. |
| `document_type` | string | No | Type of document. Default: `"1"`. See [Document Types](#document-types). |
| `platform` | string | No | End-user's platform. Default: `"Web"`. See [Platform Values](#platform-values). |
| `redirect_url` | string | No | Custom URL to redirect the user after KYC completion. If not provided, users are redirected to TrueStack's default status page. See [Custom Redirect URL](#custom-redirect-url). |
| `metadata` | object | No | Custom key-value pairs to associate with the session. Returned in webhooks. Max 10 keys, 1KB total. |

#### Document Types

| Value | Document Type |
|-------|---------------|
| `1` | MyKad (Malaysian IC) - Default |
| `2` | Passport |

#### Platform Values

| Value | Description |
|-------|-------------|
| `Web` | Desktop or mobile web browser (default) |
| `iOS` | Native iOS application |
| `Android` | Native Android application |

**Tip**: For mobile apps using WebView, use `"Web"` and ensure the WebView's user-agent is set correctly.

#### Custom Redirect URL

By default, after completing the KYC verification, users are redirected to a TrueStack-hosted status page that displays the verification result (success/failure).

If you want to handle the user experience yourself, you can provide a `redirect_url`. When specified:

- Users will be redirected directly to your URL after completing KYC
- The redirect includes query parameters with the verification status
- You are responsible for displaying the appropriate UI to the user

**Query Parameters on Redirect:**

| Parameter | Description |
|-----------|-------------|
| `status` | Verification status: `2` (completed) |
| `result` | Result: `1` (approved) or `0` (rejected) |

**Example redirect:**
```
https://yourapp.com/kyc/complete?status=2&result=1
```

**Important**: When using a custom `redirect_url`, you should still rely on webhooks as the authoritative source for verification results. The query parameters are informational only and should not be trusted for security decisions.

#### Example Request

**Basic (using TrueStack's default status page):**

```bash
curl -X POST https://api.truestack.my/api/v1/kyc/sessions \
  -H "Authorization: Bearer ts_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "document_name": "Ahmad bin Abdullah",
    "document_number": "901234-56-7890",
    "webhook_url": "https://yourapp.com/webhooks/kyc",
    "metadata": {
      "user_id": "usr_12345"
    }
  }'
```

**With custom redirect URL:**

```bash
curl -X POST https://api.truestack.my/api/v1/kyc/sessions \
  -H "Authorization: Bearer ts_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "document_name": "Ahmad bin Abdullah",
    "document_number": "901234-56-7890",
    "webhook_url": "https://yourapp.com/webhooks/kyc",
    "redirect_url": "https://yourapp.com/kyc/complete",
    "document_type": "1",
    "platform": "Web",
    "metadata": {
      "user_id": "usr_12345",
      "application_id": "app_67890"
    }
  }'
```

#### Success Response

**Status: 201 Created**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "onboarding_url": "https://verify.truestack.my/onboarding/abc123",
  "expires_at": "2026-01-30T12:00:00.000Z",
  "status": "pending"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Unique session identifier. Store this to track the session. |
| `onboarding_url` | string | URL to redirect the end-user to complete KYC verification. |
| `expires_at` | string (ISO 8601) | When the session expires (24 hours from creation). |
| `status` | string | Initial status, always `"pending"`. |

---

### Get Session Status

Retrieves the current status and details of a KYC session.

```http
GET /api/v1/kyc/sessions/:id
```

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string (UUID) | The session ID returned when creating the session |

#### Example Request

```bash
curl -X GET https://api.truestack.my/api/v1/kyc/sessions/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer ts_live_abc123..."
```

#### Success Response

**Status: 200 OK**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "result": "approved",
  "document_name": "Ahmad bin Abdullah",
  "document_number": "901234-56-7890",
  "document_type": "1",
  "metadata": {
    "user_id": "usr_12345"
  },
  "created_at": "2026-01-28T10:00:00.000Z",
  "updated_at": "2026-01-28T10:05:00.000Z",
  "document": {
    "full_name": "AHMAD BIN ABDULLAH",
    "id_number": "901234-56-7890",
    "id_number_back": "901234-56-7890-04-01",
    "address": "123 JALAN EXAMPLE, 50000 KUALA LUMPUR",
    "gender": "LELAKI",
    "dob": null,
    "nationality": null,
    "religion": null,
    "race": null
  },
  "verification": {
    "document_valid": true,
    "name_match": true,
    "id_match": true,
    "front_back_match": true,
    "landmark_valid": true,
    "face_match": true,
    "face_match_score": 95,
    "liveness_passed": true
  },
  "documents": {
    "front_document": "https://api.truestack.my/api/v1/kyc/sessions/.../documents/front_document",
    "back_document": "https://api.truestack.my/api/v1/kyc/sessions/.../documents/back_document",
    "face_image": "https://api.truestack.my/api/v1/kyc/sessions/.../documents/face_image",
    "best_frame": "https://api.truestack.my/api/v1/kyc/sessions/.../documents/best_frame"
  }
}
```

**Note**: `document`, `verification`, and `documents` are only included when session status is `completed`.

---

### Refresh Session Status

Fetches the latest verification status and updates the session. Use this when webhooks are delayed or to verify current status.

```http
POST /api/v1/kyc/sessions/:id
```

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string (UUID) | The session ID returned when creating the session |

#### Example Request

```bash
curl -X POST https://api.truestack.my/api/v1/kyc/sessions/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer ts_live_abc123..."
```

#### Success Response

**Status: 200 OK**

When status was refreshed (includes full verification data):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "ref_id": "CLI_mkxl2qbq_52c0732a",
  "status": "completed",
  "result": "approved",
  "reject_message": null,
  "refreshed": true,
  
  "document": {
    "full_name": "AHMAD BIN ABDULLAH",
    "id_number": "901234-56-7890",
    "id_number_back": "901234-56-7890-04-01",
    "address": "123 JALAN EXAMPLE, 50000 KUALA LUMPUR",
    "gender": "LELAKI"
  },
  
  "verification": {
    "document_valid": true,
    "name_match": true,
    "id_match": true,
    "front_back_match": true,
    "landmark_valid": true,
    "face_match": true,
    "face_match_score": 95,
    "liveness_passed": true
  },
  
  "images": {
    "front_document": "https://cdn.truestack.my/kyc/.../front_document.jpg?...",
    "back_document": "https://cdn.truestack.my/kyc/.../back_document.jpg?...",
    "face_image": "https://cdn.truestack.my/kyc/.../face_image.jpg?...",
    "best_frame": "https://cdn.truestack.my/kyc/.../best_frame.jpg?..."
  }
}
```

#### Response Fields

| Field | Description |
|-------|-------------|
| `id` | TrueStack session UUID |
| `ref_id` | Reference ID for this session |
| `status` | Session status: `pending`, `processing`, `completed`, `expired` |
| `result` | Verification result: `approved`, `rejected`, or `null` if pending |
| `reject_message` | Reason for rejection (if applicable) |
| `refreshed` | Whether status was updated from our verification system |
| **document** | |
| `document.full_name` | Full name extracted via OCR |
| `document.id_number` | ID number from front of document |
| `document.id_number_back` | ID number from back of document |
| `document.address` | Address extracted from document |
| `document.gender` | Gender from document |
| **verification** | |
| `verification.document_valid` | Document passed all verification checks |
| `verification.name_match` | Name matches what was provided |
| `verification.id_match` | ID number matches what was provided |
| `verification.front_back_match` | Front and back ID numbers match |
| `verification.landmark_valid` | Document landmarks are valid (anti-fraud) |
| `verification.face_match` | Face matches the ID photo |
| `verification.face_match_score` | Face match confidence score (0-100) |
| `verification.liveness_passed` | User passed liveness detection |
| **images** | Pre-signed URLs (valid for 1 hour) |
| `images.front_document` | URL to front of ID document |
| `images.back_document` | URL to back of ID document |
| `images.face_image` | URL to cropped face from ID |
| `images.best_frame` | URL to best frame from liveness check |

**Note**: Image URLs expire after 1 hour. Call this endpoint again to receive fresh URLs. No additional charges for status checks on completed sessions.

---

## Webhooks

When a KYC session completes, TrueStack sends a webhook notification to your configured `webhook_url`.

### Webhook Events

| Event | Description |
|-------|-------------|
| `kyc.session.started` | User opened the verification URL (status: pending) |
| `kyc.session.processing` | User is actively completing verification (status: processing) |
| `kyc.session.completed` | Session finished with a final result (approved/rejected) |
| `kyc.session.expired` | Session expired before user completed verification |

**Note**: You may receive webhooks for each status transition. The `kyc.session.completed` event is the most important one for updating your records.

### Webhook Payload

Webhooks are **lightweight notifications** that inform you of status changes. They contain enough information to identify the session and its outcome, but do not include full OCR or verification data.

```http
POST {your_webhook_url}
Content-Type: application/json
X-TrueStack-Event: kyc.session.completed
```

```json
{
  "event": "kyc.session.completed",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "ref_id": "CLI_mkxl2qbq_52c0732a",
  "status": "completed",
  "result": "approved",
  "reject_message": null,
  "document_name": "Ahmad bin Abdullah",
  "document_number": "901234-56-7890",
  "metadata": {
    "user_id": "usr_12345",
    "application_id": "app_67890"
  },
  "timestamp": "2026-01-29T15:30:00.000Z"
}
```

| Field | Description |
|-------|-------------|
| `event` | Event type (see [Webhook Events](#webhook-events)) |
| `session_id` | Unique session identifier |
| `ref_id` | Reference ID for this session |
| `status` | Session status: `completed`, `expired` |
| `result` | Verification result: `approved` or `rejected` |
| `reject_message` | Reason for rejection (if applicable) |
| `document_name` | Name provided when creating the session |
| `document_number` | Document number provided when creating the session |
| `metadata` | Your custom metadata passed when creating the session |
| `timestamp` | When the webhook was sent (ISO 8601) |

**Important**: To retrieve full OCR data, verification results, and document images, call the [Get Session Status](#get-session-status) or [Refresh Session Status](#refresh-session-status) endpoint using the `session_id` from the webhook.

### Webhook Handler Example

```javascript
// In your webhook handler
app.post('/webhooks/kyc', async (req, res) => {
  // Respond immediately to acknowledge receipt
  res.status(200).send('OK');
  
  // Process the webhook asynchronously
  const { event, session_id, status, result, metadata } = req.body;
  
  if (event === 'kyc.session.completed') {
    // Fetch full verification details from API
    const sessionDetails = await fetch(
      `https://api.truestack.my/api/v1/kyc/sessions/${session_id}`,
      {
        method: 'POST', // Use POST to refresh and get full data
        headers: { 'Authorization': `Bearer ${YOUR_API_KEY}` }
      }
    ).then(r => r.json());
    
    // Now you have full OCR data, verification results, and image URLs
    const { document, verification, images } = sessionDetails;
    
    // Update your database
    await updateUserVerification(metadata.user_id, {
      status: result,
      fullName: document?.full_name,
      idNumber: document?.id_number,
      faceMatchScore: verification?.face_match_score,
    });
  }
});
```

### Expected Response

Your webhook endpoint must return an **HTTP 2xx status code** (e.g., 200, 201, 202) to acknowledge receipt. We only check the status code, not the response body.

| Response | Result |
|----------|--------|
| HTTP 200-299 | Success - webhook marked as delivered |
| HTTP 4xx/5xx | Failed - recorded as delivery failure |
| Timeout/Error | Failed - recorded as delivery failure |

**Important**: Respond within **5 seconds**. If your processing takes longer, return 200 immediately and process asynchronously.

### Webhook Best Practices

1. **Respond quickly**: Return a 2xx status within 5 seconds
2. **Process asynchronously**: Queue webhook data for processing, don't block the response
3. **Handle duplicates**: Use `session_id` for idempotency - you may receive multiple webhooks for the same session
4. **Log everything**: Store the raw webhook payload for debugging
5. **Fetch full details**: Use the session API to retrieve complete OCR and verification data

### Webhook Delivery Notes

- **No automatic retry**: Webhooks are sent once per status change. If your endpoint fails, the webhook is not automatically retried.
- **Multiple webhooks possible**: You may receive multiple webhooks for the same session as it progresses through states (pending → processing → completed).
- **Fallback to polling**: If you suspect a missed webhook, use the [Refresh Session Status](#refresh-session-status) endpoint to get the current status.
- **Timeout**: Your endpoint must respond within 5 seconds or the webhook will be marked as failed.

---

## Session States & Results

### Session Status

| Status | Description |
|--------|-------------|
| `pending` | Session created, waiting for user to start |
| `processing` | User has started the KYC process |
| `completed` | KYC process finished (check `result` for outcome) |
| `expired` | Session expired before completion (24 hours) |

### Verification Results

| Result | Description |
|--------|-------------|
| `approved` | Identity verification successful |
| `rejected` | Identity verification failed |

### Rejection Reasons

When `result` is `rejected`, the `reject_message` field indicates why:

| Reason | Description |
|--------|-------------|
| `document_invalid` | Document could not be verified as authentic |
| `face_mismatch` | Selfie does not match ID photo |
| `liveness_failed` | Liveness detection failed |
| `name_mismatch` | Name on document doesn't match provided name |
| `id_mismatch` | ID number doesn't match provided number |

---

## Error Handling

### Error Response Format

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error description"
}
```

### HTTP Status Codes

| Status | Error Code | Description |
|--------|------------|-------------|
| 400 | `BAD_REQUEST` | Invalid request parameters |
| 401 | `UNAUTHORIZED` | Invalid or missing API key |
| 402 | `INSUFFICIENT_CREDITS` | Account has insufficient credits |
| 404 | `NOT_FOUND` | Session not found |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |
| 502 | `GATEWAY_ERROR` | Verification service temporarily unavailable |

### Common Errors

**Missing required fields:**
```json
{
  "error": "BAD_REQUEST",
  "message": "document_name and document_number are required"
}
```

**Invalid webhook URL:**
```json
{
  "error": "BAD_REQUEST",
  "message": "webhook_url must be a valid HTTPS URL"
}
```

**Insufficient credits:**
```json
{
  "error": "INSUFFICIENT_CREDITS",
  "message": "Account credit balance exhausted",
  "balance": 0.5
}
```

---

## Rate Limits

| Limit | Value |
|-------|-------|
| Requests per minute | 60 |
| Concurrent sessions | 100 |

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1706538000
```

---

## SDK Examples

### JavaScript / TypeScript

```typescript
interface KycSession {
  id: string;
  onboarding_url: string;
  expires_at: string;
  status: string;
}

async function createKycSession(
  apiKey: string,
  documentName: string,
  documentNumber: string,
  webhookUrl: string,
  metadata?: Record<string, string>
): Promise<KycSession> {
  const response = await fetch('https://api.truestack.my/api/v1/kyc/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      document_name: documentName,
      document_number: documentNumber,
      webhook_url: webhookUrl,
      metadata,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
}

// Usage
const session = await createKycSession(
  'ts_live_abc123...',
  'Ahmad bin Abdullah',
  '901234-56-7890',
  'https://yourapp.com/webhooks/kyc',
  { user_id: 'usr_12345' }
);

// Redirect user
window.location.href = session.onboarding_url;
```

### Python

```python
import requests
from typing import Optional, Dict

def create_kyc_session(
    api_key: str,
    document_name: str,
    document_number: str,
    webhook_url: str,
    metadata: Optional[Dict[str, str]] = None
) -> dict:
    response = requests.post(
        'https://api.truestack.my/api/v1/kyc/sessions',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'document_name': document_name,
            'document_number': document_number,
            'webhook_url': webhook_url,
            'metadata': metadata or {},
        },
    )
    
    response.raise_for_status()
    return response.json()

# Usage
session = create_kyc_session(
    api_key='ts_live_abc123...',
    document_name='Ahmad bin Abdullah',
    document_number='901234-56-7890',
    webhook_url='https://yourapp.com/webhooks/kyc',
    metadata={'user_id': 'usr_12345'},
)

onboarding_url = session['onboarding_url']
# Redirect user to onboarding_url
```

### PHP

```php
<?php

function createKycSession(
    string $apiKey,
    string $documentName,
    string $documentNumber,
    string $webhookUrl,
    array $metadata = []
): array {
    $ch = curl_init('https://api.truestack.my/api/v1/kyc/sessions');
    
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'document_name' => $documentName,
            'document_number' => $documentNumber,
            'webhook_url' => $webhookUrl,
            'metadata' => $metadata,
        ]),
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 201) {
        throw new Exception('Failed to create KYC session');
    }
    
    return json_decode($response, true);
}

// Usage
$session = createKycSession(
    'ts_live_abc123...',
    'Ahmad bin Abdullah',
    '901234-56-7890',
    'https://yourapp.com/webhooks/kyc',
    ['user_id' => 'usr_12345']
);

header('Location: ' . $session['onboarding_url']);
exit;
```

### Go

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
)

type KycSessionRequest struct {
    DocumentName   string            `json:"document_name"`
    DocumentNumber string            `json:"document_number"`
    WebhookURL     string            `json:"webhook_url"`
    Metadata       map[string]string `json:"metadata,omitempty"`
}

type KycSessionResponse struct {
    ID            string `json:"id"`
    OnboardingURL string `json:"onboarding_url"`
    ExpiresAt     string `json:"expires_at"`
    Status        string `json:"status"`
}

func CreateKycSession(apiKey string, req KycSessionRequest) (*KycSessionResponse, error) {
    body, _ := json.Marshal(req)
    
    httpReq, _ := http.NewRequest(
        "POST",
        "https://api.truestack.my/api/v1/kyc/sessions",
        bytes.NewBuffer(body),
    )
    
    httpReq.Header.Set("Authorization", "Bearer "+apiKey)
    httpReq.Header.Set("Content-Type", "application/json")
    
    resp, err := http.DefaultClient.Do(httpReq)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    var session KycSessionResponse
    json.NewDecoder(resp.Body).Decode(&session)
    
    return &session, nil
}

func main() {
    session, _ := CreateKycSession("ts_live_abc123...", KycSessionRequest{
        DocumentName:   "Ahmad bin Abdullah",
        DocumentNumber: "901234-56-7890",
        WebhookURL:     "https://yourapp.com/webhooks/kyc",
        Metadata:       map[string]string{"user_id": "usr_12345"},
    })
    
    fmt.Printf("Redirect user to: %s\n", session.OnboardingURL)
}
```

---

## Best Practices

### Integration

1. **Always store the session ID** - You'll need it to correlate webhook notifications and query status
2. **Use metadata** - Pass your internal user/application IDs to link sessions to your records
3. **Implement webhook handlers** - Webhooks are the primary way to receive verification results
4. **Handle errors gracefully** - Implement retry logic for transient failures

### Security

1. **Keep API keys secure** - Never expose in client-side code
2. **Verify webhook signatures** - Always validate the `X-Webhook-Signature` header
3. **Use HTTPS** - All webhook URLs must use HTTPS in production

### User Experience

1. **Set correct platform** - Use `iOS` or `Android` for native apps to optimize the verification flow
2. **Inform users** - Let users know what documents they'll need before starting
3. **Handle failures** - Provide clear next steps when verification fails

### Billing

1. **Monitor credits** - Check your balance regularly in the Admin Portal
2. **Set up alerts** - Configure low-balance notifications
3. **Understand billing** - You're only charged when sessions complete (approved or rejected)

---

## FAQ

### General

**Q: How long does a verification session last?**
A: Sessions expire 24 hours after creation if not completed.

**Q: Can users retry if verification fails?**
A: Yes, create a new session for the user to try again.

**Q: What documents are supported?**
A: Currently MyKad (Malaysian IC) and Passports.

### Technical

**Q: What if I don't receive a webhook?**
A: Use the Refresh Session Status endpoint (`POST /api/v1/kyc/sessions/:id`) to check the current status.

**Q: How do I test in development?**
A: Contact us for sandbox credentials and test identity documents.

**Q: Can I use the API from client-side code?**
A: No. API calls should only be made from your backend to keep your API key secure.

**Q: Can I redirect users to my own page after KYC?**
A: Yes! Provide a `redirect_url` when creating the session. Users will be redirected to your URL with query parameters indicating the verification result (`?status=2&result=1` for approved). If not provided, users see TrueStack's default status page.

**Q: Should I trust the redirect query parameters for verification?**
A: No. Always use webhooks as the authoritative source for verification results. The redirect query parameters are for UX purposes only and should not be used for security decisions.

### Billing

**Q: When am I charged?**
A: Only when a session completes (approved or rejected). Sessions that expire or are abandoned are not charged.

**Q: What happens if my balance runs out?**
A: New sessions will fail with `INSUFFICIENT_CREDITS` error. Contact us for top-up options.

---

## Support

For technical support or questions:

- **Email**: support@truestack.my
- **Documentation**: https://docs.truestack.my
- **Status Page**: https://status.truestack.my

---

*Last updated: January 2026*
