import json

with open('deck_dump.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

with open('deck_summary.txt', 'w', encoding='utf-8') as out:
    for s in data:
        out.write(f"\n=================== SLIDE {s['slide']} ===================\n")
        for sh in s['shapes']:
            txt = sh.get('text', '').replace('\n', ' ')
            if txt.strip():
                out.write(f"  [{sh['name']}]: {txt}\n")
            elif sh.get('is_picture'):
                out.write(f"  [PICTURE {sh['name']}]: left={sh['left']}, top={sh['top']}, w={sh['width']}, h={sh['height']}\n")
print("Done writing deck_summary.txt")
