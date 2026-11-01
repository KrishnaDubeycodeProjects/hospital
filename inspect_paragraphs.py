import pptx

prs = pptx.Presentation(r'C:\Users\Krishana dubey\.gemini\antigravity\brain\1daec743-24f8-4020-8df9-b72fa44deb4a\.user_uploaded\media_1793290444969.pptx')

with open('paragraphs_debug.txt', 'w', encoding='utf-8') as out:
    for s_idx, slide in enumerate(prs.slides):
        out.write(f"\n=================== SLIDE {s_idx + 1} ===================\n")
        for sh in slide.shapes:
            if sh.has_text_frame:
                out.write(f"Shape: '{sh.name}' (type={sh.shape_type})\n")
                for p_idx, p in enumerate(sh.text_frame.paragraphs):
                    p_txt = p.text.strip()
                    if p_txt:
                        runs_info = []
                        for r in p.runs:
                            color_val = None
                            if r.font.color and r.font.color.type == pptx.enum.dml.MSO_COLOR_TYPE.RGB:
                                color_val = str(r.font.color.rgb)
                            runs_info.append(f"'{r.text}'(sz={r.font.size.pt if r.font.size else None}, b={r.font.bold}, c={color_val})")
                        out.write(f"  P{p_idx}: {p_txt}\n    Runs: {', '.join(runs_info)}\n")
print("Done writing paragraphs_debug.txt")
