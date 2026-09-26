import os
import logging
import hashlib
import requests
from typing import Optional, Dict, List

logger = logging.getLogger(__name__)

# Cache em memória (termo -> url)
_cache: Dict[str, str] = {}


def _cache_key(term: str) -> str:
    return hashlib.md5(term.lower().strip().encode()).hexdigest()


class ImageResolverService:
    @staticmethod
    def search_unsplash(query: str) -> Optional[str]:
        api_key = os.environ.get("UNSPLASH_ACCESS_KEY", "")
        if not api_key:
            return None
        try:
            resp = requests.get(
                "https://api.unsplash.com/search/photos",
                params={"query": query, "per_page": 1, "orientation": "landscape"},
                headers={"Authorization": f"Client-ID {api_key}"},
                timeout=6,
            )
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])
                if results:
                    url = results[0].get("urls", {}).get("regular") or results[0].get(
                        "urls", {}
                    ).get("small")
                    if url:
                        logger.info(
                            f"[ImageResolver] Unsplash encontrado para '{query}': {url[:60]}..."
                        )
                        return url
        except Exception as e:
            logger.warning(f"[ImageResolver] Falha no Unsplash para '{query}': {e}")
        return None

    @staticmethod
    def search_pexels(query: str) -> Optional[str]:
        api_key = os.environ.get("PEXELS_API_KEY", "")
        if not api_key:
            return None
        try:
            resp = requests.get(
                "https://api.pexels.com/v1/search",
                params={"query": query, "per_page": 1, "orientation": "landscape"},
                headers={"Authorization": api_key},
                timeout=6,
            )
            if resp.status_code == 200:
                data = resp.json()
                photos = data.get("photos", [])
                if photos:
                    url = photos[0].get("src", {}).get("medium") or photos[0].get(
                        "src", {}
                    ).get("large")
                    if url:
                        logger.info(
                            f"[ImageResolver] Pexels encontrado para '{query}': {url[:60]}..."
                        )
                        return url
        except Exception as e:
            logger.warning(f"[ImageResolver] Falha no Pexels para '{query}': {e}")
        return None

    @classmethod
    def generate_flux_image(
        cls,
        term: str,
        topic: Optional[str] = None,
        visual_prompt: Optional[str] = None,
    ) -> Optional[str]:
        """
        Gera uma imagem de alta qualidade com IA usando FLUX.1-dev no Hugging Face Spaces.
        Instrui o modelo a NÃO desenhar textos, legendas ou palavras para evitar spoilers da resposta.
        Faz o upload automático do resultado para o Cloudinary para obter CDN permanente.
        """
        clean_term = term.strip()
        # Se vier no formato "Topic: item1, item2", extrai a primeira entidade
        if ":" in clean_term:
            parts = clean_term.split(":", 1)
            topic = topic or parts[0].strip()
            clean_term = parts[1].split(",")[0].strip()
        elif "," in clean_term:
            clean_term = clean_term.split(",")[0].strip()

        token = (
            os.getenv("HF_TOKEN")
            or os.getenv("tati-deploy")
            or os.getenv("HUGGING_FACE_HUB_TOKEN")
        )

        try:
            from gradio_client import Client

            logger.info(f"[ImageResolver] Iniciando geração IA via FLUX.1-dev para '{clean_term}'...")
            client = Client("black-forest-labs/FLUX.1-dev", token=token)

            if visual_prompt and len(visual_prompt) > 10:
                prompt = (
                    f"{visual_prompt}, realistic educational photography, cinematic natural lighting, "
                    f"clean background, highly pedagogical, strictly NO visible text, NO letters, "
                    f"NO words, NO signage, NO labels, NO typography, 4k"
                )
            elif topic:
                prompt = (
                    f"A clear, realistic educational photography illustrating the concept of '{clean_term}' "
                    f"in the context of '{topic}', bright natural lighting, highly pedagogical, "
                    f"strictly NO visible text, NO letters, NO words, NO signage, NO labels, clean background, 4k"
                )
            else:
                prompt = (
                    f"A clear, realistic educational photography illustrating the concept of '{clean_term}', "
                    f"bright natural lighting, highly pedagogical, strictly NO visible text, NO letters, "
                    f"NO words, NO signage, NO labels, clean background, 4k"
                )

            result = client.predict(
                prompt=prompt,
                seed=0,
                randomize_seed=True,
                width=1024,
                height=1024,
                guidance_scale=3.5,
                num_inference_steps=28,
                api_name="/infer",
            )

            if result and isinstance(result, (tuple, list)) and len(result) > 0:
                img_data = result[0]
                local_path = None
                remote_url = None

                if isinstance(img_data, dict):
                    local_path = img_data.get("path")
                    remote_url = img_data.get("url")
                elif isinstance(img_data, str):
                    if os.path.exists(img_data):
                        local_path = img_data
                    else:
                        remote_url = img_data

                # Faz upload para o Cloudinary para ter URL permanente
                if local_path and os.path.exists(local_path):
                    from .assets_service import CloudinaryService
                    with open(local_path, "rb") as f:
                        file_bytes = f.read()
                    safe_name = "".join(c if c.isalnum() else "_" for c in clean_term[:25])
                    cdn_url = CloudinaryService.upload_file(file_bytes, f"flux_{safe_name}.webp")
                    if cdn_url:
                        logger.info(f"[ImageResolver] FLUX.1 gerou e persistiu no Cloudinary: {cdn_url}")
                        return cdn_url

                if remote_url:
                    logger.info(f"[ImageResolver] FLUX.1 gerou URL direta: {remote_url}")
                    return remote_url

        except Exception as e:
            logger.warning(f"[ImageResolver] Falha na geração IA via FLUX.1-dev para '{clean_term}': {e}")

        return None

    @classmethod
    def resolve_image(
        cls,
        term: str,
        topic: Optional[str] = None,
        search_query: Optional[str] = None,
        visual_prompt: Optional[str] = None,
    ) -> str:
        """
        Busca uma imagem relevante e pedagógica para o termo em inglês, evitando spoilers.
        1. Se search_query for informada (gerada contextualmente sem texto pela IA), usa na busca.
        2. Tenta Unsplash -> Pexels -> Palavra principal contextualizada.
        3. Se falhar ou for termo abstrato, aciona FLUX.1-dev sem texto.
        4. Fallback temático curado.
        """
        if not term or not term.strip():
            return "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&w=600&q=80"

        clean_term = term.strip()
        cache_key_str = search_query or (clean_term + ("_" + topic if topic else ""))
        key = _cache_key(cache_key_str)
        if key in _cache:
            return _cache[key]

        # Prepara a query de busca inicial
        query_to_search = search_query
        if not query_to_search:
            # Remove palavras de ligação comuns que atrapalham a busca em bancos de fotos
            words = clean_term.split()
            cleaned_words = [w for w in words if w.lower() not in ("to", "a", "an", "the", "in", "on", "at", "of")]
            query_to_search = " ".join(cleaned_words) if cleaned_words else clean_term

            # Se for termo abstrato ou muito curto, contextualiza com o tópico
            abstract_indicators = ("however", "although", "opinion", "believe", "feel", "name", "identity", "neither", "phrase", "expression")
            if any(ind in query_to_search.lower() for ind in abstract_indicators) and topic:
                query_to_search = f"{topic} {query_to_search}"

        # 1. Tenta Unsplash
        url = cls.search_unsplash(query_to_search)

        # 2. Tenta Pexels se Unsplash não encontrar
        if not url:
            url = cls.search_pexels(query_to_search)

        # 3. Tenta termo limpo original se a query especializada falhou
        if not url and query_to_search != clean_term:
            url = cls.search_unsplash(clean_term) or cls.search_pexels(clean_term)

        # 4. Geração com IA (FLUX.1-dev) com regras anti-spoiler
        if not url:
            url = cls.generate_flux_image(clean_term, topic=topic, visual_prompt=visual_prompt)

        # 5. Fallback temático caso IA não esteja acessível
        if not url:
            url = "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&w=600&q=80"

        _cache[key] = url
        return url

    @classmethod
    def resolve_batch(cls, terms: List[str], topic: Optional[str] = None) -> Dict[str, str]:
        results = {}
        for t in terms:
            if t and t.strip():
                # Se o termo vier com múltiplos separados por vírgula, separa
                if "," in t and not ":" in t:
                    sub_items = [s.strip() for s in t.split(",") if s.strip()]
                    for s in sub_items:
                        results[s] = cls.resolve_image(s, topic=topic)
                else:
                    results[t] = cls.resolve_image(t, topic=topic)
        return results


# Module-level aliases
generate_flux_image = ImageResolverService.generate_flux_image
resolve_image = ImageResolverService.resolve_image
resolve_batch = ImageResolverService.resolve_batch
