import logging
from django.core.management.base import BaseCommand
from apps.activities.generator import CEFRGeneratorService

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Executa os agendamentos pedagógicos ativos gerando novos flashcards e simulações CEFR."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Força a geração mesmo que o horário ou dia não coincida.",
        )

    def handle(self, *args, **options):
        force = options.get("force", True)
        self.stdout.write(self.style.NOTICE("Iniciando execução dos agendamentos CEFR..."))
        res = CEFRGeneratorService.check_and_run_schedules(force=force)
        self.stdout.write(self.style.SUCCESS(f"Concluído: {res.get('message')}"))
