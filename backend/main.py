from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
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

RISK_ALERT_THRESHOLD = 0.7


def log_audit(db: Session, actor: models.User, action: str, target_type: str,
              target_id: Optional[int] = None, target_label: Optional[str] = None,
              details: Optional[str] = None):
    """Record a sensitive admin action. Called after the action's own commit
    succeeds, so a failed action never produces a misleading log entry."""
    entry = models.AuditLog(
        actor_id=actor.id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        target_label=target_label,
        details=details,
    )
    db.add(entry)
    db.commit()

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
    allow_origins=["http://localhost:3000"],  
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
    try:
        risk_score, predicted, importance, method, architecture = predict_dropout(
            request.weekly_clicks, db=db
        )
    except (RuntimeError, FileNotFoundError, ValueError) as e:
       
        raise HTTPException(status_code=503, detail=str(e))

  
    active_version = (
        db.query(models.ModelVersion)
        .filter(models.ModelVersion.is_active == True)  # noqa: E712
        .first()
    )

    record = models.Prediction(
        user_id=current_user.id,
        student_label=request.student_label,
        weekly_clicks=request.weekly_clicks,
        risk_score=risk_score,
        predicted_dropout=predicted,
        model_version_id=active_version.id if active_version else None,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    
    if risk_score >= RISK_ALERT_THRESHOLD:
        label = request.student_label or "Unnamed student"
        other_users = (
            db.query(models.User)
            .filter(models.User.id != current_user.id, models.User.is_active == True)  # noqa: E712
            .all()
        )
        for user in other_users:
            db.add(models.Notification(
                user_id=user.id,
                title="High dropout risk detected",
                message=(
                    f"{label} was just flagged at {risk_score * 100:.1f}% risk "
                    f"by {current_user.email}."
                ),
                notification_type="high_risk_prediction",
                student_label=label,
                prediction_id=record.id,
            ))
        db.commit()

    return schemas.PredictResponse(
        risk_score=risk_score,
        predicted_dropout=predicted,
        attention_by_week=importance,
        interpretability_method=method,
        model_architecture=architecture,
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
    student_name = student.full_name
    db.delete(student)
    db.commit()
    log_audit(db, current_user, "deleted", "student", student_id, student_name)
    return {"detail": "Student deleted"}


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
    course_name = course.name
    db.delete(course)
    db.commit()
    log_audit(db, current_user, "deleted", "course", course_id, course_name)
    return {"detail": "Course deleted"}


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

    update_data = updates.dict(exclude_unset=True)
    old_role = user.role
    old_is_active = user.is_active

    for field, value in update_data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)

    if "role" in update_data and old_role != user.role:
        log_audit(db, current_user, "role_changed", "user", user.id, user.email,
                   f"{old_role} -> {user.role}")
    if "is_active" in update_data and old_is_active != user.is_active:
        log_audit(db, current_user, "activated" if user.is_active else "deactivated",
                   "user", user.id, user.email)

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

    deleted_email = user.email
    db.delete(user)
    db.commit()
    log_audit(db, current_user, "deleted", "user", user_id, deleted_email)
    return {"detail": "User deleted"}


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
    label = f"{new_version.architecture} {new_version.version_label or ''}".strip()
    log_audit(db, current_user, "registered", "model_version", new_version.id, label)
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

    db.query(models.ModelVersion).update({"is_active": False})
    target.is_active = True
    db.commit()
    db.refresh(target)
    label = f"{target.architecture} {target.version_label or ''}".strip()
    log_audit(db, current_user, "activated", "model_version", target.id, label)
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
    label = f"{target.architecture} {target.version_label or ''}".strip()
    db.delete(target)
    db.commit()
    log_audit(db, current_user, "deleted", "model_version", version_id, label)
    return {"detail": "Model version deleted"}


# --- Interventions ---
# Any admin or advisor can create/view (shared workflow — the whole team
# tracks the same students). Only the creator or an admin can edit/delete
# a given intervention, same self-protection pattern used for Users.

@app.post("/interventions", response_model=schemas.InterventionOut)
def create_intervention(
    payload: schemas.InterventionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    student = db.query(models.Student).filter(models.Student.id == payload.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    new_intervention = models.Intervention(
        student_id=payload.student_id,
        advisor_id=current_user.id,
        intervention_type=payload.intervention_type,
        notes=payload.notes,
        status=payload.status,
        follow_up_date=payload.follow_up_date,
    )
    db.add(new_intervention)
    db.commit()
    db.refresh(new_intervention)
    return new_intervention


@app.get("/interventions", response_model=List[schemas.InterventionOut])
def list_interventions(
    student_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Intervention)
    if student_id is not None:
        query = query.filter(models.Intervention.student_id == student_id)
    return query.order_by(models.Intervention.created_at.desc()).all()


@app.get("/interventions/{intervention_id}", response_model=schemas.InterventionOut)
def get_intervention(
    intervention_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    intervention = db.query(models.Intervention).filter(models.Intervention.id == intervention_id).first()
    if not intervention:
        raise HTTPException(status_code=404, detail="Intervention not found")
    return intervention


@app.put("/interventions/{intervention_id}", response_model=schemas.InterventionOut)
def update_intervention(
    intervention_id: int,
    updates: schemas.InterventionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    intervention = db.query(models.Intervention).filter(models.Intervention.id == intervention_id).first()
    if not intervention:
        raise HTTPException(status_code=404, detail="Intervention not found")

    if current_user.role != "admin" and intervention.advisor_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You can only edit interventions you created.",
        )

    for field, value in updates.dict(exclude_unset=True).items():
        setattr(intervention, field, value)
    db.commit()
    db.refresh(intervention)
    return intervention


@app.delete("/interventions/{intervention_id}")
def delete_intervention(
    intervention_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    intervention = db.query(models.Intervention).filter(models.Intervention.id == intervention_id).first()
    if not intervention:
        raise HTTPException(status_code=404, detail="Intervention not found")

    if current_user.role != "admin" and intervention.advisor_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You can only delete interventions you created.",
        )

    intervention_type_label = intervention.intervention_type
    db.delete(intervention)
    db.commit()
    log_audit(db, current_user, "deleted", "intervention", intervention_id,
               intervention_type_label)
    return {"detail": "Intervention deleted"}


# --- Analytics ---

@app.get("/analytics/admin", response_model=schemas.AdminAnalyticsOut)
def admin_analytics(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin")),
):
    total_students = db.query(models.Student).count()
    total_courses = db.query(models.Course).count()
    total_predictions = db.query(models.Prediction).count()

    dropout_count = (
        db.query(models.Prediction)
        .filter(models.Prediction.predicted_dropout == 1)
        .count()
    )
    dropout_rate = (dropout_count / total_predictions) if total_predictions else 0.0

    arch_rows = (
        db.query(
            models.ModelVersion.architecture,
            func.count(models.Prediction.id),
            func.avg(models.Prediction.risk_score),
        )
        .join(models.Prediction, models.Prediction.model_version_id == models.ModelVersion.id)
        .group_by(models.ModelVersion.architecture)
        .all()
    )
    predictions_by_architecture = [
        schemas.ArchitectureStat(architecture=arch, count=count, avg_risk_score=float(avg or 0))
        for arch, count, avg in arch_rows
    ]

    status_rows = (
        db.query(models.Intervention.status, func.count(models.Intervention.id))
        .group_by(models.Intervention.status)
        .all()
    )
    interventions_by_status = [
        schemas.StatusCount(status=status, count=count) for status, count in status_rows
    ]

    date_rows = (
        db.query(
            func.date(models.Prediction.created_at),
            func.count(models.Prediction.id),
        )
        .group_by(func.date(models.Prediction.created_at))
        .order_by(func.date(models.Prediction.created_at))
        .all()
    )
    predictions_over_time = [
        schemas.DailyCount(date=str(d), count=count) for d, count in date_rows
    ]

    return schemas.AdminAnalyticsOut(
        total_students=total_students,
        total_courses=total_courses,
        total_predictions=total_predictions,
        dropout_rate=dropout_rate,
        predictions_by_architecture=predictions_by_architecture,
        interventions_by_status=interventions_by_status,
        predictions_over_time=predictions_over_time,
    )


@app.get("/analytics/advisor", response_model=schemas.AdvisorAnalyticsOut)
def advisor_analytics(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    own_predictions_query = db.query(models.Prediction).filter(
        models.Prediction.user_id == current_user.id
    )
    total_predictions = own_predictions_query.count()

    dropout_count = own_predictions_query.filter(
        models.Prediction.predicted_dropout == 1
    ).count()
    dropout_rate = (dropout_count / total_predictions) if total_predictions else 0.0

    status_rows = (
        db.query(models.Intervention.status, func.count(models.Intervention.id))
        .filter(models.Intervention.advisor_id == current_user.id)
        .group_by(models.Intervention.status)
        .all()
    )
    interventions_by_status = [
        schemas.StatusCount(status=status, count=count) for status, count in status_rows
    ]

    date_rows = (
        db.query(
            func.date(models.Prediction.created_at),
            func.count(models.Prediction.id),
        )
        .filter(models.Prediction.user_id == current_user.id)
        .group_by(func.date(models.Prediction.created_at))
        .order_by(func.date(models.Prediction.created_at))
        .all()
    )
    predictions_over_time = [
        schemas.DailyCount(date=str(d), count=count) for d, count in date_rows
    ]

    return schemas.AdvisorAnalyticsOut(
        total_predictions=total_predictions,
        dropout_rate=dropout_rate,
        interventions_by_status=interventions_by_status,
        predictions_over_time=predictions_over_time,
    )


# --- Notifications ---

@app.get("/notifications", response_model=List[schemas.NotificationOut])
def list_notifications(
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Notification).filter(models.Notification.user_id == current_user.id)
    if unread_only:
        query = query.filter(models.Notification.is_read == False)  # noqa: E712
    return query.order_by(models.Notification.created_at.desc()).all()


@app.get("/notifications/unread-count")
def unread_notification_count(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    count = (
        db.query(models.Notification)
        .filter(
            models.Notification.user_id == current_user.id,
            models.Notification.is_read == False,  # noqa: E712
        )
        .count()
    )
    return {"unread_count": count}


@app.put("/notifications/{notification_id}/read", response_model=schemas.NotificationOut)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    notification = (
        db.query(models.Notification)
        .filter(
            models.Notification.id == notification_id,
            models.Notification.user_id == current_user.id,
        )
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification


@app.put("/notifications/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read == False,  # noqa: E712
    ).update({"is_read": True})
    db.commit()
    return {"detail": "All notifications marked read"}


# --- Audit log ---

@app.get("/audit-logs", response_model=List[schemas.AuditLogOut])
def list_audit_logs(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin")),
):
    return (
        db.query(models.AuditLog)
        .order_by(models.AuditLog.created_at.desc())
        .limit(min(limit, 500))
        .all()
    )
