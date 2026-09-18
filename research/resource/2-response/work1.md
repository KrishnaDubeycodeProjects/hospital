# Walkthrough: Rural Healthcare Accessibility & ABDM Integration

We have implemented the core components specified in [`research/resource/2-response/projectDescription.md`](file:///c:/Users/Krishana%20dubey/hospital-spring-boot/research/resource/2-response/projectDescription.md), leveraging the Eka Care ABDM credentials from `eka-care-abha-tester`.

---

## 1. Database Schema Additions (`schema.sql`)

Added idempotent tables and columns into the dedicated `clinicqueue` schema:

* **Family Unit Module**:
  * `family_units`: Tracks primary WhatsApp phone and head of family.
  * `family_members`: Supports members linked with ABHA or without ABHA (for children and elderly).
* **Continuity of Care ("Course" Engine)**:
  * `courses`: FHIR `EpisodeOfCare` representation for ongoing treatment journeys (e.g. TB Treatment, ANC, Hypertension).
  * `course_encounters`: FHIR `Encounter` + `Composition` for individual consultations.
  * `course_prescriptions`: FHIR `MedicationRequest` with SNOMED CT and NLEM indicators.
  * `course_documents`: FHIR `Binary` + `DocumentReference` for scanned PDFs and reports.
* **Tiered Referrals**:
  * `course_referrals`: Multi-tier priority referrals (`urgent_7d`, `semi_urgent_14d`, `routine_30d`) with QR passes.
  * Quota columns on `hospitals` table (`urgent_referral_quota`, `standard_referral_quota`).

---

## 2. Eka Care ABDM Integration (`EkaCareAbdmService.java`)

Integrated with Eka Care Gateway (`https://api.eka.care`) using:
* **Client ID**: `EC_1789403504199`
* **Client Secret**: `eka_5c9f2af5d467477483e292fb`

Implemented operations:
* Automated authentication & Bearer token caching (`/connect-auth/v1/account/login`).
* **M1**: Aadhaar & ABHA number KYC init (`/abdm/v1/profile/kyc/init`) and OTP verification (`/abdm/na/v1/profile/login/verify`).
* **M1**: ABHA handle availability check (`/abdm/v1/registration/check-address`).
* **M2**: Patient discovery & care context linking (`/abdm/v1/hip/patient/discover`, `/abdm/v1/hip/care-context/link`).
* **M3**: HIU Consent management (`/abdm/v1/hiu/consent/init`, status check).

---

## 3. Services and REST APIs

| Module | Service | Controller Endpoints |
|---|---|---|
| **Family Unit** | [`FamilyUnitService`](file:///c:/Users/Krishana%20dubey/hospital-spring-boot/src/main/java/com/qdischarge/clinicqueue/service/FamilyUnitService.java) | `GET /api/family`<br>`GET /api/family/members`<br>`POST /api/family/members`<br>`POST /api/family/members/{id}/link-abha` |
| **Course Engine** | [`CourseService`](file:///c:/Users/Krishana%20dubey/hospital-spring-boot/src/main/java/com/qdischarge/clinicqueue/service/CourseService.java) | `POST /api/courses`<br>`GET /api/courses/{id}`<br>`GET /api/courses/{id}/timeline`<br>`GET /api/courses/{id}/consent-bundle`<br>`POST /api/courses/{id}/encounters`<br>`POST /api/courses/{id}/documents`<br>`POST /api/courses/{id}/close`<br>`GET /api/courses/patient` |
| **Referrals** | [`ReferralService`](file:///c:/Users/Krishana%20dubey/hospital-spring-boot/src/main/java/com/qdischarge/clinicqueue/service/ReferralService.java) | `POST /api/referrals`<br>`GET /api/referrals/{id}`<br>`GET /api/referrals/{id}/qr`<br>`GET /api/referrals/prior-context`<br>`GET /api/referrals/patient`<br>`POST /api/referrals/{id}/complete` |
| **Drug Registry** | [`DrugRegistryService`](file:///c:/Users/Krishana%20dubey/hospital-spring-boot/src/main/java/com/qdischarge/clinicqueue/service/DrugRegistryService.java) | `GET /api/drugs/search?query=...`<br>`GET /api/drugs/templates` |
| **ABDM Gateway** | [`EkaCareAbdmService`](file:///c:/Users/Krishana%20dubey/hospital-spring-boot/src/main/java/com/qdischarge/clinicqueue/service/EkaCareAbdmService.java) | `POST /api/abdm/kyc/init`<br>`POST /api/abdm/kyc/verify`<br>`GET /api/abdm/check-address`<br>`POST /api/abdm/consent/init`<br>`GET /api/abdm/consent/{id}/status` |

---

## 4. Verification & Automated Tests

Ran Maven compilation and unit tests:
```powershell
mvn test
```

### Test Results:
* `DrugRegistryServiceTest`:
  * Verified SNOMED CT coded search and NLEM flag matching (`Amoxicillin`, `HRZE`).
  * Verified condition-based dosage template generation (Anemia protocol, TB DOTS).
* `EkaCareAbdmServiceTest`:
  * Verified Eka Care OAuth token caching and authenticated ABHA address lookup.
* **Result**: **4 tests run, 0 failures, 0 errors**.
