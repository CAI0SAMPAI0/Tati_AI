import os
import json
import urllib.request
from io import BytesIO
from PIL import Image

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    raw_path = os.path.join(base_dir, "lingoclip_extracted_raw.json")
    if not os.path.exists(raw_path):
        print(f"Error: {raw_path} not found.")
        return

    with open(raw_path, "r", encoding="utf-8") as f:
        songs = json.load(f)

    # Directories for optimized webp
    frontend_img_dir = os.path.abspath(os.path.join(base_dir, "../../frontend/public/images/musics"))
    backend_img_dir = os.path.abspath(os.path.join(base_dir, "../assets/images/musics"))
    os.makedirs(frontend_img_dir, exist_ok=True)
    os.makedirs(backend_img_dir, exist_ok=True)

    enriched_songs = []
    print(f"Optimizing {len(songs)} song images to .webp...")

    for idx, s in enumerate(songs):
        song_id = s["id"]
        raw_img = s.get("raw_image_url")
        webp_filename = f"{song_id}.webp"
        frontend_filepath = os.path.join(frontend_img_dir, webp_filename)
        backend_filepath = os.path.join(backend_img_dir, webp_filename)

        image_relative_path = f"/images/musics/{webp_filename}"

        if not os.path.exists(frontend_filepath) and raw_img:
            try:
                req = urllib.request.Request(
                    raw_img,
                    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
                )
                with urllib.request.urlopen(req, timeout=10) as response:
                    img_data = response.read()
                    img = Image.open(BytesIO(img_data)).convert("RGB")
                    # Resize to optimal card dimension (max width 480)
                    img.thumbnail((480, 360), Image.Resampling.LANCZOS)
                    img.save(frontend_filepath, "WEBP", quality=82, method=6)
                    # Also copy to backend
                    img.save(backend_filepath, "WEBP", quality=82, method=6)
                    print(f"[{idx+1}/{len(songs)}] Saved {webp_filename} ({os.path.getsize(frontend_filepath)//1024} KB)")
            except Exception as e:
                print(f"[{idx+1}/{len(songs)}] Failed to download {raw_img} for {song_id}: {e}")
                image_relative_path = raw_img
        else:
            if os.path.exists(frontend_filepath) and not os.path.exists(backend_filepath):
                try:
                    with open(frontend_filepath, "rb") as f_in, open(backend_filepath, "wb") as f_out:
                        f_out.write(f_in.read())
                except Exception:
                    pass

        # Construct the game links
        # 1. Choice: https://lingoclip.app/lyrics/{id}?mode=mc#game/level
        # 2. Typing: https://lingoclip.app/lyrics/{id}?mode=tp#game/level
        # 3. Karaoke: https://lingoclip.app/play/{id}
        enriched_songs.append({
            "id": song_id,
            "title": s["title"],
            "artist": s["artist"],
            "genre": s.get("genre", "Pop"),
            "image": image_relative_path,
            "fallback_image": raw_img,
            "more": s.get("more", ""),
            "level": s.get("level", "All"),
            "url": f"https://lingoclip.app/lyrics/{song_id}#game",
            "modes": {
                "choice": f"https://lingoclip.app/lyrics/{song_id}?mode=mc#game/level",
                "typing": f"https://lingoclip.app/lyrics/{song_id}?mode=tp#game/level",
                "karaoke": f"https://lingoclip.app/play/{song_id}"
            }
        })

    # Save to backend/apps/activities/data/lingoclip_musics.json
    backend_data_path = os.path.abspath(os.path.join(base_dir, "../apps/activities/data/lingoclip_musics.json"))
    os.makedirs(os.path.dirname(backend_data_path), exist_ok=True)
    with open(backend_data_path, "w", encoding="utf-8") as f:
        json.dump(enriched_songs, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(enriched_songs)} enriched songs to {backend_data_path}")

    # Also save to frontend/public/data/lingoclip_musics.json for immediate access/fallback
    frontend_data_path = os.path.abspath(os.path.join(base_dir, "../../frontend/public/data/lingoclip_musics.json"))
    os.makedirs(os.path.dirname(frontend_data_path), exist_ok=True)
    with open(frontend_data_path, "w", encoding="utf-8") as f:
        json.dump(enriched_songs, f, ensure_ascii=False, indent=2)
    print(f"Saved to {frontend_data_path}")

if __name__ == "__main__":
    main()
