from PIL import Image, ImageOps

img = Image.open('earth.jpg')
w, h = img.size
new_h = int(1200 * h / w)
img_1200 = img.resize((1200, new_h), Image.Resampling.LANCZOS)
img_1200.save('earth_1200.jpg')

img_gray = img.convert('L')
img_gray.save('earth_gray.jpg')

img_border = ImageOps.expand(img, border=20, fill='white')
img_border.save('earth_border.png')
print('Done')
