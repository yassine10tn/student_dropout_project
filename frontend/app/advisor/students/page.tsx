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
import { Student, getStudents } from "@/lib/api";

export default function AdvisorStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getStudents()
      .then(setStudents)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My Students</h1>
        <p className="text-sm text-muted-foreground mt-1">
          View student records. Contact an admin to add or edit students.
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.full_name}</TableCell>
                <TableCell>{s.student_number || "—"}</TableCell>
                <TableCell>{s.email || "—"}</TableCell>
                <TableCell>{s.course_name || "—"}</TableCell>
                <TableCell className="max-w-[240px] truncate">{s.notes || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}