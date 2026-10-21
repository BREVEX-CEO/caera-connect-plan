from PIL import Image, ImageDraw

# Create image 800x600
img = Image.new("RGB", (800, 600), color="#0b1d51")
draw = ImageDraw.Draw(img)

# Draw some stars in the night sky
import random
random.seed(42)
for _ in range(50):
    x = random.randint(0, 800)
    y = random.randint(0, 600)
    draw.point((x, y), fill="white")

# Rocket body (rectangle): center x: 360 to 440, y: 200 to 450
draw.rectangle([360, 200, 440, 450], fill="#e0e0e0", outline="#b0b0b0", width=2)

# Nose cone (triangle): top (400, 100), bottom-left (360, 200), bottom-right (440, 200)
draw.polygon([(400, 100), (360, 200), (440, 200)], fill="#cc2222")

# Flame under it (triangle/polygon): top-left (370, 450), top-right (430, 450), bottom (400, 530)
draw.polygon([(370, 450), (430, 450), (400, 530)], fill="#ff7700")
draw.polygon([(385, 450), (415, 450), (400, 500)], fill="#ffee00")

# Save as rocket.png
img.save("rocket.png")
print("Saved rocket.png successfully")
