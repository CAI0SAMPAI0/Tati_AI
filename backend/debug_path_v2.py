from pathlib import Path
route_file = Path(r"C:\Users\Caio\Documents\GitHub\Tati_AI\backend\app\modules\simulation\routes\avatar.py")
asset_dir = Path(r"C:\Users\Caio\Documents\GitHub\Tati_AI\backend\assets\avatar")

# Tentando descobrir quantos .parent precisamos para chegar na raiz 'backend'
# route_file (0) -> routes (1) -> simulation (2) -> modules (3) -> app (4) -> backend (5)
# Wait, Path(__file__) em avatar.py:
# avatar.py (0) -> routes (1) -> simulation (2) -> modules (3) -> app (4) -> backend (5)
# Então precisamos de 5 .parent para chegar em backend

print(f"Calculado: {route_file.parent.parent.parent.parent.parent / 'assets' / 'avatar'}")
