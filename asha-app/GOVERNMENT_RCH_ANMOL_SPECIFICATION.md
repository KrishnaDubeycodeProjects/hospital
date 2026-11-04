# AarogyaFlow — Government RCH 2.0 & ANMOL Systems Alignment Specification

> **Official Standard Reference:** Ministry of Health & Family Welfare (MoHFW), Government of India  
> **Source Documents Analyzed:**  
> 1. *ANMOL Online Training-cum-User Manual Version 5.0.12* (MoHFW / NIC)  
> 2. *Integrated RCH Register Version 2.0* (MoHFW National Health Mission)  
> 3. *Instruction Manual for ANM on Integrated RCH Register* (MoHFW)  
> 4. *Annexures 1 to 4: EDD Calendar, National Immunization Schedule (NIS), Monthly Immunization Reporting, Standard Abbreviations*  
> 5. *Ayushman Bharat Digital Mission (ABDM) M1/M2/M3 Frontline Specifications*  
> 6. *ASHA-ANM Operational Guidelines & Field Survey Workflows*  

---

## 1. Executive Summary & Ecosystem Architecture

The National Health Mission (NHM) and the Ministry of Health & Family Welfare (MoHFW) run the reproductive, maternal, newborn, child, and adolescent health (RMNCH+A) program across India through digital portals, primarily the **RCH Portal (Reproductive and Child Health 2.0)**, the **ANMOL (ANM Online)** tablet application, the **Poshan Tracker** (Ministry of Women and Child Development), and the **ABDM (Ayushman Bharat Digital Mission)** backbone.

Currently, frontline field realities suffer from three critical bottlenecks:
1. **Paper-Digital Redundancy:** Frontline workers maintain massive physical paper registers (Register 18A for Eligible Couples, Register 18B for Maternal Care, Child Registers, Village Schedules) while simultaneously attempting double data entry into brittle digital apps.
2. **Connectivity Fragility:** Existing government mobile apps fail in offline environments or corrupt state when syncing intermittently over 2G/3G rural networks.
3. **Blurred Role Demarcations:** ASHA workers (community mobilizers) are frequently burdened with clinical entry tasks, while ANMs (clinical midwives) spend clinical session time on clerical line-listing rather than patient care.

**AarogyaFlow** is architected as an offline-first, visual-first platform that seamlessly mirrors and synchronizes with the official MoHFW RCH 2.0 and ANMOL schemas while offering a radically simplified, non-AI-abstracted user interface tailored for frontline literacy levels.

```
┌───────────────────────────────────────────────────────────────────────────┐
│                       AAROGYAFLOW FRONTLINE ECOSYSTEM                     │
└───────────────────────────────────────────────────────────────────────────┘
                                     │
          ┌──────────────────────────┴──────────────────────────┐
          ▼                                                     ▼
┌──────────────────────────────┐              ┌──────────────────────────────┐
│         ASHA WORKER          │              │        ANM (SUB-CENTRE)      │
│  (Community Scout/Mobilizer) │              │  (Clinical Provider/Gate)    │
│  • Household Line Listing    │              │  • Clinical ANC / Lab Tests  │
│  • High-Risk Identification  │ ──Bluetooth──►  • Vaccine Administration     │
│  • Due-List Mobilization     │ ──or QR Code─►  • RCH 2.0 Official Sync     │
│  • HBNC / HBYC Home Visits   │              │  • Logistics Stock Ledger    │
│  • NHM Incentive Claims      │              │  • Institutional Referral    │
└──────────────────────────────┘              └──────────────────────────────┘
          │                                                     │
          └──────────────────────────┬──────────────────────────┘
                                     │
                                     ▼
                      ┌──────────────────────────────┐
                      │    CHO / ASHA FACILITATOR    │
                      │  (Arogya Mandir / HWC Level) │
                      │  • Clinical Review & Triage  │
                      │  • High-Risk Case Escalation │
                      │  • Incentive Verification    │
                      └──────────────────────────────┘
                                     │
                                     ▼ (ABDM M1/M2/M3 & REST Sync Engine)
┌───────────────────────────────────────────────────────────────────────────┐
│     GOVERNMENT PLATFORMS: RCH 2.0 | ANMOL | ABDM (ABHA) | POSHAN TRACKER   │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Government Data Models & Formats

To ensure 100% interoperability with official Government of India health infrastructure, AarogyaFlow adopts the standard data schemas defined in the *Integrated RCH Register Version 2.0* and *ANMOL 5.0.12*.

### 2.1 Geographic & Administrative Hierarchy (Annexure 3 & 3A)
Every record in the system must inherit the standardized 7-tier administrative tree:
- **Rural Hierarchy:** `State` ➔ `District` ➔ `Sub-District (Taluka/Tehsil/Block)` ➔ `Health Block` ➔ `PHC / HWC` ➔ `Sub-Centre` ➔ `Village / Habitation` ➔ `ASHA Catchment ID`.
- **Urban Hierarchy:** `State` ➔ `District` ➔ `City / Corporation` ➔ `Urban Health Block / Zone` ➔ `UPHC` ➔ `Ward / Slum / Mohalla` ➔ `ASHA Catchment ID`.

### 2.2 Identification Standards
- **RCH ID:** 12-digit alphanumeric standard identifier generated by the central RCH portal for every eligible woman and child.
- **ABHA Address & Number:** 14-digit Ayushman Bharat Health Account number (`XX-XXXX-XXXX-XXXX`) and PHR handle (`name@abdm`). AarogyaFlow must support:
  - Demographic Authentication (Name, Gender, DOB, Pincode matching - score >= 75%)
  - OTP-based Aadhaar validation (with Annexure 5 statutory consent recording).
- **MCTS Legacy ID:** 16-digit legacy tracking identifier where backfilled.

### 2.3 Eligible Couple (EC) Module (Registers EC-1 & EC-2)
Captures reproductive tracking for women aged 15–49 and their spouses:
```typescript
interface EligibleCoupleRecord {
  ecId: string;                   // Local UUID or RCH ID
  rchId?: string;                 // 12-digit RCH ID
  villageId: string;
  ashaId: string;
  womanName: string;
  womanAgeYears: number;          // Must be >= 15
  husbandName: string;
  husbandAgeYears: number;
  contactNumber: string;
  addressLine: string;
  socialCategory: 'SC' | 'ST' | 'OBC' | 'GENERAL';
  economicStatus: 'BPL' | 'APL';
  totalChildrenBoys: number;
  totalChildrenGirls: number;
  youngestChildAgeMonths?: number;
  currentContraceptiveMethod: 
    | 'NONE'
    | 'CONDOM'
    | 'ORAL_PILLS_MALA_N'
    | 'CENTCHROMAN_CHHAYA'
    | 'IUCD_COPPER_T_375'
    | 'IUCD_COPPER_T_380A'
    | 'INJECTABLE_MPA_ANTARA'
    | 'FEMALE_STERILIZATION'
    | 'MALE_STERILIZATION'
    | 'PPIUCD'
    | 'PAIUCD';
  contraceptiveStartDate?: string; // ISO-8601 YYYY-MM-DD
  pregnancyStatus: boolean;
  status: 'ACTIVE' | 'MIGRATED_IN' | 'MIGRATED_OUT' | 'GUEST' | 'CLOSED';
}
```

### 2.4 Antenatal Care (ANC) & Maternal Health (Registers PW-1 to PW-4)
Captures the continuum of care for pregnant women:
- **Baseline Data:**
  - `LMP Date` (Last Menstrual Period): Primary anchor for clinical computations.
  - `EDD Date` (Expected Date of Delivery): Computed strictly using **Naegele’s Rule** (Annexure 1): $\text{EDD} = \text{LMP} + 9 \text{ Calendar Months} + 7 \text{ Days}$.
  - `Gravida` (Total pregnancies), `Para` (Deliveries > 20 weeks), `Living Children`, `Abortions` (Spontaneous vs Induced/MTP).
  - Baseline height (cm), weight (kg), and Blood Group (A+, A-, B+, B-, AB+, AB-, O+, O-).
- **Mandatory 4 Antenatal Checkups (ANC 1 to 4):**
  - **ANC 1:** Within first 12 weeks (Registration & baseline screening).
  - **ANC 2:** Between 14 and 26 weeks.
  - **ANC 3:** Between 28 and 34 weeks.
  - **ANC 4:** Between 36 weeks and delivery.
- **Clinical Checkup Parameters:**
  - Gestational age in weeks.
  - Weight (kg) and Weight Gain trajectory.
  - Blood Pressure (Systolic & Diastolic in mmHg): **Alert triggered if Systolic $\ge 140$ or Diastolic $\ge 90$ mmHg** (Gestational Hypertension / Preeclampsia).
  - Hemoglobin (Hb in g/dL):
    - $\ge 11.0\text{ g/dL}$: Normal (Routine 180 IFA red tablets).
    - $9.0 - 10.9\text{ g/dL}$: Mild Anemia (Therapeutic 360 IFA tablets).
    - $7.0 - 8.9\text{ g/dL}$: Moderate Anemia (Close tracking, nutritional intervention).
    - $< 7.0\text{ g/dL}$: **Severe Anemia (High-Risk alert & urgent FRU referral)**.
  - Urine Albumin & Sugar (Nil, Trace, 1+, 2+, 3+, 4+).
  - Fundal Height (cm) & Foetal Heart Rate (FHR in bpm, normal: 120–160 bpm).
  - Foetal Movements Present (Yes/No).
  - Abdominal Scan (Ultrasound) completed.
- **Prophylaxis & Immunization (Annexure 2):**
  - **Tetanus & Diphtheria (Td):**
    - `Td-1`: Early in pregnancy (0.5 ml, IM, Upper Arm).
    - `Td-2`: 4 weeks after Td-1.
    - `Td-Booster`: If 2 Td doses were administered in a pregnancy within the last 3 years.
  - **Supplements:**
    - Folic Acid (5 mg/day) up to 12 weeks.
    - Iron Folic Acid (IFA red tablets - 100 mg elemental iron + 500 mcg folic acid): minimum 180 tablets post-12 weeks.
    - Calcium (500 mg with Vitamin D3): 360 tablets (2 tablets/day from 14 weeks onwards).
    - Albendazole (400 mg single dose): administered in 2nd trimester for deworming.
- **High-Risk Flags (HRP):**
  - Severe anemia ($\text{Hb} < 7\text{ g/dL}$), Severe PIH/Preeclampsia, Gestational Diabetes (GDM), Previous Caesarean section, Malpresentation (Breech/Transverse), Multiple gestation (twins), Teenage pregnancy ($<18\text{ yrs}$), Elderly primigravida ($>35\text{ yrs}$), History of stillbirth/recurrent abortions, Systemic disease (Cardiac, TB, HIV, Hepatitis B).

### 2.5 Delivery Outcome & Postnatal Care (Registers PW-3, PW-4 & HBNC)
- **Delivery Information:**
  - Date & Time of Delivery.
  - Place of Delivery: Home (Attended by SBA / Non-SBA), Sub-Centre, PHC, CHC, Sub-District Hospital, District Hospital, Private Accredited Hospital.
  - Delivery Type: Normal Vaginal, Assisted (Forceps/Vacuum), Caesarean Section (LSCS).
  - Delivery Complications: Postpartum Hemorrhage (PPH), Sepsis, Eclampsia, Retained Placenta.
  - Outcome: Live Birth, Still Birth (Fresh vs Macerated), Abortion (Spontaneous vs MTP).
- **Newborn Details at Birth:**
  - Gender (Male, Female, Transgender).
  - Birth Weight (kg): **Alert if $< 2.5\text{ kg}$ (Low Birth Weight - LBW), Critical if $< 1.8\text{ kg}$ (VLBW/SNCU admission)**.
  - Cried immediately at birth (Yes/No - Neonatal Resuscitation).
  - Breastfeeding initiated within 1 hour (Golden Hour).
  - Visible congenital malformations (Cleft lip/palate, Club foot, Neural tube defects - Annexure 1 Red Flags).
  - Birth Dose Vaccines administered within 24 hours: **BCG, OPV-0, Hepatitis B Birth Dose**.
- **Postnatal Visits (Mother & Infant):**
  - **Institutional Delivery:** Day 3, Day 7, Day 14, Day 21, Day 28, Day 42.
  - **Home Delivery:** Day 1 (within 24h), Day 3, Day 7, Day 14, Day 21, Day 28, Day 42.
  - HBNC (Home-Based Newborn Care) checks: Cord cleanliness, jaundice observation, temperature stability, exclusive breastfeeding, breathing rate (>60 breaths/min = fast breathing referral).

### 2.6 Child Immunization Schedule (National Immunization Schedule — Annexure 2)
The app must strictly enforce the following vaccine antigens, schedules, dosages, routes, and anatomic sites:

| Age Milestone | Antigens / Vaccines | Dosage | Route | Anatomic Site |
| :--- | :--- | :--- | :--- | :--- |
| **At Birth** | BCG | 0.1 ml (0.05 ml if <1 mo) | Intra-dermal | Left Upper Arm |
| | OPV-0 (Oral Polio) | 2 drops | Oral | Oral cavity |
| | Hepatitis B (Birth Dose) | 0.5 ml | Intra-muscular | Antero-lateral mid-thigh (Left) |
| **6 Weeks** | OPV-1 | 2 drops | Oral | Oral cavity |
| | Pentavalent-1 (DPT+HepB+Hib) | 0.5 ml | Intra-muscular | Antero-lateral mid-thigh (Left) |
| | Rotavirus-1 (Rotavac) | 5 drops / 2.5 ml | Oral | Oral cavity |
| | Fractional IPV-1 (fIPV) | 0.1 ml | Intra-dermal | Right Upper Arm |
| | PCV-1 (Pneumococcal) | 0.5 ml | Intra-muscular | Antero-lateral mid-thigh (Right) |
| **10 Weeks** | OPV-2 | 2 drops | Oral | Oral cavity |
| | Pentavalent-2 | 0.5 ml | Intra-muscular | Antero-lateral mid-thigh (Left) |
| | Rotavirus-2 | 5 drops / 2.5 ml | Oral | Oral cavity |
| **14 Weeks** | OPV-3 | 2 drops | Oral | Oral cavity |
| | Pentavalent-3 | 0.5 ml | Intra-muscular | Antero-lateral mid-thigh (Left) |
| | Rotavirus-3 | 5 drops / 2.5 ml | Oral | Oral cavity |
| | Fractional IPV-2 (fIPV) | 0.1 ml | Intra-dermal | Right Upper Arm |
| | PCV-2 | 0.5 ml | Intra-muscular | Antero-lateral mid-thigh (Right) |
| **9–12 Months** | MR-1 (Measles-Rubella) | 0.5 ml | Sub-cutaneous | Right Upper Arm |
| | JE-1 (Japanese Encephalitis)* | 0.5 ml | Sub-cutaneous | Left Upper Arm |
| | PCV Booster | 0.5 ml | Intra-muscular | Antero-lateral mid-thigh (Right) |
| | Vitamin A (1st Dose) | 1 ml (1 lakh IU) | Oral | Oral cavity |
| **16–24 Months** | MR-2 | 0.5 ml | Sub-cutaneous | Right Upper Arm |
| | JE-2* | 0.5 ml | Sub-cutaneous | Left Upper Arm |
| | DPT Booster-1 | 0.5 ml | Intra-muscular | Antero-lateral mid-thigh (Left) |
| | OPV Booster | 2 drops | Oral | Oral cavity |
| | Vitamin A (2nd Dose) | 2 ml (2 lakh IU) | Oral | Oral cavity |
| **Every 6 Mo to 5 Yr** | Vitamin A (Doses 3 to 9) | 2 ml (2 lakh IU) | Oral | Oral cavity (bi-annual) |
| **5–6 Years** | DPT Booster-2 | 0.5 ml | Intra-muscular | Upper Arm |
| **10 Years** | Td (Tetanus-Diphtheria) | 0.5 ml | Intra-muscular | Upper Arm |
| **16 Years** | Td (Tetanus-Diphtheria) | 0.5 ml | Intra-muscular | Upper Arm |

*\*Note: JE administered only in designated endemic districts.*

### 2.7 Child Health & Development Red Flags (Annexure 1)
Home-Based Young Child (HBYC) visits at 3, 6, 9, 12, and 15 months monitor developmental milestones:
- 3 Months: Unable to hold head steady; does not smile or respond to mother's voice.
- 6 Months: Cannot roll over; persistent fisting; does not reach for objects.
- 9 Months: Cannot sit without support; does not babble or respond to name.
- 12 Months: Cannot stand with support; no single words.
- Any Age: Lethargy, inability to feed, sunken eyes, chest indrawing, convulsions (Urgent Referral).

---

## 3. End-to-End Data Flow & Sync Architecture

To bridge the gap between frontline field reality and centralized government registries, AarogyaFlow implements an **Asynchronous Multi-Tier Handoff Architecture**.

```
┌───────────────────────────────────────────────────────────────────────────┐
│               OFFLINE LOCAL LEDGER (WatermelonDB / SQLite)                │
│            • Mutations committed locally in < 5ms                         │
│            • Mutation appended to append-only @asha_outbox                │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
                 ┌────────────────────┴────────────────────┐
                 │                                         │
                 ▼ (When ANM is in proximity)              ▼ (When Internet is available)
┌─────────────────────────────────────────┐   ┌─────────────────────────────────────────┐
│       PEER-TO-PEER P2P HANDSHAKE        │   │          CLOUD SYNC ENGINE              │
│ • Local Bluetooth LE / Offline QR Code  │   │ • HTTPS REST API with AWS Gateway       │
│ • ASHA transfers mobilized line-list to │   │ • Exponential backoff (1s, 2s, 4s, 8s)  │
│   ANM tablet directly at VHND session   │   │ • Idempotency key per outbox mutation   │
│ • Zero cellular internet required       │   │ • Soft-delete tombstone propagation     │
└─────────────────────────────────────────┘   └─────────────────────────────────────────┘
                                                           │
                                                           ▼
                                      ┌─────────────────────────────────────────┐
                                      │      GOVERNMENT ADAPTER SERVICE         │
                                      │ • ABDM M1/M2/M3 FHIR Bundles            │
                                      │ • RCH 2.0 Ingestion Pipeline            │
                                      │ • Poshan Tracker ABHA Demographics      │
                                      └─────────────────────────────────────────┘
```

### 3.1 Field-to-Session Handshake (The VHND Dynamic)
1. **Prior to Village Health Nutrition Day (VHND):**
   - ASHA conducts home visits, identifies eligible couples, detects early pregnancies, and identifies missed vaccine doses.
   - AarogyaFlow automatically generates the **VHND Due List** (ग्राम स्वास्थ्य दिवस कार्यसूची) on ASHA’s phone.
2. **On VHND Morning:**
   - ASHA mobilizes mothers and children to the Anganwadi / Sub-centre site.
   - In offline zones, ASHA taps **"Export VHND Session QR"** or pairs via **Bluetooth LE** with the ANM’s AarogyaFlow tablet.
   - The ANM’s app ingests the mobilized beneficiary list instantly without manual data re-entry.
3. **During the Clinical Session:**
   - The ANM performs clinical examinations (BP, Hb, Td, vaccines) and records batch numbers and diluent details (Annexure 3, Format 1).
   - Records are digitally signed by the ANM.
4. **Post-Session Reconciliation:**
   - As soon as the device connects to mobile data or Wi-Fi at the PHC, all validated session entries are synchronized to the central cloud backend and submitted to the Government RCH 2.0 API gateway.

---

## 4. UI & UX System: Frontline Visual Abstract Design

AarogyaFlow strictly follows the **Visual Abstract UI** philosophy (`visual-abstract-ui` skill) to eliminate cognitive overload and AI-slop:

### 4.1 Core UX Tenets
1. **The 3-Word Ceiling:**
   - Frontline buttons and micro-copy must never exceed three words in Hindi or Marathi.
   - *Bad:* "कृपया लाभार्थी का नया पंजीकरण करने के लिए यहाँ क्लिक करें"
   - *Good:* "नया पंजीकरण" (नवीन नोंदणी)
2. **Visual-First Affordance:**
   - Every primary clinical or administrative concept has an unmistakable, high-contrast icon (Lucide or Material Symbols).
   - High-Risk is marked with a persistent bold crimson beacon (`#DC2626`) and an alert triangle.
   - Up-to-date is marked with an emerald checkmark (`#059669`).
   - Upcoming service is marked with an amber clock (`#D97706`).
3. **Tactile Finger-Friendly Touch Targets:**
   - Minimum button touch target: **48x48 dp** (comfortably tappable while walking on village trails).
   - Number pickers and date dials replace tiny text inputs.
4. **Color-Coded Village Heatmap (गाँव स्वास्थ्य मानचित्र):**
   - Each household in the ASHA's ward is displayed as a tactile card or grid block with explicit color coding:
     - 🔴 **Red (उच्च जोखिम):** Severe anemia, uncontrolled BP, severe malnutrition (SAM), overdue vaccine $>30$ days.
     - 🟠 **Orange (आसन्न सेवा):** Delivery expected within 7 days, vaccine due within 48 hours, missed visit.
     - 🟡 **Yellow (नियमित अनुसूची):** Standard scheduled ANC/PNC or growth monitoring visit.
     - 🟢 **Green (सुरक्षित / पूर्ण):** All checkups and immunizations up to date.

### 4.2 Interactive Daily Work Plan (दैनिक कार्यसूची)
Instead of forcing the worker to browse through thousands of rows in a register, the app generates a smart prioritized daily route every morning:
- **Morning Briefing:**
  - "आज 4 घर जाने हैं: 1 प्रसव पूर्व जांच, 2 शिशु टीका, 1 जोखिम फॉलो-अप"
  - ("आज 4 घरांना भेट द्यायची आहे: 1 प्रसूतीपूर्व तपासणी, 2 बाल लसीकरण, 1 जोखीम पाठपुरावा")
- Tap to navigate with GPS or offline village landmark bearings.
- Quick-action swipe to complete, postpone, or record absent/migrated status.

### 4.3 Multilingual & Voice Dictation Engine
- **Strict Bilingual Isolation:**
  - AarogyaFlow strictly supports **100% Devanagari Hindi (`hi`)** and **100% Marathi (`mr`)**.
  - No half-translated English strings or fallback leaking into production UI.
- **Hands-Free Rural Voice Input:**
  - Mic button on every form field allows spoken recording in local accents:
    - *ASHA speaks:* "हीमोग्लोबिन नौ दशमलव पांच" ➔ Field automatically populates `9.5`.
    - *ASHA speaks:* "वजन बावन किलो" ➔ Field automatically populates `52`.
  - Built-in text-to-speech reads back critical warning indicators in clear Hindi/Marathi.

---

## 5. Role Demarcation & Granular Access Control Matrix

The fundamental operational distinction between an **ASHA (Accredited Social Health Activist)** and an **ANM (Auxiliary Nurse Midwife)** is the boundary between **Community Mobilization** and **Clinical Service Delivery**. The **CHO (Community Health Officer)** provides diagnostic oversight and referral approval.

| Feature / Domain | ASHA (आशा कार्यकर्ता) | ANM (ए.एन.एम. - उपकेंद्र) | CHO (सी.एच.ओ. - आरोग्य मंदिर) |
| :--- | :--- | :--- | :--- |
| **Role Concept** | Community Mobilizer & Scout | Clinical Midwife & Validator | Clinical Team Lead & Primary Care |
| **Eligible Couple Survey** | Full Entry (Door-to-door line listing) | Reviews & Validates Catchment Totals | Views Epidemiological Summaries |
| **ANC Registration** | Identifies pregnancy, calculates LMP/EDD | Validates & Generates Official RCH ID | Reviews high-risk registrations |
| **Clinical ANC Checks (BP, Hb)** | Cannot enter official clinical diagnostics; can note symptoms | **Full Entry** (Measures & inputs BP, Hb, urine tests, fundal height) | Reviews abnormal lab values & orders treatment |
| **Medicines & Logistics** | Distributes condoms, OCPs, basic IFA | Disburses Calcium, IFA, Albendazole, Antara injectable | Prescribes specialized pharmacotherapy |
| **Vaccine Administration** | Prepares mobilization due-list; assists at session | **Sole Authority** to record vaccine dose, batch no., and route | Monitors AEFI (Adverse Events) reports |
| **High-Risk Case Flagging** | Flags danger signs observed in home visit | Confirms clinical HRP diagnosis; initiates referral | Validates Clinical Diagnosis & Escalates Referral |
| **Delivery Outcome** | Records notification of birth & delivery place | Enters detailed obstetric delivery register | Audits maternal/infant death autopsies |
| **HBNC / HBYC Visits** | Conducts home visits at Days 1, 3, 7, 14, 21, 28, 42 | Inspects non-healing cord / complications | Manages sick newborn referrals to SNCU |
| **Incentive Claims** | **Claims monthly NHM incentives** (Format Section C) | Verifies & signs off ASHA activity claims | Approves final incentive disbursement list |
| **RCH Portal Sync** | Pushes to Sub-Centre queue | Approves & commits records to official RCH/ANMOL | Monitors block-level performance KPIs |

---

## 6. Bilingual Terminology Standardization (Hindi & Marathi)

Every data entity and clinical term must map to official Government of India Devanagari terminology:

| English Technical Term | Hindi Official Term (हिन्दी) | Marathi Official Term (मराठी) |
| :--- | :--- | :--- |
| **Eligible Couple** | योग्य दंपति (Yogya Dampati) | पात्र दांपत्य (Paatra Daampatya) |
| **Pregnant Woman** | गर्भवती महिला (Garbhavati Mahila) | गरोदर महिला (Garodar Mahila) |
| **Last Menstrual Period (LMP)** | अंतिम मासिक धर्म तिथि (LMP) | शेवटची मासिक पाळीची तारीख (LMP) |
| **Expected Date of Delivery (EDD)** | संभावित प्रसव तिथि (EDD) | संभाव्य प्रसूतीची तारीख (EDD) |
| **Antenatal Care (ANC)** | प्रसव पूर्व जांच (ANC) | प्रसूतीपूर्व तपासणी (ANC) |
| **Postnatal Care (PNC)** | प्रसवोत्तर जांच (PNC) | प्रसूतीनंतरची तपासणी (PNC) |
| **High-Risk Pregnancy (HRP)** | उच्च जोखिम गर्भावस्था | उच्च जोखमीची गर्भधारणा |
| **Immunization** | टीकाकरण (Teekakaran) | लसीकरण (Laseekaran) |
| **Village Health Nutrition Day (VHND)** | ग्राम स्वास्थ्य एवं पोषण दिवस | ग्राम आरोग्य व पोषण दिन |
| **Severe Anemia** | गंभीर रक्ताल्पता (एनीमिया) | तीव्र रक्तक्षय (अ‍ॅनिमिया) |
| **Blood Pressure** | रक्तचाप (बी.पी.) | रक्तदाब (बी.पी.) |
| **Low Birth Weight (LBW)** | जन्म के समय कम वजन | जन्माच्या वेळचे कमी वजन |
| **Institutional Delivery** | संस्थागत प्रसव | संस्थात्मक प्रसूती |
| **Home Visit (HBNC)** | गृह भेंट (नवजात शिशु देखभाल) | गृहभेट (नवजात बालकाची काळजी) |
| **Incentive Claim** | प्रोत्साहन राशि दावा (इंसेंटिव) | प्रोत्साहन निधी दावा (इन्सेंटिव्ह) |
| **Sub-Centre** | उप-स्वास्थ्य केंद्र | उपकेंद्र |
| **Health & Wellness Centre** | आयुष्मान आरोग्य मंदिर | आयुष्यमान आरोग्य मंदिर |
| **Due List** | देय सूची (ड्यू लिस्ट) | देय यादी (ड्यु लिस्ट) |
| **Tombstone / Closed Case** | बंद मामला | बंद प्रकरण |

---

## 7. Concrete Codebase Roadmap for AarogyaFlow

To bring the current codebase (`asha-app` and `hospital-spring-boot`) into 100% compliance with this specification, execute the following technical changes:

### Phase 1: Storage & Schema Alignment
1. **Database Migration (`V4__rch_anmol_fields.sql`):**
   - Extend `patients` and `members` tables with:
     - `rch_id VARCHAR(12)`
     - `abha_number VARCHAR(17)`
     - `lmp_date DATE`
     - `edd_date DATE`
     - `is_high_risk BOOLEAN DEFAULT FALSE`
     - `high_risk_reason TEXT`
     - `blood_group VARCHAR(5)`
     - `parity INT`, `gravida INT`
   - Create `rch_anc_visits` table capturing BP, Hb, urine albumin, fundal height, and IFA count.
   - Create `rch_immunization_ledger` table capturing all 24 antigens, batch numbers, and administering ANM ID.
2. **Frontend Offline Entity Typing:**
   - Update `asha-app/src/types/index.ts` to strictly mirror `EligibleCoupleRecord`, `AncVisitRecord`, and `ChildImmunizationRecord`.

### Phase 2: Role Separation & UI Abstract Redesign
1. **Dynamic Navigation by Role:**
   - When role is `ASHA`: Show Home Grid, Daily Work Plan (दैनिक कार्यसूची), Household Survey, Mobilization Due-List, Incentive Tracker.
   - When role is `ANM`: Show Clinical ANC Entry, Vaccine Administration Desk, VHND Session Reconciliation, Logistics Supply Ledger.
   - When role is `CHO`: Show High-Risk Triage, Referral Review & Advice, HWC Performance Dashboard.
2. **Implement Tactile Heatmap Component:**
   - Build `VillageHeatMap.tsx` adhering to the 4-color health status system with zero cognitive clutter.

### Phase 3: P2P & Government Sync Protocols
1. **Offline QR / Bluetooth Handshake:**
   - Implement `VhndHandshakeScreen.tsx` allowing ASHA to generate a dense, compressed JSON QR payload (deflated with zlib) containing her village's VHND due-list.
   - The ANM's camera scans the QR in 500ms to import the session without network connectivity.
2. **ABDM Milestone M1/M2/M3 Compliance:**
   - Integrate ABDM Demographics Auth endpoints into `AuthService.ts` and `OfflineStorageService.ts`.

---
*Authored as the authoritative architectural baseline for AarogyaFlow (`com.jansamvaad.aarogyaflow`).*
