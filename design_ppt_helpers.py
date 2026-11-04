import pptx
from pptx.util import Pt
from pptx.dml.color import RGBColor
import os

src_path = r'C:\Users\Krishana dubey\.gemini\antigravity\brain\1daec743-24f8-4020-8df9-b72fa44deb4a\.user_uploaded\media_1793290444969.pptx'
out_path = r'c:\Users\Krishana dubey\hospital-spring-boot\AarogyaFlow_Seva_Challenge_2026.pptx'

prs = pptx.Presentation(src_path)

# Helper function to parse hex color
def hex_to_rgb(hex_str):
    if not hex_str:
        return None
    hex_str = hex_str.strip().lstrip('#')
    return RGBColor(int(hex_str[0:2], 16), int(hex_str[2:4], 16), int(hex_str[4:6], 16))

# Helper to find shape by name on slide
def get_shape(slide, name):
    for sh in slide.shapes:
        if sh.name == name:
            return sh
    return None

# Helper to update shape with multiple paragraphs and runs
def update_shape_runs(shape, para_specs):
    """
    para_specs: list of paragraphs.
    Each paragraph is a list of runs: [(text, bold, size_pt, hex_color), ...]
    """
    tf = shape.text_frame
    tf.word_wrap = True
    
    # We clear existing paragraphs by keeping the first and clearing its runs
    # In python-pptx, tf.paragraphs has at least 1 paragraph
    while len(tf.paragraphs) > len(para_specs):
        p_elem = tf.paragraphs[-1]._p
        p_elem.getparent().remove(p_elem)
        
    for p_idx, runs in enumerate(para_specs):
        if p_idx < len(tf.paragraphs):
            p = tf.paragraphs[p_idx]
        else:
            p = tf.add_paragraph()
            
        # Clear runs in p
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

print("Helper functions ready.")
