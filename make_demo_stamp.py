import os, io, base64
from PIL import Image, ImageDraw, ImageFont

static_png = '/opt/accounting-app/static/stamp_signature.png'
template_path = '/opt/accounting-app/templates/generator.html'

# 1. Создаем прозрачное полотно (RGBA)
width, height = 450, 200
img = Image.new('RGBA', (width, height), (255, 255, 255, 0))
draw = ImageDraw.Draw(img)

# Сине-фиолетовый цвет чернил печати и ручки
stamp_blue = (25, 70, 160, 220)
ink_blue = (15, 45, 130, 240)

# 2. Отрисовка круглой печати (справа)
cx, cy, r = 320, 100, 75
# Внешняя и внутренняя окружности
draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=stamp_blue, width=4)
draw.ellipse([cx - r + 8, cy - r + 8, cx + r - 8, cy + r - 8], outline=stamp_blue, width=2)

# Текст внутри печати
font = ImageFont.load_default()
draw.text((cx - 45, cy - 35), "DEMO COMPANY", fill=stamp_blue, font=font)
draw.text((cx - 35, cy - 5), "* APPROVED *", fill=stamp_blue, font=font)
draw.text((cx - 40, cy + 25), "REG: 00000000", fill=stamp_blue, font=font)

# 3. Отрисовка размашистой подписи (перекрывающей печать)
sig_points = [
    (60, 130), (90, 80), (110, 150), (140, 70),
    (180, 120), (220, 85), (270, 135), (330, 95), (370, 110)
]
draw.line(sig_points, fill=ink_blue, width=3, joint='curve')
draw.arc([80, 60, 340, 150], start=210, end=390, fill=ink_blue, width=2)

# 4. Сохраняем PNG
os.makedirs(os.path.dirname(static_png), exist_ok=True)
img.save(static_png)

# 5. Кодируем в Base64 Data URI
buffered = io.BytesIO()
img.save(buffered, format="PNG")
b64_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
data_uri = f"data:image/png;base64,{b64_str}"

# 6. Обновляем generator.html
if os.path.exists(template_path):
    with open(template_path, 'r', encoding='utf-8') as f:
        html = f.read()

    new_img_tag = f'<img src="{data_uri}" alt="DEMO Stamp & Signature" class="stamp-img w-64 sm:w-72 object-contain filter drop-shadow-sm">'

    if 'stamp-img' in html:
        import re
        html = re.sub(r'<img [^>]*stamp-img[^>]*>', new_img_tag, html)
    else:
        html = html.replace(
            '<!-- Original Stamp & Signature Overlay Image -->',
            f'<!-- Original Stamp & Signature Overlay Image -->\n<div class="mt-8 pt-4 flex justify-end items-end stamp-print-row">{new_img_tag}</div>'
        )

    with open(template_path, 'w', encoding='utf-8') as f:
        f.write(html)

print("Успешно: Демо-печать сгенерирована и зашита в generator.html!")
