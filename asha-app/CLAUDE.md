# CLAUDE.md — AarogyaFlow ASHA Worker App Engine Guidelines

> **Project Identity:** AarogyaFlow (`com.jansamvaad.aarogyaflow`)  
> **Domain:** National Health Mission (NHM) & Ayushman Bharat Digital Mission (ABDM) rural healthcare platform.  
> **Target Users:** Accredited Social Health Activists (ASHA), Auxiliary Nurse Midwives (ANM), and Community Health Officers (CHO).

---

## 🛠️ Stack & Architecture Constraints

- **Mobile Framework:** React Native 0.76.7 with Expo SDK ~52.0.0 (TypeScript 5.3.3, React 18.3.1).
- **Backend API:** Spring Boot 3.3.5, Java 21, PostgreSQL (`clinicqueue` schema), AWS Lambda Serverless Container.
- **Production API Gateway:** `https://r30w1p3cyh.execute-api.us-east-1.amazonaws.com`
- **Offline Storage:** `@react-native-async-storage/async-storage` with an append-only Outbox Queue (`@asha_outbox`).
- **Icons & UI:** `lucide-react-native`, `react-native-svg` (Clean, text-light, icon-driven Material 3 surface styling).
- **Design Skill & Rules:** Strictly enforce [`DESIGN_SKILL.md`](file:///c:/Users/Krishana%20dubey/hospital-spring-boot/asha-app/DESIGN_SKILL.md) and [`visual-abstract-ui`](file:///c:/Users/Krishana%20dubey/hospital-spring-boot/.agents/skills/visual-abstract-ui/SKILL.md) (Anti-AI-slop, 3-word ceiling, tactile cards, semantic color bindings).
- **Government System Alignment:** Strictly adhere to [`GOVERNMENT_RCH_ANMOL_SPECIFICATION.md`](file:///c:/Users/Krishana%20dubey/hospital-spring-boot/asha-app/GOVERNMENT_RCH_ANMOL_SPECIFICATION.md) for official RCH 2.0 registers, ANMOL 5.0.12 schemas, National Immunization Schedule (NIS Annexure 2), Naegele's rule EDD calculation (Annexure 1), VHND workflows, and ASHA vs ANM role boundaries.
- **Voice Engine:** `expo-speech-recognition`, `expo-speech` (Local model initialization for offline rural dialect dictation).
- **Language Localization:** Three complete, separate languages: **Hindi (`hi`)**, **Marathi (`mr`)** and **English (`en`)**. Each screen renders entirely in the selected language (no mixed-language strings).

---

## 🧠 Model Allocation Guidelines

| Task / Phase | Model | Rationale |
| :--- | :--- | :--- |
| **Bug Fixing & UI Refinement** | `claude-sonnet-4-6` | Rapid turnaround, exceptional UI styling, pattern matching. |
| **Outbox & Sync Protocol Hardening** | `claude-opus-4-8` | Deep reasoning for distributed state, reconciliation, and offline conflict resolution. |
| **Security Audits & SAST Triage** | `claude-opus-4-8` | High-stakes evaluation of SonarQube and mobsfscan findings to prevent false positives. |
| **Unit & Integration Test Suite** | `claude-sonnet-4-6` | Fast test generation; escalate to Opus for adversarial edge-case verification. |

---

## 📜 Non-Negotiable Business & Architectural Rules

1. **Offline-First Invariant:**
   - Field operations (adding families, recording maternal/child surveys, logging visits) **must succeed with zero network connectivity**.
   - Always persist mutations to local storage first, enqueue an action in `@asha_outbox`, and update the UI optimistically.
   - Never block user interaction on remote network requests.
2. **Rehydration Safety (No Data Loss on Reinstall):**
   - Cloud sync downloads must run through `OfflineStorageService.mergeRemoteLedger(...)`. Never overwrite un-synced local outbox items.
3. **Soft-Delete Only (Epidemiological Audit Trail):**
   - Hard deletions (`DELETE FROM ...`) are strictly prohibited in both frontend and backend.
   - Deletions must set `is_deleted = true`, enqueue `DELETE_FAMILY` or `DELETE_MEMBER` tombstones, and propagate bidirectionally.
4. **Cadre Hierarchy & Immutable Roles:**
   - **CHO** registers workers and assigns their initial preferred language.
   - **ASHA & ANM** cannot self-register; they authenticate via Phone + OTP (`/api/auth/otp/send` and `/api/auth/otp/verify`).
   - Roles (`ASHA`, `ANM`, `CHO`) are strictly immutable post-login.
5. **Language Constraint:**
   - Hindi (`hi`), Marathi (`mr`) and English (`en`) are supported; the worker picks one on Login / Profile and the CHO can assign it at onboarding.
   - Every user-facing string must carry all three: `tr('हिंदी', 'मराठी', 'English')` (via `useTr()`), or the `t(key)` dictionary in `LanguageContext`.
   - Screens rendered outside `<LanguageProvider>` (splash, login, auth messages) read the saved language with `src/utils/storedLanguage.ts`.
6. **Government Compatibility Invariant:**
   - All forms, clinical tracking parameters (BP, Hb, EDD, vaccines), and role handoffs must strictly adhere to [`GOVERNMENT_RCH_ANMOL_SPECIFICATION.md`](file:///c:/Users/Krishana%20dubey/hospital-spring-boot/asha-app/GOVERNMENT_RCH_ANMOL_SPECIFICATION.md).
7. **Guardrails:**
   - **DO NOT** edit files in `dist/`, `.expo/`, or `android/app/build/`.
   - **DO NOT** replace React Native code with native Android Java/Kotlin unless explicitly requested for custom native modules.

---

## 🧪 Verification & Build Commands

Always run these verification commands before marking any task as complete:

```bash
# 1. TypeScript Static Check (Must pass with 0 errors)
node node_modules/typescript/bin/tsc --noEmit

# 2. Export Web Production Bundle
npx expo export -p web

# 3. Cloud EAS Android Standalone APK Build (PowerShell)
$env:EAS_NO_VCS="1"; $env:NODE_TLS_REJECT_UNAUTHORIZED="0"; node "C:\Users\Krishana dubey\AppData\Roaming\npm\node_modules\eas-cli\bin\run" build --platform android --profile preview --non-interactive

# 4. Backend Compile & Test Verification (from repo root)
mvn test-compile
```

---

## 🛡️ Security & Static Analysis (SAST) Protocols

- **SonarQube Integration:** Use the installed `sonarqube@claude-plugins-official` plugin to scan TypeScript and Java services for security hotspots, injection risks, and dead code.
- **Mobile SAST:** Run `mobsfscan` on `asha-app/` to detect Android export issues, insecure webview settings, or weak cryptographic storage.
- **Secret Safety:** Never commit JWT secrets, AWS credentials, or Twilio tokens into source files. Use `.env` and AWS Parameter Store.
