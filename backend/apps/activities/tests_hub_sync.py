"""
Testes da sincronização de materiais do Hub (conversão LibreOffice + páginas seguras).

Cobre o incidente em que várias requisições simultâneas de páginas disparavam conversões
LibreOffice concorrentes sobre o mesmo arquivo (WrappedTargetRuntimeException) e o visualizador
exibia a página placeholder roxa.
"""
import io
import os
import shutil
import tempfile
import threading
import time
import zipfile
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase, override_settings

from apps.activities import secure_document_service as sds
from apps.activities import tasks


def _zip_bytes(names: list[str], mimetype: str | None = None) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        if mimetype:
            zf.writestr("mimetype", mimetype)
        for n in names:
            zf.writestr(n, "x")
    return buf.getvalue()


class DetectDocumentExtensionTest(SimpleTestCase):
    def test_pdf(self):
        self.assertEqual(sds.detect_document_extension(b"%PDF-1.7 ..."), ".pdf")

    def test_pptx(self):
        data = _zip_bytes(["[Content_Types].xml", "ppt/presentation.xml"])
        self.assertEqual(sds.detect_document_extension(data, "file_lee51w"), ".pptx")

    def test_docx_is_not_named_pptx(self):
        data = _zip_bytes(["[Content_Types].xml", "word/document.xml"])
        self.assertEqual(sds.detect_document_extension(data, "source_temp.pptx"), ".docx")

    def test_xlsx(self):
        data = _zip_bytes(["xl/workbook.xml"])
        self.assertEqual(sds.detect_document_extension(data), ".xlsx")

    def test_odp(self):
        data = _zip_bytes(["content.xml"], "application/vnd.oasis.opendocument.presentation")
        self.assertEqual(sds.detect_document_extension(data), ".odp")

    def test_ole_powerpoint(self):
        data = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 64 + "PowerPoint".encode("utf-16-le")
        self.assertEqual(sds.detect_document_extension(data), ".ppt")

    def test_ole_word(self):
        data = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 64 + "WordDocument".encode("utf-16-le")
        self.assertEqual(sds.detect_document_extension(data), ".doc")


class ConvertToPdfTest(SimpleTestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.input = os.path.join(self.tmp, "source_temp.pptx")
        with open(self.input, "wb") as f:
            f.write(_zip_bytes(["ppt/presentation.xml"]))
        self.out = os.path.join(self.tmp, "out")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    @staticmethod
    def _fake_run_factory(fail_first: int = 0, delay: float = 0.0, tracker: dict | None = None):
        state = {"calls": 0}
        lock = threading.Lock()

        def fake_run(cmd, **kwargs):
            with lock:
                state["calls"] += 1
                call_no = state["calls"]
                if tracker is not None:
                    tracker["active"] += 1
                    tracker["max_active"] = max(tracker["max_active"], tracker["active"])
            try:
                # Garante que o soffice recebe ambiente headless isolado
                env = kwargs["env"]
                assert env["SAL_USE_VCLPLUGIN"] == "svp"
                assert env["HOME"].startswith(tempfile.gettempdir()) or "soffice_profile_" in env["HOME"]
                if delay:
                    time.sleep(delay)
                outdir = cmd[cmd.index("--outdir") + 1]
                src = cmd[-1]
                if call_no > fail_first:
                    base = os.path.splitext(os.path.basename(src))[0]
                    with open(os.path.join(outdir, f"{base}.pdf"), "wb") as f:
                        f.write(b"%PDF-1.4 fake")
                    return SimpleNamespace(returncode=0, stdout="", stderr="")
                return SimpleNamespace(
                    returncode=1,
                    stdout="",
                    stderr="terminate called after throwing an instance of "
                    "'com::sun::star::lang::WrappedTargetRuntimeException'",
                )
            finally:
                if tracker is not None:
                    with lock:
                        tracker["active"] -= 1

        return fake_run, state

    def test_retries_after_soffice_crash(self):
        fake_run, state = self._fake_run_factory(fail_first=1)
        with patch.object(sds, "_find_soffice", return_value="libreoffice"), \
                patch.object(sds.subprocess, "run", side_effect=fake_run), \
                patch.object(sds.time, "sleep"):
            pdf = sds._convert_to_pdf(self.input, self.out)

        self.assertIsNotNone(pdf)
        self.assertEqual(pdf, os.path.join(self.out, "source_temp.pdf"))
        self.assertTrue(os.path.exists(pdf))
        self.assertEqual(state["calls"], 2)
        # Arquivo original intacto (conversão ocorre em cópia isolada)
        self.assertTrue(os.path.exists(self.input))

    def test_returns_none_after_all_attempts_fail(self):
        fake_run, state = self._fake_run_factory(fail_first=99)
        with patch.object(sds, "_find_soffice", return_value="libreoffice"), \
                patch.object(sds.subprocess, "run", side_effect=fake_run), \
                patch.object(sds.time, "sleep"):
            pdf = sds._convert_to_pdf(self.input, self.out)

        self.assertIsNone(pdf)
        self.assertEqual(state["calls"], sds._SOFFICE_MAX_ATTEMPTS)

    def test_concurrent_conversions_are_serialized(self):
        tracker = {"active": 0, "max_active": 0}
        fake_run, state = self._fake_run_factory(delay=0.05, tracker=tracker)
        results = []

        def worker(i):
            out = os.path.join(self.tmp, f"out_{i}")
            results.append(sds._convert_to_pdf(self.input, out))

        with patch.object(sds, "_find_soffice", return_value="libreoffice"), \
                patch.object(sds.subprocess, "run", side_effect=fake_run):
            threads = [threading.Thread(target=worker, args=(i,)) for i in range(5)]
            for t in threads:
                t.start()
            for t in threads:
                t.join()

        self.assertEqual(tracker["max_active"], 1)
        self.assertEqual(len(results), 5)
        self.assertTrue(all(r and os.path.exists(r) for r in results))

    def test_misnamed_docx_is_converted_with_docx_extension(self):
        with open(self.input, "wb") as f:
            f.write(_zip_bytes(["word/document.xml"]))
        seen = {}

        def fake_run(cmd, **kwargs):
            seen["src"] = cmd[-1]
            outdir = cmd[cmd.index("--outdir") + 1]
            with open(os.path.join(outdir, "source_temp.pdf"), "wb") as f:
                f.write(b"%PDF")
            return SimpleNamespace(returncode=0, stdout="", stderr="")

        with patch.object(sds, "_find_soffice", return_value="libreoffice"), \
                patch.object(sds.subprocess, "run", side_effect=fake_run):
            pdf = sds._convert_to_pdf(self.input, self.out)

        self.assertIsNotNone(pdf)
        self.assertTrue(seen["src"].endswith("source_temp.docx"))


class SyncMaterialPagesTest(SimpleTestCase):
    def setUp(self):
        self.media = tempfile.mkdtemp()
        self.override = override_settings(MEDIA_ROOT=self.media)
        self.override.enable()
        tasks._LAST_SYNC_FAILURE.clear()
        tasks._SYNC_LOCKS.clear()
        self.content = SimpleNamespace(
            id="6588b80b-7e8f-4638-a0f4-39fdb2670532",
            title="Verb Tenses",
            content_source="https://res.cloudinary.com/x/raw/upload/file_lee51w",
            secure_pages=[],
        )
        self.local_dir = os.path.join(self.media, "hub_pages", self.content.id)

    def tearDown(self):
        self.override.disable()
        shutil.rmtree(self.media, ignore_errors=True)
        tasks._LAST_SYNC_FAILURE.clear()
        tasks._SYNC_LOCKS.clear()

    def _write_pages(self, n: int):
        os.makedirs(self.local_dir, exist_ok=True)
        for i in range(n):
            with open(os.path.join(self.local_dir, f"page_{i + 1}.webp"), "wb") as f:
                f.write(b"RIFF....WEBP")

    def test_concurrent_requests_trigger_single_conversion(self):
        calls = {"n": 0}

        def fake_source(content, content_id, local_dir):
            calls["n"] += 1
            time.sleep(0.2)
            self._write_pages(22)
            return True

        results = []
        with patch.object(tasks, "_sync_from_source", side_effect=fake_source):
            threads = [
                threading.Thread(target=lambda: results.append(tasks.sync_material_pages(self.content)))
                for _ in range(22)
            ]
            for t in threads:
                t.start()
            for t in threads:
                t.join()

        self.assertEqual(calls["n"], 1)
        self.assertEqual(len(results), 22)
        self.assertTrue(all(results))

    def test_failure_returns_false_and_respects_cooldown(self):
        with patch.object(tasks, "_sync_from_source", return_value=False) as src:
            self.assertFalse(tasks.sync_material_pages(self.content))
            self.assertFalse(tasks.sync_material_pages(self.content))
            self.assertEqual(src.call_count, 1)

    def test_existing_pages_skip_conversion(self):
        self._write_pages(3)
        with patch.object(tasks, "_sync_from_source") as src:
            self.assertTrue(tasks.sync_material_pages(self.content))
            src.assert_not_called()

    def test_failed_conversion_does_not_render_pptx_or_leave_temp_files(self):
        pptx = _zip_bytes(["ppt/presentation.xml"])
        fake_resp = SimpleNamespace(status_code=200, content=pptx)

        class FakeClient:
            def __init__(self, *a, **k):
                pass

            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            def get(self, url):
                return fake_resp

        with patch.object(tasks.httpx, "Client", FakeClient), \
                patch.object(sds, "_convert_to_pdf", return_value=None), \
                patch.object(tasks, "convert_from_path") as render:
            self.assertFalse(tasks.sync_material_pages(self.content))
            render.assert_not_called()

        self.assertEqual(tasks._list_local_pages(self.local_dir), [])
        self.assertFalse(any(f.startswith("source_temp") for f in os.listdir(self.local_dir)))


class HubPageUnavailableTest(SimpleTestCase):
    def test_returns_retryable_503_without_cache(self):
        from apps.activities.api import _hub_page_unavailable

        resp = _hub_page_unavailable()
        self.assertEqual(resp.status_code, 503)
        self.assertIn("no-store", resp["Cache-Control"])
        self.assertEqual(resp["Retry-After"], "5")
        self.assertNotIn(b"<svg", resp.content)
