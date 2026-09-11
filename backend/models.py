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
    is_active = Column(Boolean, default=True, nullable=False)   # NEW
    created_at = Column(DateTime, default=datetime.utcnow)
 
    predictions = relationship("Prediction", back_populates="owner")


class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    student_number = Column(String, nullable=True)
    email = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=True)  # NEW
    created_at = Column(DateTime, default=datetime.utcnow)
 
    course = relationship("Course", back_populates="students")  # NEW
 
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