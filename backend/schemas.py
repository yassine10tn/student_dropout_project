from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime


class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    role: str
    auth_provider: str
    is_active: bool

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PredictRequest(BaseModel):
    weekly_clicks: List[float]     # must contain exactly 40 values, one per week (0-39)
    student_label: Optional[str] = None


class PredictResponse(BaseModel):
    risk_score: float
    predicted_dropout: int
    attention_by_week: List[float]
    # "attention" (Transformer's real self-attention weights) or
    # "saliency" (gradient-based importance, used for MLP/GRU which have
    # no attention mechanism). Lets the frontend label the chart correctly.
    interpretability_method: str = "attention"
    model_architecture: Optional[str] = None


class PredictionHistoryOut(BaseModel):
    id: int
    student_label: Optional[str]
    risk_score: float
    predicted_dropout: int
    created_at: datetime

    class Config:
        from_attributes = True


class StudentCreate(BaseModel):
    full_name: str
    student_number: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    course_id: Optional[int] = None


class StudentUpdate(BaseModel):
    full_name: Optional[str] = None
    student_number: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    course_id: Optional[int] = None


class StudentOut(BaseModel):
    id: int
    full_name: str
    student_number: Optional[str]
    email: Optional[str]
    notes: Optional[str]
    course_id: Optional[int]
    course_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CourseCreate(BaseModel):
    name: str
    code: Optional[str] = None
    term: Optional[str] = None
    description: Optional[str] = None


class CourseUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    term: Optional[str] = None
    description: Optional[str] = None


class CourseOut(BaseModel):
    id: int
    name: str
    code: Optional[str]
    term: Optional[str]
    description: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class GoogleAuthRequest(BaseModel):
    credential: str


class UserAdminUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None


class ModelVersionCreate(BaseModel):
    architecture: str
    version_label: Optional[str] = None
    accuracy: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1_score: Optional[float] = None
    training_time_seconds: Optional[float] = None
    notes: Optional[str] = None
    file_path: Optional[str] = None  # NEW — e.g. "../ML/models/mlp.pt"


class ModelVersionOut(BaseModel):
    id: int
    architecture: str
    version_label: Optional[str]
    accuracy: Optional[float]
    precision: Optional[float]
    recall: Optional[float]
    f1_score: Optional[float]
    training_time_seconds: Optional[float]
    notes: Optional[str]
    is_active: bool
    file_path: Optional[str] = None  # NEW
    created_at: datetime

    class Config:
        from_attributes = True


class InterventionCreate(BaseModel):
    student_id: int
    intervention_type: str  # "call" | "meeting" | "email" | "note" | "other"
    notes: Optional[str] = None
    status: str = "open"     # "open" | "completed" | "follow_up_needed"
    follow_up_date: Optional[datetime] = None


class InterventionUpdate(BaseModel):
    intervention_type: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    follow_up_date: Optional[datetime] = None


class InterventionOut(BaseModel):
    id: int
    student_id: int
    student_name: Optional[str] = None
    advisor_id: int
    advisor_email: Optional[str] = None
    intervention_type: str
    notes: Optional[str]
    status: str
    follow_up_date: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class ArchitectureStat(BaseModel):
    architecture: str
    count: int
    avg_risk_score: float


class StatusCount(BaseModel):
    status: str
    count: int


class DailyCount(BaseModel):
    date: str
    count: int


class AdminAnalyticsOut(BaseModel):
    total_students: int
    total_courses: int
    total_predictions: int
    dropout_rate: float  # fraction 0-1, of predictions where predicted_dropout == 1
    predictions_by_architecture: List[ArchitectureStat]
    interventions_by_status: List[StatusCount]
    predictions_over_time: List[DailyCount]


class AdvisorAnalyticsOut(BaseModel):
    total_predictions: int
    dropout_rate: float
    interventions_by_status: List[StatusCount]
    predictions_over_time: List[DailyCount]


class NotificationOut(BaseModel):
    id: int
    title: str
    message: str
    notification_type: str
    student_label: Optional[str]
    prediction_id: Optional[int]
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogOut(BaseModel):
    id: int
    actor_id: int
    actor_email: Optional[str]
    action: str
    target_type: str
    target_id: Optional[int]
    target_label: Optional[str]
    details: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True