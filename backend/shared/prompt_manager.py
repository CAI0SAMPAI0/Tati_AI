import os
import re
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class PromptManager:
    """
    Centralized Prompt Manager for Teacher Tatiana AI.
    Loads and versions prompts from Markdown files (.md) in backend/ai/prompts/.
    Supports in-memory caching, hot-reload, and safe template interpolation.
    """

    _CACHE: Dict[str, str] = {}
    _MTIMES: Dict[str, float] = {}

    @classmethod
    def _get_prompts_dir(cls) -> str:
        # Tenta a partir de settings.BASE_DIR ou relativo ao diretório backend
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        prompts_dir = os.path.join(base_dir, "ai", "prompts")
        if not os.path.exists(prompts_dir):
            alt_dir = os.path.join(base_dir, "..", "backend", "ai", "prompts")
            if os.path.exists(alt_dir):
                return os.path.abspath(alt_dir)
        return prompts_dir

    @classmethod
    def load_raw_prompt(cls, prompt_name: str, force_reload: bool = False) -> str:
        """
        Carrega o conteúdo cru do arquivo .md correspondente ao prompt.
        """
        filename = f"{prompt_name}.md" if not prompt_name.endswith(".md") else prompt_name
        filepath = os.path.join(cls._get_prompts_dir(), filename)

        if not os.path.exists(filepath):
            logger.warning(f"[PromptManager] Arquivo de prompt não encontrado: {filepath}")
            return ""

        try:
            mtime = os.path.getmtime(filepath)
            if not force_reload and prompt_name in cls._CACHE and cls._MTIMES.get(prompt_name) == mtime:
                return cls._CACHE[prompt_name]

            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()

            cls._CACHE[prompt_name] = content
            cls._MTIMES[prompt_name] = mtime
            return content
        except Exception as e:
            logger.error(f"[PromptManager] Erro ao ler prompt '{prompt_name}' de {filepath}: {e}")
            return cls._CACHE.get(prompt_name, "")

    @classmethod
    def extract_section(cls, content: str, section_title: str) -> str:
        """
        Extrai o bloco de texto ou código de uma seção específica do Markdown (ex: '## Flashcards Generator').
        """
        pattern = rf"##\s+{re.escape(section_title)}\s*\n(?:```(?:[a-zA-Z0-9_-]+)?\n)?(.*?)(?:```|\n##|\Z)"
        match = re.search(pattern, content, re.DOTALL | re.IGNORECASE)
        if match:
            return match.group(1).strip()
        return ""

    @classmethod
    def get_prompt(
        cls,
        prompt_name: str,
        section: Optional[str] = None,
        **kwargs: Any
    ) -> str:
        """
        Retorna o prompt renderizado com as variáveis fornecidas.
        Interpola de forma segura apenas as chaves fornecidas sem quebrar em chaves JSON.
        """
        content = cls.load_raw_prompt(prompt_name)
        if not content:
            return ""

        text = cls.extract_section(content, section) if section else content

        # Remove bloco inicial de título markdown se for o arquivo inteiro
        if not section:
            text = re.sub(r"^#\s+[^\n]+\n+", "", text)

        # Interpolação segura de variáveis ({chave}) preservando {} literais do JSON
        for key, value in kwargs.items():
            placeholder = f"{{{key}}}"
            text = text.replace(placeholder, str(value) if value is not None else "")

        return text.strip()

    @classmethod
    def clear_cache(cls):
        """Limpa o cache em memória para forçar releitura dos arquivos."""
        cls._CACHE.clear()
        cls._MTIMES.clear()
