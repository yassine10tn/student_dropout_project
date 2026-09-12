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
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
import {
  ModelVersion,
  getModelVersions,
  createModelVersion,
  activateModelVersion,
  deleteModelVersion,
} from "@/lib/api";

type FormState = {
  architecture: string;
  version_label: string;
  accuracy: string;
  precision: string;
  recall: string;
  f1_score: string;
  training_time_seconds: string;
  notes: string;
  file_path: string;
};

const DEFAULT_PATHS: Record<string, string> = {
  MLP: "../ML/models/mlp.pt",
  GRU: "../ML/models/gru.pt",
  Transformer: "../ML/models/transformer.pt",
};

const emptyForm: FormState = {
  architecture: "MLP",
  version_label: "",
  accuracy: "",
  precision: "",
  recall: "",
  f1_score: "",
  training_time_seconds: "",
  notes: "",
  file_path: DEFAULT_PATHS["MLP"],
};

function toNumberOrUndefined(v: string): number | undefined {
  if (v.trim() === "") return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

function formatPct(v: number | null): string {
  return v === null ? "—" : `${(v * 100).toFixed(1)}%`;
}

export default function AdminModelsPage() {
  const [versions, setVersions] = useState<ModelVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  function loadVersions() {
    setLoading(true);
    getModelVersions()
      .then(setVersions)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadVersions();
  }, []);

  function openCreateDialog() {
    setForm(emptyForm);
    setError("");
    setDialogOpen(true);
  }

  function handleArchitectureChange(v: string) {
    // Prefill file_path with the conventional default for that architecture,
    // but only if the field is empty or still matches a previous default —
    // don't clobber something the admin already typed in on purpose.
    const wasDefault = Object.values(DEFAULT_PATHS).includes(form.file_path);
    setForm({
      ...form,
      architecture: v,
      file_path: form.file_path === "" || wasDefault ? (DEFAULT_PATHS[v] || "") : form.file_path,
    });
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await createModelVersion({
        architecture: form.architecture,
        version_label: form.version_label || undefined,
        accuracy: toNumberOrUndefined(form.accuracy),
        precision: toNumberOrUndefined(form.precision),
        recall: toNumberOrUndefined(form.recall),
        f1_score: toNumberOrUndefined(form.f1_score),
        training_time_seconds: toNumberOrUndefined(form.training_time_seconds),
        notes: form.notes || undefined,
        file_path: form.file_path || undefined,
      });
      setDialogOpen(false);
      loadVersions();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(id: number) {
    setBusyId(id);
    setError("");
    try {
      await activateModelVersion(id);
      loadVersions();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteModelVersion(id);
      loadVersions();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Model Registry</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track trained MLP, GRU, and Transformer runs, and mark which one is active.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button onClick={openCreateDialog} />}>
            <Plus className="mr-2 h-4 w-4" />
            Register model version
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register model version</DialogTitle>
              <DialogDescription>
                Record the results of a training run. Metrics are optional but
                recommended for comparison. File path is required for this
                version to actually be usable for predictions once activated.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
              <div className="space-y-1.5">
                <Label>Architecture</Label>
                <Select
                  value={form.architecture}
                  onValueChange={(v) => v && handleArchitectureChange(v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MLP">MLP</SelectItem>
                    <SelectItem value="GRU">GRU</SelectItem>
                    <SelectItem value="Transformer">Transformer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="file_path">
                  File path <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="file_path"
                  value={form.file_path}
                  onChange={(e) => setForm({ ...form, file_path: e.target.value })}
                  placeholder="../ML/models/mlp.pt"
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Path to the .pt file, relative to the backend/ folder. This is
                  what /predict actually loads when this version is activated.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="version_label">Version label (optional)</Label>
                <Input
                  id="version_label"
                  value={form.version_label}
                  onChange={(e) => setForm({ ...form, version_label: e.target.value })}
                  placeholder="e.g. baseline, tuned-lr, v2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="accuracy">Accuracy (0–1)</Label>
                  <Input
                    id="accuracy"
                    type="number"
                    step="0.0001"
                    value={form.accuracy}
                    onChange={(e) => setForm({ ...form, accuracy: e.target.value })}
                    placeholder="0.83"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="precision">Precision (0–1)</Label>
                  <Input
                    id="precision"
                    type="number"
                    step="0.0001"
                    value={form.precision}
                    onChange={(e) => setForm({ ...form, precision: e.target.value })}
                    placeholder="0.79"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="recall">Recall (0–1)</Label>
                  <Input
                    id="recall"
                    type="number"
                    step="0.0001"
                    value={form.recall}
                    onChange={(e) => setForm({ ...form, recall: e.target.value })}
                    placeholder="0.81"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="f1_score">F1 score (0–1)</Label>
                  <Input
                    id="f1_score"
                    type="number"
                    step="0.0001"
                    value={form.f1_score}
                    onChange={(e) => setForm({ ...form, f1_score: e.target.value })}
                    placeholder="0.80"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="training_time_seconds">Training time (seconds, optional)</Label>
                <Input
                  id="training_time_seconds"
                  type="number"
                  step="1"
                  value={form.training_time_seconds}
                  onChange={(e) => setForm({ ...form, training_time_seconds: e.target.value })}
                  placeholder="184"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  placeholder="Hyperparameters, dataset version, anything worth remembering"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error && !dialogOpen && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading model versions…</p>
      ) : versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No model versions registered yet — add one above.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Architecture</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>File</TableHead>
              <TableHead>Accuracy</TableHead>
              <TableHead>Precision</TableHead>
              <TableHead>Recall</TableHead>
              <TableHead>F1</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[160px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {versions.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">{v.architecture}</TableCell>
                <TableCell>{v.version_label || "—"}</TableCell>
                <TableCell>
                  {v.file_path ? (
                    <span
                      className="font-mono text-xs text-muted-foreground"
                      title={v.file_path}
                    >
                      {v.file_path.length > 22
                        ? `…${v.file_path.slice(-20)}`
                        : v.file_path}
                    </span>
                  ) : (
                    <span className="text-xs text-destructive">Not set</span>
                  )}
                </TableCell>
                <TableCell>{formatPct(v.accuracy)}</TableCell>
                <TableCell>{formatPct(v.precision)}</TableCell>
                <TableCell>{formatPct(v.recall)}</TableCell>
                <TableCell>{formatPct(v.f1_score)}</TableCell>
                <TableCell>
                  {v.is_active ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-green-600 text-green-700">
                      <CheckCircle2 className="h-3 w-3" />
                      Active
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full border text-muted-foreground">
                      Inactive
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {!v.is_active && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === v.id}
                        onClick={() => handleActivate(v.id)}
                      >
                        Activate
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger render={<Button variant="ghost" size="icon" />}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete {v.architecture} {v.version_label || `#${v.id}`}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This can&apos;t be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(v.id)}>
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