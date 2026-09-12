const API_BASE = "http://127.0.0.1:8000";

export function saveToken(token: string) {
  localStorage.setItem("access_token", token);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export interface CurrentUser {
  id: number;
  email: string;
  role: "admin" | "advisor";
  auth_provider: string;
  is_active: boolean;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch current user");
  return res.json();
}
export function clearToken() {
  localStorage.removeItem("access_token");
}



export async function registerUser(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Registration failed");
  }
  return res.json();
}

export async function loginUser(email: string, password: string) {
  const body = new URLSearchParams();
  body.append("username", email);
  body.append("password", password);

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Login failed");
  }
  const data = await res.json();
  saveToken(data.access_token);
  return data;
}

export interface PredictResponse {
  risk_score: number;
  predicted_dropout: number;
  attention_by_week: number[];
  // "attention" for Transformer (real self-attention weights), or
  // "saliency" for MLP/GRU (gradient-based importance — those
  // architectures have no attention mechanism to report).
  interpretability_method: "attention" | "saliency";
  model_architecture: string | null;
}

export async function predictDropout(
  weeklyClicks: number[],
  studentLabel: string
): Promise<PredictResponse> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/predict`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ weekly_clicks: weeklyClicks, student_label: studentLabel }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Prediction failed");
  }
  return res.json();
}

export interface PredictionHistoryItem {
  id: number;
  student_label: string | null;
  risk_score: number;
  predicted_dropout: number;
  created_at: string;
}

export async function getHistory(): Promise<PredictionHistoryItem[]> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/predictions/history`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}



export interface Student {
  id: number;
  full_name: string;
  student_number: string | null;
  email: string | null;
  notes: string | null;
  course_id: number | null;
  course_name: string | null;
  created_at: string;
}

export interface StudentInput {
  full_name: string;
  student_number?: string;
  email?: string;
  notes?: string;
  course_id?: number | null;
}

export async function getStudents(): Promise<Student[]> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/students`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch students");
  return res.json();
}

export async function createStudent(data: StudentInput): Promise<Student> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/students`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create student");
  }
  return res.json();
}

export async function updateStudent(id: number, data: Partial<StudentInput>): Promise<Student> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/students/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update student");
  }
  return res.json();
}

export async function deleteStudent(id: number): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/students/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to delete student");
  }
}


export interface Course {
  id: number;
  name: string;
  code: string | null;
  term: string | null;
  description: string | null;
  created_at: string;
}

export interface CourseInput {
  name: string;
  code?: string;
  term?: string;
  description?: string;
}

export async function getCourses(): Promise<Course[]> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/courses`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch courses");
  return res.json();
}

export async function createCourse(data: CourseInput): Promise<Course> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/courses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create course");
  }
  return res.json();
}

export async function updateCourse(id: number, data: Partial<CourseInput>): Promise<Course> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/courses/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update course");
  }
  return res.json();
}

export async function deleteCourse(id: number): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/courses/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to delete course");
  }
}

export async function googleLogin(credential: string) {
  const res = await fetch(`${API_BASE}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Google sign-in failed");
  }
  const data = await res.json();
  saveToken(data.access_token);
  return data;
}

export async function getUsers(): Promise<CurrentUser[]> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

export async function updateAppUser(
  id: number,
  data: { role?: string; is_active?: boolean }
): Promise<CurrentUser> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update user");
  }
  return res.json();
}

export async function deleteAppUser(id: number): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/users/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to delete user");
  }
}


export interface ModelVersion {
  id: number;
  architecture: string;
  version_label: string | null;
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  f1_score: number | null;
  training_time_seconds: number | null;
  notes: string | null;
  is_active: boolean;
  file_path: string | null;
  created_at: string;
}

export interface ModelVersionInput {
  architecture: string;
  version_label?: string;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  training_time_seconds?: number;
  notes?: string;
  file_path?: string;
}

export async function getModelVersions(): Promise<ModelVersion[]> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/model-versions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch model versions");
  return res.json();
}

export async function createModelVersion(data: ModelVersionInput): Promise<ModelVersion> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/model-versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create model version");
  }
  return res.json();
}

export async function activateModelVersion(id: number): Promise<ModelVersion> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/model-versions/${id}/activate`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to activate model version");
  }
  return res.json();
}

export async function deleteModelVersion(id: number): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/model-versions/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to delete model version");
  }
}


export interface Intervention {
  id: number;
  student_id: number;
  student_name: string | null;
  advisor_id: number;
  advisor_email: string | null;
  intervention_type: string;
  notes: string | null;
  status: string;
  follow_up_date: string | null;
  created_at: string;
}

export interface InterventionInput {
  student_id: number;
  intervention_type: string;
  notes?: string;
  status?: string;
  follow_up_date?: string | null;
}

export interface InterventionUpdateInput {
  intervention_type?: string;
  notes?: string;
  status?: string;
  follow_up_date?: string | null;
}

export async function getInterventions(studentId?: number): Promise<Intervention[]> {
  const token = getToken();
  const url = studentId
    ? `${API_BASE}/interventions?student_id=${studentId}`
    : `${API_BASE}/interventions`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch interventions");
  return res.json();
}

export async function createIntervention(data: InterventionInput): Promise<Intervention> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/interventions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create intervention");
  }
  return res.json();
}

export async function updateIntervention(
  id: number,
  data: InterventionUpdateInput
): Promise<Intervention> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/interventions/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update intervention");
  }
  return res.json();
}

export async function deleteIntervention(id: number): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/interventions/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to delete intervention");
  }
}


export interface ArchitectureStat {
  architecture: string;
  count: number;
  avg_risk_score: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface DailyCount {
  date: string;
  count: number;
}

export interface AdminAnalytics {
  total_students: number;
  total_courses: number;
  total_predictions: number;
  dropout_rate: number;
  predictions_by_architecture: ArchitectureStat[];
  interventions_by_status: StatusCount[];
  predictions_over_time: DailyCount[];
}

export interface AdvisorAnalytics {
  total_predictions: number;
  dropout_rate: number;
  interventions_by_status: StatusCount[];
  predictions_over_time: DailyCount[];
}

export async function getAdminAnalytics(): Promise<AdminAnalytics> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/analytics/admin`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch admin analytics");
  return res.json();
}

export async function getAdvisorAnalytics(): Promise<AdvisorAnalytics> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/analytics/advisor`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch advisor analytics");
  return res.json();
}


export interface Notification {
  id: number;
  title: string;
  message: string;
  notification_type: string;
  student_label: string | null;
  prediction_id: number | null;
  is_read: boolean;
  created_at: string;
}

export async function getNotifications(unreadOnly = false): Promise<Notification[]> {
  const token = getToken();
  const url = `${API_BASE}/notifications${unreadOnly ? "?unread_only=true" : ""}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch notifications");
  return res.json();
}

export async function getUnreadNotificationCount(): Promise<number> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/notifications/unread-count`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch unread count");
  const data = await res.json();
  return data.unread_count;
}

export async function markNotificationRead(id: number): Promise<Notification> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to mark notification read");
  return res.json();
}

export async function markAllNotificationsRead(): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/notifications/read-all`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to mark all notifications read");
}


export interface AuditLog {
  id: number;
  actor_id: number;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: number | null;
  target_label: string | null;
  details: string | null;
  created_at: string;
}

export async function getAuditLogs(limit = 100): Promise<AuditLog[]> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/audit-logs?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch audit logs");
  return res.json();
}