from PIL import Image, ImageOps

img = Image.open('earth.jpg')
print('Original size:', img.size)

# 1. earth_1200.jpg resized to 1200 pixels wide keeping proportions
w, h = img.size
new_h = int(h * 1200 / w)
img_1200 = img.resize((1200, new_h), Image.Resampling.LANCZOS)
img_1200.save('earth_1200.jpg', quality=95)

# 2. earth_gray.jpg black-and-white version at full size
img_gray = img.convert('L')
img_gray.save('earth_gray.jpg', quality=95)

# 3. earth_border.png full-size photo with a 20-pixel white border on every side
img_border = ImageOps.expand(img, border=20, fill='white')
img_border.save('earth_border.png')

print('All processed successfully!')
