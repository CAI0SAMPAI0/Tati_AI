from app.core.enums import normalize_level


def matches_level(
    user_level: str | None,
    item_level: str | None,
    item_levels: list[str] | None = None,
) -> bool:
    """
    Verifica se um item deve ser exibido para um usuário com base no nível.
    Lógica unificada para Quizzes, Flashcards e Simulações.
    """
    if not user_level:
        return True

    u_raw = str(user_level).lower().strip()

    # Admins ou filtros "todos" veem tudo
    if u_raw in ["all", "todos", "admin", "undefined"]:
        return True

    # Normaliza o nível do usuário
    u_lvl = normalize_level(user_level)

    # 1. Se o item é para todos, sempre mostra
    all_variants = [
        "all",
        "todos",
        "all levels",
        "todos os níveis",
        "todos os niveis",
        "any",
    ]

    if item_level:
        i_raw = str(item_level).lower().strip()
        if i_raw in all_variants:
            return True
        if normalize_level(item_level) == u_lvl:
            return True

    if item_levels:
        for l in item_levels:
            l_raw = str(l).lower().strip()
            if l_raw in all_variants:
                return True
            if normalize_level(l) == u_lvl:
                return True

    # 3. Match por prefixo/contém para flexibilidade legada
    if item_level:
        i_lvl = str(item_level).lower()
        if u_raw.startswith(i_lvl) or i_lvl.startswith(u_raw):
            return True

    if item_levels:
        for l in item_levels:
            l_lvl = str(l).lower()
            if u_raw.startswith(l_lvl) or l_lvl.startswith(u_raw):
                return True

    return False
