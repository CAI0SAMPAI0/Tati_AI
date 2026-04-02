from dataclasses import dataclass

@dataclass
class UserProfile:
    username: str
    level: str
    focus: str
    custom_prompt: str = ""
    
def build_profile_instruction(profile: UserProfile) -> str:
    """
    Constrói a instrução de perfil do aluno.
    Essa instrução é anexada ao super prompt para guiar a LLM a adaptar suas respostas ao perfil do usuário.
    """
    return (
        f"\n\n--- STUDENT PROFILE ---\n"
        f"English Level: {profile.level}\n"
        f"Main Focus: {profile.focus}\n\n"
        "ADAPTATION RULES:\n"
        "- If the level is 'Beginner': Use extremely simple words...\n"
        "- If the level is 'Intermediate': Speak naturally...\n"
        "- If the level is 'Advanced': Talk like a native speaker...\n"
        "- Always align your examples with their Main Focus."
    )
def build_rag_instruction(context: str) -> str:
    """Constrói a instrução RAG."""
    if not context:
        return ""
    
    return (
        "\n\n--- LIBRARY CONTEXT (RAG) ---\n"
        "Use the context below to inform your response.\n"
        f"CONTEXT:\n{context}\n"
        "STRICT RULES:\n"
        "1. NEVER mention you have access to books or documents.\n"
        "2. NEVER copy text word for word.\n"
        "3. Use it as silent inspiration only."
    )

def build_effective_prompt(
    base_prompt: str,
    profile: UserProfile,
    rag_context: str
) -> str:
    """
    Monta o prompt final sem banco, api ou arquivos, apenas com as instruções essenciais para a LLM.
    """
    parts = [
        base_prompt,
        build_profile_instruction(profile),
        build_rag_instruction(rag_context),
    ]
    
    if profile.custom_prompt:
        parts.append(f"\n\nExtra instructions:\n{profile.custom_prompt}")
    
    return "".join(parts)