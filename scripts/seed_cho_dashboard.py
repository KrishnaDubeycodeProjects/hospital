"""
Seed demo data for the CHO performance dashboard (asha-app → CHO → प्रदर्शन tab).

Sector: CHO +919876522222 (cho_officers) → ANM Rekha Sharma 9876543211 → ASHA workers below.
Creates ASHA workers with families, members (pregnant / NCD / children), surveys spread over
the last 30 days and follow-up / referral tasks, with deliberately varied performance levels.

Every seeded row is tagged so it can be found later:
  family_units.client_uuid / family_members.client_uuid  LIKE 'seed-cho-%'
  survey_responses.offline_id / follow_up_tasks.offline_id LIKE 'SEED-CHO-%'

Idempotent: a worker that already has seed families is skipped.
Usage (from repo root, reads DB_* from .env):  python scripts/seed_cho_dashboard.py
"""
import json
import random
from datetime import date, datetime, timedelta
from pathlib import Path

import psycopg2

ANM_PHONE = "9876543211"  # Rekha Sharma (ANM), registered by CHO 9876522222

# phone, name, village, activity level (0..1), families
WORKERS = [
    ("9876543210", "Sunita Devi (ASHA)", "Chandpur Village", 0.80, 10),
    ("9876544101", "Geeta Yadav", "Rampur", 0.95, 14),
    ("9876544102", "Pooja Maurya", "Sarai Mohana", 0.70, 11),
    ("9876544103", "Kiran Patel", "Bhagwanpur", 0.50, 8),
    ("9876544104", "Anita Singh", "Kotwa", 0.30, 6),
    ("9876544105", "Shanti Devi", "Lohta", 0.10, 4),
]

SURNAMES = ["Yadav", "Patel", "Maurya", "Singh", "Gupta", "Verma", "Pal", "Rajbhar", "Prajapati", "Kushwaha"]
MALE = ["Ramesh", "Suresh", "Mahesh", "Rajesh", "Dinesh", "Mukesh", "Santosh", "Vinod", "Ashok", "Pradeep"]
FEMALE = ["Sita", "Gita", "Radha", "Kamla", "Savitri", "Pushpa", "Meena", "Rekha", "Asha", "Lakshmi"]
KIDS = ["Aarav", "Anaya", "Vivaan", "Diya", "Kabir", "Ira", "Arjun", "Myra", "Reyansh", "Siya"]
NCD = ["Hypertension", "Diabetes", "TB", "Asthma"]


def load_env():
    env = {}
    for line in Path(".env").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k] = v.strip().strip('"')
    return env


def at(days_ago, rnd):
    d = datetime.now() - timedelta(days=days_ago)
    d = d.replace(hour=rnd.randint(8, 17), minute=rnd.randint(0, 59), second=0, microsecond=0)
    return min(d, datetime.now() - timedelta(minutes=rnd.randint(5, 90)))


def main():
    env = load_env()
    conn = psycopg2.connect(host=env["DB_HOST"], port=env["DB_PORT"], dbname=env["DB_DATABASE"],
                            user=env["DB_USER"], password=env["DB_PASSWORD"], sslmode="require")
    cur = conn.cursor()
    cur.execute("SELECT category_code, id FROM clinicqueue.survey_templates WHERE is_active = TRUE")
    tpl = dict(cur.fetchall())

    for wi, (phone, name, village, level, n_fam) in enumerate(WORKERS):
        rnd = random.Random(1000 + wi)
        cur.execute(
            "INSERT INTO clinicqueue.asha_workers (phone, name, village_name, block_name, district_name, anm_phone, role, preferred_language, is_active) "
            "VALUES (%s,%s,%s,'Chandpur Block','Varanasi',%s,'ASHA','hi',TRUE) "
            "ON CONFLICT (phone) DO UPDATE SET anm_phone = EXCLUDED.anm_phone, is_active = TRUE, role = 'ASHA'",
            (phone, name, village, ANM_PHONE))
        cur.execute("SELECT COUNT(*) FROM clinicqueue.family_units WHERE client_uuid LIKE %s", (f"seed-cho-{phone}-%",))
        if cur.fetchone()[0] > 0:
            print(f"skip {name}: already seeded")
            continue

        surveys = tasks = 0
        for fi in range(n_fam):
            sur = rnd.choice(SURNAMES)
            head = f"{rnd.choice(MALE)} {sur}"
            visited = rnd.random() < level
            last_visit = at(rnd.randint(0, 25), rnd) if visited else at(rnd.randint(35, 70), rnd)
            cur.execute(
                "INSERT INTO clinicqueue.family_units (primary_phone, head_name, village_name, house_number, sequential_number, "
                "visit_interval_days, next_visit_date, asha_worker_phone, last_visited_at, is_deleted, client_uuid, created_at) "
                "VALUES (%s,%s,%s,%s,%s,30,%s,%s,%s,FALSE,%s,%s) RETURNING id",
                (f"9{rnd.randint(100000000, 999999999)}", head, village, str(101 + fi), fi + 1,
                 (last_visit + timedelta(days=30)).date(), phone, last_visit,
                 f"seed-cho-{phone}-f{fi}", at(rnd.randint(60, 120), rnd)))
            fam_id = cur.fetchone()[0]

            members = [(head, rnd.randint(30, 60), "male", "Head")]
            wife = f"{rnd.choice(FEMALE)} {sur}"
            members.append((wife, rnd.randint(20, 35), "female", "Wife"))
            for k in range(rnd.randint(1, 3)):
                g = rnd.choice(["male", "female"])
                members.append((f"{rnd.choice(KIDS)} {sur}", rnd.randint(0, 12), g, "Son" if g == "male" else "Daughter"))
            pregnant_idx = 1 if rnd.random() < 0.35 else None

            for mi, (mname, age, gender, rel) in enumerate(members):
                is_preg = mi == pregnant_idx
                ncd = NCD[rnd.randrange(len(NCD))] if rel == "Head" and age > 40 and rnd.random() < 0.45 else None
                edd = date.today() + timedelta(days=rnd.randint(20, 200)) if is_preg else None
                cur.execute(
                    "INSERT INTO clinicqueue.family_members (family_unit_id, name, age, gender, relationship, is_pregnant, "
                    "expected_delivery_date, has_chronic_condition, chronic_condition_type, last_survey_date, is_deleted, client_uuid) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,FALSE,%s) ON CONFLICT DO NOTHING RETURNING id",
                    (fam_id, mname, age, gender, rel, is_preg, edd, ncd is not None, ncd,
                     last_visit if visited else None, f"seed-cho-{phone}-f{fi}-m{mi}"))
                row = cur.fetchone()
                if not row:
                    continue
                mem_id = row[0]

                cat = "PREGNANCY" if is_preg else "DISEASE" if ncd else "CHILD" if age < 5 else None
                if not cat or cat not in tpl:
                    continue
                # Active workers record 1-4 surveys per tracked member over the last 30 days.
                n_surv = sum(1 for _ in range(4) if rnd.random() < level)
                for si in range(n_surv):
                    when = at(rnd.randint(0, 29), rnd)
                    if cat == "PREGNANCY":
                        ans = {"memberName": mname, "isPregnant": True, "ancVisit": f"ANC {si + 1}",
                               "bp": f"{rnd.randint(105, 145)}/{rnd.randint(65, 95)}", "hemoglobin": str(round(rnd.uniform(8.5, 12.5), 1)),
                               "weight": str(rnd.randint(45, 70)), "ironTablets": "30", "serviceStatus": "✓ सेवा पूर्ण"}
                    elif cat == "DISEASE":
                        ans = {"memberName": mname, "condition": ncd, "bp": f"{rnd.randint(120, 170)}/{rnd.randint(75, 105)}",
                               "medicineTaken": rnd.choice(["हाँ", "नहीं"]), "serviceStatus": "✓ सेवा पूर्ण"}
                    else:
                        ans = {"memberName": mname, "childWeight": str(round(rnd.uniform(4, 16), 1)),
                               "vaccineGiven": "✓ हाँ, टीका लगाया", "childCondition": "पूर्णतः स्वस्थ"}
                    ans["recordedAt"] = when.isoformat()
                    cur.execute(
                        "INSERT INTO clinicqueue.survey_responses (family_unit_id, family_member_id, template_id, category_code, "
                        "asha_worker_phone, answers, synced_to_anm, target_anm_phone, synced_at, offline_id, created_at) "
                        "VALUES (%s,%s,%s,%s,%s,%s,TRUE,%s,%s,%s,%s)",
                        (fam_id, mem_id, tpl[cat], cat, phone, json.dumps(ans, ensure_ascii=False), ANM_PHONE, when,
                         f"SEED-CHO-S-{phone}-{fi}-{mi}-{si}", when))
                    surveys += 1

                # Follow-up / referral tasks for tracked members.
                if cat in ("PREGNANCY", "DISEASE") or rnd.random() < 0.3:
                    referral = (is_preg or ncd) and rnd.random() < 0.4
                    ttype = "ASHA_TO_CHO_REFERRAL" if referral else "FOLLOW_UP"
                    done = rnd.random() < level
                    if referral:
                        status = "APPROVED_CHO" if done and rnd.random() < 0.6 else "PENDING"
                    else:
                        status = "COMPLETED" if done else "PENDING"
                    due = date.today() + timedelta(days=rnd.randint(-12, 10))
                    created = at(rnd.randint(5, 30), rnd)
                    completed = at(rnd.randint(0, 13), rnd) if status == "COMPLETED" else None
                    title = {"PREGNANCY": "ANC जाँच", "DISEASE": f"{ncd} फॉलो-अप", "CHILD": "टीकाकरण"}[cat]
                    if referral:
                        title = "उच्च जोखिम रेफरल"
                    cur.execute(
                        "INSERT INTO clinicqueue.follow_up_tasks (family_unit_id, family_member_id, asha_worker_phone, task_type, "
                        "title, description, due_date, status, completed_at, offline_id, created_at, cho_approved_by, cho_approved_at) "
                        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                        (fam_id, mem_id, phone, ttype, title, f"{mname} — {title}", due, status, completed,
                         f"SEED-CHO-T-{phone}-{fi}-{mi}", created,
                         "+919876522222" if status == "APPROVED_CHO" else None,
                         at(rnd.randint(0, 5), rnd) if status == "APPROVED_CHO" else None))
                    tasks += 1
        print(f"seeded {name}: {n_fam} families, {surveys} surveys, {tasks} tasks")

    conn.commit()
    conn.close()


if __name__ == "__main__":
    main()
