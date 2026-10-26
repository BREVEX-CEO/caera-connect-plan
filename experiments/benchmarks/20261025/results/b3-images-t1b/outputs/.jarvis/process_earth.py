from PIL import Image, ImageOps
img = Image.open('earth.jpg')
w, h = img.size
new_w = 1200
new_h = int(h * (new_w / w))
img.resize((new_w, new_h), Image.Resampling.LANCZOS).save('earth_1200.jpg', quality=95)
img.convert('L').save('earth_gray.jpg', quality=95)
ImageOps.expand(img, border=20, fill='white').save('earth_border.png')
