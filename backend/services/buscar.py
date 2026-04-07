import os
from dotenv import load_dotenv
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq

# Carrega as variáveis do arquivo .env
load_dotenv()

# Configuração Global da "Memória" da Tati
DIRETORIO_ATUAL = os.path.dirname(os.path.abspath(__file__))
DIRETORIO_BACKEND = os.path.dirname(DIRETORIO_ATUAL)

# Aponta para backend/data/chroma_db
PASTA_RAIZ = os.getcwd()
CHROMA_PATH = os.path.join(PASTA_RAIZ,"backend", "data", "chroma_db")

from langchain_community.embeddings import HuggingFaceInferenceAPIEmbeddings
_embeddings = HuggingFaceInferenceAPIEmbeddings(
    api_key=os.getenv("HUGGING_FACE_KEY", ""),
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)
vectorstore = Chroma(persist_directory=CHROMA_PATH, embedding_function=_embeddings)

def consultar_tati_com_rag(pergunta: str):
    """
    Busca a resposta no banco vetorial e gera a resposta usando o Groq (Llama 3).
    """
    print(f"🔍 Buscando nos livros de Tati por: '{pergunta}'...\n")
    
    # --- PASSO 1: A BUSCA NO CHROMA ---
    retriever = vectorstore.as_retriever(search_kwargs={"k": 3})
    docs_encontrados = retriever.invoke(pergunta)
    
    # --- PASSO 2: EXTRAÇÃO DE CONTEXTO E FONTES ---
    contexto_formatado = ""
    fontes_usadas = set()
    
    if docs_encontrados:
        for i, doc in enumerate(docs_encontrados):
            contexto_formatado += f"\n--- Trecho {i+1} ---\n{doc.page_content}\n"
            nome_arquivo = doc.metadata.get('title', doc.metadata.get('source', 'Arquivo Desconhecido'))
            pagina = doc.metadata.get('page', 'N/A')
            fontes_usadas.add(f"📄 {nome_arquivo} (Pág: {pagina})")
    else:
        contexto_formatado = "Nenhum trecho específico encontrado nos PDFs para esta pergunta."

    # --- PASSO 3: CONFIGURAÇÃO DA IA (Groq) ---
    llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0.3)
    
    # --- PASSO 4: O NOVO PROMPT MESTRE (Mente Aberta) ---
    system_prompt = f"""Você é a Professora Tati, uma assistente virtual didática, amigável e muito prestativa.
    Abaixo, você receberá trechos de documentos da nossa biblioteca (Contexto).

    INSTRUÇÕES IMPORTANTES:
    1. Primeiro, busque a resposta nos trechos de Contexto fornecidos. Se a resposta estiver lá, use-a e mencione os materiais.
    2. Se o Contexto não tiver a resposta completa ou não mencionar o assunto, NÃO diga apenas que não sabe. Use o seu próprio conhecimento geral e inteligência artificial para dar uma resposta completa, educativa e segura para o aluno.
    3. Responda a pergunta detalhadamente em Inglês de forma clara e empática. Fale em português apenas se o aluno pedir ou se for necessário para explicar algo específico. A Tati é fluente em ambos os idiomas, mas prefere usar o Inglês para ensinar.
    4. No final, como você é uma professora de idiomas, traduza um resumo da sua explicação para o Inglês e peça de forma animada para o aluno repetir a frase e praticar a pronúncia.
    5. Nunca cite os trechos do livro, nomes de arquivos, fontes ou link. Use-os apenas como inspiração para saber qual vocabulário ou gramática ensinar. Suas respostas devem ser curtas, naturais e parecer uma pessoa conversando, e não um áudio-livro.

    MATERIAL DA AULA (Contexto da Biblioteca):
    {contexto_formatado}
    """

    # --- PASSO 5: A GERAÇÃO ---
    print("🧠 Tati está processando a resposta...\n")
    messages = [
        ("system", system_prompt),
        ("human", pergunta)
    ]
    
    resposta_ia = llm.invoke(messages)
    texto_final = resposta_ia.content
        
    return texto_final

# ==========================================
# ÁREA DE CHAT NO TERMINAL
# ==========================================
if __name__ == "__main__":
    print("⏳ Acordando a Tati...\n")
    print(f"📂 O banco de dados está apontado para: {CHROMA_PATH}")
    print(f"📦 Total de pedaços de texto no banco de dados: {vectorstore._collection.count()}\n")
    print("💬 O chat está aberto! (Digite 'sair' para encerrar)\n")
    
    # Loop infinito para você fazer várias perguntas sem precisar rodar o script de novo
    while True:
        pergunta_usuario = input("🗣️ Você: ")
        
        # Condição de parada
        if pergunta_usuario.lower() in ['sair', 'exit', 'quit', 'tchau']:
            print("👋 Tati: Foi um prazer! Até a próxima aula!")
            break
            
        if not pergunta_usuario.strip():
            continue
            
        print("-" * 50)
        resposta = consultar_tati_com_rag(pergunta_usuario)
        
        print("\n🌟 RESPOSTA DA TATI:\n")
        print(resposta)
        print("\n" + "=" * 50 + "\n")
        
# função para usar no voice e chat
def obter_contexto_rag(pergunta: str):
    retriever = vectorstore.as_retriever(search_kwargs={"k": 3})
    docs_encontrados = retriever.invoke(pergunta)
    
    contexto_formatado = ""
    if docs_encontrados:
        for i, doc in enumerate(docs_encontrados):
            contexto_formatado += f"\n--- Trecho {i+1} ---\n{doc.page_content}\n"
    else:
        contexto_formatado = "Nenhum trecho específico encontrado nos PDFs para esta pergunta."
        
    return contexto_formatado