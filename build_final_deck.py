import pptx
from pptx.util import Pt
from pptx.dml.color import RGBColor
import os
import shutil

src_path = r'C:\Users\Krishana dubey\.gemini\antigravity\brain\1daec743-24f8-4020-8df9-b72fa44deb4a\.user_uploaded\media_1793290444969.pptx'
out_path = r'c:\Users\Krishana dubey\hospital-spring-boot\AarogyaFlow_Seva_Challenge_2026.pptx'

prs = pptx.Presentation(src_path)

def hex_to_rgb(hex_str):
    if not hex_str:
        return None
    hex_str = hex_str.strip().lstrip('#')
    return RGBColor(int(hex_str[0:2], 16), int(hex_str[2:4], 16), int(hex_str[4:6], 16))

def get_shape(slide, name):
    for sh in slide.shapes:
        if sh.name == name:
            return sh
    return None

def update_shape_runs(shape, para_specs):
    if not shape:
        return
    tf = shape.text_frame
    tf.word_wrap = True
    
    # Remove excess paragraphs
    while len(tf.paragraphs) > len(para_specs):
        p_elem = tf.paragraphs[-1]._p
        p_elem.getparent().remove(p_elem)
        
    for p_idx, runs in enumerate(para_specs):
        if p_idx < len(tf.paragraphs):
            p = tf.paragraphs[p_idx]
        else:
            p = tf.add_paragraph()
            
        p.text = ""
        for r_spec in runs:
            text, bold, size_pt, hex_color = r_spec
            run = p.add_run()
            run.text = text
            if bold is not None:
                run.font.bold = bold
            if size_pt is not None:
                run.font.size = Pt(size_pt)
            if hex_color:
                run.font.color.rgb = hex_to_rgb(hex_color)

# ==========================================
# SLIDE 1
# ==========================================
s1 = prs.slides[0]

# Sub-description
update_shape_runs(get_shape(s1, 'Text 2'), [
    [("A WhatsApp-first platform that links travel-aware OPD queues, consent-based health records, closed-loop referrals and an offline-first ASHA app, built on ABDM, ABHA and FHIR R4.", False, 12.0, "C9D2EC")]
])

# Chip 1 label
update_shape_runs(get_shape(s1, 'Chip 1 label'), [
    [("shorter in-clinic wait in UAT (92.96 → 5 min via dynamic ETA)", False, 9.0, "C9D2EC")]
])

# Team line
update_shape_runs(get_shape(s1, 'Team line'), [
    [("Team Swayambhu • TCET Mumbai", True, 9.5, "FFFFFF")]
])

# Collage caption
update_shape_runs(get_shape(s1, 'Collage caption'), [
    [("Working prototype: doctor workbench, zero-install patient app, WhatsApp bot, and offline ASHA grid", False, 8.0, "C9D2EC")]
])

# Replace screenshot: patient app + call alert with clean_patient_app.png
patient_app_shape = get_shape(s1, 'Screenshot: patient app + call alert')
if patient_app_shape and os.path.exists('extracted_images/clean_patient_app.png'):
    blip = patient_app_shape._element.xpath('.//a:blip')
    if blip:
        rId = blip[0].get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
        img_part = s1.part.related_part(rId)
        with open('extracted_images/clean_patient_app.png', 'rb') as f:
            img_part._blob = f.read()
    patient_app_shape.name = 'Screenshot: patient app (clean)'

print("Slide 1 updated.")

# ==========================================
# SLIDE 2
# ==========================================
s2 = prs.slides[1]

# What is the problem?
update_shape_runs(get_shape(s2, 'Text 7'), [
    [("Queue: ", True, 10.0, "1B2A5C"), ("Blind waits; rural families lose 1–1.5 days daily wages (₹400–600)", False, 10.0, "1F2937")],
    [("Records: ", True, 10.0, "1B2A5C"), ("Paper slips lost; zero clinical continuity across visits", False, 10.0, "1F2937")],
    [("Referral: ", True, 10.0, "1B2A5C"), ("Verbal slips; 0% tracked completion & zero back-referral", False, 10.0, "1F2937")],
    [("Follow-up: ", True, 10.0, "1B2A5C"), ("Paper diaries slip; high-risk cases missed in field", False, 10.0, "1F2937")],
    [("Root cause: ", True, 10.0, "1B2A5C"), ("Disconnected workflows across community, PHC & DH", False, 10.0, "1F2937")]
])

# Who is affected, and where?
update_shape_runs(get_shape(s2, 'Text 10'), [
    [("Rural patients & daily wagers ", False, 10.0, "1F2937"), ("travelling up to 40 km", True, 10.0, "1F2937"), (" to district OPDs", False, 10.0, "1F2937")],
    [("10.29 lakh", True, 10.0, "1F2937"), (" ASHA workers [4], plus ANM and CHO supervisors", False, 10.0, "1F2937")],
    [("Overburdened OPD doctors and hospital front desks managing crowding", False, 10.0, "1F2937")],
    [("Pilot corridor: ", True, 10.0, "1B2A5C"), ("1 linked PHC + District Hospital + 25 ASHA beats", False, 10.0, "1F2937")]
])

# Evidence
update_shape_runs(get_shape(s2, 'Text 13'), [
    [("59 min mean wait vs 6.9 min with the doctor in a Maharashtra tertiary hospital [2]", False, 10.0, "1F2937")],
    [("57 ASHAs: paper diaries hard to read, confusing & claim delays [3]", False, 10.0, "1F2937")],
    [("ASHA incentives are claim-based; unrecorded work means lost livelihood [5]", False, 10.0, "1F2937")]
])

# Current gaps
update_shape_runs(get_shape(s2, 'Text 16'), [
    [("Waiting is invisible: patients travel blindly, wait hours, or forfeit turns", False, 10.0, "1F2937")],
    [("Records and referrals do not travel across primary & district tiers", False, 10.0, "1F2937")],
    [("No back-referral : ", True, 10.0, "1F2937"), ("the loop never closes between DH & ASHA", False, 10.0, "1F2937")],
    [("Paper diaries and weak signal slow high-risk ANC/NCD follow-up", False, 10.0, "1F2937")]
])

# Why it matters
update_shape_runs(get_shape(s2, 'Text 21'), [
    [("A referral is not complete when a patient gets a paper slip. It is complete when the next tier of care is reached, the specialist consults, and the back-referral loop closes with community follow-up.", False, 10.0, "C9D2EC")]
])

print("Slide 2 updated.")

# ==========================================
# SLIDE 3
# ==========================================
s3 = prs.slides[2]

# Our solution in brief
update_shape_runs(get_shape(s3, 'Text 6'), [
    [("AarogyaFlow connects the whole patient journey end-to-end. ", False, 10.0, "1F2937")],
    [("Patients book and track OPD tokens on ", False, 10.0, "1F2937"), ("WhatsApp or web without app install", True, 10.0, "1F2937"), (". ", False, 10.0, "1F2937")],
    [("Doctors keep every visit, FHIR prescription and referral ", False, 10.0, "1F2937"), ("in one treatment course. ", True, 10.0, "1F2937")],
    [("ASHA workers use an offline, voice-enabled household app that ", False, 10.0, "1F2937"), ("flags overdue high-risk visits.", True, 10.0, "1F2937")]
])

# Input
update_shape_runs(get_shape(s3, 'Text 12'), [
    [("Patient :- token request + live GPS location.", False, 9.0, "1F2937")],
    [("Doctor :- consult, FHIR R4 Rx & digital referral.", False, 9.0, "1F2937")],
    [("ASHA :- voice & grid entry offline; auto-sync.", False, 9.0, "1F2937")]
])

# Process
update_shape_runs(get_shape(s3, 'Text 18'), [
    [("Dynamic Travel ETA vs queue speed", True, 9.0, "1F2937"), ("; late patients deferred, not struck off; emergency priority insertion.", False, 9.0, "1F2937")]
])

# Output
update_shape_runs(get_shape(s3, 'Text 24'), [
    [("“Leave now” WhatsApp alerts (saves 88+ min); consent-based FHIR records; closed-loop ASHA back-referrals.", False, 9.0, "1F2937")]
])

# Key USP
update_shape_runs(get_shape(s3, 'Text 27'), [
    [("Smart OPD Queues: ", True, 10.0, "1B2A5C"), ("Travel-aware arrival notifications & dynamic buffer.", False, 10.0, "1F2937")],
    [("Digital Health Records: ", True, 10.0, "1B2A5C"), ("Secure, consent-based ABDM / FHIR R4 exchange.", False, 10.0, "1F2937")],
    [("Referral Tracking: ", True, 10.0, "1B2A5C"), ("Closed-loop back-referral auto-assigned to ASHA.", False, 10.0, "1F2937")],
    [("Offline ASHA App: ", True, 10.0, "1B2A5C"), ("Multilingual voice surveys and offline SQLite sync.", False, 10.0, "1F2937")],
    [("DPDP Act Compliant: ", True, 10.0, "1B2A5C"), ("Granular consent revocation & privacy-by-design.", False, 10.0, "1F2937")]
])

# Table 0 on Slide 3
for sh in s3.shapes:
    if sh.has_table:
        tbl = sh.table
        # Row 1: Cost
        tbl.cell(1, 1).text = "Wasted trips, lost wages, paper registers"
        tbl.cell(1, 2).text = "Software-first; ≈ ₹0.11 via Meta / free via NIC SMS"
        # Row 2: Speed / time
        tbl.cell(2, 1).text = "59–99 min crowded waiting room idle time"
        tbl.cell(2, 2).text = "92.96 → 5 min in-clinic wait in UAT (dynamic ETA)"
        # Row 3: Reach / access
        tbl.cell(3, 1).text = "Paper diaries, app-only tools, high drop-off"
        tbl.cell(3, 2).text = "Zero-install WhatsApp/web + 100% offline ASHA app"
        # Row 4: Ease of use
        tbl.cell(4, 1).text = "Verbal referrals, manual diary searches"
        tbl.cell(4, 2).text = "Multilingual voice entry & color-coded 24-grid"
        # Row 5: Continuity
        tbl.cell(5, 1).text = "Records & referrals stop at each hand-off"
        tbl.cell(5, 2).text = "Single FHIR R4 course; automated back-referral loop"
        
        # Style table cells neatly
        for r in tbl.rows:
            for cell in r.cells:
                for p in cell.text_frame.paragraphs:
                    p.font.size = Pt(9.5)
                    p.font.name = "Arial"

print("Slide 3 updated.")

# ==========================================
# SLIDE 4
# ==========================================
s4 = prs.slides[3]

# Technology
update_shape_runs(get_shape(s4, 'Text 19'), [
    [("Backend: ", True, 10.0, "1B2A5C"), ("Java 21, Spring Boot 3.3.x, PostgreSQL 16 (PgBouncer), Docker", False, 10.0, "1F2937")],
    [("Apps: ", True, 10.0, "1B2A5C"), ("React 19 web workbench; Expo offline mobile PWA; no hardware", False, 10.0, "1F2937")],
    [("Integrations: ", True, 10.0, "1B2A5C"), ("WhatsApp Cloud API, MapMyIndia/TomTom, Eka Care ABHA/ABDM, FHIR R4", False, 10.0, "1F2937")]
])

# Estimated cost
update_shape_runs(get_shape(s4, 'Text 22'), [
    [("≈ ₹0.115 ", True, 10.0, "1B2A5C"), ("per WhatsApp session; NIC SMS / Web Push fallback (< ₹0.05)", False, 10.0, "1F2937")],
    [("≈ ₹8k ", True, 10.0, "1B2A5C"), ("per month for cloud hosting, container runtime and backups", False, 10.0, "1F2937")],
    [("≈ ₹3–4 lakh ", True, 10.0, "1B2A5C"), ("for a 6-month pilot (~25 ASHAs covering ~25k pop; ₹12–16/person)", False, 10.0, "1F2937")]
])

# Partners
update_shape_runs(get_shape(s4, 'Text 28'), [
    [("Proposed (to be confirmed)", True, 9.5, "1B2A5C")],
    [("District Health Society / NHM district team", False, 9.5, "1F2937")],
    [("District hospital OPD + linked PHC corridor", False, 9.5, "1F2937")],
    [("ASHAs, ANMs, CHOs & community workers", False, 9.5, "1F2937")],
    [("In place", True, 9.5, "1B2A5C")],
    [("UAT with Sai Siddhi and Shiv Clinic; Eka Care ABDM APIs", False, 9.5, "1F2937")]
])

# Risks
update_shape_runs(get_shape(s4, 'Risk col 1'), [
    [("Weak connectivity → ", True, 10.0, "1B2A5C"), ("offline-first SQLite, auto delta-sync to ANM", False, 10.0, "1F2937")]
])
update_shape_runs(get_shape(s4, 'Risk col 2'), [
    [("Health-data privacy → ", True, 10.0, "1B2A5C"), ("DPDP Act 2023, OTP/QR consent, role-based access", False, 10.0, "1F2937")]
])
update_shape_runs(get_shape(s4, 'Risk col 3'), [
    [("ABDM / API changes → ", True, 10.0, "1B2A5C"), ("Eka Care sandbox + strict FHIR R4 abstraction", False, 10.0, "1F2937")]
])
update_shape_runs(get_shape(s4, 'Risk col 4'), [
    [("Field adoption → ", True, 10.0, "1B2A5C"), ("voice entry, Marathi/Hindi UI, zero patient app", False, 10.0, "1F2937")]
])

print("Slide 4 updated.")

# ==========================================
# SLIDE 5
# ==========================================
s5 = prs.slides[4]

# Metric 1: Beneficiaries
update_shape_runs(get_shape(s5, 'Text 8'), [
    [("pilot target: 1 PHC catchment ≈ 25 ASHAs × ~1,000 people (~25,000 population)", False, 9.0, "6B7280")]
])

# Metric 2: Shorter in-clinic wait
update_shape_runs(get_shape(s5, 'Text 11'), [
    [("Shorter in-clinic wait", True, 11.0, "1F2937")]
])
update_shape_runs(get_shape(s5, 'Text 12'), [
    [("92.96 → 5 min in-clinic waiting room time in UAT (≈ 88 min saved)", False, 9.0, "6B7280")]
])

# Metric 3: ASHAs livelihoods
update_shape_runs(get_shape(s5, 'Text 15'), [
    [("ASHA livelihoods supported", True, 11.0, "1F2937")]
])
update_shape_runs(get_shape(s5, 'Text 16'), [
    [("incentive-linked visits and high-risk follow-ups tracked in one app", False, 9.0, "6B7280")]
])

# Who benefits
update_shape_runs(get_shape(s5, 'Text 19'), [
    [("Patients: ", True, 10.0, "1B2A5C"), ("know their turn, avoid wage loss (₹400–600), own digital records", False, 10.0, "1F2937")],
    [("Doctors: ", True, 10.0, "1B2A5C"), ("fewer idle gaps, pre-visit history with consent, closed referrals", False, 10.0, "1F2937")],
    [("ASHAs: ", True, 10.0, "1B2A5C"), ("overdue visits auto-flagged, faster incentive claim verification", False, 10.0, "1F2937")],
    [("National Fit: ", True, 10.0, "1B2A5C"), ("Directly aligns with ABDM, NHM; UN SDGs 3, 5, 10", False, 10.0, "1F2937")]
])

# Sustainability
update_shape_runs(get_shape(s5, 'Text 22'), [
    [("Funded via NHM flexipool / District Health Society IT budget or CSR grants", False, 10.0, "1F2937")],
    [("Sub-₹0.15/visit marginal messaging via WhatsApp service & NIC SMS gateways", False, 10.0, "1F2937")],
    [("Open standards (FHIR R4, ABDM) avoid vendor lock-in & ensure HMIS interoperability", False, 10.0, "1F2937")]
])

# Scale-up plan
update_shape_runs(get_shape(s5, 'Text 25'), [
    [("Baseline + 6-month pilot in one PHC–hospital corridor to prove referral closure", False, 10.0, "1F2937")],
    [("Prove gains in waits, missed tokens, referral completion, ASHA follow-up & earnings", False, 10.0, "1F2937")],
    [("Standardise onboarding, data governance, vernacular training & field support", False, 10.0, "1F2937")],
    [("Expand district by district; Docker + FHIR make rollout repeatable & scalable", False, 10.0, "1F2937")]
])

print("Slide 5 updated.")

# ==========================================
# SLIDE 6
# ==========================================
s6 = prs.slides[5]

# Member 1
update_shape_runs(get_shape(s6, 'Text 7'), [
    [("Himanshu Gupta", True, 10.5, "FFFFFF")]
])
update_shape_runs(get_shape(s6, 'Text 8'), [
    [("Product Lead & UAT", False, 9.0, "F28C28")]
])
update_shape_runs(get_shape(s6, 'Text 9'), [
    [("B.Tech, TCET Mumbai", False, 8.5, "B8C2E0")]
])

# Member 2
update_shape_runs(get_shape(s6, 'Text 13'), [
    [("Krishna Dubey", True, 10.5, "FFFFFF")]
])
update_shape_runs(get_shape(s6, 'Text 14'), [
    [("Backend & ABDM Architect", False, 9.0, "F28C28")]
])
update_shape_runs(get_shape(s6, 'Text 15'), [
    [("B.Tech, TCET Mumbai", False, 8.5, "B8C2E0")]
])

# Member 3
update_shape_runs(get_shape(s6, 'Text 19'), [
    [("Kavish", True, 10.5, "FFFFFF")]
])
update_shape_runs(get_shape(s6, 'Text 20'), [
    [("Web & Patient Systems", False, 9.0, "F28C28")]
])
update_shape_runs(get_shape(s6, 'Text 21'), [
    [("B.Tech, TCET Mumbai", False, 8.5, "B8C2E0")]
])

# Member 4
update_shape_runs(get_shape(s6, 'Text 25'), [
    [("Team Swayambhu Lead", True, 10.5, "FFFFFF")]
])
update_shape_runs(get_shape(s6, 'Text 26'), [
    [("ASHA App & Offline Sync", False, 9.0, "F28C28")]
])
update_shape_runs(get_shape(s6, 'Text 27'), [
    [("B.Tech, TCET Mumbai", False, 8.5, "B8C2E0")]
])

# Support details
update_shape_runs(get_shape(s6, 'Support detail: Mentorship & technical guidance'), [
    [("Public-health workflows, epidemiologic metrics & DPDP compliance", False, 8.5, "6B7280")]
])
update_shape_runs(get_shape(s6, 'Support detail: Pilot with a government department'), [
    [("District Hospital + linked PHC corridor; ASHA/ANM/CHO unions", False, 8.5, "6B7280")]
])
update_shape_runs(get_shape(s6, 'Support detail: Funding / grant support'), [
    [("≈ ₹3–4 lakh: APIs, cloud hosting, vernacular training & field ops", False, 8.5, "6B7280")]
])
update_shape_runs(get_shape(s6, 'Support detail: Testing, certification or IP support'), [
    [("ABDM Milestone 1/2/3 production certification; independent outcome audit", False, 8.5, "6B7280")]
])

# Thank you & Contact
update_shape_runs(get_shape(s6, 'Text 42'), [
    [("Thank you  |  ", True, 11.0, "F28C28"), ("himanshuggupta16@gmail.com · 8879063655  |  Team Swayambhu, TCET Mumbai", True, 11.0, "F28C28")]
])

print("Slide 6 updated.")

# Save presentation
prs.save(out_path)
print(f"Presentation saved successfully to: {out_path}")

# Also copy to workspace brain user_uploaded backup if desired
user_uploaded_target = r'C:\Users\Krishana dubey\.gemini\antigravity\brain\1daec743-24f8-4020-8df9-b72fa44deb4a\AarogyaFlow_Seva_Challenge_2026.pptx'
shutil.copyfile(out_path, user_uploaded_target)
print(f"Backup copy saved to: {user_uploaded_target}")
