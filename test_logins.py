import requests
import urllib3
urllib3.disable_warnings()

base = 'https://r30w1p3cyh.execute-api.us-east-1.amazonaws.com'

tests = [
    ('CHO', '9876522222', 'Dr. Ananya Verma'),
    ('CHO', '9876522223', 'Dr. Rajesh Patil'),
    ('ANM', '9876543211', 'Rekha Sharma'),
    ('ANM', '9876543212', 'Priya Jadhav'),
    ('ASHA', '9876543210', 'Sunita Devi'),
    ('ASHA', '9876543209', 'Kavita Shinde'),
    ('ASHA', '9876543208', 'Pooja Gaikwad'),
    ('ASHA', '9876543207', 'Meena Kumari'),
]

print("=== VERIFYING LIVE AWS LAMBDA OTP LOGINS (OTP: 123456) ===")
for role, phone, name in tests:
    res = requests.post(f'{base}/api/auth/otp/verify', json={'phone': phone, 'code': '123456', 'purpose': 'WORKER'}, verify=False, timeout=25)
    data = res.json()
    status = res.status_code
    success = data.get('success')
    res_role = data.get('role')
    profile_name = data.get('profile', {}).get('name') if data.get('profile') else None
    print(f"[{status}] {role:4} {name:20} ({phone}) -> Success: {success} | Role: {res_role} | Name: {profile_name}")
