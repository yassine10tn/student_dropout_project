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
    course_id: Optional[int] = None          # NEW


class StudentUpdate(BaseModel):
    full_name: Optional[str] = None
    student_number: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    course_id: Optional[int] = None          # NEW


class StudentOut(BaseModel):
    id: int
    full_name: str
    student_number: Optional[str]
    email: Optional[str]
    notes: Optional[str]
    course_id: Optional[int]                 # NEW
    course_name: Optional[str] = None        # NEW
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
    created_at: datetime

    class Config:
        from_attributes = True