"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClipboardList, Trash2 } from "lucide-react";
import {
  Student,
  Intervention,
  getStudents,
  getInterventions,
  createIntervention,
  updateIntervention,
  deleteIntervention,
  getCurrentUser,
  CurrentUser,
} from "@/lib/api";

type FormState = {
  intervention_type: string;
  notes: string;
  status: string;
  follow_up_date: string; // yyyy-mm-dd from <input type="date">, or ""
};

const emptyForm: FormState = {
  intervention_type: "call",
  notes: "",
  status: "open",
  follow_up_date: "",
};

function statusColor(status: string) {
  if (status === "completed") return { border: "border-green-600", text: "text-green-700" };
  if (status === "follow_up_needed") return { border: "border-amber-600", text: "text-amber-700" };
  return { border: "border-muted-foreground", text: "text-muted-foreground" }; // "open"
}

function statusLabel(status: string) {
  if (status === "follow_up_needed") return "Follow-up needed";
  if (status === "completed") return "Completed";
  return "Open";
}

export default function AdvisorStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const [dialogStudent, setDialogStudent] = useState<Student | null>(null);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [ivLoading, setIvLoading] = useState(false);
  const [ivError, setIvError] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getStudents()
      .then(setStudents)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    getCurrentUser().then(setCurrentUser).catch(() => {});
  }, []);

  function openInterventionsDialog(student: Student) {
    setDialogStudent(student);
    setForm(emptyForm);
    setIvError("");
    loadInterventions(student.id);
  }

  function loadInterventions(studentId: number) {
    setIvLoading(true);
    getInterventions(studentId)
      .then(setInterventions)
      .catch((err) => setIvError(err.message))
      .finally(() => setIvLoading(false));
  }

  async function handleLog() {
    if (!dialogStudent) return;
    setSaving(true);
    setIvError("");
    try {
      await createIntervention({
        student_id: dialogStudent.id,
        intervention_type: form.intervention_type,
        notes: form.notes || undefined,
        status: form.status,
        follow_up_date: form.follow_up_date
          ? new Date(form.follow_up_date).toISOString()
          : undefined,
      });
      setForm(emptyForm);
      loadInterventions(dialogStudent.id);
    } catch (err: any) {
      setIvError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkCompleted(iv: Intervention) {
    if (!dialogStudent) return;
    try {
      await updateIntervention(iv.id, { status: "completed" });
      loadInterventions(dialogStudent.id);
    } catch (err: any) {
      setIvError(err.message);
    }
  }

  async function handleDelete(iv: Intervention) {
    if (!dialogStudent) return;
    try {
      await deleteIntervention(iv.id);
      loadInterventions(dialogStudent.id);
    } catch (err: any) {
      setIvError(err.message);
    }
  }

  const canManage = (iv: Intervention) =>
    currentUser && (currentUser.role === "admin" || currentUser.id === iv.advisor_id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My Students</h1>
        <p className="text-sm text-muted-foreground mt-1">
          View student records and log interventions. Contact an admin to add or edit student details.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading students…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : students.length === 0 ? (
        <p className="text-sm text-muted-foreground">No students yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Student #</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="w-[140px]">Interventions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.full_name}</TableCell>
                <TableCell>{s.student_number || "—"}</TableCell>
                <TableCell>{s.email || "—"}</TableCell>
                <TableCell>{s.course_name || "—"}</TableCell>
                <TableCell className="max-w-[200px] truncate">{s.notes || "—"}</TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => openInterventionsDialog(s)}>
                    <ClipboardList className="mr-2 h-3.5 w-3.5" />
                    Log / view
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogStudent !== null} onOpenChange={(open) => !open && setDialogStudent(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Interventions — {dialogStudent?.full_name}</DialogTitle>
            <DialogDescription>
              Log a call, meeting, email, or note, and track follow-ups for this student.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2 max-h-[65vh] overflow-y-auto pr-1">
            {/* Log new intervention */}
            <div className="space-y-3 border rounded-md p-4">
              <p className="text-sm font-medium">Log a new intervention</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select
                    value={form.intervention_type}
                    onValueChange={(v) => v && setForm({ ...form, intervention_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="call">Call</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="note">Note</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => v && setForm({ ...form, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="follow_up_needed">Follow-up needed</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  placeholder="What happened, what was discussed, next steps…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="follow_up_date">Follow-up date (optional)</Label>
                <Input
                  id="follow_up_date"
                  type="date"
                  value={form.follow_up_date}
                  onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })}
                />
              </div>
              {ivError && <p className="text-sm text-destructive">{ivError}</p>}
              <Button onClick={handleLog} disabled={saving} size="sm">
                {saving ? "Logging…" : "Log intervention"}
              </Button>
            </div>

            {/* History */}
            <div className="space-y-2">
              <p className="text-sm font-medium">History</p>
              {ivLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : interventions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No interventions logged yet for this student.
                </p>
              ) : (
                <div className="space-y-2">
                  {interventions.map((iv) => {
                    const colors = statusColor(iv.status);
                    return (
                      <div key={iv.id} className="border rounded-md p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium capitalize">
                              {iv.intervention_type}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full border ${colors.border} ${colors.text}`}
                            >
                              {statusLabel(iv.status)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {iv.status !== "completed" && canManage(iv) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => handleMarkCompleted(iv)}
                              >
                                Mark completed
                              </Button>
                            )}
                            {canManage(iv) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleDelete(iv)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {iv.notes && <p className="text-sm text-muted-foreground">{iv.notes}</p>}
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span>by {iv.advisor_email || "unknown"}</span>
                          <span>{new Date(iv.created_at).toLocaleString()}</span>
                          {iv.follow_up_date && (
                            <span>
                              follow up: {new Date(iv.follow_up_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogStudent(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}