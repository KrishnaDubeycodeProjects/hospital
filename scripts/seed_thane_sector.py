#!/usr/bin/env python3
"""
Seed a clean, fully connected demo sector in Thane district for evaluators.

    CHO  Dr. Snehal Patil ............................ 9820100001  (Bhiwandi Block, PHC Padgha)
     ├─ ANM Sushma Pawar (Sub-centre Anjur) ........... 9820100011
     │    ├─ ASHA Manisha Gharat  (Anjur)  ............ 9820100021
     │    ├─ ASHA Rupali Patil    (Kalher) ............ 9820100022
     │    └─ ASHA Sangita Bhoir   (Purna)  ............ 9820100023
     └─ ANM Vaishali Mhatre (Sub-centre Padgha) ....... 9820100012
          ├─ ASHA Jyoti Shelar    (Padgha) ............ 9820100024
          └─ ASHA Lata Wagh       (Khoni)  ............ 9820100025

    Hospital side (existing hospitals, new doctors):
      CSMH Kalwa (Government, referral hospital for the sector)
        Dr. Prashant Kulkarni  General Medicine ....... +919820300001
        Dr. Aparna Deshmukh    Obstetrics & Gynae ..... +919820300002
        Dr. Nikhil Joshi       Paediatrics ............ +919820300003
        Dr. Swati Naik         General Surgery ........ +919820300004
        Dr. Imran Shaikh       Orthopaedics ........... +919820300005
      Jupiter Hospital Thane (Private, tertiary cardiology)
        Dr. Harshad Vartak     Cardiology ............. +919820300006

Clinical journeys wired end to end (ASHA survey → CHO-validated referral → hospital token →
care course with visits / prescriptions / tests / documents → hospital referral → ASHA follow-up):
  • High-risk pregnancy, moderate anaemia (IV iron)          Manisha → CSMH OBG
  • Uncontrolled hypertension + T2DM → cardiology referral    Rupali  → CSMH GM → Jupiter
  • Child pneumonia, treated and closed                       Rupali  → CSMH Paediatrics
  • Pulmonary TB on DOTS with ASHA adherence visits           Sangita → CSMH GM
  • Diabetic foot referral that expired → REFERRAL_MISSED     Jyoti   → CSMH GM → Surgery
  • Routine ANC with anomaly scan                             Jyoti   → CSMH OBG
  • Knee osteoarthritis                                       Jyoti   → CSMH Ortho
  • Pending referrals waiting in the CHO queue                Sangita, Lata

Every login uses OTP 123456 (evaluation bypass in OtpService).

Rows are tagged so they can be removed cleanly:
  family_units / family_members.client_uuid LIKE 'seed-thane-%'
  survey_responses / follow_up_tasks.offline_id LIKE 'SEED-THANE-%'
  everything else is found through those members / the phone numbers above.
Hospital-side rows are inserted with eka_sync_status = 'SKIPPED' so the ABDM reconciler never
pushes demo records to Eka Care.

Usage (repo root, reads DB_* from .env):
  python scripts/seed_thane_sector.py            # dry run: insert, print summary, roll back
  python scripts/seed_thane_sector.py --commit   # insert for real
  python scripts/seed_thane_sector.py --purge --commit   # remove everything this script added
"""
import argparse
import json
import random
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

import psycopg2

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

TAG = "seed-thane"
OTAG = "SEED-THANE"
NOW = datetime.now().replace(microsecond=0)
TODAY = date.today()

# ----------------------------------------------------------------- people

CHO = ("9820100001", "Dr. Snehal Patil (CHO)", "Bhiwandi Block", "Thane")
ANMS = [
    # phone, name, sub-centre, qr
    ("9820100011", "Sushma Pawar (ANM)", "Sub-centre Anjur", "ANM-QR-9820100011"),
    ("9820100012", "Vaishali Mhatre (ANM)", "Sub-centre Padgha", "ANM-QR-9820100012"),
]
# phone, name, village, anm phone, activity level 0..1
ASHAS = [
    ("9820100021", "Manisha Gharat", "Anjur", "9820100011", 0.92),
    ("9820100022", "Rupali Patil", "Kalher", "9820100011", 0.78),
    ("9820100023", "Sangita Bhoir", "Purna", "9820100011", 0.55),
    ("9820100024", "Jyoti Shelar", "Padgha", "9820100012", 0.85),
    ("9820100025", "Lata Wagh", "Khoni", "9820100012", 0.28),
]
DOCTORS = {
    # key: phone, name, hospital slug, department (must match hospital_departments.category), counter, HPR
    "gm": ("+919820300001", "Dr. Prashant Kulkarni", "csmh-hospital-kalwa", "General Medicine / Internal Medicine", 1, "71-4410-2231-0001"),
    "obg": ("+919820300002", "Dr. Aparna Deshmukh", "csmh-hospital-kalwa", "Obstetrics & Gynaecology", 2, "71-4410-2231-0002"),
    "paed": ("+919820300003", "Dr. Nikhil Joshi", "csmh-hospital-kalwa", "Paediatrics", 3, "71-4410-2231-0003"),
    "surg": ("+919820300004", "Dr. Swati Naik", "csmh-hospital-kalwa", "General Surgery", 4, "71-4410-2231-0004"),
    "ortho": ("+919820300005", "Dr. Imran Shaikh", "csmh-hospital-kalwa", "Orthopaedics", 5, "71-4410-2231-0005"),
    "cardio": ("+919820300006", "Dr. Harshad Vartak", "jupiter-hospital-thane", "Cardiology", 1, "71-4410-2231-0006"),
}
DEPT_CODE = {
    "General Medicine / Internal Medicine": "GM",
    "Obstetrics & Gynaecology": "OG",
    "Paediatrics": "PA",
    "General Surgery": "GS",
    "Orthopaedics": "OR",
    "Cardiology": "CA",
}

SURNAMES = ["Patil", "Gharat", "Bhoir", "Mhatre", "Pawar", "Shelar", "Wagh", "Jadhav", "More", "Kene",
            "Thakare", "Bhoye", "Dhumal", "Gaikwad", "Mali", "Raut", "Bhagat", "Sapre"]
MALE = ["Santosh", "Ganesh", "Dilip", "Ramesh", "Vinod", "Sunil", "Prakash", "Anil", "Dattatray",
        "Balu", "Namdev", "Vitthal", "Kailas", "Sachin", "Rahul", "Mahesh", "Tukaram"]
FEMALE = ["Sunita", "Manda", "Rekha", "Kavita", "Sarika", "Pooja", "Ashwini", "Priyanka", "Vandana",
          "Shobha", "Sangita", "Jayshree", "Rupali", "Archana", "Sonal", "Vaishali"]
KIDS_M = ["Om", "Sai", "Atharva", "Soham", "Pranav", "Aarav", "Vedant", "Shlok"]
KIDS_F = ["Arya", "Shravani", "Vedika", "Tanvi", "Swara", "Gauri", "Mrunal", "Isha"]
NCDS = ["Hypertension", "Diabetes", "Hypertension"]


# ------------------------------------------------------------- utilities

def load_env():
    env = {}
    for line in Path(".env").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k] = v.strip().strip('"')
    return env


def ago(days, hour=None, minute=None, rnd=None):
    rnd = rnd or random
    d = NOW - timedelta(days=days)
    d = d.replace(hour=hour if hour is not None else rnd.randint(9, 16),
                  minute=minute if minute is not None else rnd.randint(0, 59), second=0)
    return min(d, NOW - timedelta(minutes=30))


def abha(rnd):
    return "91-" + "-".join(f"{rnd.randint(1000, 9999)}" for _ in range(3))


def make_pdf(title, subtitle, lines):
    """Tiny single-page PDF (Helvetica) so the document viewer opens a real file."""
    def esc(s):
        return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    ops = ["BT", "/F1 16 Tf", "50 790 Td", f"({esc(title)}) Tj", "/F1 10 Tf", "0 -18 Td", f"({esc(subtitle)}) Tj",
           "0 -10 Td"]
    for ln in lines:
        ops += ["0 -16 Td", f"({esc(ln)}) Tj"]
    ops += ["0 -30 Td", "/F1 8 Tf", "(Demo record - AarogyaFlow evaluation dataset) Tj", "ET"]
    stream = "\n".join(ops).encode("latin-1", "replace")
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return bytes(out)


class Seeder:
    def __init__(self, cur):
        self.cur = cur
        self.stats = {}
        self.tpl = {}
        self.hosp = {}
        self.doc = {}        # key -> (id, hospital_id, dept, counter)
        self.daily = {}      # (hospital, dept, date) -> next number
        self.n_task = 0
        self.n_survey = 0

    def bump(self, k, n=1):
        self.stats[k] = self.stats.get(k, 0) + n

    def one(self, sql, args=None):
        self.cur.execute(sql, args)
        return self.cur.fetchone()

    # ------------------------------------------------------- workforce

    def workforce(self):
        cur = self.cur
        phone, name, block, district = CHO
        cur.execute("INSERT INTO cho_officers (phone, name, block_name, district_name, is_active) "
                    "VALUES (%s,%s,%s,%s,TRUE) ON CONFLICT (phone) DO UPDATE SET name=EXCLUDED.name, "
                    "block_name=EXCLUDED.block_name, district_name=EXCLUDED.district_name, is_active=TRUE",
                    (phone, name, block, district))
        self.bump("CHO")
        for aphone, aname, centre, qr in ANMS:
            cur.execute("INSERT INTO asha_workers (phone, name, village_name, block_name, district_name, anm_phone, role, "
                        "preferred_language, is_active) VALUES (%s,%s,%s,%s,%s,%s,'ANM','mr',TRUE) "
                        "ON CONFLICT (phone) DO UPDATE SET name=EXCLUDED.name, village_name=EXCLUDED.village_name, "
                        "block_name=EXCLUDED.block_name, district_name=EXCLUDED.district_name, anm_phone=EXCLUDED.anm_phone, "
                        "role='ANM', preferred_language='mr', is_active=TRUE",
                        (aphone, aname, centre, block, district, CHO[0]))
            cur.execute("INSERT INTO anm_profiles (phone, name, phc_name, qr_code_data) VALUES (%s,%s,%s,%s) "
                        "ON CONFLICT (phone) DO UPDATE SET name=EXCLUDED.name, phc_name=EXCLUDED.phc_name, "
                        "qr_code_data=EXCLUDED.qr_code_data", (aphone, aname, f"{centre} (PHC Padgha)", qr))
            self.bump("ANM")
        for sphone, sname, village, anm, _ in ASHAS:
            cur.execute("INSERT INTO asha_workers (phone, name, village_name, block_name, district_name, anm_phone, role, "
                        "preferred_language, is_active, created_at) VALUES (%s,%s,%s,%s,%s,%s,'ASHA','mr',TRUE,%s) "
                        "ON CONFLICT (phone) DO UPDATE SET name=EXCLUDED.name, village_name=EXCLUDED.village_name, "
                        "block_name=EXCLUDED.block_name, district_name=EXCLUDED.district_name, anm_phone=EXCLUDED.anm_phone, "
                        "role='ASHA', preferred_language='mr', is_active=TRUE",
                        (sphone, sname, village, block, district, anm, ago(200, 10, 0)))
            self.bump("ASHA")

    def hospitals_and_doctors(self):
        cur = self.cur
        cur.execute("SELECT category_code, id FROM survey_templates WHERE is_active = TRUE")
        self.tpl = dict(cur.fetchall())
        for key, (phone, name, slug, dept, counter, hpr) in DOCTORS.items():
            if slug not in self.hosp:
                row = self.one("SELECT id, name FROM hospitals WHERE uri_slug = %s", (slug,))
                if not row:
                    raise SystemExit(f"hospital {slug} not found")
                self.hosp[slug] = row
            hid = self.hosp[slug][0]
            ok = self.one("SELECT 1 FROM hospital_departments WHERE hospital_id=%s AND category=%s", (hid, dept))
            if not ok:
                raise SystemExit(f"department {dept} missing at {slug}")
            row = self.one("INSERT INTO doctors (phone, name, hospital_id, counter_id, category, hpr_id, created_at, updated_at) "
                           "VALUES (%s,%s,%s,%s,%s,%s,%s,NOW()) ON CONFLICT (phone) DO UPDATE SET name=EXCLUDED.name, "
                           "hospital_id=EXCLUDED.hospital_id, counter_id=EXCLUDED.counter_id, category=EXCLUDED.category, "
                           "hpr_id=EXCLUDED.hpr_id, updated_at=NOW() RETURNING id",
                           (phone, name, hid, counter, dept, hpr, ago(240, 9, 0)))
            self.doc[key] = (row[0], hid, dept, counter, name)
            self.bump("Doctors")

    # --------------------------------------------------------- families

    def family(self, asha, idx, head, phone, house, members, last_visit_days, interval=30):
        rnd = random.Random(f"{asha}-{idx}")
        village = next(a[2] for a in ASHAS if a[0] == asha)
        last_visit = ago(last_visit_days, rnd=rnd)
        fid = self.one(
            "INSERT INTO family_units (primary_phone, head_name, village_name, house_number, sequential_number, "
            "visit_interval_days, next_visit_date, asha_worker_phone, last_visited_at, is_deleted, client_uuid, created_at) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,FALSE,%s,%s) RETURNING id",
            (phone, head, village, house, idx + 1, interval, (last_visit + timedelta(days=interval)).date(), asha,
             last_visit, f"{TAG}-{asha}-f{idx}", ago(150 + idx, rnd=rnd)))[0]
        self.bump("Families")
        ids = {}
        for mi, m in enumerate(members):
            dob = date(TODAY.year - m["age"], rnd.randint(1, 12), rnd.randint(1, 28)) if m["age"] > 0 else \
                TODAY - timedelta(days=m.get("days", 270))
            first = m["name"].split()[0].lower()
            mid = self.one(
                "INSERT INTO family_members (family_unit_id, name, dob, age, gender, relationship, phone, abha_number, "
                "abha_address, is_abha_linked, is_pregnant, expected_delivery_date, has_chronic_condition, "
                "chronic_condition_type, last_survey_date, follow_up_due_date, follow_up_reason, is_deleted, client_uuid, created_at) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,FALSE,%s,%s) RETURNING id",
                (fid, m["name"], dob, m["age"], m["gender"], m["rel"], phone,
                 abha(rnd) if m["age"] >= 1 else None,
                 f"{first}.{m['name'].split()[-1].lower()}{rnd.randint(10, 99)}@abdm" if m["age"] >= 18 else None,
                 m["age"] >= 1, bool(m.get("edd")), m.get("edd"), bool(m.get("ncd")), m.get("ncd"),
                 last_visit if m.get("tracked") else None,
                 m.get("fu_date"), m.get("fu_reason"),
                 f"{TAG}-{asha}-f{idx}-m{mi}", ago(150 + idx, rnd=rnd)))[0]
            ids[m.get("key", f"m{mi}")] = mid
            self.bump("Members")
        return fid, ids

    def survey(self, asha, fid, mid, cat, answers, when, synced=True):
        anm = next(a[3] for a in ASHAS if a[0] == asha)
        answers = {**answers, "recordedAt": when.isoformat()}
        self.n_survey += 1
        self.cur.execute(
            "INSERT INTO survey_responses (family_unit_id, family_member_id, template_id, category_code, asha_worker_phone, "
            "answers, synced_to_anm, target_anm_phone, synced_at, offline_id, created_at) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (fid, mid, self.tpl[cat], cat, asha, json.dumps(answers, ensure_ascii=False), synced, anm,
             when + timedelta(hours=3) if synced else None, f"{OTAG}-S-{self.n_survey:04d}", when))
        self.bump("Surveys")

    def task(self, asha, fid, mid, ttype, title, desc, due, status="PENDING", created=None, completed=None,
             cho_at=None, cho_note=None, source_referral=None):
        self.n_task += 1
        row = self.one(
            "INSERT INTO follow_up_tasks (family_unit_id, family_member_id, asha_worker_phone, task_type, title, description, "
            "due_date, status, source_referral_id, completed_at, offline_id, created_at, cho_approved_by, cho_approved_at, cho_note) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            (fid, mid, asha, ttype, title, desc, due, status, source_referral, completed, f"{OTAG}-T-{self.n_task:04d}",
             created or NOW - timedelta(days=2), CHO[0] if cho_at else None, cho_at, cho_note))
        self.bump("Tasks")
        return row[0]

    # ------------------------------------------------------ hospital side

    def token(self, phone, name, age, gender, doc_key, visit, mid, course_id, referral_id=None):
        did, hid, dept, counter, _ = self.doc[doc_key]
        k = (hid, dept, visit.date())
        self.daily[k] = self.daily.get(k, random.Random(str(k)).randint(4, 11)) + 1
        n = self.daily[k]
        created = visit - timedelta(minutes=45)
        self.cur.execute(
            "INSERT INTO tokens (phone, name, age, gender, category, status, session_step, created_at, served_at, completed_at, "
            "is_verified, verified_at, hospital_id, counter_id, daily_number, family_member_id, course_id, referral_id, "
            "token_code, no_show_count, search_offset) "
            "VALUES (%s,%s,%s,%s,%s,'completed','confirmed',%s,%s,%s,TRUE,%s,%s,%s,%s,%s,%s,%s,%s,0,0)",
            ("+91" + phone, name, age, gender, dept, created, visit, visit + timedelta(minutes=14), created + timedelta(minutes=2),
             hid, counter, n, mid, course_id, referral_id, f"AF-{DEPT_CODE[dept]}{n:02d}"))
        self.bump("Tokens")

    def course(self, phone, name, mid, doc_key, ctype, title, dx, icd, summary, created, status="active", closed=None):
        did, hid, *_ = self.doc[doc_key]
        cid = self.one(
            "INSERT INTO courses (patient_phone, patient_name, family_member_id, course_type, title, diagnosis, icd10_code, status, "
            "started_by_doctor_id, started_at_hospital_id, current_summary, created_at, updated_at, closed_at) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            ("+91" + phone, name, mid, ctype, title, dx, icd, status, did, hid, summary, created, closed or created, closed))[0]
        self.bump("Courses")
        return cid

    def encounter(self, cid, doc_key, visit, complaint, notes, exam, plan, rx=(), docs=()):
        did, hid, *_ = self.doc[doc_key]
        eid = self.one(
            "INSERT INTO course_encounters (course_id, doctor_id, hospital_id, visit_date, chief_complaint, clinical_notes, "
            "examination_findings, plan, created_at, eka_sync_status) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,'SKIPPED') RETURNING id",
            (cid, did, hid, visit, complaint, notes, exam, plan, visit))[0]
        self.bump("Encounters")
        for med, dose, freq, days, route, instr, nlem in rx:
            self.cur.execute(
                "INSERT INTO course_prescriptions (course_id, encounter_id, doctor_id, medicine_name, dosage, frequency, "
                "duration_days, route, instructions, is_nlem, created_at, eka_sync_status) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'SKIPPED')",
                (cid, eid, did, med, dose, freq, days, route, instr, nlem, visit))
            self.bump("Prescriptions")
        for dtype, fname, title, lines, note in docs:
            pdf = make_pdf(title, f"{self.doc[doc_key][4]}  |  {visit:%d %b %Y}", lines)
            self.cur.execute(
                "INSERT INTO course_documents (course_id, encounter_id, doc_type, file_name, content_type, file_size, file_data, "
                "uploaded_by_doctor_id, notes, created_at, eka_sync_status) VALUES (%s,%s,%s,%s,'application/pdf',%s,%s,%s,%s,%s,'SKIPPED')",
                (cid, eid, dtype, fname, len(pdf), psycopg2.Binary(pdf), did, note, visit + timedelta(minutes=20)))
            self.bump("Documents")
        self.cur.execute("UPDATE courses SET updated_at = GREATEST(updated_at, %s) WHERE id = %s", (visit, cid))
        return eid

    def patient_doc(self, phone, name, age, doc_key, dtype, fname, title, lines, when):
        did, hid, *_ = self.doc[doc_key]
        pdf = make_pdf(title, f"{self.hosp_name(hid)}  |  {when:%d %b %Y}", lines)
        self.cur.execute(
            "INSERT INTO patient_documents (patient_phone, patient_name, patient_age, doc_type, hospital_id, uploaded_by_doctor_id, "
            "file_name, content_type, file_size, file_data, created_at, eka_sync_status) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,'application/pdf',%s,%s,%s,'SKIPPED')",
            ("+91" + phone, name, age, dtype, hid, did, fname, len(pdf), psycopg2.Binary(pdf), when))
        self.bump("Patient documents")

    def hosp_name(self, hid):
        return next(n for i, n in self.hosp.values() if i == hid)

    def referral(self, cid, eid, from_key, to_key, reason, tier, created, valid_days, status, visited=None):
        fdid, fhid, *_ = self.doc[from_key]
        tdid, thid, tdept, *_ = self.doc[to_key]
        valid = (created + timedelta(days=valid_days)).date()
        rid = self.one(
            "INSERT INTO course_referrals (course_id, encounter_id, referring_doctor_id, from_hospital_id, to_hospital_id, "
            "target_department, referred_doctor_id, reason, priority_tier, valid_until, status, qr_payload, created_at, visited_at) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            (cid, eid, fdid, fhid, thid, tdept, tdid, reason, tier, valid, status, None, created, visited))[0]
        self.cur.execute("UPDATE course_referrals SET qr_payload = %s WHERE id = %s",
                         (json.dumps({"type": "AAROGYAFLOW_REFERRAL", "referralId": rid, "courseId": cid,
                                      "toHospitalId": thid, "department": tdept, "validUntil": str(valid)}), rid))
        self.bump("Hospital referrals")
        return rid, valid

    # ---------------------------------------------------------- journeys

    def journeys(self):
        M, R, S, J, L = (a[0] for a in ASHAS)
        csmh = "CSMH Kalwa"

        # 1. High-risk pregnancy, moderate anaemia — Manisha (Anjur)
        ph = "9820400101"
        fid, ids = self.family(M, 0, "Dilip Gharat", ph, "12", [
            {"name": "Dilip Gharat", "age": 58, "gender": "male", "rel": "Head", "ncd": "Hypertension", "tracked": True, "key": "dilip",
             "fu_date": TODAY + timedelta(days=9), "fu_reason": "NCD monthly BP check"},
            {"name": "Manda Gharat", "age": 52, "gender": "female", "rel": "Wife"},
            {"name": "Ganesh Gharat", "age": 29, "gender": "male", "rel": "Son"},
            {"name": "Priyanka Gharat", "age": 24, "gender": "female", "rel": "Daughter-in-law", "key": "priyanka", "tracked": True,
             "edd": TODAY + timedelta(days=80), "fu_date": TODAY + timedelta(days=3), "fu_reason": "HRP - IV iron 3rd dose & Hb recheck"},
        ], 3, interval=7)
        p = ids["priyanka"]
        lmp = TODAY - timedelta(days=200)
        for i, (d, hb, bp, anc) in enumerate([(62, "9.1", "110/72", "ANC 1"), (34, "8.4", "112/74", "ANC 2"), (3, "9.6", "114/76", "ANC 3")]):
            self.survey(M, fid, p, "PREGNANCY", {
                "memberName": "Priyanka Gharat", "isPregnant": "होय", "lmpDate": str(lmp), "eddDate": str(TODAY + timedelta(days=80)),
                "isFirstPregnancy": "होय", "ancVisit": anc, "ttGiven": "✓ दिली", "bp": bp, "weight": str(48 + i),
                "hemoglobin": hb, "urine": "सामान्य", "abdominalExam": "✓ केली", "ironTablets": "60", "calciumTablets": "60",
                "hasComplications": "होय", "complicationsList": ["Anaemia"],
                "serviceStatus": "रुग्णालय संदर्भ" if i == 1 else "✓ सेवा पूर्ण",
                "remarks": ["थकवा व चक्कर, IFA सुरू", "Hb 8.4 — रक्तक्षय, CHO मार्फत CSMH संदर्भ", "IV आयर्न 2 डोस झाले, थकवा कमी"][i],
            }, ago(d, rnd=random.Random(d)))
        self.task(M, fid, p, "ASHA_TO_CHO_REFERRAL", "उच्च जोखीम गर्भधारणा: Priyanka Gharat",
                  "Hb 8.4 g/dL (मध्यम रक्तक्षय), 23 आठवडे. CSMH स्त्रीरोग विभागात IV आयर्नसाठी संदर्भ.",
                  TODAY - timedelta(days=32), "APPROVED_CHO", created=ago(34), cho_at=ago(33, 11, 20),
                  cho_note="संदर्भ मंजूर — CSMH Kalwa OBG, 102 रुग्णवाहिका समन्वय केला")
        v1, v2 = ago(31, 10, 40), ago(10, 11, 5)
        cid = self.course(ph, "Priyanka Gharat", p, "obg", "antenatal", "High-risk Pregnancy - Moderate Anaemia",
                          "Moderate anaemia in pregnancy (2nd trimester)", "O99.012",
                          "G1P0 at 28 weeks. Hb improved 8.4 -> 9.6 g/dL after 2 doses IV iron sucrose. Third dose due.", v1)
        self.token(ph, "Priyanka Gharat", 24, "female", "obg", v1, p, cid)
        e1 = self.encounter(cid, "obg", v1, "Tiredness, breathlessness on climbing stairs, giddiness for 2 weeks. Referred by ASHA via CHO.",
            "G1P0, 23 weeks by LMP. BP 112/74 mmHg, Pulse 96 bpm, Weight 49 kg. Hb 8.4 g/dL (ASHA HB meter).\n"
            "Investigations Ordered: CBC with indices, Serum Ferritin, Obstetric USG (anomaly scan), Urine routine",
            "Pallor ++, no pedal oedema. Fundal height corresponds to 23 weeks. FHS 146/min regular.",
            "Moderate anaemia in pregnancy. Start IV iron sucrose 200 mg x 3 doses, one every 7-10 days.\n"
            "Continue calcium. Iron-rich diet (nachni, green leafy vegetables, jaggery).\n"
            "Investigations Ordered: CBC with indices, Serum Ferritin, Obstetric USG (anomaly scan)",
            rx=[("Iron Sucrose 200 mg IV", "200 mg in 100 ml NS", "Once in 7 days", 21, "IV", "Given in hospital day-care, 3 doses", True),
                ("Folic Acid 5 mg", "1 tablet", "OD (Once daily)", 30, "Oral", "After breakfast", True),
                ("Calcium Carbonate 500 mg + Vit D3", "1 tablet", "BD (Twice daily)", 30, "Oral", "After lunch and dinner, 2 hours apart from iron", True)],
            docs=[("lab_report", "CBC_Ferritin_Priyanka_Gharat.pdf", "Complete Blood Count + Serum Ferritin",
                   ["Patient: Priyanka Gharat, 24 F", "Haemoglobin: 8.4 g/dL  (ref 11.0 - 15.0)  LOW",
                    "MCV: 68 fL (ref 80 - 100)  LOW", "MCH: 21 pg (ref 27 - 32)  LOW", "Platelets: 2.4 lakh/cumm",
                    "Serum Ferritin: 9 ng/mL (ref 15 - 150)  LOW", "Impression: Microcytic hypochromic anaemia - iron deficiency"],
                   "CBC and ferritin before IV iron"),
                  ("scan", "Anomaly_Scan_USG_Priyanka_Gharat.pdf", "Obstetric USG - Anomaly Scan",
                   ["Single live intrauterine foetus, cephalic", "Gestational age: 23 weeks 2 days", "EFW: 590 g",
                    "Placenta: posterior, upper segment", "Liquor: adequate (AFI 13)", "No obvious structural anomaly seen"],
                   "Level II scan, CSMH radiology")])
        self.token(ph, "Priyanka Gharat", 24, "female", "obg", v2, p, cid)
        self.encounter(cid, "obg", v2, "Follow-up after 2 doses IV iron. Feels less tired.",
            "26 weeks. BP 114/76 mmHg, Pulse 84 bpm, Weight 50.5 kg. Repeat Hb 9.6 g/dL.\n"
            "Investigations Ordered: Repeat Hb after 3rd dose, OGTT 75 g",
            "Pallor +, FHS 142/min. No oedema.",
            "Responding to IV iron. 3rd dose of iron sucrose next week. Start oral IFA after IV course.\n"
            "ASHA to ensure follow-up visit and track Hb at home.",
            rx=[("Iron Sucrose 200 mg IV", "200 mg in 100 ml NS", "Single dose", 1, "IV", "3rd and final dose at day-care", True),
                ("Ferrous Sulphate 100 mg + Folic Acid 0.5 mg (IFA)", "1 tablet", "OD night", 90, "Oral", "Start after IV course, with lemon water, not with tea", True)])
        self.patient_doc(ph, "Priyanka Gharat", 24, "obg", "report", "Hb_Recheck_Priyanka_Gharat.pdf", "Haemoglobin Recheck",
                         ["Haemoglobin: 9.6 g/dL (previous 8.4 g/dL)", "Trend: improving after IV iron sucrose"], v2 + timedelta(hours=2))
        self.task(M, fid, p, "FOLLOW_UP", "IV आयर्न तिसरा डोस: Priyanka Gharat", "CSMH OBG day-care, 3rd dose iron sucrose. सोबत ANC कार्ड न्या.",
                  TODAY + timedelta(days=3), created=v2 + timedelta(hours=5))
        # Dilip — NCD monitoring, controlled on meds
        for d, s, di in [(58, 152, 94), (29, 142, 88), (3, 136, 84)]:
            self.survey(M, fid, ids["dilip"], "DISEASE", {"memberName": "Dilip Gharat", "chronicCondition": "Hypertension",
                        "bpSystolic": str(s), "bpDiastolic": str(di), "bp": f"{s}/{di}", "onRegularMedication": "होय",
                        "dietSaltReduced": "होय", "chestPainOrDizziness": "नाही", "remarks": "Amlodipine नियमित, मीठ कमी"},
                        ago(d, rnd=random.Random(d + 1)))
        self.task(M, fid, ids["dilip"], "NCD_FOLLOWUP", "BP तपासणी: Dilip Gharat", "मासिक BP तपासणी व Amlodipine पुरवठा तपासा.",
                  TODAY - timedelta(days=27), "COMPLETED", created=ago(40), completed=ago(29, 12, 10))
        self.task(M, fid, ids["dilip"], "NCD_FOLLOWUP", "BP तपासणी: Dilip Gharat", "मासिक BP तपासणी व Amlodipine पुरवठा तपासा.",
                  TODAY + timedelta(days=9), created=ago(3))

        # Infant immunisation — Manisha
        ph = "9820400102"
        fid, ids = self.family(M, 1, "Sachin Patil", ph, "27", [
            {"name": "Sachin Patil", "age": 31, "gender": "male", "rel": "Head"},
            {"name": "Ashwini Patil", "age": 27, "gender": "female", "rel": "Wife"},
            {"name": "Om Patil", "age": 0, "days": 290, "gender": "male", "rel": "Son", "key": "om", "tracked": True,
             "fu_date": TODAY + timedelta(days=4), "fu_reason": "MR-1 & Vitamin A at 9 months"},
        ], 6, interval=15)
        for d, w, vac in [(160, "5.9", "Pentavalent-3"), (100, "7.4", "IPV-2"), (6, "8.6", "Weight check")]:
            self.survey(M, fid, ids["om"], "CHILD", {"memberName": "Om Patil", "vaccineGiven": "✓ होय, लस दिली" if vac != "Weight check" else "✕ दिली नाही",
                        "childWeight": w, "childCondition": "पूर्णपणे निरोगी", "childStatus": "✓ लसीकरण पूर्ण",
                        "remarks": f"{vac}; स्तनपान व पूरक आहार सुरू"}, ago(d, rnd=random.Random(d + 7)))
        self.task(M, fid, ids["om"], "VACCINATION", "MR-1 लसीकरण: Om Patil", "9 महिने पूर्ण — VHND सत्रात MR-1 व Vitamin A.",
                  TODAY + timedelta(days=4), created=ago(6))

        # 2. Uncontrolled HTN + T2DM → CSMH GM → Jupiter cardiology — Rupali (Kalher)
        ph = "9820400201"
        fid, ids = self.family(R, 0, "Ramesh Bhoir", ph, "8", [
            {"name": "Ramesh Bhoir", "age": 56, "gender": "male", "rel": "Head", "key": "ramesh", "tracked": True,
             "ncd": "Hypertension, Type 2 Diabetes", "fu_date": TODAY + timedelta(days=5), "fu_reason": "Cardiology appointment at Jupiter"},
            {"name": "Sunita Bhoir", "age": 50, "gender": "female", "rel": "Wife"},
            {"name": "Rahul Bhoir", "age": 26, "gender": "male", "rel": "Son"},
        ], 2, interval=15)
        r = ids["ramesh"]
        for d, s, di, med in [(92, 172, 104, "नाही"), (60, 158, 96, "होय"), (30, 146, 90, "होय"), (2, 138, 86, "होय")]:
            self.survey(R, fid, r, "DISEASE", {"memberName": "Ramesh Bhoir", "chronicCondition": "Hypertension",
                        "bpSystolic": str(s), "bpDiastolic": str(di), "bp": f"{s}/{di}", "onRegularMedication": med,
                        "dietSaltReduced": "होय" if med == "होय" else "नाही",
                        "chestPainOrDizziness": "होय" if d in (92, 30) else "नाही",
                        "remarks": "छातीत अधूनमधून दुखणे, चालताना धाप" if d == 30 else "औषधे नियमित"}, ago(d, rnd=random.Random(d + 3)))
        self.task(R, fid, r, "ASHA_TO_CHO_REFERRAL", "अनियंत्रित BP: Ramesh Bhoir", "BP 172/104, औषधे घेत नाहीत, चक्कर. CSMH मेडिसिन OPD संदर्भ.",
                  TODAY - timedelta(days=89), "APPROVED_CHO", created=ago(92), cho_at=ago(91, 16, 5),
                  cho_note="मंजूर — CSMH General Medicine OPD, उपाशीपोटी साखर तपासणीसाठी सकाळी जा")
        v1, v2, v3 = ago(89, 10, 15), ago(50, 11, 30), ago(9, 10, 50)
        cid = self.course(ph, "Ramesh Bhoir", r, "gm", "hypertension", "Hypertension with Type 2 Diabetes - NCD Care",
                          "Essential hypertension with type 2 diabetes mellitus", "I10, E11.9",
                          "BP down from 172/104 to 146/90 on Telmisartan + Amlodipine. HbA1c 8.9%. Exertional chest discomfort - referred to cardiology.", v1)
        self.token(ph, "Ramesh Bhoir", 56, "male", "gm", v1, r, cid)
        self.encounter(cid, "gm", v1, "Headache and giddiness for 10 days. Not taking BP tablets for 2 months. Referred by ASHA.",
            "BP 172/104 mmHg, Pulse 88 bpm, SpO2 98%, Weight 78 kg. RBS 246 mg/dL.\n"
            "Investigations Ordered: HbA1c, Fasting & PP blood sugar, Lipid profile, Serum creatinine, Urine albumin, ECG",
            "Obese (BMI 29). CVS: S1 S2 normal. Fundus: grade I hypertensive changes. Feet: sensation intact.",
            "New T2DM, uncontrolled hypertension. Start Telmisartan + Amlodipine, Metformin.\n"
            "Salt below 5 g/day, 30 min walk daily, no tobacco. ASHA to check BP every 2 weeks.\n"
            "Investigations Ordered: HbA1c, Lipid profile, Serum creatinine, Urine albumin, ECG",
            rx=[("Telmisartan 40 mg", "1 tablet", "OD (Once daily)", 30, "Oral", "Morning, same time every day", True),
                ("Amlodipine 5 mg", "1 tablet", "OD (Once daily)", 30, "Oral", "Morning", True),
                ("Metformin 500 mg", "1 tablet", "BD (Twice daily)", 30, "Oral", "With breakfast and dinner", True)],
            docs=[("lab_report", "HbA1c_Lipid_Renal_Ramesh_Bhoir.pdf", "Diabetes & Cardiac Risk Panel",
                   ["Patient: Ramesh Bhoir, 56 M", "HbA1c: 9.4 %  HIGH", "Fasting glucose: 182 mg/dL  HIGH",
                    "Post-prandial glucose: 268 mg/dL  HIGH", "Total cholesterol: 232 mg/dL", "LDL: 158 mg/dL  HIGH",
                    "Triglycerides: 210 mg/dL  HIGH", "Serum creatinine: 1.0 mg/dL", "Urine albumin: trace"], "Baseline NCD panel"),
                  ("report", "ECG_Ramesh_Bhoir.pdf", "12-lead ECG",
                   ["Sinus rhythm, rate 86/min", "Left axis deviation", "LVH by voltage criteria", "No acute ST-T changes"],
                   "Baseline ECG")])
        self.token(ph, "Ramesh Bhoir", 56, "male", "gm", v2, r, cid)
        self.encounter(cid, "gm", v2, "Review after 1 month. Taking medicines regularly.",
            "BP 158/96 mmHg, Pulse 80 bpm, Weight 77 kg. FBS 148 mg/dL.\nInvestigations Ordered: Fasting blood sugar",
            "No pedal oedema. Chest clear.",
            "Improving. Increase Metformin. Add Atorvastatin for LDL 158.\nInvestigations Ordered: Fasting blood sugar",
            rx=[("Telmisartan 40 mg", "1 tablet", "OD (Once daily)", 30, "Oral", "Morning", True),
                ("Amlodipine 5 mg", "1 tablet", "OD (Once daily)", 30, "Oral", "Morning", True),
                ("Metformin 1000 mg", "1 tablet", "BD (Twice daily)", 30, "Oral", "With breakfast and dinner", True),
                ("Atorvastatin 10 mg", "1 tablet", "HS (At bedtime)", 30, "Oral", "At night", True)])
        self.token(ph, "Ramesh Bhoir", 56, "male", "gm", v3, r, cid)
        e3 = self.encounter(cid, "gm", v3, "Chest tightness on walking uphill for 2 weeks, relieved by rest.",
            "BP 146/90 mmHg, Pulse 78 bpm, SpO2 98%, Weight 76 kg. HbA1c 8.9%.\n"
            "Investigations Ordered: 2D Echo, TMT (stress test) at cardiology",
            "CVS: S1 S2 normal, no murmur. No signs of failure.",
            "Suspected stable angina in diabetic hypertensive. Refer to Cardiology, Jupiter Hospital for 2D Echo and TMT.\n"
            "Start Aspirin. Sublingual Sorbitrate if chest pain - go to hospital immediately.",
            rx=[("Telmisartan 40 mg", "1 tablet", "OD (Once daily)", 30, "Oral", "Morning", True),
                ("Amlodipine 5 mg", "1 tablet", "OD (Once daily)", 30, "Oral", "Morning", True),
                ("Metformin 1000 mg", "1 tablet", "BD (Twice daily)", 30, "Oral", "With breakfast and dinner", True),
                ("Atorvastatin 20 mg", "1 tablet", "HS (At bedtime)", 30, "Oral", "At night", True),
                ("Aspirin 75 mg", "1 tablet", "OD (Once daily)", 30, "Oral", "After lunch", True)],
            docs=[("lab_report", "HbA1c_Repeat_Ramesh_Bhoir.pdf", "HbA1c (3-month review)",
                   ["HbA1c: 8.9 %  (previous 9.4 %)", "Fasting glucose: 132 mg/dL"], "Repeat HbA1c")])
        rid, valid = self.referral(cid, e3, "gm", "cardio",
                                   "Exertional chest tightness in hypertensive diabetic - 2D Echo and TMT to rule out IHD",
                                   "semi_urgent_14d", v3 + timedelta(minutes=30), 14, "booked")
        self.task(R, fid, r, "DOCTOR_REFERRAL", "Doctor Referral: Cardiology, Jupiter Hospital",
                  f"Referred to Jupiter Hospital Thane (Cardiology). 2D Echo + TMT. Appointment booked, valid until {valid:%d %b %Y}.",
                  TODAY + timedelta(days=5), created=v3 + timedelta(minutes=35), source_referral=rid)
        self.cur.execute("INSERT INTO access_grants (doctor_id, patient_phone, granted_at) VALUES (%s,%s,%s)",
                         (self.doc["cardio"][0], "+91" + ph, v3 + timedelta(hours=2)))
        self.bump("Access grants")

        # 3. Child pneumonia, closed course — Rupali
        ph = "9820400202"
        fid, ids = self.family(R, 1, "Vinod Mhatre", ph, "19", [
            {"name": "Vinod Mhatre", "age": 33, "gender": "male", "rel": "Head"},
            {"name": "Kavita Mhatre", "age": 29, "gender": "female", "rel": "Wife"},
            {"name": "Soham Mhatre", "age": 2, "gender": "male", "rel": "Son", "key": "soham", "tracked": True},
            {"name": "Gauri Mhatre", "age": 6, "gender": "female", "rel": "Daughter"},
        ], 9, interval=30)
        s = ids["soham"]
        self.survey(R, fid, s, "CHILD", {"memberName": "Soham Mhatre", "vaccineGiven": "✕ दिली नाही", "childWeight": "10.8",
                    "childCondition": "गंभीर — संदर्भ आवश्यक", "childStatus": "पालक अनुपस्थित",
                    "remarks": "3 दिवस ताप, जलद श्वास (52/मिनिट), छाती आत ओढली जाते"}, ago(24, 9, 20))
        self.task(R, fid, s, "ASHA_TO_CHO_REFERRAL", "गंभीर न्यूमोनिया संशय: Soham Mhatre", "2 वर्षे, जलद श्वास 52/मिनिट, chest indrawing. तात्काळ बालरोग संदर्भ.",
                  TODAY - timedelta(days=24), "APPROVED_CHO", created=ago(24, 9, 25), cho_at=ago(24, 9, 50),
                  cho_note="तात्काळ — 108 रुग्णवाहिका, CSMH बालरोग विभाग कळवले")
        v1, v2 = ago(24, 12, 10), ago(17, 10, 30)
        cid = self.course(ph, "Soham Mhatre", s, "paed", "acute", "Pneumonia - Paediatric Care", "Community-acquired pneumonia",
                          "J18.9", "Treated with oral amoxicillin and nebulisation. Fully recovered at day-7 review.", v1, "completed", v2 + timedelta(minutes=20))
        self.token("9820400202", "Soham Mhatre", 2, "male", "paed", v1, s, cid)
        self.encounter(cid, "paed", v1, "Fever 3 days, fast breathing, reduced feeding. Referred by ASHA.",
            "Temp 101.6 F, RR 52/min, SpO2 94%, Weight 10.8 kg.\nInvestigations Ordered: CBC, Chest X-ray",
            "Lower chest indrawing present, crepitations right base. No danger signs (feeding, conscious).",
            "Pneumonia without danger signs. Oral amoxicillin, salbutamol nebulisation x2 in OPD, paracetamol for fever.\n"
            "Review after 2 days or earlier if not feeding / breathing worse.",
            rx=[("Amoxicillin syrup 250 mg/5 ml", "5 ml", "TDS (Thrice daily)", 5, "Oral", "After feeds, complete full course", True),
                ("Paracetamol syrup 120 mg/5 ml", "5 ml", "SOS (fever above 100 F)", 3, "Oral", "Not more than 4 times a day", True),
                ("ORS", "50-100 ml", "After every loose stool", 5, "Oral", "Continue breastfeeding and feeds", True)],
            docs=[("scan", "Chest_XRay_Soham_Mhatre.pdf", "Chest X-ray PA view",
                   ["Patchy consolidation right lower zone", "No pleural effusion", "Impression: right lower lobe pneumonia"], "Chest X-ray")])
        self.token("9820400202", "Soham Mhatre", 2, "male", "paed", v2, s, cid)
        self.encounter(cid, "paed", v2, "Day-7 review. Playing, feeding well, no fever for 4 days.",
            "Temp 98.4 F, RR 30/min, SpO2 99%, Weight 11 kg.", "Chest clear, no indrawing.",
            "Recovered. Course closed. Complete pending Measles-Rubella 2nd dose at next VHND.")
        self.task(R, fid, s, "FOLLOW_UP", "न्यूमोनिया नंतर गृहभेट: Soham Mhatre", "ताप नाही, श्वास सामान्य — खात्री करा.",
                  TODAY - timedelta(days=19), "COMPLETED", created=v1 + timedelta(hours=4), completed=ago(19, 11, 0))
        self.task(R, fid, s, "VACCINATION", "MR-2 लसीकरण: Soham Mhatre", "बालरोग तज्ज्ञांच्या सल्ल्यानुसार पुढील VHND ला MR-2.",
                  TODAY + timedelta(days=6), created=v2 + timedelta(hours=3))

        # 4. Pulmonary TB on DOTS — Sangita (Purna)
        ph = "9820400301"
        fid, ids = self.family(S, 0, "Kailas Wagh", ph, "4", [
            {"name": "Kailas Wagh", "age": 42, "gender": "male", "rel": "Head", "key": "kailas", "tracked": True, "ncd": "Tuberculosis",
             "fu_date": TODAY + timedelta(days=2), "fu_reason": "DOTS adherence visit"},
            {"name": "Rekha Wagh", "age": 37, "gender": "female", "rel": "Wife"},
            {"name": "Pranav Wagh", "age": 13, "gender": "male", "rel": "Son"},
        ], 5, interval=7)
        k = ids["kailas"]
        self.survey(S, fid, k, "GENERAL", {"memberName": "Kailas Wagh", "otherCategory": "NCD तपासणी", "suppliesGiven": "फक्त समुपदेशन केले",
                    "otherStatus": "आरोग्य केंद्र संदर्भ", "remarks": "4 आठवडे खोकला, संध्याकाळी ताप, वजन 4 kg कमी — TB संशय"}, ago(66, 10, 0))
        self.task(S, fid, k, "ASHA_TO_CHO_REFERRAL", "TB संशय: Kailas Wagh", "4 आठवडे खोकला, रात्री घाम, वजन घट. थुंकी तपासणी (CBNAAT) साठी संदर्भ.",
                  TODAY - timedelta(days=64), "APPROVED_CHO", created=ago(66, 10, 5), cho_at=ago(65, 12, 30),
                  cho_note="मंजूर — CSMH मेडिसिन OPD, Nikshay नोंदणी करावी")
        v1, v2 = ago(63, 10, 0), ago(33, 10, 20)
        cid = self.course(ph, "Kailas Wagh", k, "gm", "tb_treatment", "Pulmonary Tuberculosis - DOTS (NTEP)",
                          "Pulmonary tuberculosis, microbiologically confirmed, drug-sensitive", "A15.0",
                          "CBNAAT positive, rifampicin sensitive. Intensive phase completed with good adherence; weight +3 kg.", v1)
        self.token(ph, "Kailas Wagh", 42, "male", "gm", v1, k, cid)
        self.encounter(cid, "gm", v1, "Cough with sputum 4 weeks, evening fever, night sweats, weight loss 4 kg. Referred by ASHA.",
            "Temp 99.8 F, Pulse 96 bpm, SpO2 96%, Weight 52 kg.\nInvestigations Ordered: Sputum CBNAAT, Chest X-ray, HIV & RBS screening, LFT",
            "Bronchial breath sounds right upper zone, few crepitations.",
            "Microbiologically confirmed drug-sensitive pulmonary TB. Start 4-FDC (HRZE) intensive phase 8 weeks, weight band 50-64 kg.\n"
            "Nikshay ID created, Nikshay Poshan Yojana enrolled. ASHA as DOTS provider. Family contact screening.",
            rx=[("4-FDC (HRZE) - Isoniazid 75 / Rifampicin 150 / Pyrazinamide 400 / Ethambutol 275 mg", "4 tablets", "OD (Once daily)", 56,
                 "Oral", "Empty stomach in the morning, under ASHA observation", True),
                ("Pyridoxine 10 mg", "1 tablet", "OD (Once daily)", 56, "Oral", "With TB medicines", True)],
            docs=[("lab_report", "Sputum_CBNAAT_Kailas_Wagh.pdf", "Sputum CBNAAT (GeneXpert)",
                   ["MTB: DETECTED (medium)", "Rifampicin resistance: NOT DETECTED", "HIV: Non-reactive", "RBS: 104 mg/dL"],
                   "Diagnostic CBNAAT"),
                  ("scan", "Chest_XRay_Kailas_Wagh.pdf", "Chest X-ray PA view",
                   ["Fibro-cavitary lesion right upper zone", "Left lung clear", "Impression: suggestive of pulmonary Koch's"], "Chest X-ray")])
        self.token(ph, "Kailas Wagh", 42, "male", "gm", v2, k, cid)
        self.encounter(cid, "gm", v2, "4-week review on DOTS. Cough reduced, no fever, appetite better.",
            "Weight 55 kg (+3 kg). Pulse 80 bpm. LFT normal.\nInvestigations Ordered: Sputum smear at end of intensive phase",
            "Few crepitations right upper zone, improving. No jaundice. Vision normal.",
            "Good response. Continue intensive phase for 4 more weeks, then continuation phase (HRE) 16 weeks.\n"
            "ASHA to continue weekly adherence visits.",
            rx=[("4-FDC (HRZE)", "4 tablets", "OD (Once daily)", 28, "Oral", "Empty stomach, under observation", True),
                ("Pyridoxine 10 mg", "1 tablet", "OD (Once daily)", 28, "Oral", "With TB medicines", True)])
        for wk in range(8):
            d = 60 - wk * 7
            self.task(S, fid, k, "FOLLOW_UP", f"DOTS आठवडा {wk + 1}: Kailas Wagh", "औषध सेवन पाहणे, दुष्परिणाम विचारणे, Nikshay नोंद.",
                      TODAY - timedelta(days=d), "COMPLETED", created=ago(d + 1), completed=ago(d, 9, 30))
        self.task(S, fid, k, "FOLLOW_UP", "DOTS आठवडा 9: Kailas Wagh", "औषध सेवन पाहणे, थुंकी तपासणी नमुना आठवण.",
                  TODAY + timedelta(days=2), created=ago(1))
        self.task(S, fid, ids.get("m1"), "FOLLOW_UP", "TB संपर्क तपासणी: Rekha Wagh", "घरातील संपर्कांची लक्षण तपासणी व TPT सल्ला.",
                  TODAY - timedelta(days=4), created=ago(30))

        # Pending HRP (PIH) referral waiting for CHO — Sangita
        ph = "9820400302"
        fid, ids = self.family(S, 1, "Prakash Thakare", ph, "15", [
            {"name": "Prakash Thakare", "age": 34, "gender": "male", "rel": "Head"},
            {"name": "Sarika Thakare", "age": 31, "gender": "female", "rel": "Wife", "key": "sarika", "tracked": True,
             "edd": TODAY + timedelta(days=46), "fu_date": TODAY + timedelta(days=1), "fu_reason": "BP high - referral pending"},
            {"name": "Tanvi Thakare", "age": 5, "gender": "female", "rel": "Daughter"},
        ], 1, interval=7)
        self.survey(S, fid, ids["sarika"], "PREGNANCY", {"memberName": "Sarika Thakare", "isPregnant": "होय",
                    "lmpDate": str(TODAY - timedelta(days=234)), "eddDate": str(TODAY + timedelta(days=46)), "isFirstPregnancy": "नाही",
                    "ancVisit": "ANC 3", "ttGiven": "✓ दिली", "bp": "148/98", "weight": "64", "hemoglobin": "10.9",
                    "urine": "असामान्य (प्रथिने+)", "abdominalExam": "✓ केली", "ironTablets": "90", "calciumTablets": "90",
                    "hasComplications": "होय", "complicationsList": ["High BP", "Swelling"], "serviceStatus": "रुग्णालय संदर्भ",
                    "remarks": "पायावर सूज, डोकेदुखी, लघवीत प्रथिने+ — PIH संशय"}, ago(1, 11, 15))
        self.task(S, fid, ids["sarika"], "ASHA_TO_CHO_REFERRAL", "PIH संशय: Sarika Thakare",
                  "33 आठवडे, BP 148/98, लघवी प्रथिने+, सूज व डोकेदुखी. CSMH स्त्रीरोग विभाग संदर्भ आवश्यक.",
                  TODAY + timedelta(days=1), created=ago(1, 11, 20))

        # 5. Diabetic foot — referral expired → REFERRAL_MISSED; Routine ANC; Knee OA — Jyoti (Padgha)
        ph = "9820400401"
        fid, ids = self.family(J, 0, "Namdev More", ph, "3", [
            {"name": "Namdev More", "age": 63, "gender": "male", "rel": "Head", "key": "namdev", "tracked": True, "ncd": "Diabetes",
             "fu_date": TODAY + timedelta(days=1), "fu_reason": "Missed surgery referral - re-motivate"},
            {"name": "Shobha More", "age": 58, "gender": "female", "rel": "Wife"},
        ], 4, interval=7)
        n = ids["namdev"]
        self.survey(J, fid, n, "DISEASE", {"memberName": "Namdev More", "chronicCondition": "Diabetes", "bpSystolic": "134",
                    "bpDiastolic": "82", "bp": "134/82", "onRegularMedication": "होय", "dietSaltReduced": "होय",
                    "chestPainOrDizziness": "नाही", "remarks": "उजव्या पायाच्या अंगठ्याजवळ जखम 2 आठवडे बरी होत नाही"}, ago(29, 10, 10))
        self.task(J, fid, n, "ASHA_TO_CHO_REFERRAL", "मधुमेही पायाची जखम: Namdev More", "2 आठवडे न भरलेली जखम. CSMH मेडिसिन OPD संदर्भ.",
                  TODAY - timedelta(days=27), "APPROVED_CHO", created=ago(29, 10, 15), cho_at=ago(28, 15, 0),
                  cho_note="मंजूर — CSMH मेडिसिन OPD")
        v1 = ago(26, 11, 0)
        cid = self.course(ph, "Namdev More", n, "gm", "diabetes", "Type 2 Diabetes with Foot Ulcer",
                          "Type 2 diabetes mellitus with foot ulcer", "E11.621",
                          "Grade 1 diabetic foot ulcer, right great toe. Referred to General Surgery for debridement - not attended.", v1)
        self.token(ph, "Namdev More", 63, "male", "gm", v1, n, cid)
        e1 = self.encounter(cid, "gm", v1, "Non-healing ulcer right great toe for 2 weeks. Known diabetic 9 years.",
            "BP 134/82 mmHg, Pulse 82 bpm, RBS 288 mg/dL, Weight 61 kg.\nInvestigations Ordered: HbA1c, CBC, X-ray right foot, Pus culture",
            "2 x 1.5 cm ulcer plantar aspect right great toe, slough +, no gangrene. Dorsalis pedis palpable. Monofilament: reduced sensation.",
            "Wagner grade 1 diabetic foot ulcer. Start antibiotic, daily dressing at PHC. Refer to General Surgery for debridement.\n"
            "Strict sugar control - add Glimepiride. Foot-care education, no barefoot walking.\n"
            "Investigations Ordered: HbA1c, X-ray right foot, Pus culture",
            rx=[("Amoxicillin + Clavulanic acid 625 mg", "1 tablet", "BD (Twice daily)", 7, "Oral", "After meals", True),
                ("Metformin 500 mg", "1 tablet", "BD (Twice daily)", 30, "Oral", "With meals", True),
                ("Glimepiride 1 mg", "1 tablet", "OD (Once daily)", 30, "Oral", "Before breakfast - eat within 15 minutes", True),
                ("Povidone iodine 5% solution", "Local application", "Daily dressing", 14, "Topical", "Dressing at PHC Padgha", True)],
            docs=[("lab_report", "HbA1c_CBC_Namdev_More.pdf", "HbA1c + CBC",
                   ["HbA1c: 10.2 %  HIGH", "TLC: 12,400 /cumm  HIGH", "Haemoglobin: 11.8 g/dL", "X-ray foot: no osteomyelitis"], "Baseline labs")])
        rid, valid = self.referral(cid, e1, "gm", "surg", "Diabetic foot ulcer (Wagner 1) right great toe - surgical debridement",
                                   "urgent_7d", v1 + timedelta(minutes=25), 7, "expired")
        self.task(J, fid, n, "DOCTOR_REFERRAL", "Doctor Referral: General Surgery, CSMH Kalwa",
                  f"Referred to CSMH Kalwa (General Surgery) for debridement. Valid until {valid:%d %b %Y}.",
                  valid, "COMPLETED", created=v1 + timedelta(minutes=30), completed=ago(20, 17, 0), source_referral=rid)
        self.task(J, fid, n, "REFERRAL_MISSED", "संदर्भ चुकला: Namdev More (General Surgery)",
                  "शस्त्रक्रिया विभागाचा संदर्भ मुदतीत वापरला नाही. कुटुंबाशी बोला, CHO कडून नवीन संदर्भ घ्या.",
                  TODAY + timedelta(days=1), created=datetime.combine(valid + timedelta(days=1), datetime.min.time()).replace(hour=6),
                  source_referral=rid)

        ph = "9820400402"
        fid, ids = self.family(J, 1, "Sunil Shelar", ph, "21", [
            {"name": "Sunil Shelar", "age": 28, "gender": "male", "rel": "Head"},
            {"name": "Ashwini Shelar", "age": 26, "gender": "female", "rel": "Wife", "key": "ashwini", "tracked": True,
             "edd": TODAY + timedelta(days=140), "fu_date": TODAY + timedelta(days=12), "fu_reason": "ANC 3"},
            {"name": "Shobha Raut", "age": 67, "gender": "female", "rel": "Mother", "key": "shobha", "tracked": True},
        ], 7, interval=15)
        a = ids["ashwini"]
        for d, anc, hb in [(55, "ANC 1", "11.4"), (12, "ANC 2", "11.2")]:
            self.survey(J, fid, a, "PREGNANCY", {"memberName": "Ashwini Shelar", "isPregnant": "होय",
                        "lmpDate": str(TODAY - timedelta(days=140)), "eddDate": str(TODAY + timedelta(days=140)), "isFirstPregnancy": "होय",
                        "ancVisit": anc, "ttGiven": "✓ दिली", "bp": "112/70", "weight": "52", "hemoglobin": hb, "urine": "सामान्य",
                        "abdominalExam": "✓ केली", "ironTablets": "60", "calciumTablets": "60", "hasComplications": "नाही",
                        "serviceStatus": "✓ सेवा पूर्ण", "remarks": "सर्व सामान्य, संस्थात्मक प्रसूती नियोजन CSMH"}, ago(d, rnd=random.Random(d + 11)))
        v1 = ago(9, 10, 30)
        cid = self.course(ph, "Ashwini Shelar", a, "obg", "antenatal", "Antenatal Care - Low Risk", "Supervision of normal first pregnancy",
                          "Z34.0", "Low-risk primigravida, 20 weeks. Anomaly scan normal.", v1)
        self.token(ph, "Ashwini Shelar", 26, "female", "obg", v1, a, cid)
        self.encounter(cid, "obg", v1, "Routine antenatal visit for anomaly scan, 20 weeks.",
            "BP 112/70 mmHg, Pulse 78 bpm, Weight 52 kg, Hb 11.2 g/dL.\nInvestigations Ordered: Anomaly scan, Blood group, HIV/HBsAg/VDRL, Urine routine",
            "Fundal height 20 weeks, FHS 148/min.",
            "Low-risk pregnancy. Continue IFA and calcium. Next ANC at 28 weeks with OGTT.\nInstitutional delivery planned at CSMH Kalwa.",
            rx=[("Ferrous Sulphate 100 mg + Folic Acid 0.5 mg (IFA)", "1 tablet", "OD night", 90, "Oral", "With water or lemon juice, not with tea", True),
                ("Calcium Carbonate 500 mg + Vit D3", "1 tablet", "BD (Twice daily)", 90, "Oral", "After meals, 2 hours apart from IFA", True)],
            docs=[("scan", "Anomaly_Scan_Ashwini_Shelar.pdf", "Obstetric USG - Anomaly Scan",
                   ["Single live intrauterine foetus", "Gestational age: 20 weeks 1 day", "No structural anomaly detected",
                    "Placenta: anterior, upper segment", "Liquor: adequate"], "Level II scan")])
        self.task(J, fid, a, "FOLLOW_UP", "ANC 3 भेट: Ashwini Shelar", "28 आठवड्यात CSMH मध्ये ANC व OGTT. JSY फॉर्म भरून घ्या.",
                  TODAY + timedelta(days=12), created=v1 + timedelta(hours=4))
        o = ids["shobha"]
        v1 = ago(40, 11, 10)
        cid = self.course(ph, "Shobha Raut", o, "ortho", "orthopedics", "Knee Osteoarthritis", "Primary osteoarthritis, bilateral knees",
                          "M17.0", "Bilateral knee OA (KL grade 2). Physiotherapy + analgesics; walking distance improved.", v1)
        self.token(ph, "Shobha Raut", 67, "female", "ortho", v1, o, cid)
        self.encounter(cid, "ortho", v1, "Pain in both knees for 1 year, worse on climbing stairs and sitting cross-legged.",
            "BP 128/80 mmHg, Weight 66 kg.\nInvestigations Ordered: X-ray both knees standing AP, Serum Vitamin D",
            "Crepitus both knees, no effusion. ROM 0-110 degrees.",
            "Bilateral knee OA. Quadriceps strengthening exercises, weight reduction, avoid squatting.\nReview after 6 weeks.",
            rx=[("Paracetamol 650 mg", "1 tablet", "BD (Twice daily)", 15, "Oral", "After meals, when pain", True),
                ("Diclofenac 1% gel", "Local application", "BD (Twice daily)", 30, "Topical", "Apply gently over knees", False),
                ("Cholecalciferol 60,000 IU", "1 sachet", "Once weekly", 56, "Oral", "With milk, 8 weeks", True)],
            docs=[("scan", "Knee_XRay_Shobha_Raut.pdf", "X-ray Both Knees (standing AP)",
                   ["Reduced medial joint space bilaterally", "Marginal osteophytes", "Kellgren-Lawrence grade 2"], "Knee X-ray")])

        # Lata (low activity): pending, overdue child referral
        ph = "9820400501"
        fid, ids = self.family(L, 0, "Balu Bhoye", ph, "6", [
            {"name": "Balu Bhoye", "age": 30, "gender": "male", "rel": "Head"},
            {"name": "Vandana Bhoye", "age": 25, "gender": "female", "rel": "Wife"},
            {"name": "Sai Bhoye", "age": 1, "gender": "male", "rel": "Son", "key": "sai", "tracked": True},
        ], 41, interval=15)
        self.survey(L, fid, ids["sai"], "CHILD", {"memberName": "Sai Bhoye", "vaccineGiven": "✕ दिली नाही", "childWeight": "7.1",
                    "childCondition": "जुलाब (ORS देय)", "childStatus": "पालक अनुपस्थित",
                    "remarks": "वजन वयाच्या मानाने कमी (MUAM पिवळा), जुलाब 3 दिवस"}, ago(8, 15, 40))
        self.task(L, fid, ids["sai"], "ASHA_TO_CHO_REFERRAL", "कमी वजन + जुलाब: Sai Bhoye", "1 वर्ष, वजन 7.1 kg (MAM), 3 दिवस जुलाब. NRC/बालरोग तपासणी आवश्यक.",
                  TODAY - timedelta(days=5), created=ago(8, 15, 45))

    # ------------------------------------------------- filler households

    def filler(self):
        counts = {"9820100021": 7, "9820100022": 6, "9820100023": 5, "9820100024": 6, "9820100025": 4}
        used = {"9820100021": 2, "9820100022": 2, "9820100023": 2, "9820100024": 2, "9820100025": 1}
        for ai, (asha, _, village, _, level) in enumerate(ASHAS):
            rnd = random.Random(f"filler-{asha}")
            for fi in range(used[asha], used[asha] + counts[asha]):
                sur = SURNAMES[(ai * 5 + fi * 3) % len(SURNAMES)]
                head = f"{MALE[(ai * 7 + fi) % len(MALE)]} {sur}"
                ph = f"98204{ai + 1}{fi:02d}{rnd.randint(10, 99)}"[:10]
                members = [{"name": head, "age": rnd.randint(32, 62), "gender": "male", "rel": "Head"}]
                wife_age = rnd.randint(22, 34)
                preg = rnd.random() < 0.3 and wife_age < 32
                members.append({"name": f"{FEMALE[(ai * 3 + fi * 5) % len(FEMALE)]} {sur}", "age": wife_age, "gender": "female",
                                "rel": "Wife", "key": "wife", "tracked": preg,
                                "edd": TODAY + timedelta(days=rnd.randint(30, 220)) if preg else None})
                ncd = members[0]["age"] > 45 and rnd.random() < 0.5
                if ncd:
                    members[0].update(key="head", tracked=True, ncd=rnd.choice(NCDS))
                for k in range(rnd.randint(1, 3)):
                    g = rnd.choice(["male", "female"])
                    age = rnd.randint(0, 14)
                    nm = (KIDS_M if g == "male" else KIDS_F)[(fi + k + ai) % 8]
                    members.append({"name": f"{nm} {sur}", "age": age, "days": rnd.randint(60, 330), "gender": g,
                                    "rel": "Son" if g == "male" else "Daughter", "key": f"kid{k}", "tracked": age < 5})
                visited = rnd.random() < level
                fid, ids = self.family(asha, fi, head, ph, str(30 + fi * 4), members,
                                       rnd.randint(1, 25) if visited else rnd.randint(35, 70))
                n_surv = sum(1 for _ in range(3) if rnd.random() < level)
                for si in range(n_surv):
                    when = ago(rnd.randint(0, 29), rnd=rnd)
                    if preg:
                        self.survey(asha, fid, ids["wife"], "PREGNANCY", {
                            "memberName": members[1]["name"], "isPregnant": "होय", "ancVisit": f"ANC {si + 1}", "ttGiven": "✓ दिली",
                            "bp": f"{rnd.randint(104, 128)}/{rnd.randint(66, 82)}", "weight": str(rnd.randint(46, 62)),
                            "hemoglobin": str(round(rnd.uniform(10.2, 12.4), 1)), "urine": "सामान्य", "abdominalExam": "✓ केली",
                            "ironTablets": "30", "calciumTablets": "30", "hasComplications": "नाही", "serviceStatus": "✓ सेवा पूर्ण",
                            "remarks": "ANC सामान्य"}, when)
                    elif ncd:
                        s, d = rnd.randint(126, 158), rnd.randint(78, 96)
                        self.survey(asha, fid, ids["head"], "DISEASE", {
                            "memberName": head, "chronicCondition": members[0]["ncd"], "bpSystolic": str(s), "bpDiastolic": str(d),
                            "bp": f"{s}/{d}", "onRegularMedication": rnd.choice(["होय", "होय", "नाही"]), "dietSaltReduced": "होय",
                            "chestPainOrDizziness": "नाही", "remarks": "औषध पुरवठा तपासला"}, when)
                    else:
                        kid = next((key for key in ids if key.startswith("kid") and members[[m.get("key") for m in members].index(key)]["age"] < 5), None)
                        if kid:
                            km = members[[m.get("key") for m in members].index(kid)]
                            self.survey(asha, fid, ids[kid], "CHILD", {
                                "memberName": km["name"], "vaccineGiven": "✓ होय, लस दिली",
                                "childWeight": str(round(4 + km["age"] * 2.1 + rnd.uniform(0, 1.5), 1)),
                                "childCondition": "पूर्णपणे निरोगी", "childStatus": "✓ लसीकरण पूर्ण", "remarks": "वेळेवर लसीकरण"}, when)
                        else:
                            self.survey(asha, fid, ids["wife"], "GENERAL", {
                                "memberName": members[1]["name"], "otherCategory": "कुटुंब नियोजन",
                                "suppliesGiven": "छाया / अंतरा / निरोध", "otherStatus": "✓ सेवा यशस्वी", "remarks": "समुपदेशन केले"}, when)
                if preg or ncd:
                    done = rnd.random() < level
                    mid = ids["wife"] if preg else ids["head"]
                    title = ("ANC भेट: " + members[1]["name"]) if preg else (f"{members[0]['ncd']} पाठपुरावा: {head}")
                    due = TODAY + timedelta(days=rnd.randint(-10, 12))
                    self.task(asha, fid, mid, "FOLLOW_UP" if preg else "NCD_FOLLOWUP", title, "नियमित गृहभेट व तपासणी",
                              due, "COMPLETED" if done else "PENDING", created=ago(rnd.randint(12, 30), rnd=rnd),
                              completed=ago(rnd.randint(0, 10), rnd=rnd) if done else None)

    # ------------------------------------------------------------ purge

    def purge(self):
        cur = self.cur
        cur.execute("SELECT id FROM family_members WHERE client_uuid LIKE %s", (f"{TAG}-%",))
        mids = [r[0] for r in cur.fetchall()]
        cur.execute("SELECT id, primary_phone FROM family_units WHERE client_uuid LIKE %s", (f"{TAG}-%",))
        fams = cur.fetchall()
        fids = [r[0] for r in fams]
        phones = ["+91" + r[1] for r in fams]
        cur.execute("SELECT id FROM courses WHERE family_member_id = ANY(%s)", (mids,))
        cids = [r[0] for r in cur.fetchall()]
        doc_phones = [d[0] for d in DOCTORS.values()]
        steps = [
            ("tokens", "DELETE FROM tokens WHERE family_member_id = ANY(%s)", mids),
            ("follow_up_tasks", "DELETE FROM follow_up_tasks WHERE offline_id LIKE %s OR family_unit_id = ANY(%s)", (f"{OTAG}-%", fids)),
            ("survey_responses", "DELETE FROM survey_responses WHERE offline_id LIKE %s OR family_unit_id = ANY(%s)", (f"{OTAG}-%", fids)),
            ("course_referrals", "DELETE FROM course_referrals WHERE course_id = ANY(%s)", cids),
            ("course_prescriptions", "DELETE FROM course_prescriptions WHERE course_id = ANY(%s)", cids),
            ("course_documents", "DELETE FROM course_documents WHERE course_id = ANY(%s)", cids),
            ("course_encounters", "DELETE FROM course_encounters WHERE course_id = ANY(%s)", cids),
            ("courses", "DELETE FROM courses WHERE id = ANY(%s)", cids),
            ("patient_documents", "DELETE FROM patient_documents WHERE patient_phone = ANY(%s)", phones),
            ("access_grants", "DELETE FROM access_grants WHERE doctor_id IN (SELECT id FROM doctors WHERE phone = ANY(%s))", doc_phones),
            ("family_members", "DELETE FROM family_members WHERE id = ANY(%s)", mids),
            ("family_units", "DELETE FROM family_units WHERE id = ANY(%s)", fids),
            ("doctors", "DELETE FROM doctors WHERE phone = ANY(%s)", doc_phones),
            ("anm_profiles", "DELETE FROM anm_profiles WHERE phone = ANY(%s)", [a[0] for a in ANMS]),
            ("asha_workers", "DELETE FROM asha_workers WHERE phone = ANY(%s)", [a[0] for a in ANMS] + [a[0] for a in ASHAS]),
            ("cho_officers", "DELETE FROM cho_officers WHERE phone = %s", CHO[0]),
        ]
        for name, sql, args in steps:
            cur.execute(sql, args if isinstance(args, tuple) else (args,))
            if cur.rowcount:
                self.stats[f"deleted {name}"] = cur.rowcount


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--commit", action="store_true", help="commit (default is a dry run that rolls back)")
    ap.add_argument("--purge", action="store_true", help="remove everything this script inserted")
    args = ap.parse_args()

    env = load_env()
    conn = psycopg2.connect(host=env["DB_HOST"], port=env["DB_PORT"], dbname=env["DB_DATABASE"], user=env["DB_USER"],
                            password=env["DB_PASSWORD"], sslmode="require", connect_timeout=20)
    cur = conn.cursor()
    cur.execute("SET search_path TO clinicqueue, public")
    s = Seeder(cur)
    try:
        if args.purge:
            s.purge()
        else:
            cur.execute("SELECT COUNT(*) FROM family_units WHERE client_uuid LIKE %s", (f"{TAG}-%",))
            if cur.fetchone()[0]:
                raise SystemExit("Thane sector already seeded. Run with --purge --commit first to re-seed.")
            s.workforce()
            s.hospitals_and_doctors()
            s.journeys()
            s.filler()
        for k, v in s.stats.items():
            print(f"  {k:<22} {v}")
        if args.commit:
            conn.commit()
            print("COMMITTED")
        else:
            conn.rollback()
            print("DRY RUN - rolled back (use --commit)")
    except BaseException:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
