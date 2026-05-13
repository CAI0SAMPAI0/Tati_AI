from pathlib import Path
print(f"Current file: {Path(__file__).resolve()}")
print(f"Parent: {Path(__file__).resolve().parent}")
print(f"3 levels up: {Path(__file__).resolve().parent.parent.parent}")
print(f"Target dir: {Path(__file__).resolve().parent.parent.parent.parent / 'assets' / 'avatar'}")
