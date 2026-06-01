import logging
#!/usr/bin/env python3

import json
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DIR = PROJECT_ROOT / "public"


def test_pwa_files() -> bool:
    required_files = [
        PUBLIC_DIR / "manifest.json",
        PUBLIC_DIR / "sw.js",
        PUBLIC_DIR / "icons" / "icon-192x192.png",
        PUBLIC_DIR / "icons" / "icon-512x512.png",
        PUBLIC_DIR / "pwa-installer.js",
    ]

    missing = [str(path.relative_to(PROJECT_ROOT))
               for path in required_files if not path.exists()]
    for path in required_files:
        rel = path.relative_to(PROJECT_ROOT)
        if path.exists():
            logging.info(f"OK: {rel}")

    if missing:
        logging.info(f"ERROR: Missing PWA files: {missing}")
        return False

    logging.info("OK: Required PWA files are present")
    return True


def test_manifest() -> bool:
    manifest_path = PUBLIC_DIR / "manifest.json"
    if not manifest_path.exists():
        logging.info("ERROR: manifest.json not found")
        return False

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        logging.info(f"ERROR: invalid manifest.json: {error}")
        return False

    required_fields = ["name", "short_name", "start_url",
                       "display", "background_color", "theme_color"]
    missing_fields = [
        field for field in required_fields if field not in manifest]
    if missing_fields:
        logging.info(
            f"ERROR: missing fields in manifest.json: {missing_fields}")
        return False

    if not manifest.get("icons"):
        logging.info("ERROR: no icons found in manifest.json")
        return False

    logging.info("OK: manifest.json is valid")
    return True


def test_service_worker() -> bool:
    sw_path = PUBLIC_DIR / "sw.js"
    if not sw_path.exists():
        logging.info("ERROR: sw.js not found")
        return False

    content = sw_path.read_text(encoding="utf-8")
    if "addEventListener" not in content:
        logging.info(
            "ERROR: invalid service worker (missing addEventListener)")
        return False

    logging.info("OK: service worker syntax looks valid")
    return True


def main() -> int:
    tests = [test_pwa_files, test_manifest, test_service_worker]
    success = all(test() for test in tests)

    logging.info("\n" + "=" * 50)
    if success:
        logging.info("SUCCESS: PWA checks passed")
        logging.info(
            "INFO: run local server and test installation in Chrome/Edge")
        return 0

    logging.info("ERROR: PWA checks failed")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
