"""
shared/services/secure_document_service.py
Conversão de PDF em imagens WebP, preview público e backup no Google Drive.
"""

import os
import shutil
from typing import List, Dict, Any, Optional

from pdf2image import convert_from_path
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from PIL import Image, ImageDraw, ImageFont
import io

import subprocess
import tempfile
from app.core.config import settings
from app.core.database import get_client

PREVIEW_BUCKET = 'hub-previews'
SECURE_BUCKET = 'hub-secure-pages'

def _convert_to_pdf(input_path: str, output_dir: str) -> Optional[str]:
    """Usa LibreOffice para converter arquivos (PPTX, DOCX) em PDF."""
    try:
        # Tenta caminhos comuns do LibreOffice no Windows
        soffice_path = "soffice" # Se estiver no PATH
        possible_paths = [
            r"C:\Program Files\LibreOffice\program\soffice.exe",
            r"C:\Program Files (x86)\LibreOffice\program\soffice.exe"
        ]
        for p in possible_paths:
            if os.path.exists(p):
                soffice_path = p
                break

        print(f"[SecureDoc] Convertendo {input_path} para PDF usando {soffice_path}...")
        
        # Comando: soffice --headless --convert-to pdf --outdir [dir] [file]
        result = subprocess.run([
            soffice_path,
            '--headless',
            '--convert-to', 'pdf',
            '--outdir', output_dir,
            input_path
        ], capture_output=True, text=True, check=True)
        
        # O LibreOffice gera o arquivo com o mesmo nome mas extensão .pdf
        base_name = os.path.splitext(os.path.basename(input_path))[0]
        pdf_path = os.path.join(output_dir, f"{base_name}.pdf")
        
        if os.path.exists(pdf_path):
            return pdf_path
        return None
    except Exception as e:
        print(f"[SecureDoc] Erro na conversão para PDF: {e}")
        return None

def extract_links_from_pdf(pdf_path: str) -> List[Dict[str, Any]]:
    """Extrai links de um PDF e retorna suas coordenadas normalizadas."""
    extracted_links = []
    try:
        import fitz
        doc = fitz.open(pdf_path)
        for page_idx, page in enumerate(doc):
            page_width = page.rect.width
            page_height = page.rect.height
            
            for link in page.get_links():
                uri = link.get("uri")
                if uri and uri.startswith("http"):
                    rect = link.get("from")
                    if rect:
                        left_pct = rect.x0 / page_width
                        top_pct = rect.y0 / page_height
                        width_pct = rect.width / page_width
                        height_pct = rect.height / page_height
                        
                        extracted_links.append({
                            "uri": uri,
                            "page": page_idx,
                            "left": round(left_pct, 4),
                            "top": round(top_pct, 4),
                            "width": round(width_pct, 4),
                            "height": round(height_pct, 4)
                        })
        doc.close()
    except Exception as e:
        print(f"[SecureDoc] Erro ao extrair links do PDF: {e}")

    return extracted_links

VALID_CATEGORIES = frozenset({
    'grammar', 'speaking', 'travel', 'business', 'vocabulary', 'writing', 'other',
})


class SecureDocumentService:
    def __init__(self):
        self.db = get_client()
        self.poppler_path = os.getenv('POPPLER_PATH')
        
        # Se não houver no .env, tenta detectar automaticamente
        if not self.poppler_path:
            import shutil
            # 1. Tenta ver se já está no PATH do Windows
            path_check = shutil.which("pdftocairo")
            if path_check:
                self.poppler_path = os.path.dirname(path_check)
            
            # 2. Busca agressiva no Chocolatey (Pasta Real)
            if not self.poppler_path and os.name == 'nt':
                import glob
                choco_lib = r"C:\ProgramData\chocolatey\lib\poppler\**\pdftocairo.exe"
                matches = glob.glob(choco_lib, recursive=True)
                if matches:
                    self.poppler_path = os.path.dirname(matches[0])
                else:
                    # 3. Caminhos comuns
                    possible_popplers = [
                        r"C:\Program Files\Release-26.02.0-0\poppler-26.02.0\Library\bin",
                        r"C:\Program Files\poppler\Library\bin",
                        r"C:\poppler\bin",
                    ]
                    for p in possible_popplers:
                        if os.path.exists(p):
                            self.poppler_path = p
                            break
        
        print(f"[SecureDoc] Poppler Path em uso: {self.poppler_path}")
        self.drive_folder_id = os.getenv('DRIVE_HUB_BACKUP_FOLDER_ID') or os.getenv('DRIVE_TATI_FILES')
        sa_path = os.getenv('GOOGLE_SERVICE_ACCOUNT_PATH', '')
        if not sa_path:
            sa_path = os.path.join(os.getcwd(), 'tatichatbot-491215-033b31817edf.json')

        self.drive_service = None
        if sa_path and os.path.exists(sa_path):
            try:
                credentials = service_account.Credentials.from_service_account_file(
                    sa_path,
                    scopes=['https://www.googleapis.com/auth/drive.file'],
                )
                self.drive_service = build('drive', 'v3', credentials=credentials)
            except Exception as e:
                print(f'[SecureDoc] Erro ao inicializar Google Drive: {e}')

    def _set_processing_status(
        self,
        content_id: str,
        status: str,
        error: Optional[str] = None,
    ) -> None:
        payload: Dict[str, Any] = {'processing_status': status}
        # Ignorando processing_error pois a coluna não existe no banco
        try:
            self.db.table('premium_content').update(payload).eq('id', content_id).execute()
        except Exception as e:
            print(f'[SecureDoc] Erro ao atualizar status: {e}')

    def upload_to_drive(self, local_path: str, filename: str) -> Optional[str]:
        if not self.drive_service or not self.drive_folder_id:
            print('[SecureDoc] Drive Service ou Folder ID não configurados.')
            return None

        try:
            file_metadata = {'name': filename, 'parents': [self.drive_folder_id]}
            media = MediaFileUpload(local_path, resumable=True)
            file = self.drive_service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id',
            ).execute()
            return file.get('id')
        except Exception as e:
            print(f'[SecureDoc] Erro no upload para o Drive: {e}')
            return None

    def process_pdf_to_images(self, pdf_path: str, output_dir: str) -> List[str]:
        try:
            os.makedirs(output_dir, exist_ok=True)
            pages = convert_from_path(pdf_path, 200, poppler_path=self.poppler_path)
            image_paths: List[str] = []
            for i, page in enumerate(pages):
                img_name = f'page_{i + 1}.webp'
                img_path = os.path.join(output_dir, img_name)
                # Salva direto para testar se o conteúdo aparece
                page.save(img_path, 'WEBP', quality=80)
                image_paths.append(img_path)
            return image_paths
        except Exception as e:
            print(f'[SecureDoc] Erro ao converter PDF: {e}')
            return []

    def upload_preview(self, first_page_path: str, content_id: str) -> Optional[str]:
        """Envia capa para bucket público hub-previews."""
        storage_path = f'{content_id}/cover.webp'
        try:
            with open(first_page_path, 'rb') as f:
                self.db.storage.from_(PREVIEW_BUCKET).upload(
                    path=storage_path,
                    file=f,
                    file_options={'cache-control': '86400', 'upsert': 'true'},
                )
            return storage_path
        except Exception as e:
            print(f'[SecureDoc] Erro no upload do preview: {e}')
            return None

    def upload_pages_to_supabase(self, image_paths: List[str], content_id: str) -> List[str]:
        storage_paths: List[str] = []
        try:
            for path in image_paths:
                filename = os.path.basename(path)
                storage_path = f'{content_id}/{filename}'
                with open(path, 'rb') as f:
                    self.db.storage.from_(SECURE_BUCKET).upload(
                        path=storage_path,
                        file=f,
                        file_options={'cache-control': '3600', 'upsert': 'true'},
                    )
                storage_paths.append(storage_path)
            return storage_paths
        except Exception as e:
            print(f'[SecureDoc] Erro no upload das páginas: {e}')
            return []

    def secure_process_document(
        self,
        local_path: str,
        filename: str,
        content_id: str,
    ) -> Dict[str, Any]:
        """Orquestra: Drive backup → imagens → preview → páginas seguras."""
        self._set_processing_status(content_id, 'processing')

        actual_pdf_path = local_path
        is_converted = False

        # Se não for PDF, tenta converter usando LibreOffice
        if not local_path.lower().endswith('.pdf'):
            temp_conv_dir = os.path.join('temp', f'conv_{content_id}')
            os.makedirs(temp_conv_dir, exist_ok=True)
            
            converted_path = _convert_to_pdf(local_path, temp_conv_dir)
            if converted_path:
                actual_pdf_path = converted_path
                is_converted = True
                print(f"[SecureDoc] Arquivo convertido com sucesso: {actual_pdf_path}")
            else:
                self._set_processing_status(content_id, 'skipped', 'Falha ao converter para PDF ou formato não suportado.')
                return {'success': False, 'error': 'Conversão falhou'}

        extracted_links = extract_links_from_pdf(actual_pdf_path)

        drive_id = self.upload_to_drive(local_path, filename)
        temp_dir = os.path.join('temp', f'process_{content_id}')
        
        # Gera as imagens a partir do PDF (original ou convertido)
        image_paths = self.process_pdf_to_images(actual_pdf_path, temp_dir)

        if not image_paths:
            self._set_processing_status(content_id, 'failed', 'Falha na conversão do PDF (Poppler/LibreOffice instalados?)')
            # Limpa se foi convertido
            if is_converted and os.path.exists(actual_pdf_path):
                try: os.remove(actual_pdf_path)
                except: pass
            return {'success': False, 'error': 'Falha na conversão de imagens'}

        preview_path = self.upload_preview(image_paths[0], content_id)
        storage_paths = self.upload_pages_to_supabase(image_paths, content_id)

        for p in image_paths:
            try:
                os.remove(p)
            except OSError:
                pass

        # Limpa o PDF convertido e sua pasta temporária se houver
        if is_converted and os.path.exists(actual_pdf_path):
            try:
                os.remove(actual_pdf_path)
                shutil.rmtree(os.path.dirname(actual_pdf_path), ignore_errors=True)
            except:
                pass

        try:
            shutil.rmtree(temp_dir, ignore_errors=True)
        except OSError:
            pass

        update_payload: Dict[str, Any] = {
            'secure_pages': storage_paths,
            'original_drive_id': drive_id,
            'is_secure': True,
            'processing_status': 'ready',
            'thumbnail_url': preview_path if preview_path else None,
            'external_links': extracted_links
        }

        self.db.table('premium_content').update(update_payload).eq('id', content_id).execute()

        return {
            'success': True,
            'drive_id': drive_id,
            'pages_count': len(storage_paths),
            'preview_path': preview_path,
            'storage_paths': storage_paths,
        }


def public_preview_url(preview_path: Optional[str]) -> Optional[str]:
    """Monta URL pública do bucket hub-previews."""
    if not preview_path:
        return None
    base = (settings.supabase_url or '').rstrip('/')
    if not base:
        return None
    return f'{base}/storage/v1/object/public/{PREVIEW_BUCKET}/{preview_path}'


def apply_watermark(image_bytes: bytes, text: str) -> bytes:
    """Aplica marca d'água transversal com opacidade em uma imagem (bytes)."""
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
        width, height = img.size
        
        # Cria uma camada transparente para o texto
        watermark = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        d = ImageDraw.Draw(watermark)
        
        try:
            font = ImageFont.truetype("arial.ttf", 35)
        except IOError:
            font = ImageFont.load_default()

        if hasattr(font, "getbbox"):
            bbox = font.getbbox(text)
            tw = bbox[2] - bbox[0]
            th = bbox[3] - bbox[1]
        else:
            tw, th = d.textsize(text, font=font)
        
        # Cor com opacidade (Cinza suave)
        fill_color = (150, 150, 150, 40)
        
        # Repete em padrão
        sx, sy = tw + 150, th + 200
        for y in range(-height, height * 2, sy):
            for x in range(-width, width * 2, sx):
                ox = x if (y // sy) % 2 == 0 else x - (sx // 2)
                d.text((ox, y), text, fill=fill_color, font=font)
        
        # Rotaciona
        watermark = watermark.rotate(35, expand=False, resample=Image.BICUBIC)
        
        # Combina
        img.paste(watermark, (0, 0), watermark)
        
        output = io.BytesIO()
        img.convert("RGB").save(output, format="WEBP", quality=80)
        return output.getvalue()
    except Exception as e:
        print(f"[SecureDoc] Erro ao aplicar marca d'água: {e}")
        return image_bytes

