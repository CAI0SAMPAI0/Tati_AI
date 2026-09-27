import os
from django.core.management.base import BaseCommand
from apps.chat.rag import rag_service, run_rag_eval
from apps.chat.rag.drive_ingest import GoogleDriveIngester, DEFAULT_TATIANA_DRIVE_FOLDER_ID


class Command(BaseCommand):
    help = "Gerencia o RAG da Teacher Tatiana: ingestão de arquivos, sincronização e avaliação contínua (Eval Set)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--folder",
            type=str,
            help="Caminho do diretório local com materiais pedagógicos (PDF, PPTX, MD, TXT). Ignora estritamente 'PESSOAIS'.",
        )
        parser.add_argument(
            "--file",
            type=str,
            help="Caminho de um arquivo específico a ser indexado.",
        )
        parser.add_argument(
            "--eval",
            action="store_true",
            help="Executa a bateria de avaliação de 50 perguntas reais de alunos e exibe as métricas de qualidade.",
        )
        parser.add_argument(
            "--reset-seeds",
            action="store_true",
            help="Limpa o repositório vetorial e recarrega os módulos pedagógicos fundamentais.",
        )
        parser.add_argument(
            "--drive-folder-id",
            type=str,
            default=DEFAULT_TATIANA_DRIVE_FOLDER_ID,
            help="ID da pasta pública do Google Drive para sincronizar materiais.",
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("=== RAG Management - Teacher Tatiana Duarte ==="))

        if options["reset_seeds"]:
            self.stdout.write("Limpando índice vetorial e restabelecendo sementes curriculares...")
            rag_service.vector_store.clear()
            rag_service._seed_foundational_materials()
            self.stdout.write(self.style.SUCCESS("Índice restaurado com sucesso!"))

        if options["file"]:
            file_path = options["file"]
            if os.path.exists(file_path):
                self.stdout.write(f"Ingerindo arquivo único: {file_path}...")
                count = rag_service.ingest_document(file_path)
                self.stdout.write(self.style.SUCCESS(f"{count} chunks indexados com sucesso!"))
            else:
                self.stdout.write(self.style.ERROR(f"Arquivo não encontrado: {file_path}"))

        if options["folder"]:
            folder_path = options["folder"]
            if os.path.exists(folder_path):
                self.stdout.write(f"Ingerindo diretório: {folder_path} (excluindo pastas 'PESSOAIS')...")
                count = rag_service.ingest_folder(folder_path)
                self.stdout.write(self.style.SUCCESS(f"{count} chunks adicionados ao índice vetorial!"))
            else:
                self.stdout.write(self.style.ERROR(f"Diretório não encontrado: {folder_path}"))

        if options["eval"]:
            self.stdout.write("Iniciando avaliação contínua do RAG com 50 perguntas de alunos...")
            report = run_rag_eval(rag_service)
            self.stdout.write(self.style.SUCCESS(
                f"\n--- Resultado da Avaliação (Benchmark) ---\n"
                f"Total de Perguntas: {report.total_queries}\n"
                f"Hit Rate: {report.hit_rate}%\n"
                f"Recall@3: {report.recall_at_k}%\n"
                f"Faithfulness Score: {report.faithfulness_score}%\n"
                f"Latência Média: {report.avg_latency_ms} ms\n"
            ))

        total_chunks = len(rag_service.vector_store.chunks)
        self.stdout.write(self.style.NOTICE(f"Total de chunks atualmente no índice vetorial: {total_chunks}"))
