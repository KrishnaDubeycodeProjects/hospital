import pptx, json

prs = pptx.Presentation(r'C:\Users\Krishana dubey\.gemini\antigravity\brain\1daec743-24f8-4020-8df9-b72fa44deb4a\.user_uploaded\media_1793290444969.pptx')

slides_detail = []
for idx, slide in enumerate(prs.slides):
    s_info = {'slide_num': idx + 1, 'shapes': []}
    for sh in slide.shapes:
        sh_info = {
            'name': sh.name,
            'id': sh.shape_id,
            'left': sh.left,
            'top': sh.top,
            'width': sh.width,
            'height': sh.height,
            'shape_type': str(sh.shape_type)
        }
        if sh.has_text_frame:
            tf = sh.text_frame
            sh_info['text'] = tf.text
            sh_info['paragraphs'] = []
            for p in tf.paragraphs:
                p_data = {'text': p.text, 'font_size': p.font.size.pt if p.font and p.font.size else None,
                          'bold': p.font.bold if p.font else None,
                          'font_name': p.font.name if p.font else None,
                          'runs': [{'text': r.text, 'bold': r.font.bold, 'size': r.font.size.pt if r.font.size else None,
                                    'color': str(r.font.color.rgb) if r.font.color and r.font.color.type == pptx.enum.dml.MSO_COLOR_TYPE.RGB else None}
                                   for r in p.runs]}
                sh_info['paragraphs'].append(p_data)
        s_info['shapes'].append(sh_info)
    slides_detail.append(s_info)

with open('full_slides_detail.json', 'w', encoding='utf-8') as f:
    json.dump(slides_detail, f, indent=2, ensure_ascii=False)

print('Wrote full_slides_detail.json successfully')
