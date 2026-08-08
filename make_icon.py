from PIL import Image, ImageDraw

SIZE = 1024
# Forme de l'éclair (coordonnées sur 1024x1024)
BOLT = [(592, 180), (352, 560), (500, 560), (432, 844), (672, 464), (524, 464)]

# Icône principale : fond noir + cercle rouge Tesla + éclair blanc
icon = Image.new("RGBA", (SIZE, SIZE), (10, 10, 10, 255))
d = ImageDraw.Draw(icon)
d.ellipse([112, 112, SIZE - 112, SIZE - 112], fill=(232, 33, 39, 255))
d.polygon(BOLT, fill=(255, 255, 255, 255))
icon.convert("RGB").save("assets/icon.png")
icon.convert("RGB").save("assets/splash-icon.png")

# Icône adaptative Android : fond transparent (Android ajoute sa forme)
fg = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
d2 = ImageDraw.Draw(fg)
d2.ellipse([212, 212, SIZE - 212, SIZE - 212], fill=(232, 33, 39, 255))
d2.polygon(BOLT, fill=(255, 255, 255, 255))
fg.save("assets/adaptive-icon.png")

print("✅ 3 icônes générées dans assets/")