from typing import Optional, List

def matches_level(user_level: Optional[str], item_level: Optional[str], item_levels: Optional[List[str]] = None) -> bool:
    """
    Verifica se um item deve ser exibido para um usuário com base no nível.
    Lógica unificada para Quizzes, Flashcards e Simulações.
    """
    if not user_level:
        return True
        
    u_lvl = str(user_level).lower()
    
    # Admins ou filtros "todos" veem tudo
    if u_lvl in ['all', 'todos', 'admin', 'undefined']:
        return True
        
    i_lvl = str(item_level).lower() if item_level else ""
    i_lvls = [str(l).lower() for l in item_levels] if item_levels else []
    
    # 1. Se o item é para todos, sempre mostra
    all_variants = ['all', 'todos', 'all levels', 'todos os níveis', 'todos os niveis', 'any']
    if i_lvl in all_variants or any(v in i_lvls for v in all_variants):
        return True
        
    # 2. Match exato
    if u_lvl == i_lvl or u_lvl in i_lvls:
        return True
        
    # 3. Match por prefixo (ex: 'beginner' matches 'beginner a1')
    if i_lvl and (u_lvl.startswith(i_lvl) or i_lvl.startswith(u_lvl)):
        return True
        
    for l in i_lvls:
        if l and (u_lvl.startswith(l) or l.startswith(u_lvl)):
            return True
            
    # 4. Mapeamento de fallback para níveis clássicos se o item for granular
    # Ex: Aluno 'pre-intermediate' deve ver 'beginner' ou 'intermediate'? 
    # Depende da política pedagógica. Por enquanto, os prefixos resolvem 90% dos casos.
    
    return False
