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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  Student,
  Course,
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  getCourses,
} from "@/lib/api";

type FormState = {
  full_name: string;
  student_number: string;
  email: string;
  notes: string;
  course_id: string; // "none" sentinel means no course, else a numeric string for the Select
};

const emptyForm: FormState = {
  full_name: "",
  student_number: "",
  email: "",
  notes: "",
  course_id: "none",
};

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  function loadStudents() {
    setLoading(true);
    getStudents()
      .then(setStudents)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadStudents();
    getCourses().then(setCourses).catch(() => {});
  }, []);

  function openCreateDialog() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setDialogOpen(true);
  }

  function openEditDialog(student: Student) {
    setEditingId(student.id);
    setForm({
      full_name: student.full_name,
      student_number: student.student_number || "",
      email: student.email || "",
      notes: student.notes || "",
      course_id: student.course_id ? String(student.course_id) : "none",
    });
    setError("");
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const payload = {
        full_name: form.full_name,
        student_number: form.student_number,
        email: form.email,
        notes: form.notes,
        course_id: form.course_id === "none" ? null : Number(form.course_id),
      };
      if (editingId === null) {
        await createStudent(payload);
      } else {
        await updateStudent(editingId, payload);
      }
      setDialogOpen(false);
      loadStudents();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteStudent(id);
      loadStudents();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Students</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage student records.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button onClick={openCreateDialog} />}>
            <Plus className="mr-2 h-4 w-4" />
            Add student
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId === null ? "Add student" : "Edit student"}</DialogTitle>
              <DialogDescription>
                {editingId === null
                  ? "Create a new student record."
                  : "Update this student's details."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="full_name">Full name</Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="e.g. Jane Doe"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="student_number">Student number (optional)</Label>
                <Input
                  id="student_number"
                  value={form.student_number}
                  onChange={(e) => setForm({ ...form, student_number: e.target.value })}
                  placeholder="e.g. STU-2024-001"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="student@university.edu"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Course (optional)</Label>
                <Select
                  value={form.course_id}
                  onValueChange={(value) => setForm({ ...form, course_id: value ?? "none" })}                >
                  <SelectTrigger>
                    <SelectValue placeholder="No course" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No course</SelectItem>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || !form.full_name.trim()}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading students…</p>
      ) : error && students.length === 0 ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : students.length === 0 ? (
        <p className="text-sm text-muted-foreground">No students yet — add one above.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Student #</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
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
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger render={<Button variant="ghost" size="icon" />}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {s.full_name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This can&apos;t be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(s.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}