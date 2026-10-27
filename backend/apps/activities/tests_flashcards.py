import io
import os
import tempfile
import uuid
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase

from apps.activities.generator import validate_flashcard_data
from apps.activities.models import ActivitySubmission, Flashcard, Module
from apps.activities.services import FlashcardService, SubmissionService
from apps.authentication.models import User


class FlashcardValidationTests(TestCase):
    def test_accepts_word_front_with_visual_generation_inputs(self):
        ok, errors = validate_flashcard_data(
            {
                "front": "Boarding pass",
                "image_search_query": "airline boarding pass airport gate",
                "image_prompt": "Realistic photograph of a passenger holding a paper boarding pass at an airport gate, natural light, no text",
            }
        )
        self.assertTrue(ok, errors)
        self.assertEqual(errors, [])

    def test_accepts_word_front_with_real_https_image_url(self):
        ok, errors = validate_flashcard_data(
            {
                "front": "Coffee mug",
                "image_url": "https://res.cloudinary.com/demo/image/upload/v1/coffee_mug.jpg",
            }
        )
        self.assertTrue(ok, errors)

    def test_rejects_legacy_back_text_and_four_options(self):
        ok, errors = validate_flashcard_data(
            {
                "front": "Apple",
                "back": "Maçã / A round red fruit",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "image_url": "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6",
            }
        )
        self.assertFalse(ok)
        self.assertTrue(any("back" in err for err in errors))
        self.assertTrue(any("options" in err for err in errors))

    def test_rejects_fake_placeholder_or_missing_visuals(self):
        ok_fake, err_fake = validate_flashcard_data(
            {
                "front": "Umbrella",
                "image_url": "https://via.placeholder.com/400x300",
            }
        )
        self.assertFalse(ok_fake)
        self.assertTrue(any("placeholder" in e.lower() for e in err_fake))

        ok_empty, err_empty = validate_flashcard_data({"front": "Umbrella"})
        self.assertFalse(ok_empty)
        self.assertTrue(any("image_url" in e for e in err_empty))


class FlashcardDeckSerializationTests(TestCase):
    def test_cefr_deck_details_strips_legacy_back_and_options(self):
        fc = Flashcard.objects.create(
            level="A1",
            topic="Kitchen Objects",
            front="Kettle",
            back="Chaleira",
            explanation="Used to boil water",
            image_url="https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5",
            options=["A", "B", "C", "D"],
            is_published=True,
        )
        deck = FlashcardService.get_deck_details("cefr_fc_A1_Kitchen Objects")
        self.assertIsNotNone(deck)
        self.assertEqual(len(deck["flashcards"]), 1)
        card = deck["flashcards"][0]
        self.assertEqual(card["id"], str(fc.id))
        self.assertEqual(card["front"], "Kettle")
        self.assertEqual(
            card["image_url"],
            "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5",
        )
        self.assertNotIn("back", card)
        self.assertNotIn("options", card)
        self.assertNotIn("explanation", card)

    def test_module_deck_details_strips_legacy_fields(self):
        mod = Module.objects.create(
            title="Weather Vocabulary",
            description="Visual deck",
            level="A2",
            is_published=True,
            flashcards=[
                {
                    "id": "c1",
                    "front": "Rainbow",
                    "back": "Arco-íris",
                    "options": ["1", "2", "3", "4"],
                    "image_url": "https://res.cloudinary.com/demo/image/upload/rainbow.jpg",
                }
            ],
        )
        deck = FlashcardService.get_deck_details(str(mod.id))
        self.assertIsNotNone(deck)
        self.assertEqual(len(deck["flashcards"]), 1)
        card = deck["flashcards"][0]
        self.assertEqual(card, {
            "id": "c1",
            "front": "Rainbow",
            "image_url": "https://res.cloudinary.com/demo/image/upload/rainbow.jpg",
        })


class FlashcardSubmissionRevertCycleTests(TestCase):
    def setUp(self):
        self.student = User.objects.create(
            username="student_fc_test",
            email="student_fc_test@tati.ai",
            role="student",
            xp_data={"total_xp": 0},
            streak_data={"current": 0},
        )
        self.deck_id = "cefr_fc_A1_Daily Routine"

    @patch("apps.users.services.GoalService.is_weekly_goal_completed", return_value=False)
    def test_auto_complete_deduct_on_revert_and_reaward_xp(self, _mock_weekly):
        # 1. Conclusão automática concede +25 XP
        res1 = SubmissionService.submit_activity(
            self.student,
            {
                "activity_id": self.deck_id,
                "activity_type": "flashcards",
                "score": 100,
                "status": "completed",
                "metadata": {
                    "id": self.deck_id,
                    "status": "done",
                    "url": f"/flashcards/{self.deck_id}",
                },
            },
        )
        self.student.refresh_from_db()
        self.assertEqual(res1["xp_earned"], 25)
        self.assertEqual(self.student.total_xp, 25)
        self.assertEqual(ActivitySubmission.objects.filter(username=self.student.username).count(), 1)

        # 2. Repetir sem reverter não duplica XP
        res_repeat = SubmissionService.submit_activity(
            self.student,
            {
                "activity_id": self.deck_id,
                "activity_type": "flashcards",
                "score": 100,
                "status": "completed",
                "metadata": {
                    "id": self.deck_id,
                    "status": "done",
                    "url": f"/flashcards/{self.deck_id}",
                },
            },
        )
        self.student.refresh_from_db()
        self.assertEqual(res_repeat["xp_earned"], 0)
        self.assertEqual(self.student.total_xp, 25)

        # 3. Reverter para pendente subtrai os 25 XP e remove submissão concluída
        res_revert = SubmissionService.submit_activity(
            self.student,
            {
                "activity_id": self.deck_id,
                "activity_type": "flashcards",
                "score": 0,
                "status": "pending",
                "metadata": {
                    "id": self.deck_id,
                    "status": "pending",
                    "url": f"/flashcards/{self.deck_id}",
                },
            },
        )
        self.student.refresh_from_db()
        self.assertEqual(res_revert["status"], "pending")
        self.assertEqual(res_revert["xp_earned"], -25)
        self.assertEqual(self.student.total_xp, 0)
        self.assertEqual(ActivitySubmission.objects.filter(username=self.student.username).count(), 0)

        # 4. Concluir novamente após reverter concede os +25 XP novamente
        res_again = SubmissionService.submit_activity(
            self.student,
            {
                "activity_id": self.deck_id,
                "activity_type": "flashcards",
                "score": 100,
                "status": "completed",
                "metadata": {
                    "id": self.deck_id,
                    "status": "done",
                    "url": f"/flashcards/{self.deck_id}",
                },
            },
        )
        self.student.refresh_from_db()
        self.assertEqual(res_again["xp_earned"], 25)
        self.assertEqual(self.student.total_xp, 25)


class FlashcardMigrationCommandTests(TestCase):
    def test_dry_run_apply_idempotency_and_rollback(self):
        valid_card = Flashcard.objects.create(
            level="A1",
            topic="Animals",
            front="Dog",
            back="Cachorro",
            image_url="https://images.unsplash.com/photo-1517849845537-4d257902454a",
            options=["Dog", "Cat", "Bird", "Fish"],
        )
        matched_card = Flashcard.objects.create(
            level="A2",
            topic="Pets",
            front="Dog",
            back="Cão doméstico",
            image_url="",
            options=["A", "B", "C", "D"],
        )
        blocked_card = Flashcard.objects.create(
            level="B1",
            topic="Abstract",
            front="Serendipity",
            back="Acaso feliz",
            image_url="",
            options=["1", "2", "3", "4"],
        )

        # 1. Dry-run não modifica o banco
        out_dry = io.StringIO()
        call_command("migrate_flashcards_visual", "--dry-run", stdout=out_dry)
        matched_card.refresh_from_db()
        self.assertEqual(matched_card.image_url, "")
        self.assertEqual(len(matched_card.options), 4)
        self.assertIn("(a) Imagem válida já vinculada (migração automática): 1", out_dry.getvalue())
        self.assertIn("(b) Imagem mapeada por metadado/ativo exato 1:1     : 1", out_dry.getvalue())
        self.assertIn("(c) Sem imagem / URL quebrada / ambígua (bloqueados): 1", out_dry.getvalue())

        with tempfile.TemporaryDirectory() as tmpdir:
            backup_path = os.path.join(tmpdir, "backup.json")

            # 2. Apply migra (a) e (b), retém 'back' legado e mantém (c) bloqueado sem URL falsa
            out_apply = io.StringIO()
            call_command(
                "migrate_flashcards_visual",
                "--apply",
                f"--backup-file={backup_path}",
                stdout=out_apply,
            )
            self.assertTrue(os.path.exists(backup_path))

            valid_card.refresh_from_db()
            matched_card.refresh_from_db()
            blocked_card.refresh_from_db()

            self.assertEqual(valid_card.options, [])
            self.assertEqual(valid_card.back, "Cachorro")  # Retido durante transição
            self.assertEqual(
                matched_card.image_url,
                "https://images.unsplash.com/photo-1517849845537-4d257902454a",
            )
            self.assertEqual(matched_card.options, [])
            self.assertEqual(blocked_card.image_url, "")
            self.assertEqual(len(blocked_card.options), 4)

            # 3. Reexecução é idempotente (0 registros alterados)
            out_idemp = io.StringIO()
            call_command(
                "migrate_flashcards_visual",
                "--apply",
                f"--backup-file={os.path.join(tmpdir, 'backup2.json')}",
                stdout=out_idemp,
            )
            self.assertIn("cefr_flashcards atualizados: 0 (idempotentes sem mudança: 2)", out_idemp.getvalue())

            # 4. Rollback via --restore-from restaura estado original
            out_restore = io.StringIO()
            call_command(
                "migrate_flashcards_visual",
                f"--restore-from={backup_path}",
                stdout=out_restore,
            )
            matched_card.refresh_from_db()
            self.assertEqual(matched_card.image_url, "")
            self.assertEqual(matched_card.options, ["A", "B", "C", "D"])
