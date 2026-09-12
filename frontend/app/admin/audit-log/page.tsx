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
import { AuditLog, getAuditLogs } from "@/lib/api";

function actionColor(action: string) {
  if (action === "deleted") return "text-destructive";
  if (action === "activated" || action === "registered") return "text-green-700";
  if (action === "deactivated") return "text-amber-700";
  return "text-foreground";
}

function actionLabel(action: string) {
  return action
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function targetTypeLabel(type: string) {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function AdminAuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getAuditLogs()
      .then(setLogs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Record of sensitive admin actions: role changes, activations, and deletions.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading audit log…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No actions recorded yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-medium">{log.actor_email || `#${log.actor_id}`}</TableCell>
                <TableCell className={actionColor(log.action)}>
                  {actionLabel(log.action)}
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">
                    {targetTypeLabel(log.target_type)}
                  </span>{" "}
                  {log.target_label || (log.target_id ? `#${log.target_id}` : "—")}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {log.details || "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(log.created_at).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}