from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)
    role = Column(String, default="advisor", nullable=False)
    auth_provider = Column(String, default="local", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    predictions = relationship("Prediction", back_populates="owner")


class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    student_number = Column(String, nullable=True)
    email = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    course = relationship("Course", back_populates="students")
    interventions = relationship(
        "Intervention", back_populates="student", cascade="all, delete-orphan"
    )

    @property
    def course_name(self):
        return self.course.name if self.course else None


class Course(Base):
    __tablename__ = "courses"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    code = Column(String, nullable=True)
    term = Column(String, nullable=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    students = relationship("Student", back_populates="course")


class ModelVersion(Base):
    __tablename__ = "model_versions"
    id = Column(Integer, primary_key=True, index=True)
    architecture = Column(String, nullable=False)
    version_label = Column(String, nullable=True)
    accuracy = Column(Float, nullable=True)
    precision = Column(Float, nullable=True)
    recall = Column(Float, nullable=True)
    f1_score = Column(Float, nullable=True)
    training_time_seconds = Column(Float, nullable=True)
    notes = Column(String, nullable=True)
    is_active = Column(Boolean, default=False, nullable=False)
    file_path = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Prediction(Base):
    __tablename__ = "predictions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    student_label = Column(String, nullable=True)
    weekly_clicks = Column(JSON, nullable=False)
    risk_score = Column(Float, nullable=False)
    predicted_dropout = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    model_version_id = Column(Integer, ForeignKey("model_versions.id"), nullable=True)

    owner = relationship("User", back_populates="predictions")
    model_version = relationship("ModelVersion")

    @property
    def model_architecture(self):
        return self.model_version.architecture if self.model_version else None


class Intervention(Base):
    """
    An action an advisor takes on a student (call, meeting, email, note),
    with a status and optional follow-up date. Unlike predictions.student_label
    (free text), this is tied to a real Student row via a foreign key.
    """
    __tablename__ = "interventions"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    advisor_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Free text, not an enum, matching the ModelVersion.architecture convention
    # in this project: "call" | "meeting" | "email" | "note" | "other"
    intervention_type = Column(String, nullable=False)
    notes = Column(String, nullable=True)

    # "open" | "completed" | "follow_up_needed"
    status = Column(String, default="open", nullable=False)
    follow_up_date = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="interventions")
    advisor = relationship("User")

    @property
    def student_name(self):
        return self.student.full_name if self.student else None

    @property
    def advisor_email(self):
        return self.advisor.email if self.advisor else None


class Notification(Base):
    """
    In-app alert sent to advisors/admins when a prediction crosses the
    high-risk threshold (see RISK_ALERT_THRESHOLD in main.py). Broadcast to
    every active user except whoever ran the prediction — they already see
    the result on their own screen.
    """
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # recipient
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    notification_type = Column(String, default="high_risk_prediction", nullable=False)
    student_label = Column(String, nullable=True)
    prediction_id = Column(Integer, ForeignKey("predictions.id"), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    """
    Record of sensitive admin actions: role changes, activate/deactivate,
    deletions, and model version registration/activation. Read-only from
    the app's perspective — rows are only ever created, never edited.
    """
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String, nullable=False)         # e.g. "role_changed", "deleted", "activated"
    target_type = Column(String, nullable=False)     # e.g. "user", "model_version", "student"
    target_id = Column(Integer, nullable=True)
    target_label = Column(String, nullable=True)     # human-readable, e.g. an email or architecture name
    details = Column(String, nullable=True)          # e.g. "advisor -> admin"
    created_at = Column(DateTime, default=datetime.utcnow)

    actor = relationship("User")

    @property
    def actor_email(self):
        return self.actor.email if self.actor else None