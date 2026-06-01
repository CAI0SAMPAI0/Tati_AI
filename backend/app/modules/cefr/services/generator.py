from typing import Dict, Any, List, Optional
from app.modules.chat.services.llm import groq_chat_json
from .embeddings import EmbeddingsService

class CEFRGeneratorService:
    CEFR_LABELS = {
        "A1": "Beginner",
        "A2": "Pre-Intermediate",
        "B1": "Intermediate",
        "B2": "Intermediate",
        "C1": "Business English",
        "C2": "Advanced"
    }

    @staticmethod
    async def generate_flashcards(level: str, topic: str, count: int = 5) -> Optional[List[Dict[str, Any]]]:
        """
        Gera flashcards baseados no material do nível CEFR usando o LLM.
        """
        level_label = CEFRGeneratorService.CEFR_LABELS.get(level.upper(), level)
        
        # Busca contexto relevante no pgvector
        context_docs = EmbeddingsService.search_similar_documents(query=topic, level=level, top_k=5)
        
        # Se não encontrou contexto, avisa
        if not context_docs:
            print(f"[CEFRGenerator] Aviso: Nenhum contexto encontrado para nível {level} e tópico '{topic}'")
            context_text = "Nenhum material de referência específico encontrado. Use seu conhecimento geral para o nível CEFR."
        else:
            context_text = "\n\n".join([f"Trecho:\n{d.get('content', '')}" for d in context_docs])
        
        prompt = f"""
        Você é um professor de idiomas experiente criando material para o nível {level} do CEFR ({level_label}).
        
        Baseado no seguinte material de referência sobre o tópico '{topic}':
        
        {context_text}
        
        Sua tarefa: Gerar {count} flashcards educacionais práticos sobre o tópico '{topic}' adequados para o nível {level} ({level_label}).
        
        REGRAS RÍGIDAS:
        1. A frente (front) deve conter uma palavra, frase ou situação prática EM INGLÊS.
        2. O verso (back) deve conter a definição ou resposta EM INGLÊS.
        3. A explicação (explanation) DEVE SER TOTALMENTE EM INGLÊS, explicando o uso, gramática ou contexto da expressão de forma simples.
        4. O conteúdo DEVE estar adequado ao nível {level} de inglês.
        5. Retorne APENAS o JSON válido sem markdown ou outro texto.
        
        Formato de saída esperado (JSON rígido):
        {{
            "flashcards": [
                {{
                    "front": "termo ou situação prática (Inglês)",
                    "back": "definição ou resposta (Inglês)",
                    "explanation": "explicação detalhada de uso (Inglês)"
                }}
            ]
        }}
        """
        
        try:
            data = await groq_chat_json(
                messages=[{'role': 'user', 'content': prompt}],
                max_tokens=2000,
                temperature=0.3,
            )
            
            flashcards = data.get('flashcards', [])
            return flashcards
        except Exception as e:
            print(f"[CEFRGenerator] Erro ao gerar flashcards: {e}")
            return None

    @staticmethod
    async def generate_exercises(level: str, topic: str, count: int = 3) -> Optional[List[Dict[str, Any]]]:
        """
        Gera exercícios de múltipla escolha baseados no material.
        """
        level_label = CEFRGeneratorService.CEFR_LABELS.get(level.upper(), level)
        
        context_docs = EmbeddingsService.search_similar_documents(query=topic, level=level, top_k=5)
        
        if not context_docs:
            context_text = "Nenhum material de referência específico encontrado."
        else:
            context_text = "\n\n".join([f"Trecho:\n{d.get('content', '')}" for d in context_docs])
            
        prompt = f"""
        Você é um professor de inglês nativo criando exercícios práticos para alunos do nível {level} do CEFR ({level_label}).
        
        Baseado no seguinte material sobre o tópico '{topic}':
        
        {context_text}
        
        Gere {count} questões de múltipla escolha focadas no USO PRÁTICO do idioma (vocabulário, gramática ou compreensão de situações reais).
        NÃO faça perguntas teóricas sobre o texto (ex: "o que o aluno faz no mercado"). Faça perguntas como se o aluno estivesse NAQUELA SITUAÇÃO praticando o INGLÊS. (ex: "You want to buy some apples. What do you say to the cashier?").
        
        REGRAS RÍGIDAS:
        1. A pergunta (question) DEVE SER TOTALMENTE EM INGLÊS e focar em uma situação, preenchimento de lacuna (fill-in-the-blank) ou resposta a um diálogo.
        2. As opções (options) DEVEM SER TOTALMENTE EM INGLÊS. Forneça exatamente 4 opções.
        3. A explicação (explanation) DEVE SER TOTALMENTE EM INGLÊS, justificando a resposta correta gramaticalmente ou pelo contexto.
        4. O índice da resposta correta (correct_index) deve ser um inteiro de 0 a 3 correspondente à opção correta.
        5. NÃO use prefixos como A), B), C) nas opções, apenas o texto da opção.
        6. Retorne APENAS um JSON válido.
        
        Formato de saída (JSON):
        {{
            "exercises": [
                {{
                    "question": "texto da pergunta situacional (Inglês)",
                    "options": ["opção 1 (Inglês)", "opção 2 (Inglês)", "opção 3 (Inglês)", "opção 4 (Inglês)"],
                    "correct_index": 0,
                    "explanation": "explicação detalhada (Inglês)"
                }}
            ]
        }}
        """
        
        try:
            data = await groq_chat_json(
                messages=[{'role': 'user', 'content': prompt}],
                max_tokens=2000,
                temperature=0.3,
            )
            
            return data.get('exercises', [])
        except Exception as e:
            print(f"[CEFRGenerator] Erro ao gerar exercícios: {e}")
            return None

    @staticmethod
    async def generate_simulations(level: str, topic: str, count: int = 2) -> Optional[List[Dict[str, Any]]]:
        """
        Gera simulações/cenários de roleplay baseados no material.
        """
        level_label = CEFRGeneratorService.CEFR_LABELS.get(level.upper(), level)
        
        context_docs = EmbeddingsService.search_similar_documents(query=topic, level=level, top_k=5)
        
        if not context_docs:
            context_text = "Nenhum material de referência específico encontrado."
        else:
            context_text = "\n\n".join([f"Trecho:\n{d.get('content', '')}" for d in context_docs])
            
        prompt = f"""
        Você é um professor de inglês nativo criando cenários de roleplay (simulações) para alunos do nível {level} do CEFR ({level_label}).
        
        Baseado no seguinte material sobre o tópico '{topic}':
        
        {context_text}
        
        Gere {count} cenários práticos de simulação focados em situações da vida real.
        
        REGRAS RÍGIDAS:
        1. O cenário (scenario) descreve a situação de forma clara EM INGLÊS.
        2. Os papéis (roles) definem quem é o aluno (Student) e quem é a IA (AI).
        3. O objetivo (goal) diz o que o aluno precisa alcançar ao final da simulação.
        4. O conteúdo DEVE estar adequado ao nível {level} de inglês.
        5. Retorne APENAS um JSON válido.
        
        Formato de saída (JSON):
        {{
            "simulations": [
                {{
                    "scenario": "descrição da situação (Inglês)",
                    "roles": {{"student": "papel do aluno", "ai": "papel da IA"}},
                    "goal": "objetivo da simulação (Inglês)"
                }}
            ]
        }}
        """
        
        try:
            data = await groq_chat_json(
                messages=[{'role': 'user', 'content': prompt}],
                max_tokens=2000,
                temperature=0.3,
            )
            
            return data.get('simulations', [])
        except Exception as e:
            print(f"[CEFRGenerator] Erro ao gerar simulações: {e}")
            return None

