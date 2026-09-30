import pytest
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.activities.models import StudentFeedback
from apps.activities.services import StudentFeedbackService
from apps.notifications.models import Notification

User = get_user_model()


class StudentFeedbackServiceTest(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        from django.db import connection
        with connection.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS student_feedbacks (
                    id VARCHAR(36) PRIMARY KEY,
                    student_username VARCHAR(150) NOT NULL,
                    student_name VARCHAR(255) DEFAULT '',
                    cefr_level VARCHAR(20) DEFAULT 'A1',
                    area VARCHAR(50) DEFAULT 'general',
                    activity_id VARCHAR(255) DEFAULT '',
                    activity_title VARCHAR(255) DEFAULT '',
                    rating INTEGER DEFAULT 5,
                    comment TEXT NOT NULL,
                    teacher_reply TEXT DEFAULT '',
                    status VARCHAR(50) DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS notifications (
                    id VARCHAR(36) PRIMARY KEY,
                    username VARCHAR(150) NOT NULL,
                    category VARCHAR(50) DEFAULT 'general',
                    title VARCHAR(255) NOT NULL,
                    body TEXT NOT NULL,
                    is_read BOOLEAN DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

    @classmethod
    def tearDownClass(cls):
        from django.db import connection
        with connection.cursor() as cur:
            cur.execute("DROP TABLE IF EXISTS student_feedbacks;")
            cur.execute("DROP TABLE IF EXISTS notifications;")
        super().tearDownClass()

    def setUp(self):
        self.student = User.objects.create_user(
            username="student_test_feedback",
            password="testpassword123",
            email="student_test@example.com",
            name="Student Tester",
            role="student",
        )
        self.feedback = StudentFeedback.objects.create(
            student_username=self.student.username,
            student_name=self.student.name,
            cefr_level="B1",
            area="listening",
            activity_title="Coffee Shop Dialogue",
            rating=5,
            comment="I really enjoyed this exercise!",
            status="pending",
        )

    def test_list_student_feedbacks_returns_only_matching_user(self):
        # Create feedback for another user
        StudentFeedback.objects.create(
            student_username="other_student",
            student_name="Other Student",
            comment="Other comment",
        )
        
        feedbacks = StudentFeedbackService.list_student_feedbacks(self.student.username)
        self.assertEqual(len(feedbacks), 1)
        self.assertEqual(feedbacks[0]["student_username"], self.student.username)
        self.assertEqual(feedbacks[0]["activity_title"], "Coffee Shop Dialogue")

    @patch("apps.notifications.services.NotificationDispatcher.send_push_to_user")
    @patch("apps.notifications.services.BrevoEmailService.send_email_detailed")
    def test_update_feedback_dispatches_notifications_when_reply_provided(
        self, mock_email, mock_push
    ):
        mock_push.return_value = {"sent": 1}
        mock_email.return_value = {"success": True}

        res = StudentFeedbackService.update_feedback(
            str(self.feedback.id),
            {"teacher_reply": "Great job, keep practicing!"}
        )

        self.assertTrue(res["success"])
        self.assertEqual(res["teacher_reply"], "Great job, keep practicing!")

        # Verify DB updated
        self.feedback.refresh_from_db()
        self.assertEqual(self.feedback.teacher_reply, "Great job, keep practicing!")
        self.assertEqual(self.feedback.status, "reviewed")

        # Verify in-app notification created
        notif = Notification.objects.filter(
            username=self.student.username,
            category="feedback_reply"
        ).first()
        self.assertIsNotNone(notif)
        self.assertIn("Teacher Tatiana respondeu", notif.title)

        # Verify push dispatched with correct URL
        mock_push.assert_called_once()
        args, kwargs = mock_push.call_args
        self.assertEqual(args[0], self.student.username)
        self.assertEqual(kwargs.get("url"), "/profile?tab=feedbacks")

        # Verify email dispatched
        mock_email.assert_called_once()
        email_args, email_kwargs = mock_email.call_args
        self.assertEqual(email_kwargs.get("to_email") or email_args[0], "student_test@example.com")

    def test_api_my_feedbacks_unauthenticated_returns_401(self):
        from django.test import Client
        client = Client()
        response = client.get("/activities/my-feedbacks")
        self.assertEqual(response.status_code, 401)

    def test_api_my_feedbacks_authenticated_returns_list(self):
        from django.test import Client
        from apps.authentication.security import create_access_token
        client = Client()
        token = create_access_token({"sub": self.student.username})
        response = client.get(
            "/activities/my-feedbacks",
            HTTP_AUTHORIZATION=f"Bearer {token}"
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["student_username"], self.student.username)
