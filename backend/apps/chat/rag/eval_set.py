import time
import logging
from typing import List, Dict, Any
from .models import EvalItem, EvalReport
from .rag_service import RAGService, rag_service

logger = logging.getLogger(__name__)

# 50 Perguntas Reais de Alunos para Avaliação Contínua do RAG (Benchmark)
BENCHMARK_EVAL_SET: List[EvalItem] = [
    # Categoria 1: Grammar (Present Perfect vs Simple Past)
    EvalItem(
        id="eval_01",
        question="Qual a diferença entre 'I went to London' e 'I have been to London'?",
        expected_answer_keywords=["simple past", "present perfect", "tempo determinado", "experiência"],
        expected_sources=["Guia de Present Perfect vs Simple Past - Módulo B1"],
        category="Grammar",
        cefr_level="B1",
    ),
    EvalItem(
        id="eval_02",
        question="Posso falar 'I have seen him yesterday' em inglês?",
        expected_answer_keywords=["incorreto", "yesterday", "simple past", "saw"],
        expected_sources=["Guia de Present Perfect vs Simple Past - Módulo B1"],
        category="Grammar",
        cefr_level="B1",
    ),
    EvalItem(
        id="eval_03",
        question="Quando eu uso 'since' e 'for' no Present Perfect?",
        expected_answer_keywords=["since", "for", "começaram no passado", "continuam"],
        expected_sources=["Guia de Present Perfect vs Simple Past - Módulo B1"],
        category="Grammar",
        cefr_level="B1",
    ),
    EvalItem(
        id="eval_04",
        question="O que significa 'She has just arrived'?",
        expected_answer_keywords=["just", "recém-concluída", "acabou de chegar"],
        expected_sources=["Guia de Present Perfect vs Simple Past - Módulo B1"],
        category="Grammar",
        cefr_level="B1",
    ),
    EvalItem(
        id="eval_05",
        question="Quais palavras indicam que devo usar Simple Past e não Present Perfect?",
        expected_answer_keywords=["yesterday", "last year", "ago", "tempo fixo"],
        expected_sources=["Guia de Present Perfect vs Simple Past - Módulo B1"],
        category="Grammar",
        cefr_level="B1",
    ),

    # Categoria 2: Phrasal Verbs
    EvalItem(
        id="eval_06",
        question="O que significa o phrasal verb 'call off'?",
        expected_answer_keywords=["cancelar", "evento", "reunião"],
        expected_sources=["Phrasal Verbs Mais Usados no Dia a Dia - Módulo A2/B1"],
        category="Phrasal Verbs",
        cefr_level="B1",
    ),
    EvalItem(
        id="eval_07",
        question="Qual a diferença entre 'put off' e 'call off'?",
        expected_answer_keywords=["adiar", "cancelar", "postergar"],
        expected_sources=["Phrasal Verbs Mais Usados no Dia a Dia - Módulo A2/B1"],
        category="Phrasal Verbs",
        cefr_level="B1",
    ),
    EvalItem(
        id="eval_08",
        question="Como uso 'look forward to' em uma frase correta?",
        expected_answer_keywords=["esperar ansiosamente", "ing", "seeing you"],
        expected_sources=["Phrasal Verbs Mais Usados no Dia a Dia - Módulo A2/B1"],
        category="Phrasal Verbs",
        cefr_level="B1",
    ),
    EvalItem(
        id="eval_09",
        question="O que quer dizer 'I can get by when traveling'?",
        expected_answer_keywords=["get by", "se virar", "sobreviver"],
        expected_sources=["Phrasal Verbs Mais Usados no Dia a Dia - Módulo A2/B1"],
        category="Phrasal Verbs",
        cefr_level="A2",
    ),
    EvalItem(
        id="eval_10",
        question="Como dizer 'descobrir' ou 'resolver um problema' com phrasal verb?",
        expected_answer_keywords=["figure out", "solucionar", "compreender"],
        expected_sources=["Phrasal Verbs Mais Usados no Dia a Dia - Módulo A2/B1"],
        category="Phrasal Verbs",
        cefr_level="B1",
    ),

    # Categoria 3: Business English & E-mails
    EvalItem(
        id="eval_11",
        question="Como iniciar um e-mail formal em inglês para um cliente?",
        expected_answer_keywords=["dear", "hope this email finds you well", "formal"],
        expected_sources=["Business English & E-mails Corporativos - Módulo B2"],
        category="Business English",
        cefr_level="B2",
    ),
    EvalItem(
        id="eval_12",
        question="Como pedir um relatório por e-mail de forma educada sem parecer grosseiro?",
        expected_answer_keywords=["could you please", "appreciate", "mandão"],
        expected_sources=["Business English & E-mails Corporativos - Módulo B2"],
        category="Business English",
        cefr_level="B2",
    ),
    EvalItem(
        id="eval_13",
        question="Como aviso que tem um documento em anexo no e-mail?",
        expected_answer_keywords=["please find attached", "anexos"],
        expected_sources=["Business English & E-mails Corporativos - Módulo B2"],
        category="Business English",
        cefr_level="B2",
    ),
    EvalItem(
        id="eval_14",
        question="Quais encerramentos profissionais posso usar em e-mails?",
        expected_answer_keywords=["best regards", "warm regards", "sincerely"],
        expected_sources=["Business English & E-mails Corporativos - Módulo B2"],
        category="Business English",
        cefr_level="B2",
    ),
    EvalItem(
        id="eval_15",
        question="Posso usar 'Give me the report' em um e-mail corporativo?",
        expected_answer_keywords=["mandão", "não", "could you please"],
        expected_sources=["Business English & E-mails Corporativos - Módulo B2"],
        category="Business English",
        cefr_level="B2",
    ),

    # Categoria 4: Pronúncia e Connected Speech
    EvalItem(
        id="eval_16",
        question="Por que os americanos falam 'water' com som parecido com R?",
        expected_answer_keywords=["flap t", "vogais", "suave", "wader"],
        expected_sources=["Pronúncia e Connected Speech em Inglês Americano"],
        category="Pronunciation",
        cefr_level="A2",
    ),
    EvalItem(
        id="eval_17",
        question="O que é o Flap T e em quais palavras ele acontece?",
        expected_answer_keywords=["flap t", "butter", "bottle", "better", "water"],
        expected_sources=["Pronúncia e Connected Speech em Inglês Americano"],
        category="Pronunciation",
        cefr_level="B1",
    ),
    EvalItem(
        id="eval_18",
        question="Como funciona a junção de palavras (linking words) como 'Check it out'?",
        expected_answer_keywords=["linking", "consoante", "vogal", "che-ki-dout"],
        expected_sources=["Pronúncia e Connected Speech em Inglês Americano"],
        category="Pronunciation",
        cefr_level="B1",
    ),
    EvalItem(
        id="eval_19",
        question="Por que nativos falam 'gonna' e 'wanna'?",
        expected_answer_keywords=["reduções", "going to", "want to"],
        expected_sources=["Pronúncia e Connected Speech em Inglês Americano"],
        category="Pronunciation",
        cefr_level="A2",
    ),
    EvalItem(
        id="eval_20",
        question="Como pronunciar 'Hold on' de forma natural?",
        expected_answer_keywords=["hol-don", "linking", "conectar"],
        expected_sources=["Pronúncia e Connected Speech em Inglês Americano"],
        category="Pronunciation",
        cefr_level="A2",
    ),

    # Categoria 5: Falsos Cognatos (False Friends)
    EvalItem(
        id="eval_21",
        question="'Actually' significa atualmente em português?",
        expected_answer_keywords=["não", "na verdade", "realmente", "currently"],
        expected_sources=["Falsos Cognatos (False Friends) e Armadilhas para Brasileiros"],
        category="Vocabulary",
        cefr_level="A2",
    ),
    EvalItem(
        id="eval_22",
        question="Como digo 'pretender' (ter a intenção) se 'pretend' significa fingir?",
        expected_answer_keywords=["intend", "fingir", "pretend"],
        expected_sources=["Falsos Cognatos (False Friends) e Armadilhas para Brasileiros"],
        category="Vocabulary",
        cefr_level="B1",
    ),
    EvalItem(
        id="eval_23",
        question="'Attend' significa atender o telefone?",
        expected_answer_keywords=["não", "participar", "comparecer", "answer"],
        expected_sources=["Falsos Cognatos (False Friends) e Armadilhas para Brasileiros"],
        category="Vocabulary",
        cefr_level="B1",
    ),
    EvalItem(
        id="eval_24",
        question="Qual a diferença entre Push e Pull na porta?",
        expected_answer_keywords=["push", "empurrar", "pull", "puxar"],
        expected_sources=["Falsos Cognatos (False Friends) e Armadilhas para Brasileiros"],
        category="Vocabulary",
        cefr_level="A1",
    ),
    EvalItem(
        id="eval_25",
        question="O verbo 'realize' significa apenas realizar sonhos?",
        expected_answer_keywords=["perceber", "cair a ficha"],
        expected_sources=["Falsos Cognatos (False Friends) e Armadilhas para Brasileiros"],
        category="Vocabulary",
        cefr_level="B1",
    ),

    # Categoria 6: Expressões Idiomáticas
    EvalItem(
        id="eval_26",
        question="O que significa quando alguém diz 'I'm feeling under the weather'?",
        expected_answer_keywords=["indisposto", "gripado", "não se sentir bem"],
        expected_sources=["Expressões Idiomáticas Essenciais para Conversação"],
        category="Idioms",
        cefr_level="B1",
    ),
    EvalItem(
        id="eval_27",
        question="Qual o significado da expressão 'bite the bullet'?",
        expected_answer_keywords=["encarar", "difícil", "coragem", "inevitável"],
        expected_sources=["Expressões Idiomáticas Essenciais para Conversação"],
        category="Idioms",
        cefr_level="B2",
    ),
    EvalItem(
        id="eval_28",
        question="O que significa 'hit the books'?",
        expected_answer_keywords=["estudar", "afinco", "livros"],
        expected_sources=["Expressões Idiomáticas Essenciais para Conversação"],
        category="Idioms",
        cefr_level="A2",
    ),
    EvalItem(
        id="eval_29",
        question="Quando alguém fala 'it's a piece of cake', o que quer dizer?",
        expected_answer_keywords=["fácil", "muito fácil"],
        expected_sources=["Expressões Idiomáticas Essenciais para Conversação"],
        category="Idioms",
        cefr_level="A2",
    ),
    EvalItem(
        id="eval_30",
        question="O que significa desejar 'break a leg' para um colega?",
        expected_answer_keywords=["boa sorte", "apresentação"],
        expected_sources=["Expressões Idiomáticas Essenciais para Conversação"],
        category="Idioms",
        cefr_level="B1",
    ),

    # Categoria 7: Viagens e Imigração
    EvalItem(
        id="eval_31",
        question="O que responder quando o oficial de imigração pergunta 'What is the purpose of your visit?'",
        expected_answer_keywords=["vacation", "business", "objetivo", "turismo"],
        expected_sources=["Viagens e Aeroportos: Guia Prático de Sobrevivência"],
        category="Travel",
        cefr_level="A2",
    ),
    EvalItem(
        id="eval_32",
        question="Como responder 'How long do you intend to stay?' na imigração?",
        expected_answer_keywords=["stay", "two weeks", "tempo"],
        expected_sources=["Viagens e Aeroportos: Guia Prático de Sobrevivência"],
        category="Travel",
        cefr_level="A2",
    ),
    EvalItem(
        id="eval_33",
        question="Qual a diferença entre 'carry-on luggage' e 'checked baggage' no aeroporto?",
        expected_answer_keywords=["mala de mão", "mala despachada"],
        expected_sources=["Viagens e Aeroportos: Guia Prático de Sobrevivência"],
        category="Travel",
        cefr_level="A2",
    ),
    EvalItem(
        id="eval_34",
        question="O que é o 'boarding pass' que pedem no portão de embarque?",
        expected_answer_keywords=["cartão de embarque", "portão"],
        expected_sources=["Viagens e Aeroportos: Guia Prático de Sobrevivência"],
        category="Travel",
        cefr_level="A1",
    ),
    EvalItem(
        id="eval_35",
        question="O que devo ter em mãos ao responder 'Where will you be staying?'",
        expected_answer_keywords=["hotel", "comprovante", "reserva"],
        expected_sources=["Viagens e Aeroportos: Guia Prático de Sobrevivência"],
        category="Travel",
        cefr_level="A2",
    ),

    # Mais 15 perguntas para fechar os 50 itens de avaliação
    EvalItem(
        id="eval_36",
        question="Posso usar 'since 2018' com Simple Past?",
        expected_answer_keywords=["present perfect", "since", "passado"],
        expected_sources=["Guia de Present Perfect vs Simple Past - Módulo B1"],
        category="Grammar",
        cefr_level="B1",
    ),
    EvalItem(
        id="eval_37",
        question="Como dizer que cancelei a festa por causa da chuva usando phrasal verb?",
        expected_answer_keywords=["called off", "cancelar"],
        expected_sources=["Phrasal Verbs Mais Usados no Dia a Dia - Módulo A2/B1"],
        category="Phrasal Verbs",
        cefr_level="B1",
    ),
    EvalItem(
        id="eval_38",
        question="Qual a regra do verbo depois de 'looking forward to'?",
        expected_answer_keywords=["-ing", "verbo"],
        expected_sources=["Phrasal Verbs Mais Usados no Dia a Dia - Módulo A2/B1"],
        category="Phrasal Verbs",
        cefr_level="B2",
    ),
    EvalItem(
        id="eval_39",
        question="Como traduzir 'atualmente' para o inglês sem usar actually?",
        expected_answer_keywords=["currently", "nowadays", "actually"],
        expected_sources=["Falsos Cognatos (False Friends) e Armadilhas para Brasileiros"],
        category="Vocabulary",
        cefr_level="A2",
    ),
    EvalItem(
        id="eval_40",
        question="Se eu disser 'I attended the conference', eu atendi uma ligação ou participei?",
        expected_answer_keywords=["participei", "compareci", "evento"],
        expected_sources=["Falsos Cognatos (False Friends) e Armadilhas para Brasileiros"],
        category="Vocabulary",
        cefr_level="B1",
    ),
    EvalItem(
        id="eval_41",
        question="Como é a pronúncia de 'better' e 'bottle' no inglês americano?",
        expected_answer_keywords=["flap t", "r suave", "vogais"],
        expected_sources=["Pronúncia e Connected Speech em Inglês Americano"],
        category="Pronunciation",
        cefr_level="B1",
    ),
    EvalItem(
        id="eval_42",
        question="O que significa 'shoulda' que escuto em músicas?",
        expected_answer_keywords=["should have", "redução"],
        expected_sources=["Pronúncia e Connected Speech em Inglês Americano"],
        category="Pronunciation",
        cefr_level="B1",
    ),
    EvalItem(
        id="eval_43",
        question="Em um e-mail em inglês, o que significa a sigla 'Best regards'?",
        expected_answer_keywords=["atenciosamente", "encerramentos", "profissionais"],
        expected_sources=["Business English & E-mails Corporativos - Módulo B2"],
        category="Business English",
        cefr_level="B2",
    ),
    EvalItem(
        id="eval_44",
        question="Como dizer 'estou anexando o arquivo orçamentário' formalmente?",
        expected_answer_keywords=["please find attached", "budget"],
        expected_sources=["Business English & E-mails Corporativos - Módulo B2"],
        category="Business English",
        cefr_level="B2",
    ),
    EvalItem(
        id="eval_45",
        question="Qual idiom usar quando você precisa ter coragem e encarar o dentista?",
        expected_answer_keywords=["bite the bullet", "coragem"],
        expected_sources=["Expressões Idiomáticas Essenciais para Conversação"],
        category="Idioms",
        cefr_level="B2",
    ),
    EvalItem(
        id="eval_46",
        question="Se estou com gripe leve, posso falar 'I'm under the weather'?",
        expected_answer_keywords=["sim", "indisposto", "gripado"],
        expected_sources=["Expressões Idiomáticas Essenciais para Conversação"],
        category="Idioms",
        cefr_level="A2",
    ),
    EvalItem(
        id="eval_47",
        question="Quando a prova é muito tranquila, que expressão com 'cake' usamos?",
        expected_answer_keywords=["piece of cake", "fácil"],
        expected_sources=["Expressões Idiomáticas Essenciais para Conversação"],
        category="Idioms",
        cefr_level="A1",
    ),
    EvalItem(
        id="eval_48",
        question="Na imigração dos EUA, se me perguntarem 'Where will you be staying?', o que respondo?",
        expected_answer_keywords=["hotel", "marriott", "reserva"],
        expected_sources=["Viagens e Aeroportos: Guia Prático de Sobrevivência"],
        category="Travel",
        cefr_level="A2",
    ),
    EvalItem(
        id="eval_49",
        question="O que significa 'vacation' na resposta da imigração?",
        expected_answer_keywords=["férias", "viagem", "turismo"],
        expected_sources=["Viagens e Aeroportos: Guia Prático de Sobrevivência"],
        category="Travel",
        cefr_level="A1",
    ),
    EvalItem(
        id="eval_50",
        question="Como a Teacher Tatiana recomenda lembrar que Push é empurrar?",
        expected_answer_keywords=["push", "empurrar", "p de empurrar", "pull"],
        expected_sources=["Falsos Cognatos (False Friends) e Armadilhas para Brasileiros"],
        category="Vocabulary",
        cefr_level="A1",
    ),
]


def run_rag_eval(service: RAGService = None, top_k: int = 3) -> EvalReport:
    """
    Executa a bateria de avaliação de 50 perguntas e calcula métricas completas de RAG:
    - Hit Rate (% de perguntas com chunks relevantes encontrados)
    - Recall@k (% de perguntas onde a fonte esperada está no top-k recuperado)
    - Faithfulness Score (% de palavras-chave esperadas cobertas pelo contexto recuperado)
    - Latência média de retrieval (ms)
    """
    target_service = service or rag_service
    total_queries = len(BENCHMARK_EVAL_SET)

    hit_count = 0
    recall_count = 0
    total_keyword_matches = 0
    total_keywords_expected = 0
    latencies: List[float] = []
    details: List[Dict[str, Any]] = []

    for item in BENCHMARK_EVAL_SET:
        t0 = time.perf_counter()
        rag_data = target_service.query(item.question, top_k=top_k)
        elapsed_ms = (time.perf_counter() - t0) * 1000
        latencies.append(elapsed_ms)

        results = rag_data["results"]
        retrieved_titles = [r.chunk.title for r in results]
        combined_text = " ".join([r.chunk.text.lower() for r in results])

        # 1. Hit Rate: Se retornou resultados válidos
        has_hit = len(results) > 0
        if has_hit:
            hit_count += 1

        # 2. Recall@k: A fonte esperada foi recuperada no top-k?
        source_found = any(exp in retrieved_titles for exp in item.expected_sources)
        if source_found:
            recall_count += 1

        # 3. Faithfulness: Proporção de palavras-chave esperadas no texto recuperado
        matched_kw = [kw for kw in item.expected_answer_keywords if kw.lower() in combined_text]
        total_keyword_matches += len(matched_kw)
        total_keywords_expected += len(item.expected_answer_keywords)

        details.append({
            "id": item.id,
            "category": item.category,
            "has_hit": has_hit,
            "source_found": source_found,
            "retrieved_sources": retrieved_titles,
            "latency_ms": round(elapsed_ms, 2),
            "matched_keywords": matched_kw,
        })

    hit_rate = round((hit_count / total_queries) * 100, 2)
    recall_at_k = round((recall_count / total_queries) * 100, 2)
    faithfulness = round((total_keyword_matches / max(total_keywords_expected, 1)) * 100, 2)
    avg_latency = round(sum(latencies) / max(len(latencies), 1), 2)

    report = EvalReport(
        total_queries=total_queries,
        hit_rate=hit_rate,
        recall_at_k=recall_at_k,
        faithfulness_score=faithfulness,
        avg_latency_ms=avg_latency,
        details=details,
    )

    logger.info(
        f"[RAG Eval] {total_queries} queries testadas | "
        f"Hit Rate: {hit_rate}% | Recall@{top_k}: {recall_at_k}% | "
        f"Faithfulness: {faithfulness}% | Latência média: {avg_latency}ms"
    )

    return report
