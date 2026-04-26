from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


PROJECT_ROOT = Path(__file__).resolve().parent.parent
ICONS_DIR = PROJECT_ROOT / "public" / "icons"
ICONS_DIR.mkdir(parents=True, exist_ok=True)


def create_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    for i in range(size):
        color_value = int(108 + (79 - 108) * (i / size))
        draw.line([(0, i), (size, i)], fill=(color_value, 99, 255, 255))

    try:
        font = ImageFont.truetype("arial.ttf", size // 3)
    except OSError:
        font = ImageFont.load_default()

    text = "T"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    text_x = (size - text_width) // 2
    text_y = (size - text_height) // 2 + size // 8

    draw.text((text_x, text_y), text, fill=(255, 255, 255, 255), font=font)
    return img


for size in (192, 512):
    output = ICONS_DIR / f"icon-{size}x{size}.png"
    create_icon(size).save(output)
    print(f"Created: {output}")

print("PWA icons generated successfully")
