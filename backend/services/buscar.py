import os
from dotenv import load_dotenv
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq

# 🚨 AS DUAS LINHAS QUE MUDARAM 🚨 (Agora puxam do classic)
from langchain_classic.chains import create_retrieval_chain
from langchain_classic.chains.combine_documents import create_stuff_documents_chain

from langchain_core.prompts import ChatPromptTemplate

# Carrega as variáveis do arquivo .env
load_dotenv()

CROMA_PATH = "./backend/data/chroma_db"

def conversar_com_tati():
    print("⏳ Acordando a Tati...")
    
    # 1. Carrega o Banco de Dados (A memória dela)
    embeddings_model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    vectorstore = Chroma(persist_directory=CROMA_PATH, embedding_function=embeddings_model)
    retriever = vectorstore.as_retriever(search_kwargs={"k": 2})
    
    # 2. Conecta o Cérebro Tagarela (Groq / Llama 3)
    llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0.3)
    
    # 3. Dá a personalidade para a Tati
    system_prompt = (
        "Você é a Professora Tati, uma assistente virtual didática, amigável e prestativa. "
        "Use APENAS os pedaços de texto abaixo (retirados da apostila) para responder à pergunta do aluno. "
        "Se a resposta não estiver no texto, diga educadamente: 'Desculpe, não encontrei essa informação na apostila.' "
        "Não invente informações. Responda sempre em Português do Brasil de forma clara.\n\n"
        "Apostila:\n{context}"
    )
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{input}"),
    ])
    
    # 4. Junta tudo: O buscador + O leitor (LLM)
    question_answer_chain = create_stuff_documents_chain(llm, prompt)
    rag_chain = create_retrieval_chain(retriever, question_answer_chain)
    
    # 5. A Pergunta!
    pergunta = "Qual o objetivo deste módulo em relação à viabilidade econômica?"
    print(f"\n🗣️ Aluno: '{pergunta}'\n")
    print("👩‍🏫 Tati está digitando...\n")
    
    # 6. A Mágica Acontece
    print("🔍 Buscando na apostila...")
    # Linha nova para debugar:
    docs_encontrados = retriever.invoke(pergunta)
    print(f"DEBUG: Encontrei {len(docs_encontrados)} pedaços de texto.")

    resposta = rag_chain.invoke({"input": pergunta})
    
    print(f"🌟 Resposta da Tati:\n{resposta['answer']}")

if __name__ == "__main__":
    conversar_com_tati()
    
    
    
    
    
    
    
    '''system_prompt = (
        "Você é a Professora Tati, uma assistente virtual didática, amigável e prestativa. "
        "Use APENAS os pedaços de texto abaixo (retirados da apostila) para responder à pergunta do aluno. "
        "Se a resposta não estiver no texto, busque na internet."
        "Não invente informações. Responda sempre em Inglês de forma clara e em Português do Brasil apenas se o aluno fizer uma pergunta em português e peça para responder em português, mas inclua a resposta em ambos os idiomas e incentive o aprendizado fazendo o aluno repetir a resposta em inglês.\n\n"
        "Apostila:\n{context}"
    )'''