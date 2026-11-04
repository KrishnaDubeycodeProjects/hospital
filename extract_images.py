import pptx, os

prs = pptx.Presentation(r'C:\Users\Krishana dubey\.gemini\antigravity\brain\1daec743-24f8-4020-8df9-b72fa44deb4a\.user_uploaded\media_1793290444969.pptx')
slide1 = prs.slides[0]
os.makedirs('extracted_images', exist_ok=True)
for i, shape in enumerate(slide1.shapes):
    if shape.shape_type == pptx.enum.shapes.MSO_SHAPE_TYPE.PICTURE:
        img = shape.image
        ext = img.ext
        safe_name = "".join([c if c.isalnum() else "_" for c in shape.name])
        fname = f'extracted_images/{safe_name}_{i}.{ext}'
        with open(fname, 'wb') as f:
            f.write(img.blob)
        print(f'Extracted: {fname}')
