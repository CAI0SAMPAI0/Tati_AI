import os
import logging
import hashlib
import requests
from typing import Optional, Dict, List, Any

logger = logging.getLogger(__name__)

# Cache em memória (termo -> url)
_cache: Dict[str, str] = {}


def _cache_key(term: str) -> str:
    return hashlib.md5(term.lower().strip().encode()).hexdigest()


CURATED_THEME_FALLBACKS: Dict[str, str] = {
    "food": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80",
    "diet": "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=800&q=80",
    "nutrition": "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=800&q=80",
    "restaurant": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80",
    "travel": "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80",
    "airport": "https://images.unsplash.com/photo-1520437358207-323b43b50729?auto=format&fit=crop&w=800&q=80",
    "hotel": "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80",
    "work": "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
    "job": "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
    "doctor": "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80",
    "hospital": "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=800&q=80",
    "stethoscope": "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=800&q=80",
    "health": "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=800&q=80",
    "fitness": "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80",
    "family": "https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=800&q=80",
    "routine": "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=800&q=80",
    "shopping": "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80",
    "clothes": "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=800&q=80",
    "weather": "https://images.unsplash.com/photo-1516912481808-3406841bd33c?auto=format&fit=crop&w=800&q=80",
    "education": "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80",
    "default": "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&w=800&q=80",
}


class ImageResolverService:
    @staticmethod
    def compose_search_query(
        term: str,
        topic: Optional[str] = None,
        search_query: Optional[str] = None,
        explanation: Optional[str] = None,
    ) -> str:
        """
        Compõe query de busca estruturada e específica para o sujeito visual real do card.
        Evita poluir termos específicos com tópicos genéricos (ex: não junta 'health' a 'diet/salad').
        """
        clean_term = term.strip()

        # Se houver search_query explícito e específico
        if search_query and len(search_query.strip()) >= 3:
            sq = search_query.strip()
            # Se já possui keywords concretas (2+ palavras), usa diretamente
            if len(sq.split()) >= 2:
                return sq
            # Se for palavra única de comida/dieta, adiciona contexto de alimentos saudáveis sem 'health'
            if any(k in sq.lower() for k in ["diet", "food", "salad", "meal", "fruit", "nutrition"]):
                return f"healthy fresh food {sq}"
            if topic and topic.lower() not in sq.lower():
                return f"{topic} {sq}"
            return sq

        stop_words = {"to", "a", "an", "the", "in", "on", "at", "of", "for", "with", "and", "is", "are"}
        words = [w.strip(".,;:?!\"'") for w in clean_term.split()]
        content_words = [w for w in words if w.lower() not in stop_words and len(w) > 1]
        term_keywords = " ".join(content_words) if content_words else clean_term

        # Detecta termos de dieta/alimentação
        combined_text = f"{clean_term} {explanation or ''}".lower()
        if any(w in combined_text for w in ["diet", "nutrition", "food", "salad", "meal", "eating", "fruit", "vegetable"]):
            return f"healthy fresh food {term_keywords}".strip()

        extra_keywords = []
        if explanation:
            exp_tokens = [
                w.strip(".,;:?!\"'")
                for w in explanation.split()
                if w.strip(".,;:?!\"'").lower() not in stop_words and len(w) > 3
            ]
            extra_keywords = exp_tokens[:2]

        parts = []
        if topic and not any(w in topic.lower() for w in ["general", "all", "deck", "vocabulary"]):
            parts.append(topic.strip())
        parts.append(term_keywords)
        if extra_keywords:
            parts.extend(extra_keywords)

        composed = " ".join(parts).strip()
        return composed or clean_term

    @staticmethod
    def search_unsplash_candidates(query: str, per_page: int = 6) -> List[Dict[str, str]]:
        api_key = os.environ.get("UNSPLASH_ACCESS_KEY", "")
        if not api_key:
            return []
        try:
            resp = requests.get(
                "https://api.unsplash.com/search/photos",
                params={"query": query, "per_page": per_page, "orientation": "landscape"},
                headers={"Authorization": f"Client-ID {api_key}"},
                timeout=6,
            )
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])
                candidates = []
                for r in results:
                    url = r.get("urls", {}).get("regular") or r.get("urls", {}).get("small")
                    desc = r.get("description") or r.get("alt_description") or ""
                    if url:
                        candidates.append({"url": url, "description": desc.strip(), "source": "unsplash"})
                return candidates
        except Exception as e:
            logger.warning(f"[ImageResolver] Falha no Unsplash candidates para '{query}': {e}")
        return []

    @staticmethod
    def search_pexels_candidates(query: str, per_page: int = 6) -> List[Dict[str, str]]:
        api_key = os.environ.get("PEXELS_API_KEY", "")
        if not api_key:
            return []
        try:
            resp = requests.get(
                "https://api.pexels.com/v1/search",
                params={"query": query, "per_page": per_page, "orientation": "landscape"},
                headers={"Authorization": api_key},
                timeout=6,
            )
            if resp.status_code == 200:
                data = resp.json()
                photos = data.get("photos", [])
                candidates = []
                for p in photos:
                    url = p.get("src", {}).get("medium") or p.get("src", {}).get("large")
                    desc = p.get("alt") or ""
                    if url:
                        candidates.append({"url": url, "description": desc.strip(), "source": "pexels"})
                return candidates
        except Exception as e:
            logger.warning(f"[ImageResolver] Falha no Pexels candidates para '{query}': {e}")
        return []

    @classmethod
    def rank_candidates_by_similarity(
        cls,
        candidates: List[Dict[str, str]],
        card_context: str,
        threshold: float = 0.28,
    ) -> Optional[str]:
        """
        Aplica ranking por similaridade semântica (cosseno) entre o contexto do card e alt/description dos candidatos.
        """
        if not candidates:
            return None

        try:
            from apps.chat.rag.embeddings import EmbeddingService

            emb_svc = EmbeddingService()
            target_vec = emb_svc.get_embedding(card_context)

            scored = []
            for cand in candidates:
                desc = cand.get("description", "").strip()
                if desc:
                    cand_vec = emb_svc.get_embedding(desc)
                    sim = EmbeddingService.cosine_similarity(target_vec, cand_vec)
                else:
                    sim = 0.20
                scored.append((sim, cand["url"]))

            scored.sort(key=lambda x: x[0], reverse=True)
            best_sim, best_url = scored[0]
            logger.info(
                f"[ImageResolver] Ranking avaliado: melhor score={best_sim:.3f} (min={threshold}) para contexto '{card_context[:40]}...'"
            )

            if best_sim >= threshold:
                return best_url
        except Exception as e:
            logger.warning(f"[ImageResolver] Erro no cálculo de embeddings: {e}")
            if candidates:
                return candidates[0]["url"]

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
                    f"{visual_prompt}, documentary style, 35mm lens, candid photography, cinematic natural lighting, "
                    f"clean background, highly pedagogical, strictly NO visible text, NO letters, "
                    f"NO words, NO signage, NO labels, NO typography, 4k"
                )
            elif topic:
                prompt = (
                    f"A clear, documentary style, 35mm lens, candid photography illustrating the concept of '{clean_term}' "
                    f"in the context of '{topic}', bright natural lighting, highly pedagogical, "
                    f"strictly NO visible text, NO letters, NO words, NO signage, NO labels, clean background, 4k"
                )
            else:
                prompt = (
                    f"A clear, documentary style, 35mm lens, candid photography illustrating the concept of '{clean_term}', "
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
    def get_curated_fallback(cls, topic: Optional[str] = None, term: Optional[str] = None) -> str:
        """
        Retorna uma imagem educacional curada pelo tema (nunca um placeholder cinza genérico).
        Garante que termos de dieta e alimentação nunca caiam em estetoscópios ou imagens médicas.
        """
        search_str = f"{topic or ''} {term or ''}".lower()
        if any(w in search_str for w in ["diet", "nutrition", "food", "salad", "meal", "eating", "fruit", "vegetable", "snack"]):
            return CURATED_THEME_FALLBACKS["diet"]

        for key, url in CURATED_THEME_FALLBACKS.items():
            if key != "default" and key in search_str:
                return url
        return CURATED_THEME_FALLBACKS["default"]

    @classmethod
    def resolve_image(
        cls,
        term: str,
        topic: Optional[str] = None,
        search_query: Optional[str] = None,
        visual_prompt: Optional[str] = None,
        explanation: Optional[str] = None,
    ) -> str:
        """
        Resolve imagem com:
        1. Query composta (tópico + intenção + keywords).
        2. Busca 5-8 candidatos no Unsplash e Pexels.
        3. Ranking por similaridade semântica de cosseno via EmbeddingService.
        4. Fallback para FLUX.1-dev se nenhum atingir threshold.
        5. Fallback temático curado (nunca placeholder cinza).
        """
        if not term or not term.strip():
            return cls.get_curated_fallback(topic, term)

        clean_term = term.strip()
        cache_key_str = search_query or (clean_term + ("_" + topic if topic else ""))
        key = _cache_key(cache_key_str)
        if key in _cache:
            return _cache[key]

        # 1. Compõe query de busca estruturada
        query = cls.compose_search_query(
            term=clean_term,
            topic=topic,
            search_query=search_query,
            explanation=explanation,
        )

        card_context = f"{clean_term}. {explanation or ''}. Topic: {topic or ''}".strip()

        # 2. Busca múltiplos candidatos (5-8) da Unsplash e Pexels
        candidates = []
        candidates.extend(cls.search_unsplash_candidates(query, per_page=6))
        if len(candidates) < 4:
            candidates.extend(cls.search_pexels_candidates(query, per_page=6))

        # Se a query composta não trouxe candidatos, tenta com clean_term
        if not candidates and query != clean_term:
            candidates.extend(cls.search_unsplash_candidates(clean_term, per_page=4))
            candidates.extend(cls.search_pexels_candidates(clean_term, per_page=4))

        # 3. Aplica ranking semântico com EmbeddingService
        best_url = cls.rank_candidates_by_similarity(candidates, card_context=card_context, threshold=0.28)

        # 4. Fallback FLUX.1 se nada atingiu threshold
        if not best_url:
            best_url = cls.generate_flux_image(clean_term, topic=topic, visual_prompt=visual_prompt)

        # 5. Fallback temático curado
        if not best_url:
            best_url = cls.get_curated_fallback(topic=topic, term=clean_term)

        _cache[key] = best_url
        return best_url

    @classmethod
    def resolve_batch(cls, terms: List[str], topic: Optional[str] = None) -> Dict[str, str]:
        results = {}
        for t in terms:
            if t and t.strip():
                if "," in t and not ":" in t:
                    sub_items = [s.strip() for s in t.split(",") if s.strip()]
                    for s in sub_items:
                        results[s] = cls.resolve_image(s, topic=topic)
                else:
                    results[t] = cls.resolve_image(t, topic=topic)
        return results


# Aliases de compatibilidade
generate_flux_image = ImageResolverService.generate_flux_image
resolve_image = ImageResolverService.resolve_image
resolve_batch = ImageResolverService.resolve_batch
