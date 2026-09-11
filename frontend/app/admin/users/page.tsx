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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import {
  CurrentUser,
  getUsers,
  updateAppUser,
  deleteAppUser,
  getCurrentUser,
} from "@/lib/api";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<CurrentUser[]>([]);
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  function loadUsers() {
    setLoading(true);
    getUsers()
      .then(setUsers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadUsers();
    getCurrentUser().then(setMe).catch(() => { });
  }, []);

  async function handleRoleChange(userId: number, newRole: string) {
    setBusyId(userId);
    setError("");
    try {
      await updateAppUser(userId, { role: newRole });
      loadUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleActive(user: CurrentUser) {
    setBusyId(user.id);
    setError("");
    try {
      await updateAppUser(user.id, { is_active: !user.is_active });
      loadUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(userId: number) {
    setError("");
    try {
      await deleteAppUser(userId);
      loadUsers();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage advisor and admin accounts.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading users…</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-muted-foreground">No users found.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[140px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const isSelf = me?.id === u.id;
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.email}
                    {isSelf && (
                      <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={u.role}
                      onValueChange={(value) => value && handleRoleChange(u.id, value)}
                      disabled={isSelf || busyId === u.id}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="advisor">Advisor</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs px-2 py-0.5 rounded-full border capitalize">
                      {u.auth_provider}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${u.is_active
                          ? "border-green-600 text-green-700"
                          : "border-destructive text-destructive"
                        }`}
                    >
                      {u.is_active ? "Active" : "Deactivated"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isSelf || busyId === u.id}
                        onClick={() => handleToggleActive(u)}
                      >
                        {u.is_active ? "Deactivate" : "Activate"}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={isSelf}
                            />
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {u.email}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This can&apos;t be undone. Their prediction history will remain,
                              but they&apos;ll lose access immediately.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(u.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}