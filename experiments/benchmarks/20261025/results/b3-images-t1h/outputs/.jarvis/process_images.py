from PIL import Image, ImageOps
img = Image.open('earth.jpg')
width, height = img.size
new_width = 1200
new_height = int((new_width / width) * height)
img_1200 = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
if img_1200.mode in ('RGBA', 'P'):
    img_1200 = img_1200.convert('RGB')
img_1200.save('earth_1200.jpg')

img_gray = img.convert('L')
img_gray.save('earth_gray.jpg')

img_border = ImageOps.expand(img.convert('RGB'), border=20, fill='white')
img_border.save('earth_border.png')
print('Done')
