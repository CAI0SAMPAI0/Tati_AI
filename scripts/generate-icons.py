import logging
from pathlib import Path
from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parent.parent
LOGO_PATH = PROJECT_ROOT / "frontend" / \
    "public" / "images" / "tati_logo.jpg"
PWA_ICONS_DIR = PROJECT_ROOT / "frontend" / "public" / "icons"
ANDROID_RES_DIR = PROJECT_ROOT / \
    "mobile_app/capacitor/android/app/src/main/res"


def resize_and_save(image, size, output_path):
    resized = image.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(output_path)
    logging.info(f"Generated: {output_path}")


def main():
    if not LOGO_PATH.exists():
        logging.info(f"Error: Logo not found at {LOGO_PATH}")
        return

    logo = Image.open(LOGO_PATH)

    # PWA Icons
    PWA_ICONS_DIR.mkdir(parents=True, exist_ok=True)
    resize_and_save(logo, 192, PWA_ICONS_DIR / "icon-192x192.png")
    resize_and_save(logo, 512, PWA_ICONS_DIR / "icon-512x512.png")

    # Android Icons
    android_sizes = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192
    }

    for dir_name, size in android_sizes.items():
        target_dir = ANDROID_RES_DIR / dir_name
        target_dir.mkdir(parents=True, exist_ok=True)
        resize_and_save(logo, size, target_dir / "ic_launcher.png")
        resize_and_save(
            logo,
            size,
            target_dir /
            "ic_launcher_round.png")

    logging.info("\nIcons generated successfully!")


if __name__ == "__main__":
    main()
