# Work phases — UX fixes, NHM module, broadcasts, security

Status legend: [ ] todo · [~] in progress · [x] done

## Phase 1 — "मेरा QR" + "स्कैन हो गया" (SendDataScreen)
Problem: the "स्कैन हो गया" button sent the fake code `ASHA_DIRECT_QR_TRANSMITTED` to the server
(no ANM could be matched) and marked surveys as sent to that fake ANM. The QR payload also invented
counts (`|| 2`, `|| 3`) and values (`MCTS-NEW`, `BP/Sugar`).
- [x] Button becomes "एएनएम ने स्कैन कर लिया" with a one-line explanation; it records the handoff to
      the ASHA's **assigned ANM** (server profile `anmPhone`), online or queued offline.
- [x] Disabled with a hint when no ANM is assigned (no fake fallback code).
- [x] QR payload: real counts only, no invented values.
- [x] Remove fake defaults `ANM-CHANDPUR-01` / `ANM-QR-<cluster>-SYNCED`.

## Phase 2 — mobsfscan findings (Android)
- [x] `allowBackup=false` (main manifest + `app.json` so Expo prebuild keeps it).
- [x] Task hijacking (StrandHogg): MainActivity `launchMode="singleTop"` + `taskAffinity=""`, kept via
      `plugins/withAndroidSecurity.js`.
- [x] Debug-only cleartext: leave in `src/debug` (needed for Metro); confirm release manifest has none.
- [x] Re-run mobsfscan and record the result: backup + StrandHogg-1 findings gone. Left:
      `android_task_hijacking2` = false positive (mobsfscan cannot read targetSdk=34 from Gradle and
      assumes 26), and debug-only cleartext (Metro dev server; not in release builds).

## Phase 3 — NHM module UI + TTS (Me → प्रशिक्षण)
- [x] Rebuild `NhmCoursesCard` on the ui kit (tactile cards, Hindi/Marathi only).
- [x] "सुनें" on every module/lesson (expo-speech, offline TTS), stop on leave.
- [x] Progress kept on device.

## Phase 4 — NHM broadcasts (CHO/ADMIN → ASHA)
Backend
- [x] Table `clinicqueue.nhm_broadcasts` (+ `nhm_broadcast_acks`), soft-delete only.
- [x] `POST/GET /api/asha/cho/broadcasts` (CHO: own sector · ADMIN: all; sent list with read/done
      counts), `POST /api/asha/cho/broadcasts/{id}/withdraw` (soft-delete, own only),
      `GET /api/asha/broadcasts/inbox` + `POST /api/asha/broadcasts/{id}/ack` (ASHA/ANM only).
App
- [x] CHO: "संदेश भेजें" — title, message (voice), priority, due date, target ASHA/ANM/all.
- [x] ASHA/ANM: inbox on Today + badge; listen (TTS), mark done; cached for offline reading.

## Phase 5 — SonarQube
- [ ] BLOCKED: SonarQube's Elasticsearch times out on start-up in the 3.7 GB Docker VM (tried twice,
      also with reduced heaps). Raise Docker Desktop memory to ~6 GB (Settings → Resources), then
      re-run: `docker run -d --name sq-local -p 9000:9000 sonarqube:community` + sonar-scanner-cli.

## Verification (each phase)
`tsc --noEmit` · `mvn test-compile` (+ tests for backend changes) · `npx expo export -p web`
