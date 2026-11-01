import json

with open('full_slides_detail.json', 'r', encoding='utf-8') as f:
    slides = json.load(f)

with open('slides_formatted.txt', 'w', encoding='utf-8') as out:
    for s in slides:
        out.write(f"\n==================== SLIDE {s['slide_num']} ====================\n")
        for sh in s['shapes']:
            txt = sh.get('text', '').replace('\n', ' // ')
            if txt.strip():
                out.write(f"[{sh['name']}]: {txt}\n")
print("Done writing slides_formatted.txt")
