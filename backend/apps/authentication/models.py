from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.utils import timezone as django_timezone


class UserRole(models.TextChoices):
    PROGRAMADOR = "programador", "Programador / SuperAdmin"
    PROFESSOR = "professor", "Professora Tatiana"
    STUDENT = "student", "Aluno"
    BUYER = "buyer", "Comprador"


class CEFRLevel(models.TextChoices):
    A1 = "A1", "Iniciante (A1)"
    A2 = "A2", "Básico (A2)"
    B1 = "B1", "Intermediário (B1)"
    B2 = "B2", "Intermediário Avançado (B2)"
    C1 = "C1", "Avançado (C1)"
    C2 = "C2", "Fluente / Domínio Pleno (C2)"


class UserManager(BaseUserManager):
    def create_user(self, username, email=None, password=None, **extra_fields):
        if not username:
            raise ValueError("O nome de usuário é obrigatório.")

        username = username.strip().lower()
        if email:
            email = self.normalize_email(email).strip().lower()

        extra_fields.setdefault("role", UserRole.STUDENT)
        extra_fields.setdefault("level", CEFRLevel.A1)
        extra_fields.setdefault("profile", {})
        extra_fields.setdefault("streak_data", {})
        extra_fields.setdefault("xp_data", {})

        user = self.model(username=username, email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields["role"] = UserRole.PROGRAMADOR
        return self.create_user(username, email, password, **extra_fields)


DEFAULT_AVATAR_URL = (
    "https://img.magnific.com/premium-vector/account-icon-user-icon-vector-graphics_292645-552.jpg?semt=ais_hybrid&w=740&q=80"
)


class User(AbstractBaseUser):
    last_login = None

    username = models.CharField(primary_key=True, max_length=150, db_column="username")
    name = models.CharField(max_length=255, db_column="name", default="")
    email = models.CharField(max_length=255, blank=True, null=True, db_column="email")
    password = models.CharField(max_length=255, db_column="password")

    role = models.CharField(
        max_length=50,
        default=UserRole.STUDENT,
        db_column="role",
    )
    level = models.CharField(
        max_length=20,
        default=CEFRLevel.A1,
        db_column="level",
        null=True,
        blank=True,
    )

    # JSONB columns nativas do Supabase
    profile = models.JSONField(default=dict, blank=True, null=True, db_column="profile")
    streak_data = models.JSONField(
        default=dict, blank=True, null=True, db_column="streak_data"
    )
    xp_data = models.JSONField(default=dict, blank=True, null=True, db_column="xp_data")
    study_goals = models.JSONField(
        default=list, blank=True, null=True, db_column="study_goals"
    )
    vocabulary = models.JSONField(
        default=dict, blank=True, null=True, db_column="vocabulary"
    )
    weekly_plan = models.JSONField(
        default=dict, blank=True, null=True, db_column="weekly_plan"
    )

    phone = models.CharField(max_length=50, blank=True, null=True, db_column="phone")
    cpf = models.CharField(max_length=50, blank=True, null=True, db_column="cpf")
    cpf_cnpj = models.CharField(
        max_length=50, blank=True, null=True, db_column="cpf_cnpj"
    )
    focus = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        db_column="focus",
        default="General Conversation",
    )
    reset_token = models.CharField(
        max_length=255, blank=True, null=True, db_column="reset_token"
    )
    reset_token_expires = models.CharField(
        max_length=100, blank=True, null=True, db_column="reset_token_expires"
    )

    # Flags e campos auxiliares do Supabase
    temp_password = models.CharField(
        max_length=255, blank=True, null=True, db_column="temp_password"
    )
    is_exempt = models.BooleanField(
        default=False, null=True, blank=True, db_column="is_exempt"
    )
    is_premium_active = models.BooleanField(
        default=False, null=True, blank=True, db_column="is_premium_active"
    )
    plan_type = models.CharField(
        max_length=50, blank=True, null=True, db_column="plan_type"
    )

    created_at = models.CharField(
        max_length=100, db_column="created_at", default=django_timezone.now
    )
    updated_at = models.DateTimeField(
        auto_now=True, null=True, blank=True, db_column="updated_at"
    )

    objects = UserManager()

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = []

    class Meta:
        db_table = "users"
        managed = False  # Usa a tabela existente do Supabase diretamente
        verbose_name = "Usuário Supabase"
        verbose_name_plural = "Usuários Supabase"

    def __str__(self):
        return f"{self.username} ({self.role})"

    @property
    def id(self):
        return self.username

    @property
    def avatar_url(self) -> str:
        if isinstance(self.profile, dict):
            url = self.profile.get("avatar_url")
            if url and str(url).strip():
                return url
        return DEFAULT_AVATAR_URL

    @avatar_url.setter
    def avatar_url(self, val: str):
        if not isinstance(self.profile, dict):
            self.profile = {}
        self.profile["avatar_url"] = val

    @property
    def native_language(self) -> str:
        if isinstance(self.profile, dict):
            return self.profile.get("native_language", "pt-BR")
        return "pt-BR"

    @property
    def timezone(self) -> str:
        if isinstance(self.streak_data, dict):
            return self.streak_data.get("timezone", "America/Sao_Paulo")
        return "America/Sao_Paulo"

    @property
    def streak_count(self) -> int:
        if isinstance(self.streak_data, dict):
            return self.streak_data.get("current_streak", 0) or 0
        return 0

    @streak_count.setter
    def streak_count(self, val: int):
        if not isinstance(self.streak_data, dict):
            self.streak_data = {}
        self.streak_data["current_streak"] = val

    @property
    def total_xp(self) -> int:
        if isinstance(self.xp_data, dict):
            return self.xp_data.get("xp", 0) or 0
        return 0

    @total_xp.setter
    def total_xp(self, val: int):
        if not isinstance(self.xp_data, dict):
            self.xp_data = {}
        self.xp_data["xp"] = val

    @property
    def is_active(self) -> bool:
        return True

    @property
    def is_staff(self) -> bool:
        return self.role in (UserRole.PROGRAMADOR, UserRole.PROFESSOR, "admin", "Admin")

    @is_staff.setter
    def is_staff(self, val: bool):
        pass

    @property
    def is_superuser(self) -> bool:
        return self.role == UserRole.PROGRAMADOR or self.username == "programador"

    @is_superuser.setter
    def is_superuser(self, val: bool):
        pass

    @property
    def is_programmer(self) -> bool:
        return self.is_superuser

    @property
    def is_teacher(self) -> bool:
        return self.is_staff

    @property
    def is_special_access(self) -> bool:
        return bool(self.is_exempt or self.is_premium_active or self.is_staff)

    @property
    def is_hub_only(self) -> bool:
        return self.role in (UserRole.BUYER, "buyer")

    @is_hub_only.setter
    def is_hub_only(self, val: bool):
        if val:
            self.role = UserRole.BUYER

    def has_perm(self, perm, obj=None) -> bool:
        return self.is_staff

    def has_perms(self, perm_list, obj=None) -> bool:
        return self.is_staff

    def has_module_perms(self, app_label: str) -> bool:
        return self.is_staff
