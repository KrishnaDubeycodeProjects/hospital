#!/usr/bin/env python3
"""
Seeds complete, interconnected field test data across CHO, ANM, and ASHA cadres
into Supabase PostgreSQL (clinicqueue schema).
"""
import sys
import json
import random
from datetime import datetime, date, timedelta
import psycopg2
from psycopg2.extras import Json

from deploy_lambda import parse_env_file, ENV_FILE

try:
    sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
except Exception:
    pass

env = parse_env_file(ENV_FILE)
DB_HOST = env.get('DB_HOST', 'aws-0-ap-northeast-1.pooler.supabase.com')
DB_PORT = int(env.get('DB_PORT', 6543))
DB_NAME = env.get('DB_DATABASE', 'postgres')
DB_USER = env.get('DB_USER', 'postgres.ilsdjguwjmsdnfqwsskr')
DB_PASS = env.get('DB_PASSWORD')

print(f"Connecting to Postgres at {DB_HOST}:{DB_PORT}/{DB_NAME}...")
conn = psycopg2.connect(
    host=DB_HOST,
    port=DB_PORT,
    dbname=DB_NAME,
    user=DB_USER,
    password=DB_PASS,
    sslmode='require',
    connect_timeout=15
)
conn.autocommit = False
cur = conn.cursor()

try:
    print("Ensuring tables and extensions exist in clinicqueue...")
    cur.execute("SET search_path TO clinicqueue, public;")

    # 1. Seed Survey Templates if not present
    templates = [
        ('PREGNANCY', 'मातृ एवं गर्भावस्था देखभाल', 'मातृ एवं गर्भावस्था देखभाल', 'HeartPulse', [
            {"id": "p1", "text": "क्या यह पहली गर्भावस्था है?", "text_mr": "ही पहिलीच गर्भधारणा आहे का?", "type": "boolean"},
            {"id": "p2", "text": "अंतिम मासिक धर्म (LMP) तारीख?", "text_mr": "शेवटच्या मासिक पाळीची (LMP) तारीख?", "type": "date"},
            {"id": "p3", "text": "क्या कोई गंभीर लक्षण हैं (रक्तस्राव / चक्कर / सूजन)?", "text_mr": "काही गंभीर लक्षणे आहेत का (रक्तस्राव / चक्कर / सूज)?", "type": "boolean"},
            {"id": "p4", "text": "हीमोग्लोबिन स्तर (g/dL)?", "text_mr": "हिमोग्लोबिन पातळी (g/dL)?", "type": "number"}
        ]),
        ('CHILD', 'बाल स्वास्थ्य एवं टीकाकरण', 'बाल स्वास्थ्य एवं लसीकरण', 'Baby', [
            {"id": "c1", "text": "जन्म के समय वजन (kg)?", "text_mr": "जन्माच्या वेळचे वजन (kg)?", "type": "number"},
            {"id": "c2", "text": "क्या आयु अनुसार सभी टीके लगे हैं?", "text_mr": "वयानुसार सर्व लस मिळाल्या आहेत का?", "type": "boolean"},
            {"id": "c3", "text": "क्या बच्चा केवल स्तनपान ले रहा है?", "text_mr": "बाळ फक्त स्तनपान घेत आहे का?", "type": "boolean"}
        ]),
        ('DISEASE', 'असंचारी रोग (NCD) स्क्रीनिंग', 'असंचारी रोग तपासणी', 'Activity', [
            {"id": "d1", "text": "रक्तचाप (Blood Pressure)?", "text_mr": "रक्तदाब (Blood Pressure)?", "type": "text"},
            {"id": "d2", "text": "रक्त शर्करा (Blood Sugar mg/dL)?", "text_mr": "रक्त शर्करा (Blood Sugar mg/dL)?", "type": "number"},
            {"id": "d3", "text": "क्या नियमित दवा ले रहे हैं?", "text_mr": "नियमित औषधे घेत आहात का?", "type": "boolean"}
        ]),
        ('GENERAL', 'सामान्य पारिवारिक स्वास्थ्य सर्वेक्षण', 'सामान्य कुटुंब आरोग्य सर्वेक्षण', 'Users', [
            {"id": "g1", "text": "पीने के पानी का मुख्य स्रोत?", "text_mr": "पिण्याच्या पाण्याचा मुख्य स्त्रोत?", "type": "text"},
            {"id": "g2", "text": "शौचालय की सुविधा उपलब्ध है?", "text_mr": "शौचालयाची सोय उपलब्ध आहे का?", "type": "boolean"}
        ])
    ]

    template_ids = {}
    for code, label, label_hi, icon, qs in templates:
        cur.execute("SELECT id FROM clinicqueue.survey_templates WHERE category_code = %s LIMIT 1;", (code,))
        row = cur.fetchone()
        if row:
            template_ids[code] = row[0]
        else:
            cur.execute("""
                INSERT INTO clinicqueue.survey_templates (category_code, category_label, category_label_hi, icon_name, questions, version, is_active)
                VALUES (%s, %s, %s, %s, %s, 1, TRUE)
                RETURNING id;
            """, (code, label, label_hi, icon, Json(qs)))
            template_ids[code] = cur.fetchone()[0]
    print(f"Survey templates ready: {template_ids}")

    # 2. Seed CHOs
    chos = [
        ('9876522222', 'Dr. Ananya Verma (CHO)', 'Chandpur Block', 'Varanasi'),
        ('9876522223', 'Dr. Rajesh Patil (CHO)', 'Haveli Block', 'Pune'),
    ]
    for phone, name, block, district in chos:
        cur.execute("""
            INSERT INTO clinicqueue.cho_officers (phone, name, block_name, district_name, is_active)
            VALUES (%s, %s, %s, %s, TRUE)
            ON CONFLICT (phone) DO UPDATE SET
                name = EXCLUDED.name,
                block_name = EXCLUDED.block_name,
                district_name = EXCLUDED.district_name,
                is_active = TRUE;
        """, (phone, name, block, district))
    print("CHOs seeded successfully.")

    # 3. Seed ANMs (Rekha Sharma & Priya Jadhav)
    anms = [
        ('9876543211', 'Rekha Sharma (ANM)', 'Chandpur Subcenter', 'Chandpur Block', 'Varanasi', '9876522222', 'ANM-QR-9876543211'),
        ('9876543212', 'Priya Jadhav (ANM)', 'Haveli Subcenter', 'Haveli Block', 'Pune', '9876522223', 'ANM-QR-9876543212'),
    ]
    for phone, name, village, block, district, cho_phone, qr in anms:
        cur.execute("""
            INSERT INTO clinicqueue.asha_workers (phone, name, village_name, block_name, district_name, anm_phone, role, is_active, preferred_language)
            VALUES (%s, %s, %s, %s, %s, %s, 'ANM', TRUE, 'hi')
            ON CONFLICT (phone) DO UPDATE SET
                name = EXCLUDED.name,
                village_name = EXCLUDED.village_name,
                block_name = EXCLUDED.block_name,
                district_name = EXCLUDED.district_name,
                anm_phone = EXCLUDED.anm_phone,
                role = 'ANM',
                is_active = TRUE;
        """, (phone, name, village, block, district, cho_phone))

        cur.execute("""
            INSERT INTO clinicqueue.anm_profiles (phone, name, phc_name, qr_code_data)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (phone) DO UPDATE SET
                name = EXCLUDED.name,
                phc_name = EXCLUDED.phc_name,
                qr_code_data = EXCLUDED.qr_code_data;
        """, (phone, name, village, qr))
    print("ANMs seeded successfully.")

    # 4. Seed ASHAs
    ashas = [
        ('9876543210', 'Sunita Devi (ASHA)', 'Rampur', 'Chandpur Block', 'Varanasi', '9876543211', 'hi'),
        ('9876543209', 'Kavita Shinde (ASHA)', 'Shivpur', 'Chandpur Block', 'Varanasi', '9876543211', 'hi'),
        ('9876543208', 'Pooja Gaikwad (ASHA)', 'Wagholi', 'Haveli Block', 'Pune', '9876543212', 'mr'),
        ('9876543207', 'Meena Kumari (ASHA)', 'Khed', 'Haveli Block', 'Pune', '9876543212', 'mr'),
    ]
    for phone, name, village, block, district, anm_phone, lang in ashas:
        cur.execute("""
            INSERT INTO clinicqueue.asha_workers (phone, name, village_name, block_name, district_name, anm_phone, role, is_active, preferred_language)
            VALUES (%s, %s, %s, %s, %s, %s, 'ASHA', TRUE, %s)
            ON CONFLICT (phone) DO UPDATE SET
                name = EXCLUDED.name,
                village_name = EXCLUDED.village_name,
                block_name = EXCLUDED.block_name,
                district_name = EXCLUDED.district_name,
                anm_phone = EXCLUDED.anm_phone,
                role = 'ASHA',
                preferred_language = EXCLUDED.preferred_language,
                is_active = TRUE;
        """, (phone, name, village, block, district, anm_phone, lang))
    print("ASHAs seeded successfully.")

    # 5. Clean up old test families for these ASHAs to guarantee fresh, well-structured test set
    asha_phone_list = [a[0] for a in ashas]
    cur.execute("SELECT id FROM clinicqueue.family_units WHERE asha_worker_phone = ANY(%s);", (asha_phone_list,))
    old_f_ids = [r[0] for r in cur.fetchall()]
    if old_f_ids:
        cur.execute("DELETE FROM clinicqueue.follow_up_tasks WHERE family_unit_id = ANY(%s);", (old_f_ids,))
        cur.execute("DELETE FROM clinicqueue.survey_responses WHERE family_unit_id = ANY(%s);", (old_f_ids,))
        cur.execute("DELETE FROM clinicqueue.family_members WHERE family_unit_id = ANY(%s);", (old_f_ids,))
        cur.execute("DELETE FROM clinicqueue.family_units WHERE id = ANY(%s);", (old_f_ids,))
        print(f"Cleaned up {len(old_f_ids)} previous test families.")

    # 6. Seed 24 rich households across the 4 ASHAs (6 families per ASHA)
    families_data = [
        # ASHA Sunita Devi (9876543210) - Rampur (Varanasi)
        {
            "asha": "9876543210", "house": "101", "head": "रामेश्वर प्रसाद यादव", "phone": "9811001011",
            "village": "Rampur", "interval": 7, "seq": 1,
            "members": [
                {"name": "रामेश्वर प्रसाद यादव", "dob": "1972-04-12", "age": 52, "gender": "male", "rel": "Head", "chronic": True, "cond": "Hypertension"},
                {"name": "शारदा यादव", "dob": "1976-08-20", "age": 48, "gender": "female", "rel": "Wife", "chronic": False},
                {"name": "अमित यादव", "dob": "1998-02-14", "age": 26, "gender": "male", "rel": "Son", "chronic": False},
                {"name": "सावित्री यादव", "dob": "2000-05-18", "age": 24, "gender": "female", "rel": "Daughter-in-law", "pregnant": True, "edd": date.today() + timedelta(days=22), "chronic": False, "high_risk": True}
            ]
        },
        {
            "asha": "9876543210", "house": "102", "head": "दिनेश कुमार मौर्य", "phone": "9811001012",
            "village": "Rampur", "interval": 15, "seq": 2,
            "members": [
                {"name": "दिनेश कुमार मौर्य", "dob": "1985-09-10", "age": 39, "gender": "male", "rel": "Head", "chronic": False},
                {"name": "सुनीता मौर्य", "dob": "1989-11-25", "age": 35, "gender": "female", "rel": "Wife", "chronic": False},
                {"name": "आरव मौर्य", "dob": "2024-03-10", "age": 0, "gender": "male", "rel": "Son", "chronic": False, "infant": True}
            ]
        },
        {
            "asha": "9876543210", "house": "103", "head": "संतोष विश्वकर्मा", "phone": "9811001013",
            "village": "Rampur", "interval": 30, "seq": 3,
            "members": [
                {"name": "संतोष विश्वकर्मा", "dob": "1980-01-15", "age": 44, "gender": "male", "rel": "Head", "chronic": False},
                {"name": "कमला विश्वकर्मा", "dob": "1984-06-12", "age": 40, "gender": "female", "rel": "Wife", "chronic": False},
                {"name": "रोहन विश्वकर्मा", "dob": "2008-07-22", "age": 16, "gender": "male", "rel": "Son", "chronic": False}
            ]
        },
        {
            "asha": "9876543210", "house": "104", "head": "हरीश चंद्र पटेल", "phone": "9811001014",
            "village": "Rampur", "interval": 7, "seq": 4,
            "members": [
                {"name": "हरीश चंद्र पटेल", "dob": "1960-03-05", "age": 64, "gender": "male", "rel": "Head", "chronic": True, "cond": "Diabetes Type 2"},
                {"name": "प्रभावती पटेल", "dob": "1965-10-18", "age": 59, "gender": "female", "rel": "Wife", "chronic": True, "cond": "Hypertension"},
                {"name": "नीरज पटेल", "dob": "1992-12-01", "age": 32, "gender": "male", "rel": "Son", "chronic": False}
            ]
        },
        {
            "asha": "9876543210", "house": "105", "head": "विनोद राजभर", "phone": "9811001015",
            "village": "Rampur", "interval": 15, "seq": 5,
            "members": [
                {"name": "विनोद राजभर", "dob": "1994-04-10", "age": 30, "gender": "male", "rel": "Head", "chronic": False},
                {"name": "गुड़िया राजभर", "dob": "1998-03-15", "age": 26, "gender": "female", "rel": "Wife", "pregnant": True, "edd": date.today() + timedelta(days=95), "chronic": False},
                {"name": "अंश राजभर", "dob": "2021-08-05", "age": 3, "gender": "male", "rel": "Son", "chronic": False}
            ]
        },
        {
            "asha": "9876543210", "house": "106", "head": "अशोक कुमार बिंद", "phone": "9811001016",
            "village": "Rampur", "interval": 30, "seq": 6,
            "members": [
                {"name": "अशोक कुमार बिंद", "dob": "1978-11-20", "age": 46, "gender": "male", "rel": "Head", "chronic": False},
                {"name": "मंजू बिंद", "dob": "1982-02-14", "age": 42, "gender": "female", "rel": "Wife", "chronic": False},
                {"name": "काजल बिंद", "dob": "2006-09-09", "age": 18, "gender": "female", "rel": "Daughter", "chronic": False}
            ]
        },

        # ASHA Kavita Shinde (9876543209) - Shivpur (Varanasi)
        {
            "asha": "9876543209", "house": "201", "head": "बृजेश कुमार सिंह", "phone": "9811002011",
            "village": "Shivpur", "interval": 7, "seq": 1,
            "members": [
                {"name": "बृजेश कुमार सिंह", "dob": "1982-07-14", "age": 42, "gender": "male", "rel": "Head", "chronic": False},
                {"name": "ममता सिंह", "dob": "1986-05-19", "age": 38, "gender": "female", "rel": "Wife", "pregnant": True, "edd": date.today() + timedelta(days=14), "chronic": True, "cond": "Severe Anemia", "high_risk": True},
                {"name": "खुशी सिंह", "dob": "2012-10-04", "age": 12, "gender": "female", "rel": "Daughter", "chronic": False}
            ]
        },
        {
            "asha": "9876543209", "house": "202", "head": "प्रमोद तिवारी", "phone": "9811002012",
            "village": "Shivpur", "interval": 15, "seq": 2,
            "members": [
                {"name": "प्रमोद तिवारी", "dob": "1975-03-30", "age": 49, "gender": "male", "rel": "Head", "chronic": True, "cond": "Asthma"},
                {"name": "रेनू तिवारी", "dob": "1980-08-14", "age": 44, "gender": "female", "rel": "Wife", "chronic": False},
                {"name": "प्रियांशु तिवारी", "dob": "2023-11-01", "age": 1, "gender": "male", "rel": "Son", "chronic": False, "infant": True}
            ]
        },
        {
            "asha": "9876543209", "house": "203", "head": "सुरेंद्र कुमार चौहान", "phone": "9811002013",
            "village": "Shivpur", "interval": 30, "seq": 3,
            "members": [
                {"name": "सुरेंद्र कुमार चौहान", "dob": "1988-12-12", "age": 36, "gender": "male", "rel": "Head", "chronic": False},
                {"name": "पूजा चौहान", "dob": "1992-04-18", "age": 32, "gender": "female", "rel": "Wife", "chronic": False}
            ]
        },
        {
            "asha": "9876543209", "house": "204", "head": "राधेश्याम गौड़", "phone": "9811002014",
            "village": "Shivpur", "interval": 15, "seq": 4,
            "members": [
                {"name": "राधेश्याम गौड़", "dob": "1970-01-20", "age": 54, "gender": "male", "rel": "Head", "chronic": False},
                {"name": "विमला गौड़", "dob": "1975-06-15", "age": 49, "gender": "female", "rel": "Wife", "chronic": True, "cond": "Arthritis"}
            ]
        },
        {
            "asha": "9876543209", "house": "205", "head": "विजय कुमार शर्मा", "phone": "9811002015",
            "village": "Shivpur", "interval": 7, "seq": 5,
            "members": [
                {"name": "विजय कुमार शर्मा", "dob": "1996-08-11", "age": 28, "gender": "male", "rel": "Head", "chronic": False},
                {"name": "अंजली शर्मा", "dob": "1999-01-22", "age": 25, "gender": "female", "rel": "Wife", "pregnant": True, "edd": date.today() + timedelta(days=45), "chronic": False}
            ]
        },
        {
            "asha": "9876543209", "house": "206", "head": "मनोज प्रजापति", "phone": "9811002016",
            "village": "Shivpur", "interval": 30, "seq": 6,
            "members": [
                {"name": "मनोज प्रजापति", "dob": "1984-05-05", "age": 40, "gender": "male", "rel": "Head", "chronic": False},
                {"name": "सुशीला प्रजापति", "dob": "1988-09-15", "age": 36, "gender": "female", "rel": "Wife", "chronic": False}
            ]
        },

        # ASHA Pooja Gaikwad (9876543208) - Wagholi (Pune, Marathi)
        {
            "asha": "9876543208", "house": "301", "head": "तानाजी संभाजी माने", "phone": "9811003011",
            "village": "Wagholi", "interval": 7, "seq": 1,
            "members": [
                {"name": "तानाजी संभाजी माने", "dob": "1975-08-15", "age": 49, "gender": "male", "rel": "Head", "chronic": True, "cond": "उच्च रक्तदाब (Hypertension)"},
                {"name": "सुवर्णा तानाजी माने", "dob": "1980-02-10", "age": 44, "gender": "female", "rel": "Wife", "chronic": False},
                {"name": "रोहन तानाजी माने", "dob": "1998-11-20", "age": 26, "gender": "male", "rel": "Son", "chronic": False},
                {"name": "प्रियांका रोहन माने", "dob": "2001-04-12", "age": 23, "gender": "female", "rel": "Daughter-in-law", "pregnant": True, "edd": date.today() + timedelta(days=18), "chronic": True, "cond": "तीव्र अशक्तपणा (Gestational Anemia)", "high_risk": True}
            ]
        },
        {
            "asha": "9876543208", "house": "302", "head": "दत्तात्रय ज्ञानोबा जगताप", "phone": "9811003012",
            "village": "Wagholi", "interval": 15, "seq": 2,
            "members": [
                {"name": "दत्तात्रय जगताप", "dob": "1986-06-25", "age": 38, "gender": "male", "rel": "Head", "chronic": False},
                {"name": "रुक्मिणी जगताप", "dob": "1990-09-14", "age": 34, "gender": "female", "rel": "Wife", "chronic": False},
                {"name": "ओम जगताप", "dob": "2024-02-15", "age": 0, "gender": "male", "rel": "Son", "chronic": False, "infant": True}
            ]
        },
        {
            "asha": "9876543208", "house": "303", "head": "बाळू किसनराव मोरे", "phone": "9811003013",
            "village": "Wagholi", "interval": 30, "seq": 3,
            "members": [
                {"name": "बाळू मोरे", "dob": "1968-12-05", "age": 56, "gender": "male", "rel": "Head", "chronic": True, "cond": "मधुमेह (Diabetes)"},
                {"name": "अनुसया मोरे", "dob": "1972-03-18", "age": 52, "gender": "female", "rel": "Wife", "chronic": False}
            ]
        },
        {
            "asha": "9876543208", "house": "304", "head": "ज्ञानेश्वर तुकाराम कदम", "phone": "9811003014",
            "village": "Wagholi", "interval": 7, "seq": 4,
            "members": [
                {"name": "ज्ञानेश्वर कदम", "dob": "1995-05-10", "age": 29, "gender": "male", "rel": "Head", "chronic": False},
                {"name": "कविता ज्ञानेश्वर कदम", "dob": "1998-07-28", "age": 26, "gender": "female", "rel": "Wife", "pregnant": True, "edd": date.today() + timedelta(days=60), "chronic": False}
            ]
        },
        {
            "asha": "9876543208", "house": "305", "head": "मारुती विठ्ठल शिंदे", "phone": "9811003015",
            "village": "Wagholi", "interval": 15, "seq": 5,
            "members": [
                {"name": "मारुती शिंदे", "dob": "1980-04-12", "age": 44, "gender": "male", "rel": "Head", "chronic": False},
                {"name": "मंदाकिनी शिंदे", "dob": "1985-08-30", "age": 39, "gender": "female", "rel": "Wife", "chronic": False},
                {"name": "स्वरा शिंदे", "dob": "2021-06-18", "age": 3, "gender": "female", "rel": "Daughter", "chronic": False}
            ]
        },
        {
            "asha": "9876543208", "house": "306", "head": "आनंदा रघुनाथ गायकवाड", "phone": "9811003016",
            "village": "Wagholi", "interval": 30, "seq": 6,
            "members": [
                {"name": "आनंदा गायकवाड", "dob": "1972-01-01", "age": 52, "gender": "male", "rel": "Head", "chronic": False},
                {"name": "सविता गायकवाड", "dob": "1976-11-15", "age": 48, "gender": "female", "rel": "Wife", "chronic": False}
            ]
        },

        # ASHA Meena Kumari (9876543207) - Khed (Pune, Marathi)
        {
            "asha": "9876543207", "house": "401", "head": "संजय बापूराव भोसले", "phone": "9811004011",
            "village": "Khed", "interval": 7, "seq": 1,
            "members": [
                {"name": "संजय भोसले", "dob": "1978-03-22", "age": 46, "gender": "male", "rel": "Head", "chronic": False},
                {"name": "उज्वला भोसले", "dob": "1983-09-08", "age": 41, "gender": "female", "rel": "Wife", "chronic": True, "cond": "उच्च रक्तदाब (Hypertension)"},
                {"name": "तेजस भोसले", "dob": "2002-12-19", "age": 22, "gender": "male", "rel": "Son", "chronic": False},
                {"name": "पूजा तेजस भोसले", "dob": "2004-06-15", "age": 20, "gender": "female", "rel": "Daughter-in-law", "pregnant": True, "edd": date.today() + timedelta(days=28), "chronic": False, "high_risk": True}
            ]
        },
        {
            "asha": "9876543207", "house": "402", "head": "प्रकाश एकनाथ साळुंखे", "phone": "9811004012",
            "village": "Khed", "interval": 15, "seq": 2,
            "members": [
                {"name": "प्रकाश साळुंखे", "dob": "1988-10-10", "age": 36, "gender": "male", "rel": "Head", "chronic": False},
                {"name": "दीपाली साळुंखे", "dob": "1992-01-20", "age": 32, "gender": "female", "rel": "Wife", "chronic": False},
                {"name": "साई साळुंखे", "dob": "2024-01-05", "age": 0, "gender": "male", "rel": "Son", "chronic": False, "infant": True}
            ]
        },
        {
            "asha": "9876543207", "house": "403", "head": "किरण तुकाराम चव्हाण", "phone": "9811004013",
            "village": "Khed", "interval": 30, "seq": 3,
            "members": [
                {"name": "किरण चव्हाण", "dob": "1970-07-07", "age": 54, "gender": "male", "rel": "Head", "chronic": True, "cond": "मधुमेह (Diabetes)"},
                {"name": "शोभा चव्हाण", "dob": "1975-12-25", "age": 49, "gender": "female", "rel": "Wife", "chronic": False}
            ]
        },
        {
            "asha": "9876543207", "house": "404", "head": "समीर रमेश वाघ", "phone": "9811004014",
            "village": "Khed", "interval": 15, "seq": 4,
            "members": [
                {"name": "समीर वाघ", "dob": "1993-02-18", "age": 31, "gender": "male", "rel": "Head", "chronic": False},
                {"name": "स्नेहल वाघ", "dob": "1997-09-12", "age": 27, "gender": "female", "rel": "Wife", "pregnant": True, "edd": date.today() + timedelta(days=75), "chronic": False}
            ]
        },
        {
            "asha": "9876543207", "house": "405", "head": "गणेश विष्णू कुंभार", "phone": "9811004015",
            "village": "Khed", "interval": 7, "seq": 5,
            "members": [
                {"name": "गणेश कुंभार", "dob": "1985-11-11", "age": 39, "gender": "male", "rel": "Head", "chronic": False},
                {"name": "सुरेखा कुंभार", "dob": "1989-04-14", "age": 35, "gender": "female", "rel": "Wife", "chronic": False},
                {"name": "वेदांत कुंभार", "dob": "2023-08-20", "age": 1, "gender": "male", "rel": "Son", "chronic": False, "infant": True}
            ]
        },
        {
            "asha": "9876543207", "house": "406", "head": "अशोक नामदेव थोरात", "phone": "9811004016",
            "village": "Khed", "interval": 30, "seq": 6,
            "members": [
                {"name": "अशोक थोरात", "dob": "1965-05-15", "age": 59, "gender": "male", "rel": "Head", "chronic": True, "cond": "हृदयरोग (Cardiac Care)"},
                {"name": "कमल थोरात", "dob": "1970-08-22", "age": 54, "gender": "female", "rel": "Wife", "chronic": False}
            ]
        }
    ]

    total_members = 0
    total_surveys = 0
    total_tasks = 0

    for fam in families_data:
        # Determine next visit date based on priority interval
        days_ahead = fam["interval"]
        next_visit = date.today() + timedelta(days=days_ahead)
        last_visit = datetime.now() - timedelta(days=random.randint(2, 20))

        cur.execute("""
            INSERT INTO clinicqueue.family_units (
                primary_phone, head_name, village_name, house_number, sequential_number,
                visit_interval_days, next_visit_date, asha_worker_phone, last_visited_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id;
        """, (
            fam["phone"], fam["head"], fam["village"], fam["house"], fam["seq"],
            fam["interval"], next_visit, fam["asha"], last_visit
        ))
        family_id = cur.fetchone()[0]

        # Determine supervisor ANM and CHO
        cur.execute("SELECT anm_phone FROM clinicqueue.asha_workers WHERE phone = %s;", (fam["asha"],))
        anm_phone = cur.fetchone()[0]
        cur.execute("SELECT anm_phone FROM clinicqueue.asha_workers WHERE phone = %s;", (anm_phone,))
        cho_phone = cur.fetchone()[0]

        for m in fam["members"]:
            total_members += 1
            is_preg = m.get("pregnant", False)
            edd = m.get("edd")
            has_chronic = m.get("chronic", False)
            cond = m.get("cond")
            is_infant = m.get("infant", False)
            is_high_risk = m.get("high_risk", False)

            # Generate ABHA ID
            abha_num = f"{random.randint(10,99)}-{random.randint(1000,9999)}-{random.randint(1000,9999)}-{random.randint(1000,9999)}"
            abha_addr = f"{m['name'].split()[0].lower()}{random.randint(100,999)}@abdm"

            cur.execute("""
                INSERT INTO clinicqueue.family_members (
                    family_unit_id, name, dob, age, gender, relationship, phone,
                    abha_number, abha_address, is_abha_linked,
                    is_pregnant, expected_delivery_date,
                    has_chronic_condition, chronic_condition_type,
                    last_survey_date, follow_up_due_date, follow_up_reason
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, TRUE,
                    %s, %s,
                    %s, %s,
                    %s, %s, %s
                ) RETURNING id;
            """, (
                family_id, m["name"], m["dob"], m["age"], m["gender"], m["rel"], fam["phone"],
                abha_num, abha_addr,
                is_preg, edd,
                has_chronic, cond,
                last_visit,
                date.today() + timedelta(days=fam["interval"]),
                "उच्च जोखिम गर्भावस्था समीक्षा" if is_high_risk else ("नियमित टीकाकरण" if is_infant else ("NCD नियमित निगरानी" if has_chronic else "सामान्य स्वास्थ्य फॉलो-अप"))
            ))
            member_id = cur.fetchone()[0]

            # 7. Seed Surveys for pregnant, infant, and chronic members
            if is_preg:
                cur.execute("""
                    INSERT INTO clinicqueue.survey_responses (
                        family_unit_id, family_member_id, template_id, category_code,
                        asha_worker_phone, answers, synced_to_anm, target_anm_phone, synced_at
                    ) VALUES (%s, %s, %s, 'PREGNANCY', %s, %s, TRUE, %s, %s);
                """, (
                    family_id, member_id, template_ids['PREGNANCY'], fam["asha"],
                    Json({"p1": False, "p2": str(date.today() - timedelta(days=200)), "p3": is_high_risk, "p4": 8.5 if is_high_risk else 11.2}),
                    anm_phone, datetime.now() - timedelta(days=1)
                ))
                total_surveys += 1

                # Seed Referral Task to CHO
                status = "PENDING" if is_high_risk else "COMPLETED"
                cur.execute("""
                    INSERT INTO clinicqueue.follow_up_tasks (
                        family_unit_id, family_member_id, asha_worker_phone, task_type,
                        title, description, due_date, status, cho_approved_by, cho_approved_at, cho_note
                    ) VALUES (%s, %s, %s, 'ASHA_TO_CHO_REFERRAL', %s, %s, %s, %s, %s, %s, %s);
                """, (
                    family_id, member_id, fam["asha"],
                    f"⚠️ उच्च जोखिम गर्भावस्था रेफरल: {m['name']}",
                    f"हीमोग्लोबिन स्तर 8.5 g/dL, गंभीर एनीमिया। CHO / CHC द्वारा अल्ट्रासाउंड एवं आयरन सुक्रोज इन्फ्यूजन अनुमोदन आवश्यक।",
                    date.today() + timedelta(days=2),
                    status,
                    cho_phone if status == "COMPLETED" else None,
                    datetime.now() - timedelta(hours=6) if status == "COMPLETED" else None,
                    "सीएचओ अनुमोदन: सीएचसी रेफरल स्वीकृत, 102 एम्बुलेंस समन्वित" if status == "COMPLETED" else None
                ))
                total_tasks += 1

            if is_infant:
                cur.execute("""
                    INSERT INTO clinicqueue.survey_responses (
                        family_unit_id, family_member_id, template_id, category_code,
                        asha_worker_phone, answers, synced_to_anm, target_anm_phone, synced_at
                    ) VALUES (%s, %s, %s, 'CHILD', %s, %s, TRUE, %s, %s);
                """, (
                    family_id, member_id, template_ids['CHILD'], fam["asha"],
                    Json({"c1": 2.9, "c2": True, "c3": True}),
                    anm_phone, datetime.now() - timedelta(days=2)
                ))
                total_surveys += 1

                cur.execute("""
                    INSERT INTO clinicqueue.follow_up_tasks (
                        family_unit_id, family_member_id, asha_worker_phone, task_type,
                        title, description, due_date, status
                    ) VALUES (%s, %s, %s, 'VACCINATION', %s, %s, %s, 'PENDING');
                """, (
                    family_id, member_id, fam["asha"],
                    f"💉 बाल टीकाकरण (Pentavalent / MR): {m['name']}",
                    "आगामी ग्राम स्वास्थ्य पोषण दिवस (VHND) सत्र पर टीकाकरण देय।",
                    date.today() + timedelta(days=5)
                ))
                total_tasks += 1

            if has_chronic:
                cur.execute("""
                    INSERT INTO clinicqueue.survey_responses (
                        family_unit_id, family_member_id, template_id, category_code,
                        asha_worker_phone, answers, synced_to_anm, target_anm_phone, synced_at
                    ) VALUES (%s, %s, %s, 'DISEASE', %s, %s, TRUE, %s, %s);
                """, (
                    family_id, member_id, template_ids['DISEASE'], fam["asha"],
                    Json({"d1": "150/95 mmHg", "d2": 180, "d3": True}),
                    anm_phone, datetime.now() - timedelta(days=3)
                ))
                total_surveys += 1

                cur.execute("""
                    INSERT INTO clinicqueue.follow_up_tasks (
                        family_unit_id, family_member_id, asha_worker_phone, task_type,
                        title, description, due_date, status
                    ) VALUES (%s, %s, %s, 'NCD_FOLLOWUP', %s, %s, %s, 'PENDING');
                """, (
                    family_id, member_id, fam["asha"],
                    f"🩺 NCD दवा एवं बीपी जांच: {m['name']}",
                    f"पुरानी बीमारी: {cond}। प्राथमिक स्वास्थ्य केंद्र से मासिक दवा रिफिल सत्यापन।",
                    date.today() + timedelta(days=7)
                ))
                total_tasks += 1

    conn.commit()
    print("=" * 60)
    print("✅ DATABASE SEEDING COMPLETED SUCCESSFULLY!")
    print(f"• 2 CHOs (Dr. Ananya Verma, Dr. Rajesh Patil)")
    print(f"• 2 ANMs (Rekha Sharma, Priya Jadhav)")
    print(f"• 4 ASHAs (Sunita Devi, Kavita Shinde, Pooja Gaikwad, Meena Kumari)")
    print(f"• 24 Family Units seeded across Rampur, Shivpur, Wagholi, Khed")
    print(f"• {total_members} Family Members with ABHA IDs & Health Profiles")
    print(f"• {total_surveys} Clinical Survey Responses")
    print(f"• {total_tasks} Follow-up & CHO Referral Tasks")
    print("=" * 60)

except Exception as e:
    conn.rollback()
    print(f"❌ Error during seeding: {e}", file=sys.stderr)
    import traceback
    traceback.print_exc()
    sys.exit(1)
finally:
    cur.close()
    conn.close()
