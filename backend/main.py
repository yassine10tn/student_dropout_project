from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import os
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from database import Base, engine, get_db
import models
import schemas
from ml_model import predict_dropout
from auth_utils import hash_password, verify_password, create_access_token, get_current_user, require_role

print("Loading schemas from:", schemas.__file__)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Student Dropout Risk API")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

@app.post("/auth/google", response_model=schemas.Token)
def google_login(payload: schemas.GoogleAuthRequest, db: Session = Depends(get_db)):
    try:
        idinfo = google_id_token.verify_oauth2_token(
            payload.credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    email = idinfo.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="Google account has no email")

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        user = models.User(
            email=email,
            hashed_password=None,
            role="advisor",
            auth_provider="google",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/auth/register", response_model=schemas.UserOut)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    new_user = models.User(email=user.email, hashed_password=hash_password(user.password))
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.post("/auth/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/auth/me", response_model=schemas.UserOut)
def read_current_user(current_user: models.User = Depends(get_current_user)):
    return current_user


@app.get("/admin/ping")
def admin_ping(current_user: models.User = Depends(require_role("admin"))):
    return {"message": f"Welcome admin {current_user.email}"}


@app.post("/predict", response_model=schemas.PredictResponse)
def predict(
    request: schemas.PredictRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    risk_score, predicted, attention = predict_dropout(request.weekly_clicks)

    record = models.Prediction(
        user_id=current_user.id,
        student_label=request.student_label,
        weekly_clicks=request.weekly_clicks,
        risk_score=risk_score,
        predicted_dropout=predicted,
    )
    db.add(record)
    db.commit()

    return schemas.PredictResponse(
        risk_score=risk_score,
        predicted_dropout=predicted,
        attention_by_week=attention,
    )


@app.get("/predictions/history", response_model=List[schemas.PredictionHistoryOut])
def get_history(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.Prediction)
        .filter(models.Prediction.user_id == current_user.id)
        .order_by(models.Prediction.created_at.desc())
        .all()
    )


@app.get("/")
def root():
    return {"status": "Student Dropout Risk API is running"}

# --- ADD THIS to main.py, after your existing routes ---
# --- Also add `require_role` to your existing auth_utils import if it isn't there already ---

@app.post("/students", response_model=schemas.StudentOut)
def create_student(
    student: schemas.StudentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin")),
):
    new_student = models.Student(**student.dict())
    db.add(new_student)
    db.commit()
    db.refresh(new_student)
    return new_student


@app.get("/students", response_model=List[schemas.StudentOut])
def list_students(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),  # admin OR advisor can view
):
    return db.query(models.Student).order_by(models.Student.full_name).all()


@app.get("/students/{student_id}", response_model=schemas.StudentOut)
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


@app.put("/students/{student_id}", response_model=schemas.StudentOut)
def update_student(
    student_id: int,
    updates: schemas.StudentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin")),
):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    for field, value in updates.dict(exclude_unset=True).items():
        setattr(student, field, value)
    db.commit()
    db.refresh(student)
    return student


@app.delete("/students/{student_id}")
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin")),
):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    db.delete(student)
    db.commit()
    return {"detail": "Student deleted"}

# --- ADD THIS to main.py, after your student endpoints ---

@app.post("/courses", response_model=schemas.CourseOut)
def create_course(
    course: schemas.CourseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin")),
):
    new_course = models.Course(**course.dict())
    db.add(new_course)
    db.commit()
    db.refresh(new_course)
    return new_course


@app.get("/courses", response_model=List[schemas.CourseOut])
def list_courses(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return db.query(models.Course).order_by(models.Course.name).all()


@app.get("/courses/{course_id}", response_model=schemas.CourseOut)
def get_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@app.put("/courses/{course_id}", response_model=schemas.CourseOut)
def update_course(
    course_id: int,
    updates: schemas.CourseUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin")),
):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    for field, value in updates.dict(exclude_unset=True).items():
        setattr(course, field, value)
    db.commit()
    db.refresh(course)
    return course


@app.delete("/courses/{course_id}")
def delete_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin")),
):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    db.delete(course)
    db.commit()
    return {"detail": "Course deleted"}

# --- ADD THIS to main.py, after your existing routes ---

@app.get("/users", response_model=List[schemas.UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin")),
):
    return db.query(models.User).order_by(models.User.email).all()


@app.put("/users/{user_id}", response_model=schemas.UserOut)
def update_user(
    user_id: int,
    updates: schemas.UserAdminUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin")),
):
    if user_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You can't change your own role or active status.",
        )

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    for field, value in updates.dict(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@app.delete("/users/{user_id}")
def delete_user_admin(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin")),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You can't delete your own account.")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()
    return {"detail": "User deleted"}

# --- ADD THIS to main.py, after your existing routes ---

@app.post("/model-versions", response_model=schemas.ModelVersionOut)
def create_model_version(
    payload: schemas.ModelVersionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin")),
):
    new_version = models.ModelVersion(**payload.dict())
    db.add(new_version)
    db.commit()
    db.refresh(new_version)
    return new_version


@app.get("/model-versions", response_model=List[schemas.ModelVersionOut])
def list_model_versions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.ModelVersion)
        .order_by(models.ModelVersion.created_at.desc())
        .all()
    )


@app.put("/model-versions/{version_id}/activate", response_model=schemas.ModelVersionOut)
def activate_model_version(
    version_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin")),
):
    target = db.query(models.ModelVersion).filter(models.ModelVersion.id == version_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Model version not found")

    # Only one version can be active at a time — deactivate all, then activate the target
    db.query(models.ModelVersion).update({"is_active": False})
    target.is_active = True
    db.commit()
    db.refresh(target)
    return target


@app.delete("/model-versions/{version_id}")
def delete_model_version(
    version_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin")),
):
    target = db.query(models.ModelVersion).filter(models.ModelVersion.id == version_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Model version not found")
    db.delete(target)
    db.commit()
    return {"detail": "Model version deleted"}

