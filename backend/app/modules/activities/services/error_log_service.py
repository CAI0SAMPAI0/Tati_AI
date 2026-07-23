import logging
"""
Captura, organiza e prioriza erros gramaticais e de vocabulário detectados no chat.
A geração automática de "AI Exercises" a partir desses erros foi removida (Sprint 20),
substituída pela aba "Grammar" com explicações das fontes DW / BBC / test-english.com.
Os erros continuam sendo persistidos e sincronizados com o SRS de vocabulário.
"""

import re
from collections import defaultdict
from typing import Dict, Any, List, Optional

from fastapi.concurrency import run_in_threadpool

from fastapi import Depends
from app.core.dependencies.db import get_db


class ErrorLogService:
    def __init__(self, db: Any = Depends(get_db)) -> None:
        if db is None or str(type(db)).find('Depends') != -1:
            from app.core.database import get_client
            self.db = get_client()
        else:
            self.db = db

    async def extract_errors_list(
            self, student_msg: str, teacher_msg: str) -> List[Dict[str, Any]]:
        """
        Extrai erros específicos da conversa e devolve uma lista estruturada.
        O modelo deve retornar apenas erros realmente relevantes para treino.
        """
        prompt = f"""
Analyze the student's message below and identify specific English grammar or vocabulary mistakes.

CONTEXT:
STUDENT MESSAGE: "{student_msg}"
TEACHER RESPONSE (CONTEXT): "{teacher_msg}"

INSTRUCTIONS:
1. Identify EXACT mistakes made by the student in their message.
2. DO NOT extract errors from the teacher's response.
3. DO NOT identify errors that were already "examples" or "corrections" mentioned by the teacher unless the student actually made that specific mistake in their message.
4. Focus on fundamental errors: Verb Tense, Subject-Verb Agreement (e.g., "I are" instead of "I am"), Prepositions, and Word Choice.
5. If the student's message is correct or just a simple greeting/acknowledgment, return {{"errors": []}}.
6. The "incorrect" field must be the EXACT substring from the student's message.

Return ONLY a JSON object:
{{
  "errors": [
    {{
      "incorrect": "exactly as written by student",
      "correct": "the correct form",
      "category": "grammar|vocabulary|preposition|verb_tense|spelling",
      "explanation": "Short explanation in English",
      "severity": 1,
      "confidence": 0.9,
      "should_practice": true
    }}
  ]
}}
"""
        try:
            from app.modules.chat.services.llm import groq_chat_json
            data = await groq_chat_json([{"role": "user", "content": prompt}], temperature=0.1)

            if not data:
                return []

            errors = data.get("errors", [])

            if not isinstance(errors, list):
                return []

            return [err for err in errors if isinstance(err, dict)]
        except Exception as e:
            logging.info(
                f"[ErrorLogService] Error extracting errors: {e}")
            return []

    def _normalize_error(self, err: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normaliza campos para facilitar persistência, agrupamento e geração de exercícios.
        """
        incorrect = (err.get("incorrect") or "").strip()
        correct = (err.get("correct") or "").strip()
        category = (err.get("category") or "grammar").strip().lower()
        explanation = (err.get("explanation") or "").strip()
        severity = self._safe_int(
            err.get("severity"), default=1, min_value=1, max_value=3)
        confidence = self._safe_float(
            err.get("confidence"),
            default=0.5,
            min_value=0.0,
            max_value=1.0)
        should_practice = bool(err.get("should_practice", True))

        pattern_key = self._build_pattern_key(
            category, incorrect, correct)

        return {
            "incorrect": incorrect,
            "correct": correct,
            "category": category,
            "explanation": explanation,
            "severity": severity,
            "confidence": confidence,
            "should_practice": should_practice,
            "pattern_key": pattern_key,
        }

    def _build_pattern_key(
            self,
            category: str,
            incorrect: str,
            correct: str) -> str:
        """
        Cria uma assinatura simples do erro para agrupar padrões recorrentes.
        """
        normalized_incorrect = self._normalize_text_for_key(incorrect)
        normalized_correct = self._normalize_text_for_key(correct)
        return f"{category}:{normalized_incorrect}->{normalized_correct}"

    def _normalize_text_for_key(self, text: str) -> str:
        """
        Normalização simples para chave de agrupamento.
        """
        text = text.lower().strip()
        text = re.sub(r"\s+", " ", text)
        text = re.sub(r"[\"'`]", "", text)
        return text

    def _safe_int(
            self,
            value: Any,
            default: int = 1,
            min_value: int = 1,
            max_value: int = 3) -> int:
        try:
            value = int(value)
            return max(min_value, min(max_value, value))
        except Exception:
            return default

    def _safe_float(
            self,
            value: Any,
            default: float = 0.5,
            min_value: float = 0.0,
            max_value: float = 1.0) -> float:
        try:
            value = float(value)
            return max(min_value, min(max_value, value))
        except Exception:
            return default

    def _deduplicate_errors(
            self, errors: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Remove duplicados com base em pattern_key.
        """
        seen = set()
        unique_errors = []

        for err in errors:
            key = err["pattern_key"]
            if key in seen:
                continue
            seen.add(key)
            unique_errors.append(err)

        return unique_errors

    def _score_error(self, err: Dict[str, Any]) -> float:
        """
        Pontua o erro para priorização de treino.
        """
        severity = err.get("severity", 1)
        confidence = err.get("confidence", 0.5)
        should_practice = err.get("should_practice", True)

        score = (severity * 2.0) + (confidence * 3.0)
        if should_practice:
            score += 2.0

        return score

    async def extract_and_log_errors(
            self,
            username: str,
            student_msg: str,
            teacher_msg: str) -> bool:
        """
        Fluxo principal:
        1. extrai erros
        2. normaliza
        3. persiste
        4. sincroniza com SRS
        5. decide se gera exercício
        """
        raw_errors = await self.extract_errors_list(student_msg, teacher_msg)
        if not raw_errors:
            return False

        normalized_errors = [
            self._normalize_error(err) for err in raw_errors]
        normalized_errors = self._deduplicate_errors(normalized_errors)

        try:
            await self._persist_errors(username, normalized_errors)
            await self._sync_errors_with_srs(username, normalized_errors)

            training_targets = await self._get_training_targets(username)

            if await self._should_generate_exercises(username, training_targets):
                from app.modules.activities.services.exercise_generator import generate_exercises_from_targets
                await generate_exercises_from_targets(username, training_targets)

            return True
        except Exception as e:
            logging.info(
                f"[ErrorLogService] Erro ao processar erros: {e}")
            return False

    async def _persist_errors(
            self, username: str, errors: List[Dict[str, Any]]):
        """
        Persiste os erros em lote.
        """
        def _save():
            payloads = []
            for err in errors:
                payloads.append({
                    "username": username,
                    "incorrect_text": err["incorrect"],
                    "correct_text": err["correct"],
                    "category": err["category"],
                    "explanation": err["explanation"],
                    "severity": err["severity"],
                    "confidence": err["confidence"],
                    "pattern_key": err["pattern_key"],
                    "is_resolved": False,
                })

            if payloads:
                self.db.table("user_errors").insert(payloads).execute()

        await run_in_threadpool(_save)

    async def _sync_errors_with_srs(
            self, username: str, errors: List[Dict[str, Any]]):
        """
        Atualiza o SRS com os erros que realmente merecem treino.
        """
        from app.modules.activities.services.vocabulary_srs import vocabulary_srs_service

        for err in errors:
            if not err.get("should_practice", True):
                continue

            await vocabulary_srs_service.add_to_srs(
                username,
                err.get("correct"),
                definition=err.get("explanation", ""),
                example=f"Incorrect: {err.get('incorrect')} -> Correct: {err.get('correct')}"
            )

    async def _get_training_targets(
            self, username: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Agrupa erros não resolvidos por padrão e calcula prioridade.
        """
        def _fetch():
            return (
                self.db.table("user_errors")
                .select("*")
                .eq("username", username)
                .eq("is_resolved", False)
                .execute()
            )

        res = await run_in_threadpool(_fetch)
        rows = res.data or []

        grouped = defaultdict(list)
        for row in rows:
            pattern_key = row.get("pattern_key") or self._build_pattern_key(
                row.get(
                    "category", "grammar"), row.get(
                    "incorrect_text", ""), row.get(
                    "correct_text", ""))
            grouped[pattern_key].append(row)

        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)

        targets = []
        for pattern_key, items in grouped.items():
            # Calcula recência (usamos o erro mais recente do grupo)
            most_recent_date = max(
                datetime.fromisoformat(
                    i.get("created_at").replace(
                        'Z', '+00:00')) for i in items if i.get("created_at"))
            days_ago = (now - most_recent_date).days

            # Penalidade de tempo (decay): erros muito antigos perdem
            # força
            recency_multiplier = 1.0
            if days_ago > 7:
                recency_multiplier = 0.5
            if days_ago > 30:
                recency_multiplier = 0.1

            total_severity = sum(
                int(i.get("severity", 1) or 1) for i in items)
            avg_confidence = sum(float(i.get("confidence", 0.5) or 0.5)
                                 for i in items) / len(items)
            frequency = len(items)

            # Score balanceado: Prioridade MÁXIMA para Gravidade (erros gramaticais como 'I are')
            # Frequência conta, mas um erro grave deve aparecer mesmo se
            # ocorreu poucas vezes.
            score = (frequency * 2.0) + (total_severity * 6.0) + \
                (avg_confidence * 1.5)
            score *= recency_multiplier

            best_item = sorted(
                items,
                key=lambda x: (
                    int(x.get("severity", 1) or 1),
                    float(x.get("confidence", 0.5) or 0.5)
                ),
                reverse=True
            )[0]

            targets.append({
                "pattern_key": pattern_key,
                "category": best_item.get("category", "grammar"),
                "incorrect_text": best_item.get("incorrect_text", ""),
                "correct_text": best_item.get("correct_text", ""),
                "explanation": best_item.get("explanation", ""),
                "frequency": frequency,
                "total_severity": total_severity,
                "avg_confidence": round(avg_confidence, 2),
                "score": round(score, 2),
                "examples": items[:3],
                "last_seen": most_recent_date.isoformat(),
            })

        targets.sort(key=lambda x: x["score"], reverse=True)
        return targets[:limit]

    async def _should_generate_exercises(
            self, username: str, training_targets: List[Dict[str, Any]]) -> bool:
        """
        Decide se vale gerar exercício agora para evitar spam.
        """
        if not training_targets:
            return False

        # 1. Pelo menos 2 padrões de erro para justificar um quiz novo
        if len(training_targets) < 2:
            return False

        # 2. Cooldown de 4 horas para não gerar exercícios em toda
        # mensagem
        try:
            from datetime import datetime, timedelta, timezone
            four_hours_ago = (datetime.now(timezone.utc) -
                              timedelta(hours=4)).isoformat()

            def _check_recent():
                # Verifica se há qualquer exercício (pendente ou
                # concluído) nas últimas 4 horas
                return (
                    self.db.table("user_exercise_attempts")
                    .select("id, status")
                    .eq("username", username)
                    .gte("created_at", four_hours_ago)
                    .execute()
                )

            res = await run_in_threadpool(_check_recent)
            if res.data:
                # Já existe um exercício pendente ou gerado recentemente
                logging.info(
                    f"[ErrorLogService] Pulando geração para {username}: cooldown ativo.")
                return False
        except Exception as e:
            logging.info(
                f"[ErrorLogService] Erro no check de cooldown: {e}")
            return False

        return True

    async def mark_errors_resolved(
            self,
            username: str,
            pattern_key: Optional[str] = None):
        """
        Marca erros como resolvidos.
        Se pattern_key vier vazio, marca todos do usuário.
        """
        def _update():
            query = self.db.table("user_errors").update(
                {"is_resolved": True}).eq("username", username)

            if pattern_key:
                query = query.eq("pattern_key", pattern_key)

            query.execute()

        await run_in_threadpool(_update)

    async def get_user_error_summary(
            self, username: str) -> Dict[str, Any]:
        """
        Retorna um resumo simples dos padrões de erro do usuário.
        """
        def _fetch():
            return (
                self.db.table("user_errors")
                .select("*")
                .eq("username", username)
                .execute()
            )

        res = await run_in_threadpool(_fetch)
        rows = res.data or []

        summary = defaultdict(lambda: {
            "frequency": 0,
            "severity_sum": 0,
            "confidence_sum": 0.0
        })

        for row in rows:
            pattern_key = row.get("pattern_key") or "unknown"
            summary[pattern_key]["frequency"] += 1
            summary[pattern_key]["severity_sum"] += int(
                row.get("severity", 1) or 1)
            summary[pattern_key]["confidence_sum"] += float(
                row.get("confidence", 0.5) or 0.5)

        result = []
        for pattern_key, data in summary.items():
            result.append({
                "pattern_key": pattern_key,
                "frequency": data["frequency"],
                "avg_severity": round(data["severity_sum"] / data["frequency"], 2),
                "avg_confidence": round(data["confidence_sum"] / data["frequency"], 2),
            })

        return {
            "username": username,
            "patterns": sorted(
                result,
                key=lambda x: x["frequency"],
                reverse=True)}


error_log_service = ErrorLogService()
