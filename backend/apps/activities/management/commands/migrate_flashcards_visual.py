import base64
import datetime
import json
import logging
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import urlparse

import requests
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.activities.models import (
    ActivitySubmission,
    Flashcard,
    Module,
    UserFlashcardProgress,
)

logger = logging.getLogger(__name__)

FAKE_HOST_TOKENS = (
    "example.com",
    "example.org",
    "placeholder",
    "dummyimage",
    "fake",
    "localhost",
    "loremflickr",
)

DATA_IMAGE_RE = re.compile(
    r"^data:image/(jpeg|jpg|png|webp|gif);base64,([A-Za-z0-9+/=\s]+)$",
    re.IGNORECASE,
)


def short_url(url: Optional[str], max_len: int = 80) -> str:
    if not url:
        return "None"
    u = str(url).strip()
    if len(u) <= max_len:
        return u
    return f"{u[:max_len]}... ({len(u)} chars)"


def verify_inline_data_image(raw_url: str) -> Tuple[bool, str]:
    """Valida data URI de imagem decodificando base64 e conferindo magic bytes reais."""
    match = DATA_IMAGE_RE.match(raw_url.strip())
    if not match:
        return False, "invalid_data_uri_format"
    b64_payload = re.sub(r"\s+", "", match.group(2))
    try:
        decoded = base64.b64decode(b64_payload, validate=True)
    except Exception:
        return False, "corrupt_base64_payload"

    if len(decoded) < 32:
        return False, "data_uri_too_small"

    is_jpeg = decoded.startswith(b"\xff\xd8\xff")
    is_png = decoded.startswith(b"\x89PNG\r\n\x1a\n")
    is_gif = decoded.startswith((b"GIF87a", b"GIF89a"))
    is_webp = decoded.startswith(b"RIFF") and decoded[8:12] == b"WEBP"
    if is_jpeg or is_png or is_gif or is_webp:
        return True, f"valid_inline_base64_{len(decoded)}b"
    return False, "invalid_image_magic_bytes"


def is_syntactically_valid_image_url(
    raw_url: Any, allow_data_uri: bool = False
) -> Tuple[bool, str]:
    """Valida sintaxe HTTP(S) (e opcionalmente data URI em JSON) bloqueando domínios fake."""
    if not isinstance(raw_url, str) or not raw_url.strip():
        return False, "missing_url"
    url = raw_url.strip()
    if url.lower().startswith("data:"):
        if not allow_data_uri:
            return False, "data_uri_exceeds_varchar_column_policy"
        return verify_inline_data_image(url)

    parsed = urlparse(url)
    host = (parsed.netloc or "").lower()
    if parsed.scheme not in ("http", "https") or not host or "." not in host:
        return False, "invalid_scheme_or_host"
    if any(tok in host for tok in FAKE_HOST_TOKENS):
        return False, f"fake_or_placeholder_host:{host}"
    return True, "ok"


def check_url_http_accessible(url: str, timeout: float = 8.0) -> Tuple[bool, str]:
    """Verifica existência e acessibilidade real de uma imagem via HTTP sem baixar o arquivo inteiro."""
    headers = {
        "User-Agent": "TatiAI-FlashcardAuditor/1.0",
        "Accept": "image/*,*/*;q=0.8",
    }
    try:
        resp = requests.head(url, headers=headers, allow_redirects=True, timeout=timeout)
        if resp.status_code in (403, 405) or resp.status_code >= 500:
            # Alguns CDNs bloqueiam HEAD; tenta GET parcial de 512 bytes
            get_headers = {**headers, "Range": "bytes=0-511"}
            resp = requests.get(
                url, headers=get_headers, allow_redirects=True, stream=True, timeout=timeout
            )
            resp.close()

        if 200 <= resp.status_code < 400:
            ctype = (resp.headers.get("Content-Type") or "").lower()
            if ctype and not (
                ctype.startswith("image/")
                or "octet-stream" in ctype
                or "binary" in ctype
            ):
                return False, f"non_image_content_type:{ctype}"
            return True, f"http_{resp.status_code}"
        return False, f"http_{resp.status_code}"
    except requests.RequestException as exc:
        return False, f"network_error:{type(exc).__name__}"


class Command(BaseCommand):
    help = (
        "Audita, classifica e migra flashcards legados de forma segura, idempotente e "
        "reversível para o formato frente (palavra/frase) -> verso (apenas imagem)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Executa somente auditoria e relatório sem gravar alterações no banco (padrão se --apply não for informado).",
        )
        parser.add_argument(
            "--apply",
            action="store_true",
            default=False,
            help="Aplica a migração não-destrutiva nos registros elegíveis (Categorias A e B) após gerar backup JSON.",
        )
        parser.add_argument(
            "--verify-urls",
            action="store_true",
            default=False,
            help="Verifica via HTTP se todas as URLs de imagens existem, respondem 2xx/3xx e retornam Content-Type de imagem.",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=50,
            help="Tamanho do lote transacional ao aplicar migração (padrão: 50).",
        )
        parser.add_argument(
            "--backup-file",
            type=str,
            default="",
            help="Caminho do snapshot JSON de backup gerado antes de --apply.",
        )
        parser.add_argument(
            "--restore-from",
            type=str,
            default="",
            help="Restaura integralmente cefr_flashcards e modules.flashcards a partir de um backup JSON anterior.",
        )
        parser.add_argument(
            "--report-json",
            type=str,
            default="",
            help="Salva o relatório completo de auditoria e classificação (a, b, c) em um arquivo JSON.",
        )
        parser.add_argument(
            "--clear-legacy-back",
            action="store_true",
            default=False,
            help="Opcional: limpa também o texto legado 'back' nos registros migrados (por padrão é retido na transição).",
        )

    def handle(self, *args, **options):
        restore_path = (options.get("restore_from") or "").strip()
        if restore_path:
            return self._handle_restore(restore_path)

        apply_changes = bool(options.get("apply"))
        verify_urls = bool(options.get("verify_urls"))
        batch_size = max(1, int(options.get("batch_size") or 50))
        clear_legacy_back = bool(options.get("clear_legacy_back"))
        report_json_path = (options.get("report_json") or "").strip()
        backup_file = (options.get("backup_file") or "").strip()

        mode_label = "APPLY (GRAVAÇÃO AUTORIZADA)" if apply_changes else "DRY-RUN (SOMENTE LEITURA)"
        self.stdout.write(
            self.style.NOTICE(
                f"=== Auditoria e Migração de Flashcards Visuais [{mode_label}] ==="
            )
        )

        cefr_cards = list(Flashcard.objects.all().order_by("level", "topic", "front"))
        modules = list(Module.objects.all().order_by("order", "title"))
        progress_count = UserFlashcardProgress.objects.count()
        flashcard_submissions_count = ActivitySubmission.objects.filter(
            activity_type="flashcards"
        ).count()

        # Coleta todas as URLs HTTP(S) candidatas para validação em paralelo
        http_candidate_urls: Set[str] = set()
        inline_data_uris_count = 0

        for fc in cefr_cards:
            if fc.image_url and str(fc.image_url).strip():
                u = str(fc.image_url).strip()
                if not u.lower().startswith("data:"):
                    http_candidate_urls.add(u)

        for mod in modules:
            raw_list = mod.flashcards if isinstance(mod.flashcards, list) else []
            for item in raw_list:
                if isinstance(item, dict):
                    for key in ("image_url", "imageUrl", "image", "thumbnail_url"):
                        val = item.get(key)
                        if isinstance(val, str) and val.strip():
                            u = val.strip()
                            if u.lower().startswith("data:"):
                                inline_data_uris_count += 1
                            else:
                                http_candidate_urls.add(u)

        http_status_map: Dict[str, Tuple[bool, str]] = {}
        urls_to_check_http: List[str] = []
        for u in sorted(http_candidate_urls):
            syn_ok, syn_reason = is_syntactically_valid_image_url(u, allow_data_uri=False)
            if not syn_ok:
                http_status_map[u] = (False, syn_reason)
            elif verify_urls:
                urls_to_check_http.append(u)
            else:
                http_status_map[u] = (True, "syntax_ok")

        if verify_urls and urls_to_check_http:
            self.stdout.write(
                f"Verificando acessibilidade HTTP de {len(urls_to_check_http)} URLs únicas de imagens..."
            )
            with ThreadPoolExecutor(max_workers=12) as executor:
                future_map = {
                    executor.submit(check_url_http_accessible, u): u
                    for u in urls_to_check_http
                }
                for fut in as_completed(future_map):
                    u = future_map[fut]
                    try:
                        http_status_map[u] = fut.result()
                    except Exception as exc:
                        http_status_map[u] = (False, f"exception:{exc}")

        def evaluate_card_url(raw_u: str, allow_data_uri: bool) -> Tuple[bool, str]:
            if not raw_u:
                return False, "missing_url"
            if raw_u.lower().startswith("data:"):
                return is_syntactically_valid_image_url(raw_u, allow_data_uri=allow_data_uri)
            return http_status_map.get(raw_u, (False, "unchecked"))

        # Índice determinístico de ativos HTTP(S) válidos (<= 1000 chars) por palavra/frase exata
        valid_front_to_urls: Dict[str, Set[str]] = {}
        for fc in cefr_cards:
            front_norm = (fc.front or "").strip().lower()
            u = (fc.image_url or "").strip()
            if (
                front_norm
                and u
                and len(u) <= 1000
                and not u.lower().startswith("data:")
                and http_status_map.get(u, (False, ""))[0]
            ):
                valid_front_to_urls.setdefault(front_norm, set()).add(u)

        for mod in modules:
            raw_list = mod.flashcards if isinstance(mod.flashcards, list) else []
            for item in raw_list:
                if not isinstance(item, dict):
                    continue
                front_norm = str(
                    item.get("front") or item.get("word") or item.get("term") or ""
                ).strip().lower()
                for key in ("image_url", "imageUrl", "image"):
                    u = str(item.get(key) or "").strip()
                    if (
                        front_norm
                        and u
                        and len(u) <= 1000
                        and not u.lower().startswith("data:")
                        and http_status_map.get(u, (False, ""))[0]
                    ):
                        valid_front_to_urls.setdefault(front_norm, set()).add(u)

        # Classificação dos registros em Categorias (a), (b) e (c)
        category_a: List[Dict[str, Any]] = []
        category_b: List[Dict[str, Any]] = []
        category_c: List[Dict[str, Any]] = []

        cefr_plan: List[Tuple[Flashcard, str, Optional[str], str]] = []
        for fc in cefr_cards:
            front_clean = (fc.front or "").strip()
            raw_url = (fc.image_url or "").strip()
            entry_base = {
                "source": "cefr_flashcards",
                "id": str(fc.id),
                "level": fc.level,
                "topic": fc.topic or "General",
                "front": front_clean,
                "current_image_url": short_url(raw_url, 120) if raw_url else None,
                "has_legacy_back": bool((fc.back or "").strip()),
                "has_legacy_options": bool(fc.options),
            }

            if len(front_clean) < 2:
                reason = "missing_or_short_front"
                category_c.append({**entry_base, "reason": reason})
                cefr_plan.append((fc, "c", None, reason))
                continue

            url_ok, url_detail = evaluate_card_url(raw_url, allow_data_uri=False)
            if url_ok:
                category_a.append({**entry_base, "status_detail": url_detail})
                cefr_plan.append((fc, "a", raw_url, url_detail))
                continue

            # Tenta mapeamento determinístico 1-para-1 por front exato nos ativos válidos existentes
            candidates = valid_front_to_urls.get(front_clean.lower(), set())
            if len(candidates) == 1:
                matched_url = next(iter(candidates))
                reason = "exact_front_single_valid_asset"
                category_b.append(
                    {
                        **entry_base,
                        "matched_image_url": short_url(matched_url, 120),
                        "reason": reason,
                    }
                )
                cefr_plan.append((fc, "b", matched_url, reason))
            elif len(candidates) > 1:
                reason = f"ambiguous_multiple_assets:{len(candidates)}"
                category_c.append({**entry_base, "reason": reason})
                cefr_plan.append((fc, "c", None, reason))
            else:
                category_c.append({**entry_base, "reason": url_detail})
                cefr_plan.append((fc, "c", None, url_detail))

        # Classificação dos cards JSON dentro de modules
        module_plan: List[Tuple[Module, List[Dict[str, Any]], bool]] = []
        for mod in modules:
            raw_list = mod.flashcards if isinstance(mod.flashcards, list) else []
            updated_cards_for_mod: List[Dict[str, Any]] = []
            mod_changed = False

            for idx, item in enumerate(raw_list):
                if not isinstance(item, dict):
                    category_c.append(
                        {
                            "source": "modules.flashcards",
                            "module_id": str(mod.id),
                            "module_title": mod.title,
                            "card_index": idx,
                            "front": "",
                            "current_image_url": None,
                            "reason": "non_dict_card_item",
                        }
                    )
                    continue

                front_clean = str(
                    item.get("front") or item.get("word") or item.get("term") or ""
                ).strip()
                primary_url = str(item.get("image_url") or "").strip()
                alt_url = str(
                    item.get("imageUrl") or item.get("image") or item.get("thumbnail_url") or ""
                ).strip()

                entry_base = {
                    "source": "modules.flashcards",
                    "module_id": str(mod.id),
                    "module_title": mod.title,
                    "card_index": idx,
                    "front": front_clean,
                    "current_image_url": short_url(primary_url, 120) if primary_url else None,
                    "has_legacy_back": bool(str(item.get("back") or "").strip()),
                    "has_legacy_options": "options" in item and bool(item.get("options")),
                }

                if len(front_clean) < 2:
                    category_c.append({**entry_base, "reason": "missing_or_short_front"})
                    updated_cards_for_mod.append(dict(item))
                    continue

                prim_ok, prim_detail = evaluate_card_url(primary_url, allow_data_uri=True)
                if prim_ok:
                    category_a.append({**entry_base, "status_detail": prim_detail})
                    new_card = self._build_migrated_module_card(
                        item, front_clean, primary_url, clear_legacy_back
                    )
                    if new_card != item:
                        mod_changed = True
                    updated_cards_for_mod.append(new_card)
                    continue

                alt_ok, _alt_detail = evaluate_card_url(alt_url, allow_data_uri=True)
                if alt_ok:
                    reason = "alternate_metadata_field_url"
                    category_b.append(
                        {
                            **entry_base,
                            "matched_image_url": short_url(alt_url, 120),
                            "reason": reason,
                        }
                    )
                    new_card = self._build_migrated_module_card(
                        item, front_clean, alt_url, clear_legacy_back
                    )
                    mod_changed = True
                    updated_cards_for_mod.append(new_card)
                    continue

                candidates = valid_front_to_urls.get(front_clean.lower(), set())
                if len(candidates) == 1:
                    matched_url = next(iter(candidates))
                    reason = "exact_front_single_valid_asset"
                    category_b.append(
                        {
                            **entry_base,
                            "matched_image_url": short_url(matched_url, 120),
                            "reason": reason,
                        }
                    )
                    new_card = self._build_migrated_module_card(
                        item, front_clean, matched_url, clear_legacy_back
                    )
                    mod_changed = True
                    updated_cards_for_mod.append(new_card)
                elif len(candidates) > 1:
                    reason = f"ambiguous_multiple_assets:{len(candidates)}"
                    category_c.append({**entry_base, "reason": reason})
                    updated_cards_for_mod.append(dict(item))
                else:
                    category_c.append({**entry_base, "reason": prim_detail})
                    updated_cards_for_mod.append(dict(item))

            module_plan.append((mod, updated_cards_for_mod, mod_changed))

        total_module_cards = sum(
            len(m.flashcards) if isinstance(m.flashcards, list) else 0 for m in modules
        )
        total_records = len(cefr_cards) + total_module_cards

        summary_report = {
            "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "mode": "apply" if apply_changes else "dry_run",
            "verify_urls": verify_urls,
            "clear_legacy_back": clear_legacy_back,
            "totals": {
                "cefr_flashcards_rows": len(cefr_cards),
                "modules_count": len(modules),
                "modules_flashcard_items": total_module_cards,
                "total_flashcards_inspected": total_records,
                "unique_http_image_urls_checked": len(http_candidate_urls),
                "inline_base64_images_inspected": inline_data_uris_count,
                "preserved_user_flashcard_progress_rows": progress_count,
                "preserved_activity_submissions_rows": flashcard_submissions_count,
                "category_a_valid_linked_image": len(category_a),
                "category_b_matched_via_metadata": len(category_b),
                "category_c_missing_or_ambiguous_blocked": len(category_c),
                "auto_migratable_total": len(category_a) + len(category_b),
            },
            "examples": {
                "category_a": category_a[:5],
                "category_b": category_b[:5],
                "category_c": category_c[:15],
            },
            "category_c_all": category_c,
        }

        self._print_report(summary_report)

        if report_json_path:
            with open(report_json_path, "w", encoding="utf-8") as fp:
                json.dump(summary_report, fp, ensure_ascii=False, indent=2)
            self.stdout.write(
                self.style.SUCCESS(f"Relatório JSON salvo em: {report_json_path}")
            )

        if not apply_changes:
            self.stdout.write(
                self.style.WARNING(
                    "\n[DRY-RUN CONCLUÍDO] Nenhuma alteração foi gravada no banco de dados."
                )
            )
            return

        # Geração obrigatória de snapshot de backup antes de qualquer escrita
        if not backup_file:
            ts = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M%S")
            backup_file = f"flashcards_migration_backup_{ts}.json"

        self._write_backup(backup_file, cefr_cards, modules)
        self.stdout.write(
            self.style.SUCCESS(f"Backup completo salvo em: {backup_file}")
        )

        # Aplicação em lotes transacionais idempotentes
        updated_cefr = 0
        noop_cefr = 0
        eligible_cefr = [
            (fc, cat, target_url)
            for (fc, cat, target_url, _reason) in cefr_plan
            if cat in ("a", "b") and target_url
        ]

        for start in range(0, len(eligible_cefr), batch_size):
            batch = eligible_cefr[start : start + batch_size]
            with transaction.atomic():
                for fc, _cat, target_url in batch:
                    changed = False
                    if (fc.image_url or "").strip() != target_url:
                        fc.image_url = target_url
                        changed = True
                    if fc.options != []:
                        fc.options = []
                        changed = True
                    if clear_legacy_back:
                        if fc.back != "":
                            fc.back = ""
                            changed = True
                        if fc.explanation:
                            fc.explanation = ""
                            changed = True

                    if changed:
                        update_fields = ["image_url", "options"]
                        if clear_legacy_back:
                            update_fields.extend(["back", "explanation"])
                        fc.save(update_fields=update_fields)
                        updated_cefr += 1
                    else:
                        noop_cefr += 1

        updated_modules = 0
        noop_modules = 0
        with transaction.atomic():
            for mod, new_cards, mod_changed in module_plan:
                if mod_changed:
                    mod.flashcards = new_cards
                    mod.save(update_fields=["flashcards"])
                    updated_modules += 1
                else:
                    noop_modules += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"\n[MIGRAÇÃO APLICADA] cefr_flashcards atualizados: {updated_cefr} "
                f"(idempotentes sem mudança: {noop_cefr}) | "
                f"modules atualizados: {updated_modules} (sem mudança: {noop_modules}) | "
                f"registros bloqueados para revisão manual (Categoria C): {len(category_c)}."
            )
        )

    @staticmethod
    def _build_migrated_module_card(
        original: Dict[str, Any],
        front_clean: str,
        valid_url: str,
        clear_legacy_back: bool,
    ) -> Dict[str, Any]:
        """Normaliza card de Module preservando ID e retendo 'back' legado durante a transição."""
        migrated: Dict[str, Any] = {}
        if original.get("id") is not None:
            migrated["id"] = original["id"]
        migrated["front"] = front_clean
        migrated["image_url"] = valid_url
        if (
            not clear_legacy_back
            and isinstance(original.get("back"), str)
            and original["back"].strip()
        ):
            # Retém o texto legado no JSON durante o período de transição sem exibi-lo na API/UI
            migrated["back"] = original["back"]
        return migrated

    def _write_backup(
        self, backup_path: str, cefr_cards: List[Flashcard], modules: List[Module]
    ) -> None:
        payload = {
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "cefr_flashcards": [
                {
                    "id": str(fc.id),
                    "level": fc.level,
                    "front": fc.front,
                    "back": fc.back,
                    "explanation": fc.explanation,
                    "image_url": fc.image_url,
                    "topic": fc.topic,
                    "source_file": fc.source_file,
                    "options": fc.options,
                    "is_published": fc.is_published,
                }
                for fc in cefr_cards
            ],
            "modules": [
                {
                    "id": str(mod.id),
                    "title": mod.title,
                    "flashcards": mod.flashcards,
                }
                for mod in modules
            ],
        }
        with open(backup_path, "w", encoding="utf-8") as fp:
            json.dump(payload, fp, ensure_ascii=False, indent=2)

    def _handle_restore(self, restore_path: str) -> None:
        try:
            with open(restore_path, "r", encoding="utf-8") as fp:
                snapshot = json.load(fp)
        except Exception as exc:
            raise CommandError(
                f"Não foi possível ler o arquivo de backup '{restore_path}': {exc}"
            )

        cefr_items = snapshot.get("cefr_flashcards", [])
        mod_items = snapshot.get("modules", [])

        restored_cefr = 0
        restored_mods = 0
        with transaction.atomic():
            for item in cefr_items:
                updated = Flashcard.objects.filter(id=item["id"]).update(
                    level=item["level"],
                    front=item["front"],
                    back=item.get("back") or "",
                    explanation=item.get("explanation"),
                    image_url=item.get("image_url"),
                    topic=item.get("topic"),
                    source_file=item.get("source_file"),
                    options=item.get("options"),
                    is_published=item.get("is_published", True),
                )
                restored_cefr += updated

            for mod_data in mod_items:
                updated = Module.objects.filter(id=mod_data["id"]).update(
                    flashcards=mod_data.get("flashcards", [])
                )
                restored_mods += updated

        self.stdout.write(
            self.style.SUCCESS(
                f"[ROLLBACK CONCLUÍDO] Restaurados {restored_cefr} registros em cefr_flashcards e {restored_mods} módulos."
            )
        )

    def _print_report(self, report: Dict[str, Any]) -> None:
        t = report["totals"]
        self.stdout.write("\n--- RESUMO DA AUDITORIA ---")
        self.stdout.write(f"Registros em cefr_flashcards : {t['cefr_flashcards_rows']}")
        self.stdout.write(
            f"Registros em modules (JSON)  : {t['modules_flashcard_items']} cards em {t['modules_count']} módulos"
        )
        self.stdout.write(
            f"Total de flashcards auditados: {t['total_flashcards_inspected']}"
        )
        self.stdout.write(
            f"URLs HTTP únicas verificadas : {t['unique_http_image_urls_checked']} "
            f"(+ {t['inline_base64_images_inspected']} data URI inline validada por magic bytes)"
        )
        self.stdout.write(
            f"Histórico preservado         : {t['preserved_user_flashcard_progress_rows']} progressos de cards, "
            f"{t['preserved_activity_submissions_rows']} submissões de baralhos"
        )
        self.stdout.write("\n--- CLASSIFICAÇÃO (A / B / C) ---")
        self.stdout.write(
            self.style.SUCCESS(
                f"(a) Imagem válida já vinculada (migração automática): {t['category_a_valid_linked_image']}"
            )
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"(b) Imagem mapeada por metadado/ativo exato 1:1     : {t['category_b_matched_via_metadata']}"
            )
        )
        if t["category_c_missing_or_ambiguous_blocked"] > 0:
            self.stdout.write(
                self.style.WARNING(
                    f"(c) Sem imagem / URL quebrada / ambígua (bloqueados): {t['category_c_missing_or_ambiguous_blocked']}"
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    "(c) Sem imagem / URL quebrada / ambígua (bloqueados): 0"
                )
            )

        ex_a = report["examples"]["category_a"]
        ex_b = report["examples"]["category_b"]
        ex_c = report["examples"]["category_c"]

        if ex_a:
            self.stdout.write("\nExemplos Categoria (a):")
            for item in ex_a[:3]:
                loc = item.get("topic") or item.get("module_title")
                self.stdout.write(
                    f"  - [{item['source']}] '{item['front']}' ({loc}) -> {short_url(item.get('current_image_url'), 70)} [{item.get('status_detail')}]"
                )

        if ex_b:
            self.stdout.write("\nExemplos Categoria (b):")
            for item in ex_b[:3]:
                loc = item.get("topic") or item.get("module_title")
                self.stdout.write(
                    f"  - [{item['source']}] '{item['front']}' ({loc}) -> {short_url(item.get('matched_image_url'), 70)} ({item['reason']})"
                )

        if ex_c:
            self.stdout.write("\nRegistros Categoria (c) [Revisão Manual Necessária]:")
            for item in ex_c:
                loc = item.get("topic") or item.get("module_title")
                self.stdout.write(
                    f"  - [{item['source']}] id={item.get('id') or item.get('module_id')} "
                    f"front='{item['front']}' ({loc}) | motivo={item['reason']} | url={short_url(item.get('current_image_url'), 70)}"
                )

