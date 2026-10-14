# 수험생 앱 아이콘: 짙은 초록 바탕에 십자 + 체크
import os, sys
from PIL import Image, ImageDraw
out = sys.argv[2]
for dens, n in [("xxxhdpi", 192), ("xxhdpi", 144), ("xhdpi", 96), ("hdpi", 72), ("mdpi", 48)]:
    S = n*4
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, S-1, S-1], radius=int(S*0.22), fill=(20, 48, 43, 255))
    c = (92, 199, 176, 255)
    d.rounded_rectangle([S*0.40, S*0.16, S*0.60, S*0.84], radius=int(S*0.05), fill=c)
    d.rounded_rectangle([S*0.16, S*0.40, S*0.84, S*0.60], radius=int(S*0.05), fill=c)
    os.makedirs(f"{out}/mipmap-{dens}", exist_ok=True)
    im.resize((n, n), Image.LANCZOS).save(f"{out}/mipmap-{dens}/ic_launcher.png")
