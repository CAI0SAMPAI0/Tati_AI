import random
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.core.database import get_client
from app.modules.cefr.services.generator import CEFRGeneratorService

# Lista de tópicos do cotidiano para a geração autônoma
EVERYDAY_TOPICS = [
    "At the supermarket (No supermercado)",
    "Ordering food at a restaurant (Pedindo comida num restaurante)",
    "Asking for directions (Pedindo informações de direção)",
    "Job interview (Entrevista de emprego)",
    "Booking a hotel room (Reservando um quarto de hotel)",
    "At the airport (No aeroporto)",
    "Talking about daily routine (Falando sobre a rotina diária)",
    "Going to the doctor (Indo ao médico)",
    "Shopping for clothes (Comprando roupas)",
    "Talking about hobbies and free time (Falando sobre hobbies e tempo livre)",
    "Making a phone call (Fazendo uma ligação telefônica)",
    "Renting an apartment (Alugando um apartamento)",
    "Talking about the weather (Falando sobre o clima)",
    "Planning a trip (Planejando uma viagem)",
    "At the bank (No banco)"
]

class CEFRScheduler:
    def __init__(self, apscheduler: AsyncIOScheduler):
        self.scheduler = apscheduler
        self.client = get_client()

    def start(self):
        """
        Registra os jobs do CEFR no scheduler principal.
        """
        # Roda toda segunda-feira às 03:00 da manhã
        self.scheduler.add_job(
            self.job_generate_weekly_content,
            'cron',
            day_of_week='mon',
            hour=3,
            minute=0,
            id='cefr_weekly_generation',
            replace_existing=True
        )
        print("[CEFR Scheduler] Job semanal de geração autônoma configurado (Segunda 03:00).")

    async def job_generate_weekly_content(self):
        """
        Gera flashcards e exercícios semanais automaticamente para cada nível disponível.
        """
        print("[CEFR Scheduler] Iniciando geração semanal de conteúdo CEFR...")
        
        try:
            # 1. Descobrir quais níveis têm materiais indexados
            res = self.client.table('cefr_documents').select('level').execute()
            if not res.data:
                print("[CEFR Scheduler] Nenhum material CEFR indexado. Cancelando geração.")
                return
                
            # Extrai os níveis únicos (A1, A2, etc)
            available_levels = list(set([doc['level'] for doc in res.data if doc.get('level')]))
            print(f"[CEFR Scheduler] Níveis encontrados para geração: {available_levels}")
            
            # 2. Para cada nível, sorteia um tópico e gera conteúdo
            for level in available_levels:
                topic = random.choice(EVERYDAY_TOPICS)
                print(f"[CEFR Scheduler] Gerando conteúdo para {level} sobre '{topic}'...")
                
                # Gera Flashcards (5)
                flashcards = await CEFRGeneratorService.generate_flashcards(level=level, topic=topic, count=5)
                if flashcards:
                    saved_cards = []
                    for card in flashcards:
                        data = {
                            "level": level,
                            "front": card.get("front"),
                            "back": card.get("back"),
                            "explanation": card.get("explanation"),
                            "topic": topic,
                            "is_published": False # Deixa para a Tati revisar/publicar
                        }
                        insert_res = self.client.table("cefr_flashcards").insert(data).execute()
                        if insert_res.data:
                            saved_cards.extend(insert_res.data)
                    print(f"[CEFR Scheduler] Salvos {len(saved_cards)} flashcards para {level}.")

                # Gera Exercícios (3)
                exercises = await CEFRGeneratorService.generate_exercises(level=level, topic=topic, count=3)
                if exercises:
                    saved_exercises = []
                    for ex in exercises:
                        data = {
                            "level": level,
                            "type": "multiple_choice",
                            "question": ex.get("question"),
                            "options": ex.get("options"),
                            "correct_index": ex.get("correct_index"),
                            "explanation": ex.get("explanation"),
                            "topic": topic,
                            "is_published": False # Deixa para a Tati revisar/publicar
                        }
                        insert_res = self.client.table("cefr_exercises").insert(data).execute()
                        if insert_res.data:
                            saved_exercises.extend(insert_res.data)
                    print(f"[CEFR Scheduler] Salvos {len(saved_exercises)} exercícios para {level}.")
            
            print("[CEFR Scheduler] Geração semanal concluída com sucesso!")
            
        except Exception as e:
            print(f"[CEFR Scheduler] Erro durante a geração semanal: {e}")
