# Eka Care ABDM / ABHA API Verification & Terminal Tester

This project provides a standalone terminal-based tester and client library to test and verify Eka Care's ABDM / ABHA APIs (Authentication, M1 Identity & KYC, M2 Care Contexts, M3 Consent Management).

## Project Location
`eka-care-abha-tester/`

## Configuration
Stored in `.env`:
```env
CLIENT_ID=EC_1789403504199
CLIENT_SECRET=eka_5c9f2af5d467477483e292fb
EKA_BASE_URL=https://api.eka.care
```

## How to Run in Terminal

1. **Navigate to the directory**:
   ```bash
   cd eka-care-abha-tester
   ```

2. **Run Automated Test Suite**:
   ```bash
   npm test
   # or
   node src/test_endpoints.js
   ```

3. **Launch Interactive Terminal CLI**:
   ```bash
   npm start
   # or
   node src/cli.js
   ```

### Available Interactive Options in CLI:
- **1. Check ABHA Address availability (M1)**
- **2. Request Aadhaar / Mobile OTP for ABHA creation (M1)**
- **3. Verify OTP & Complete Registration (M1)**
- **4. Patient Care Context Discovery (M2)**
- **5. Consent Request Status & Data Sharing (M3)**
- **6. Full Automated Test Suite Execution**
