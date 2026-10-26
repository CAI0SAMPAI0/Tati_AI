import logging
import os
import uuid
from typing import Any, Dict, List, Optional

from django.utils import timezone as django_timezone

from apps.authentication.models import User
from .activity_scraper import (
    ALLOWED_EXAM_CATEGORIES,
    ActivityPlaywrightScraper,
    ensure_scraped_activity_table,
)
from .models import ActivitySubmission, ScrapedActivityContent, TrimestralExam
from .trimestral_exams import ExamGeneratorService, TrimestralExamService

logger = logging.getLogger(__name__)

VALID_CEFR_LEVELS = ("A1", "A2", "B1", "B2", "C1", "C2")

# Contas administrativas (programador e professora Tatiana) que não devem aparecer
# na listagem de exames do Dashboard quando os exames forem liberados para todos os alunos.
_DEFAULT_ADMIN_EXCLUDED_USERNAMES = {
    "programador",
    "programmer",
    "admin",
    "professor",
    "professora",
    "tatiana",
    "tatys_english_class",
}
_EXTRA_EXCLUDED_USERNAMES = {
    u.strip().lower()
    for u in os.getenv("DASHBOARD_EXAMS_EXCLUDED_USERNAMES", "").split(",")
    if u.strip()
}
DASHBOARD_ADMIN_EXCLUDED_USERNAMES = _DEFAULT_ADMIN_EXCLUDED_USERNAMES | _EXTRA_EXCLUDED_USERNAMES

DASHBOARD_ADMIN_EXCLUDED_ROLES = {
    "programador",
    "programmer",
    "professor",
    "professora",
    "teacher",
    "admin",
}


class AdminExamReviewService:
    """
    Serviço administrativo para a aba Exams no Dashboard:
    - Filtragem por nível CEFR (A1..C2) e listagem de alunos (com ocultação automática de
      programador e professora Tatiana assim que os exames forem liberados para todos os alunos).
    - Sincronização/verificação via Playwright das atividades concluídas pelo aluno (Grammar..Reading).
    - Geração personalizada de exames baseados no nível e atividades concluídas pelo aluno.
    - Reset de exames dos alunos (reabrir tentativa mantendo questões ou zerar ciclo trimestral).
    - Aprovação / reprovação de questões individualmente ou em lote.
    - Sugestão de melhorias para a IA alterar a questão em tempo real e atualizar no banco.
    - Visualização completa das respostas, alternativas marcadas, textos, transcrições e diagnóstico de nível.
    """

    @staticmethod
    def is_admin_or_teacher_account(user: User) -> bool:
        """Identifica contas administrativas (programador e professora Tatiana)."""
        uname = str(getattr(user, "username", "") or "").strip().lower()
        role = str(getattr(user, "role", "") or "").strip().lower()
        if uname in DASHBOARD_ADMIN_EXCLUDED_USERNAMES:
            return True
        if role in DASHBOARD_ADMIN_EXCLUDED_ROLES:
            return True
        if (
            getattr(user, "is_staff", False)
            or getattr(user, "is_superuser", False)
            or getattr(user, "is_teacher", False)
            or getattr(user, "is_programmer", False)
        ):
            return True
        return False

    @staticmethod
    def should_exclude_admins() -> bool:
        """
        Quando os exames forem liberados a todos os alunos (TRIMESTRAL_EXAMS_FOR_ALL=true ou
        EXAMS_FOR_ALL=True em trimestral_exams.py) — ou se DASHBOARD_EXAMS_EXCLUDE_ADMINS=true
        for definido — oculta automaticamente o programador e a professora (Tatiana) da lista
        de Exams no Dashboard.
        """
        explicit = os.getenv("DASHBOARD_EXAMS_EXCLUDE_ADMINS", "").strip().lower()
        if explicit in ("true", "1", "yes"):
            return True
        if explicit in ("false", "0", "no"):
            return False

        from . import trimestral_exams as te_mod

        env_for_all = os.getenv("TRIMESTRAL_EXAMS_FOR_ALL", "").strip().lower() in ("true", "1", "yes")
        return bool(getattr(te_mod, "EXAMS_FOR_ALL", False) or env_for_all)

    @staticmethod
    def _compute_approval_summary(questions: List[Dict[str, Any]]) -> Dict[str, Any]:
        total = len(questions or [])
        approved = sum(1 for q in (questions or []) if q.get("approval_status") == "approved")
        rejected = sum(1 for q in (questions or []) if q.get("approval_status") == "rejected")
        pending = max(0, total - approved - rejected)

        if total == 0:
            overall = "empty"
        elif rejected > 0:
            overall = "changes_requested"
        elif approved == total:
            overall = "approved"
        elif approved > 0:
            overall = "partial"
        else:
            overall = "pending"

        return {
            "total": total,
            "approved": approved,
            "rejected": rejected,
            "pending": pending,
            "overall_status": overall,
        }

    @classmethod
    def format_admin_exam(cls, exam: TrimestralExam) -> Dict[str, Any]:
        """Formata um TrimestralExam completo (com gabaritos, textos, status de aprovação e respostas enriquecidas do aluno)."""
        qs = list(exam.questions or [])
        normalized_qs: List[Dict[str, Any]] = []
        q_by_id: Dict[str, Dict[str, Any]] = {}

        for idx, q in enumerate(qs, start=1):
            item = dict(q)
            if not item.get("id"):
                item["id"] = f"q{idx}"
            if not item.get("approval_status"):
                item["approval_status"] = "pending"
            if "admin_notes" not in item:
                item["admin_notes"] = ""
            normalized_qs.append(item)
            q_by_id[str(item["id"])] = item

        ans_map = exam.answers if isinstance(exam.answers, dict) else {}
        fb = exam.feedback if isinstance(exam.feedback, dict) else {}
        audio_map = fb.get("speaking_audio_map") if isinstance(fb.get("speaking_audio_map"), dict) else {}

        raw_corrections = (
            fb.get("corrections") or TrimestralExamService._reconstruct_corrections(exam)
            if (exam.status == "completed" or bool(ans_map))
            else []
        )

        # Enriquece cada resposta do aluno com o texto de Reading, script de Listening,
        # todas as alternativas (A/B/C/D) e áudio gravado de Speaking (se disponível).
        enriched_corrections: List[Dict[str, Any]] = []
        for idx, corr in enumerate(raw_corrections, start=1):
            c_item = dict(corr)
            q_id = str(c_item.get("question_id") or f"q{idx}")
            q_src = q_by_id.get(q_id, {})
            raw_ans = str(ans_map.get(q_id, "") or "").strip()

            c_item["question_id"] = q_id
            c_item["type"] = c_item.get("type") or q_src.get("type") or "reading"
            c_item["question"] = c_item.get("question") or q_src.get("question") or ""
            c_item["reading_text"] = q_src.get("reading_text")
            c_item["audio_text"] = q_src.get("audio_text")
            c_item["options"] = q_src.get("options") if isinstance(q_src.get("options"), list) else []
            c_item["max_points"] = int(q_src.get("points") or 10)
            c_item["raw_student_answer"] = raw_ans
            c_item["improvements"] = c_item.get("improvements") if isinstance(c_item.get("improvements"), list) else []

            audio_data = audio_map.get(q_id)
            if not audio_data and raw_ans.startswith("data:audio"):
                audio_data = raw_ans
            c_item["student_audio_data"] = audio_data or None

            enriched_corrections.append(c_item)

        answered_count = sum(1 for v in ans_map.values() if v is not None and str(v).strip() != "")

        return {
            "id": str(exam.id),
            "exam_id": str(exam.id),
            "username": exam.username,
            "level": (exam.level or "A1").upper(),
            "status": exam.status,
            "score": exam.score,
            "passed": exam.passed,
            "total_questions": len(normalized_qs),
            "answered_count": answered_count,
            "questions": normalized_qs,
            "answers": ans_map,
            "approval_summary": cls._compute_approval_summary(normalized_qs),
            "summary_feedback": fb.get("summary", ""),
            "recommended_level": fb.get("recommended_level"),
            "skills_breakdown": fb.get("skills_breakdown", {}),
            "points_to_improve": fb.get("points_to_improve", []),
            "can_do_statements": fb.get("can_do_statements", []),
            "corrections": enriched_corrections,
            "review_meta": fb.get("review_meta", {}),
            "started_at": exam.started_at.isoformat() if exam.started_at else None,
            "completed_at": exam.completed_at.isoformat() if exam.completed_at else None,
            "created_at": exam.created_at.isoformat() if exam.created_at else None,
            "updated_at": exam.updated_at.isoformat() if exam.updated_at else None,
        }

    @staticmethod
    def _extract_avatar(user: User) -> Optional[str]:
        prof = getattr(user, "profile", None)
        if isinstance(prof, dict):
            return prof.get("avatar_url") or prof.get("avatar") or None
        return None

    @classmethod
    def list_students_and_exams(
        cls,
        level: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Retorna visão geral para a tela Exams do Dashboard:
        - Contadores por nível CEFR (A1..C2)
        - Lista de alunos filtrada por nível e busca (ocultando automaticamente programador
          e professora Tatiana quando os exames estiverem liberados para todos os alunos)
        - Resumo de atividades concluídas do nível atual (Grammar..Reading) + status Playwright
        - Exame ativo/pré-gerado para aprovação e resumo de exames respondidos pelo aluno
        """
        ensure_scraped_activity_table()

        exclude_admins = cls.should_exclude_admins()
        base_users_qs = User.objects.exclude(role__iexact="buyer").order_by("name", "username")
        all_users = [
            u for u in base_users_qs
            if not (exclude_admins and cls.is_admin_or_teacher_account(u))
        ]

        level_counts: Dict[str, int] = {"ALL": 0, "A1": 0, "A2": 0, "B1": 0, "B2": 0, "C1": 0, "C2": 0}
        for u in all_users:
            u_lvl = str(getattr(u, "level", "") or "A1").strip().upper()
            if u_lvl not in VALID_CEFR_LEVELS:
                u_lvl = "A1"
            level_counts[u_lvl] = level_counts.get(u_lvl, 0) + 1
            level_counts["ALL"] += 1

        lvl_filter = (level or "").strip().upper()
        if lvl_filter in VALID_CEFR_LEVELS:
            filtered_users = [
                u for u in all_users
                if (str(getattr(u, "level", "") or "A1").strip().upper() == lvl_filter)
            ]
        else:
            filtered_users = all_users

        if search and search.strip():
            q_str = search.strip().lower()
            filtered_users = [
                u for u in filtered_users
                if q_str in str(getattr(u, "name", "") or "").lower()
                or q_str in str(getattr(u, "username", "") or "").lower()
                or q_str in str(getattr(u, "email", "") or "").lower()
            ]

        usernames_lower = {u.username.lower(): u.username for u in filtered_users if u.username}

        # Carrega em lote submissões concluídas e URLs já extraídas via Playwright
        scraped_urls = set(ScrapedActivityContent.objects.values_list("url", flat=True))

        all_subs = list(
            ActivitySubmission.objects.filter(
                status="completed",
                score__gt=0,
            ).values("username", "activity_type", "metadata")
        )

        subs_by_user: Dict[str, List[Dict[str, Any]]] = {}
        for s in all_subs:
            uname_low = str(s.get("username") or "").lower()
            if uname_low in usernames_lower:
                subs_by_user.setdefault(uname_low, []).append(s)

        # Carrega em lote todos os exames trimestrais
        all_exams = list(
            TrimestralExam.objects.exclude(status="expired").order_by("-created_at", "-started_at")
        )
        exams_by_user: Dict[str, List[TrimestralExam]] = {}
        for ex in all_exams:
            uname_low = str(ex.username or "").lower()
            if uname_low in usernames_lower:
                exams_by_user.setdefault(uname_low, []).append(ex)

        students_payload: List[Dict[str, Any]] = []
        pending_review_exams = 0
        approved_exams = 0
        total_completed_exams = 0

        for u in filtered_users:
            uname = u.username
            uname_low = uname.lower()
            u_lvl = str(getattr(u, "level", "") or "A1").strip().upper()
            if u_lvl not in VALID_CEFR_LEVELS:
                u_lvl = "A1"

            # Conta atividades concluídas estritamente de Grammar..Reading no nível atual do aluno
            seen_act = set()
            cat_counts = {"grammar": 0, "vocabulary": 0, "listening": 0, "reading": 0}
            scraped_cnt = 0

            for sub in subs_by_user.get(uname_low, []):
                meta = sub.get("metadata") if isinstance(sub.get("metadata"), dict) else {}
                raw_url = meta.get("url") or meta.get("activity_id") or meta.get("id") or ""
                norm_url = ActivityPlaywrightScraper.normalize_url(raw_url) if str(raw_url).startswith("http") else ""
                cat = ActivityPlaywrightScraper.classify_category(sub.get("activity_type", ""), meta, norm_url)
                if cat not in ALLOWED_EXAM_CATEGORIES:
                    continue
                act_lvls = ActivityPlaywrightScraper.extract_activity_levels(meta, norm_url, str(meta.get("title") or ""))
                if act_lvls and not ActivityPlaywrightScraper.level_matches_student(act_lvls, u_lvl):
                    continue
                if not act_lvls and not norm_url:
                    continue
                dedup = norm_url or f"{cat}:{meta.get('slug') or meta.get('title')}"
                if dedup in seen_act:
                    continue
                seen_act.add(dedup)
                cat_counts[cat] += 1
                if norm_url and norm_url in scraped_urls:
                    scraped_cnt += 1

            u_exams = exams_by_user.get(uname_low, [])
            active_ex = next(
                (e for e in u_exams if e.status in ("ready", "in_progress") and (e.level or "").upper() == u_lvl),
                None,
            ) or next((e for e in u_exams if e.status in ("ready", "in_progress")), None)

            completed_list = [e for e in u_exams if e.status == "completed"]
            total_completed_exams += len(completed_list)
            latest_completed = completed_list[0] if completed_list else None

            active_formatted = cls.format_admin_exam(active_ex) if active_ex else None
            if active_formatted:
                ov = active_formatted["approval_summary"]["overall_status"]
                if ov == "approved":
                    approved_exams += 1
                else:
                    pending_review_exams += 1

            students_payload.append({
                "username": uname,
                "name": getattr(u, "name", "") or uname,
                "email": getattr(u, "email", "") or "",
                "level": u_lvl,
                "role": getattr(u, "role", "student"),
                "is_admin_account": cls.is_admin_or_teacher_account(u),
                "avatar_url": cls._extract_avatar(u),
                "completed_activities_summary": {
                    "total": sum(cat_counts.values()),
                    "scraped_count": scraped_cnt,
                    "by_category": cat_counts,
                },
                "active_exam": active_formatted,
                "completed_exams_count": len(completed_list),
                "latest_completed_exam": (
                    {
                        "id": str(latest_completed.id),
                        "level": (latest_completed.level or u_lvl).upper(),
                        "score": latest_completed.score,
                        "passed": latest_completed.passed,
                        "completed_at": latest_completed.completed_at.isoformat() if latest_completed.completed_at else None,
                    }
                    if latest_completed
                    else None
                ),
            })

        # Ordena priorizando quem já tem exame ativo, exames concluídos ou atividades feitas no nível
        students_payload.sort(
            key=lambda item: (
                1 if item["active_exam"] else 0,
                item["completed_exams_count"],
                item["completed_activities_summary"]["total"],
                item["name"].lower(),
            ),
            reverse=True,
        )

        return {
            "level_counts": level_counts,
            "admins_excluded": exclude_admins,
            "summary": {
                "filtered_students": len(students_payload),
                "pending_review_exams": pending_review_exams,
                "approved_exams": approved_exams,
                "completed_exams": total_completed_exams,
            },
            "students": students_payload,
        }

    @classmethod
    def get_student_exam_detail(cls, username: str) -> Dict[str, Any]:
        """Retorna todos os dados de exames, respostas e atividades verificadas de um aluno."""
        ensure_scraped_activity_table()
        user = User.objects.filter(username__iexact=username).first()
        if not user:
            raise ValueError(f"Aluno '{username}' não encontrado.")

        u_lvl = str(getattr(user, "level", "") or "A1").strip().upper()
        if u_lvl not in VALID_CEFR_LEVELS:
            u_lvl = "A1"

        completed_activities = ActivityPlaywrightScraper.get_student_completed_exam_activities(
            username=user.username,
            level=u_lvl,
        )

        exams = list(
            TrimestralExam.objects.filter(username__iexact=user.username)
            .exclude(status="expired")
            .order_by("-created_at", "-started_at")
        )

        active_ex = next(
            (e for e in exams if e.status in ("ready", "in_progress") and (e.level or "").upper() == u_lvl),
            None,
        ) or next((e for e in exams if e.status in ("ready", "in_progress")), None)

        completed_exams = [cls.format_admin_exam(e) for e in exams if e.status == "completed"]

        cat_counts = {"grammar": 0, "vocabulary": 0, "listening": 0, "reading": 0}
        for act in completed_activities:
            c = act.get("category")
            if c in cat_counts:
                cat_counts[c] += 1

        return {
            "student": {
                "username": user.username,
                "name": getattr(user, "name", "") or user.username,
                "email": getattr(user, "email", "") or "",
                "level": u_lvl,
                "role": getattr(user, "role", "student"),
                "is_admin_account": cls.is_admin_or_teacher_account(user),
                "avatar_url": cls._extract_avatar(user),
            },
            "completed_activities_summary": {
                "total": len(completed_activities),
                "scraped_count": sum(1 for a in completed_activities if a.get("scraped")),
                "by_category": cat_counts,
            },
            "completed_activities": completed_activities,
            "active_exam": cls.format_admin_exam(active_ex) if active_ex else None,
            "completed_exams": completed_exams,
        }

    @classmethod
    def sync_student_activities(cls, username: str, force_refresh: bool = False) -> Dict[str, Any]:
        """Verifica com Playwright as atividades concluídas pelo aluno no nível atual e salva no banco."""
        user = User.objects.filter(username__iexact=username).first()
        if not user:
            raise ValueError(f"Aluno '{username}' não encontrado.")
        u_lvl = str(getattr(user, "level", "") or "A1").strip().upper()
        if u_lvl not in VALID_CEFR_LEVELS:
            u_lvl = "A1"

        sync_info = ActivityPlaywrightScraper.sync_student_activities(
            username=user.username,
            level=u_lvl,
            max_to_scrape=8,
            force_refresh=force_refresh,
        )
        detail = cls.get_student_exam_detail(user.username)
        detail["sync_result"] = {
            "newly_scraped": sync_info["newly_scraped"],
            "total_scraped": sync_info["total_scraped"],
            "total_completed": sync_info["total_completed"],
        }
        return detail

    @classmethod
    def generate_student_exam(cls, username: str, num_questions: int = 10) -> Dict[str, Any]:
        """
        Sincroniza via Playwright as atividades concluídas pelo aluno no nível atual (Grammar..Reading)
        e gera um novo exame personalizado pronto para revisão/aprovação no Dashboard.
        """
        user = User.objects.filter(username__iexact=username).first()
        if not user:
            raise ValueError(f"Aluno '{username}' não encontrado.")

        u_lvl = str(getattr(user, "level", "") or "A1").strip().upper()
        if u_lvl not in VALID_CEFR_LEVELS:
            u_lvl = "A1"

        # Expira exames abertos anteriores não concluídos
        TrimestralExam.objects.filter(
            username__iexact=user.username,
            status__in=["ready", "in_progress"],
        ).update(status="expired")

        num_questions = max(8, min(15, int(num_questions or 10)))
        questions = ExamGeneratorService.generate_trimestral_questions(
            level=u_lvl,
            num_questions=num_questions,
            username=user.username,
        )

        new_exam = TrimestralExam.objects.create(
            id=uuid.uuid4(),
            username=user.username,
            level=u_lvl,
            status="ready",
            questions=questions,
            total_questions=len(questions),
            feedback={
                "review_meta": {
                    "generated_from_student_level": u_lvl,
                    "generated_at": django_timezone.now().isoformat(),
                }
            },
            started_at=django_timezone.now(),
        )
        logger.info(f"[AdminExamReviewService] Novo exame {new_exam.id} gerado para {user.username} ({u_lvl}).")
        return cls.get_student_exam_detail(user.username)

    @classmethod
    def reset_student_exams(
        cls,
        username: str,
        mode: str = "clear_all",
        exam_id: Optional[str] = None,
        reviewer: str = "",
    ) -> Dict[str, Any]:
        """
        Reseta o exame de um aluno caso a professora queira liberar nova tentativa:
        - mode="reopen": reabre o exame selecionado/último mantendo as questões aprovadas,
          limpando respostas e liberando imediatamente para o aluno refazer sem bloqueio de 90 dias.
        - mode="delete_one": remove apenas uma tentativa específica (exam_id).
        - mode="clear_all": apaga os exames do aluno e reseta por completo o ciclo trimestral.
        """
        user = User.objects.filter(username__iexact=username).first()
        if not user:
            raise ValueError(f"Aluno '{username}' não encontrado.")

        clean_mode = (mode or "clear_all").strip().lower()
        affected_count = 0

        if clean_mode == "reopen":
            target_exam = None
            if exam_id:
                target_exam = TrimestralExam.objects.filter(
                    id=exam_id,
                    username__iexact=user.username,
                ).first()
            if not target_exam:
                target_exam = (
                    TrimestralExam.objects.filter(
                        username__iexact=user.username,
                        status__in=["in_progress", "ready", "completed"],
                    )
                    .order_by("-completed_at", "-created_at")
                    .first()
                )
            if not target_exam:
                raise ValueError("Este aluno ainda não possui exame para reabrir.")

            # Expira quaisquer outros exames abertos do aluno para evitar conflito
            TrimestralExam.objects.filter(
                username__iexact=user.username,
                status__in=["ready", "in_progress"],
            ).exclude(id=target_exam.id).update(status="expired")

            prev_fb = target_exam.feedback if isinstance(target_exam.feedback, dict) else {}
            rm = dict(prev_fb.get("review_meta") or {})
            rm["last_reset_by"] = reviewer
            rm["last_reset_at"] = django_timezone.now().isoformat()
            rm["reset_mode"] = "reopen"

            target_exam.status = "ready"
            target_exam.answers = {}
            target_exam.score = 0
            target_exam.passed = False
            target_exam.completed_at = None
            target_exam.started_at = django_timezone.now()
            target_exam.feedback = {"review_meta": rm}
            target_exam.save()

            ActivitySubmission.objects.filter(
                username__iexact=user.username,
                activity_type="trimestral_exam",
                metadata__exam_id=str(target_exam.id),
            ).delete()
            affected_count = 1
            logger.info(
                f"[AdminExamReviewService] Exame {target_exam.id} de {user.username} reaberto (ready) por {reviewer}."
            )

        elif clean_mode == "delete_one" and exam_id:
            deleted, _ = TrimestralExam.objects.filter(
                id=exam_id,
                username__iexact=user.username,
            ).delete()
            ActivitySubmission.objects.filter(
                username__iexact=user.username,
                activity_type="trimestral_exam",
                metadata__exam_id=str(exam_id),
            ).delete()
            affected_count = deleted
            logger.info(
                f"[AdminExamReviewService] Tentativa de exame {exam_id} de {user.username} removida por {reviewer}."
            )

        else:
            deleted, _ = TrimestralExam.objects.filter(username__iexact=user.username).delete()
            ActivitySubmission.objects.filter(
                username__iexact=user.username,
                activity_type="trimestral_exam",
            ).delete()
            affected_count = deleted
            logger.info(
                f"[AdminExamReviewService] Ciclo completo de exames de {user.username} resetado ({deleted} registros) por {reviewer}."
            )

        detail = cls.get_student_exam_detail(user.username)
        detail["reset_result"] = {
            "mode": clean_mode,
            "affected_count": affected_count,
        }
        return detail

    @classmethod
    def set_question_approval(
        cls,
        exam_id: str,
        question_id: str,
        approval_status: str,
        admin_notes: Optional[str] = None,
        reviewer: str = "",
    ) -> Dict[str, Any]:
        """Aprova ou reprova uma questão específica de um exame."""
        status_clean = str(approval_status or "").strip().lower()
        if status_clean not in ("approved", "rejected", "pending"):
            raise ValueError("Status inválido. Use 'approved', 'rejected' ou 'pending'.")

        exam = TrimestralExam.objects.filter(id=exam_id).first()
        if not exam:
            raise ValueError("Exame não encontrado.")

        qs = list(exam.questions or [])
        updated_q = None
        for idx, q in enumerate(qs):
            if str(q.get("id")) == str(question_id):
                q_copy = dict(q)
                q_copy["approval_status"] = status_clean
                if admin_notes is not None:
                    q_copy["admin_notes"] = str(admin_notes).strip()
                qs[idx] = q_copy
                updated_q = q_copy
                break

        if not updated_q:
            raise ValueError(f"Questão '{question_id}' não encontrada no exame.")

        fb = dict(exam.feedback) if isinstance(exam.feedback, dict) else {}
        rm = dict(fb.get("review_meta") or {})
        rm["last_reviewed_by"] = reviewer
        rm["last_reviewed_at"] = django_timezone.now().isoformat()
        fb["review_meta"] = rm

        exam.questions = qs
        exam.feedback = fb
        exam.save(update_fields=["questions", "feedback", "updated_at"])

        return {
            "exam": cls.format_admin_exam(exam),
            "updated_question": updated_q,
        }

    @classmethod
    def approve_all_questions(
        cls,
        exam_id: str,
        approval_status: str = "approved",
        reviewer: str = "",
    ) -> Dict[str, Any]:
        """Aprova (ou reseta) todas as questões de um exame de uma só vez."""
        status_clean = str(approval_status or "approved").strip().lower()
        if status_clean not in ("approved", "rejected", "pending"):
            status_clean = "approved"

        exam = TrimestralExam.objects.filter(id=exam_id).first()
        if not exam:
            raise ValueError("Exame não encontrado.")

        qs = []
        for q in (exam.questions or []):
            q_copy = dict(q)
            q_copy["approval_status"] = status_clean
            qs.append(q_copy)

        fb = dict(exam.feedback) if isinstance(exam.feedback, dict) else {}
        rm = dict(fb.get("review_meta") or {})
        rm["last_reviewed_by"] = reviewer
        rm["last_reviewed_at"] = django_timezone.now().isoformat()
        rm["bulk_status"] = status_clean
        fb["review_meta"] = rm

        exam.questions = qs
        exam.feedback = fb
        exam.save(update_fields=["questions", "feedback", "updated_at"])

        return {
            "exam": cls.format_admin_exam(exam),
        }

    @classmethod
    def improve_question_realtime(
        cls,
        exam_id: str,
        question_id: str,
        suggestion: str,
        reviewer: str = "",
    ) -> Dict[str, Any]:
        """
        Recebe a sugestão de melhoria / alteração do admin, aciona a IA na hora para alterar a questão,
        persiste no banco e devolve imediatamente a questão atualizada para exibição em tela.
        """
        if not suggestion or not suggestion.strip():
            raise ValueError("Informe o que deseja melhorar ou alterar na questão.")

        exam = TrimestralExam.objects.filter(id=exam_id).first()
        if not exam:
            raise ValueError("Exame não encontrado.")

        qs = list(exam.questions or [])
        target_idx = None
        target_q = None
        for idx, q in enumerate(qs):
            if str(q.get("id")) == str(question_id):
                target_idx = idx
                target_q = dict(q)
                break

        if target_idx is None or target_q is None:
            raise ValueError(f"Questão '{question_id}' não encontrada no exame.")

        updated_q = ExamGeneratorService.improve_single_question_with_ai(
            level=exam.level or "A1",
            question_obj=target_q,
            suggestion=suggestion.strip(),
            username=exam.username,
        )
        qs[target_idx] = updated_q

        fb = dict(exam.feedback) if isinstance(exam.feedback, dict) else {}
        rm = dict(fb.get("review_meta") or {})
        rm["last_ai_edit_by"] = reviewer
        rm["last_ai_edit_at"] = django_timezone.now().isoformat()
        fb["review_meta"] = rm

        exam.questions = qs
        exam.feedback = fb
        exam.save(update_fields=["questions", "feedback", "updated_at"])

        return {
            "exam": cls.format_admin_exam(exam),
            "updated_question": updated_q,
        }

    @classmethod
    def manual_update_question(
        cls,
        exam_id: str,
        question_id: str,
        updates: Dict[str, Any],
        reviewer: str = "",
    ) -> Dict[str, Any]:
        """Permite ajuste manual direto nos textos/alternativas/gabarito de uma questão pelo admin."""
        exam = TrimestralExam.objects.filter(id=exam_id).first()
        if not exam:
            raise ValueError("Exame não encontrado.")

        qs = list(exam.questions or [])
        updated_q = None
        for idx, q in enumerate(qs):
            if str(q.get("id")) == str(question_id):
                q_copy = dict(q)
                for field in ("question", "reading_text", "audio_text", "correct_answer", "explanation", "approval_status", "admin_notes"):
                    if field in updates and updates[field] is not None:
                        q_copy[field] = updates[field]
                if "options" in updates and isinstance(updates["options"], list):
                    q_copy["options"] = [str(o).strip() for o in updates["options"] if str(o).strip()]
                qs[idx] = q_copy
                updated_q = q_copy
                break

        if not updated_q:
            raise ValueError(f"Questão '{question_id}' não encontrada no exame.")

        fb = dict(exam.feedback) if isinstance(exam.feedback, dict) else {}
        rm = dict(fb.get("review_meta") or {})
        rm["last_manual_edit_by"] = reviewer
        rm["last_manual_edit_at"] = django_timezone.now().isoformat()
        fb["review_meta"] = rm

        exam.questions = qs
        exam.feedback = fb
        exam.save(update_fields=["questions", "feedback", "updated_at"])

        return {
            "exam": cls.format_admin_exam(exam),
            "updated_question": updated_q,
        }
