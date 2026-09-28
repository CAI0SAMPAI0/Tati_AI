import logging
from typing import List, Optional, Dict, Any
from .models import RetrievalResult, DocumentChunk
from .embeddings import EmbeddingService
from .vector_store import VectorStore
from .chunking import SmartChunker
from .ingestion import DocumentIngestion
from .retrieval import RAGRetriever

logger = logging.getLogger(__name__)


class RAGService:
    """
    Serviço central de RAG (Retrieval-Augmented Generation) para o tutor Tatiana AI.
    Coordena ingestão de materiais, busca vetorial e injeção contextual de citações.
    """

    def __init__(
        self,
        vector_store: Optional[VectorStore] = None,
        retriever: Optional[RAGRetriever] = None,
    ):
        self.embedding_service = EmbeddingService()
        self.vector_store = vector_store or VectorStore(embedding_service=self.embedding_service)
        self.retriever = retriever or RAGRetriever(vector_store=self.vector_store)
        self.chunker = SmartChunker()
        self.ingestion = DocumentIngestion(vector_store=self.vector_store, chunker=self.chunker)

        # Se o repositório vetorial estiver zerado, inicializa materiais fundamentais
        if len(self.vector_store.chunks) == 0:
            self._seed_foundational_materials()

    def query(
        self,
        student_message: str,
        top_k: int = 3,
        score_threshold: float = 0.20,
    ) -> Dict[str, Any]:
        """
        Executa retrieval para a mensagem do estudante e prepara o contexto com citações.
        """
        results = self.retriever.retrieve(
            query=student_message,
            top_k=top_k,
            score_threshold=score_threshold,
        )

        has_materials = len(results) > 0
        context_block = self.retriever.format_context_for_prompt(results)
        citations = [r.citation for r in results]

        return {
            "has_materials": has_materials,
            "results": results,
            "citations": citations,
            "context_block": context_block,
        }

    def augment_prompt_with_rag(
        self,
        system_prompt: str,
        student_message: str,
        top_k: int = 3,
    ) -> str:
        """
        Injeta o contexto dos materiais do RAG no system prompt.
        Se existir o marcador '{{rag_context}}', substitui. Caso contrário, anexa ao final.
        """
        rag_data = self.query(student_message, top_k=top_k)
        context_block = rag_data["context_block"]

        if not context_block:
            # Remove o marcador limpo se existir
            return system_prompt.replace("{{rag_context}}", "").strip()

        if "{{rag_context}}" in system_prompt:
            return system_prompt.replace("{{rag_context}}", context_block)
        else:
            return f"{system_prompt}\n\n{context_block}"

    def ingest_document(self, file_path: str, title: Optional[str] = None) -> int:
        """Ingere um único documento (PDF, PPTX, MD, TXT)."""
        chunks = self.ingestion.ingest_file(file_path, title=title)
        return len(chunks)

    def ingest_folder(self, folder_path: str) -> int:
        """Ingere um diretório inteiro, respeitando as proibições de pastas pessoais."""
        chunks = self.ingestion.ingest_directory(folder_path)
        return len(chunks)


    def _seed_foundational_materials(self):
        """
        Inicializa módulos curriculares oficiais da Teacher Tatiana Duarte caso o índice esteja vazio,
        garantindo funcionamento imediato do RAG para as principais dúvidas de alunos.
        """
        logger.info("[RAGService] Inicializando materiais curriculares fundamentais da Teacher Tatiana...")

        foundational_docs = [
            {
                "title": "Guia de Present Perfect vs Simple Past - Módulo B1",
                "source": "materials/grammar/present_perfect_guide.md",
                "doc_type": "md",
                "page": 1,
                "text": (
                    "Teacher Tatiana Duarte - Curso Fluência Prática.\n"
                    "Capítulo: Present Perfect vs Simple Past.\n"
                    "O Simple Past é usado quando o tempo no passado está determinado ou concluído. "
                    "Palavras-chave: yesterday, last year, in 2020, ago, when I was a child. "
                    "Exemplo: 'I went to London in 2022' (tempo fixo e encerrado).\n"
                    "Já o Present Perfect (have/has + past participle) conecta o passado com o presente. "
                    "Usamos para experiências de vida sem especificar o momento exato ('I have been to London'), "
                    "ações que começaram no passado e continuam no presente com 'since' ou 'for' ('I have lived here for 3 years'), "
                    "ou ações recém-concluídas com 'just' ('She has just arrived'). "
                    "Dica da Teacher Tati: Nunca use datas específicas de passado com Present Perfect! "
                    "Dizer 'I have seen him yesterday' é incorreto; o certo é 'I saw him yesterday'."
                ),
            },
            {
                "title": "Phrasal Verbs Mais Usados no Dia a Dia - Módulo A2/B1",
                "source": "materials/vocabulary/phrasal_verbs_daily.md",
                "doc_type": "md",
                "page": 3,
                "text": (
                    "Teacher Tatiana Duarte - Phrasal Verbs Essenciais.\n"
                    "1. 'Get by': conseguir se virar ou sobreviver financeiramente ou em comunicação. "
                    "Ex: 'My English is not fluent, but I can get by when traveling.'\n"
                    "2. 'Call off': cancelar um evento ou reunião. "
                    "Ex: 'The manager called off the meeting due to the storm.'\n"
                    "3. 'Put off': adiar, postergar uma tarefa. "
                    "Ex: 'Don't put off until tomorrow what you can do today.'\n"
                    "4. 'Look forward to': esperar ansiosamente por algo bom (atenção: exige verbo com -ING!). "
                    "Ex: 'I am looking forward to seeing you soon.'\n"
                    "5. 'Figure out': compreender ou solucionar um problema. "
                    "Ex: 'I finally figured out how to use this software.'"
                ),
            },
            {
                "title": "Business English & E-mails Corporativos - Módulo B2",
                "source": "materials/business/email_etiquette_tatiana.md",
                "doc_type": "md",
                "page": 5,
                "text": (
                    "Teacher Tatiana Duarte - Comunicação Corporativa & Negócios.\n"
                    "Como iniciar e-mails formais e profissionais em inglês:\n"
                    "- Para destinatário conhecido: 'Dear Mr. / Ms. [Sobrenome]' ou 'Hi [Nome]' se o ambiente for casual.\n"
                    "- Aberturas polidas: 'I hope this email finds you well' ou 'Thank you for getting back to me.'\n"
                    "- Fazendo solicitações sem soar mandão: em vez de 'Give me the report', use 'Could you please share the report when convenient?' ou 'I would appreciate it if you could send...'.\n"
                    "- Anexos: 'Please find attached the updated budget proposal.'\n"
                    "- Encerramentos elegantes: 'Best regards', 'Warm regards' ou 'Sincerely' (muito formal)."
                ),
            },
            {
                "title": "Pronúncia e Connected Speech em Inglês Americano",
                "source": "materials/pronunciation/connected_speech.md",
                "doc_type": "md",
                "page": 2,
                "text": (
                    "Teacher Tatiana Duarte - Guia de Pronúncia e Fala Natural (Connected Speech).\n"
                    "Nativos não pronunciam palavra por palavra separadas; eles conectam os sons.\n"
                    "1. Flap T: Nos Estados Unidos, o som de 'T' entre vogais soa como um 'R' suave em português (como em 'caro'). "
                    "Exemplos: 'water' soa como 'wader', 'butter', 'bottle', 'better'.\n"
                    "2. Linking words: Quando uma palavra termina em consoante e a seguinte começa em vogal, elas se unem: "
                    "'Check it out' soa como 'che-ki-dout'. 'Hold on' soa como 'hol-don'.\n"
                    "3. Reduções comuns: 'going to' vira 'gonna', 'want to' vira 'wanna', 'should have' soa como 'shoulda'."
                ),
            },
            {
                "title": "Falsos Cognatos (False Friends) e Armadilhas para Brasileiros",
                "source": "materials/vocabulary/false_friends.md",
                "doc_type": "md",
                "page": 4,
                "text": (
                    "Teacher Tatiana Duarte - Cuidado com os Falsos Amigos!\n"
                    "- 'Actually' NÃO significa atualmente! Significa 'na verdade' ou 'realmente'. Para 'atualmente', use 'currently' ou 'nowadays'.\n"
                    "- 'Pretend' NÃO é pretender! Significa 'fingir'. Para dizer pretender ter a intenção, use 'intend'.\n"
                    "- 'Attend' NÃO significa atender o telefone! Significa 'participar' ou 'comparecer' a uma aula/evento. Para atender o telefone, use 'answer the phone'.\n"
                    "- 'Realize' NÃO é apenas realizar sonhos; o significado principal é 'perceber' ou 'cair a ficha'.\n"
                    "- 'Push' é EMPURRAR, e 'Pull' é PUXAR. Dica da Teacher Tati: Push começa com P de empurrar para longe!"
                ),
            },
            {
                "title": "Expressões Idiomáticas Essenciais para Conversação",
                "source": "materials/expressions/daily_idioms.md",
                "doc_type": "md",
                "page": 1,
                "text": (
                    "Teacher Tatiana Duarte - Idioms e Expressões Naturais.\n"
                    "- 'Under the weather': não se sentir bem, estar indisposto ou gripado. Ex: 'I'm feeling a bit under the weather today.'\n"
                    "- 'Bite the bullet': encarar uma situação difícil ou inevitável com coragem. Ex: 'I had to bite the bullet and tell him the truth.'\n"
                    "- 'Hit the books': estudar com afinco. Ex: 'Finals are coming, time to hit the books.'\n"
                    "- 'Piece of cake': algo muito fácil de fazer. Ex: 'Don't worry about the exam, it's a piece of cake.'\n"
                    "- 'Break a leg': desejar boa sorte a alguém antes de uma apresentação."
                ),
            },
            {
                "title": "Viagens e Aeroportos: Guia Prático de Sobrevivência",
                "source": "materials/travel/airport_english.md",
                "doc_type": "md",
                "page": 2,
                "text": (
                    "Teacher Tatiana Duarte - Inglês para Viagens e Imigração.\n"
                    "Perguntas comuns no aeroporto e na imigração:\n"
                    "- 'What is the purpose of your visit?' (Qual o objetivo da sua visita?) Resposta: 'I am here on vacation' ou 'I am here for business.'\n"
                    "- 'How long do you intend to stay?' (Quanto tempo planeja ficar?) Resposta: 'I will stay for two weeks.'\n"
                    "- 'Where will you be staying?' (Onde vai se hospedar?) Resposta: 'At the Marriott Hotel' (tenha o comprovante da reserva em mãos).\n"
                    "- No portão de embarque: 'Boarding pass' (cartão de embarque), 'Carry-on luggage' (mala de mão), 'Checked baggage' (mala despachada)."
                ),
            },
        ]

        chunks_to_add: List[DocumentChunk] = []
        for doc in foundational_docs:
            chunk = DocumentChunk(
                id=f"seed_{len(chunks_to_add)+1}",
                text=doc["text"],
                source=doc["source"],
                title=doc["title"],
                doc_type=doc["doc_type"],
                page=doc.get("page"),
                author="Teacher Tatiana Duarte",
                metadata={"course": "Fluência Prática", "category": "Curricular"},
            )
            chunks_to_add.append(chunk)

        self.vector_store.add_chunks(chunks_to_add)
        logger.info(f"[RAGService] {len(chunks_to_add)} materiais fundamentais indexados com sucesso no RAG!")


# Instância Singleton global
rag_service = RAGService()
