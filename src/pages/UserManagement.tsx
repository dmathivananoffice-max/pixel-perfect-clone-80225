import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { inviteUser, updateAppUser } from "@/lib/admin/users.functions";
import type { User, UserRole } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, Edit, Power, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";

const roleOptions: UserRole[] = [
  "super_admin",
  "managing_director",
  "sales_executive",
  "recruiter",
  "documentation_officer",
  "german_trainer",
  "agency_partner",
  "employer",
  "candidate",
];

interface Row {
  id: string;
  email: string;
  full_name: string;
  role_key: UserRole;
  active: boolean;
  metadata: { department?: string } | null;
  created_at: string;
}

export default function UserManagement() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "recruiter" as UserRole,
    department: "",
  });

  const reload = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("app_users")
      .select("id, email, full_name, role_key, active, metadata, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  const filtered = rows.filter(
    (u) =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  const openEdit = (u: Row) => {
    setForm({
      name: u.full_name,
      email: u.email,
      role: u.role_key,
      department: u.metadata?.department ?? "",
    });
    setEditingId(u.id);
    setShowAdd(true);
  };

  const saveUser = async () => {
    if (!form.name || !form.email) {
      toast.error("Name and email are required");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateAppUser({
          data: {
            id: editingId,
            role: form.role,
            fullName: form.name,
            department: form.department,
          },
        });
        toast.success("User updated");
      } else {
        await inviteUser({
          data: {
            email: form.email,
            fullName: form.name,
            role: form.role,
            department: form.department,
          },
        });
        toast.success("Invitation sent");
      }
      setShowAdd(false);
      setEditingId(null);
      setForm({ name: "", email: "", role: "recruiter", department: "" });
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: Row) => {
    try {
      await updateAppUser({ data: { id: u.id, active: !u.active } });
      toast.success(u.active ? "User deactivated" : "User activated");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Administrator access required.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground">
            Invite users, assign roles, and control access
          </p>
        </div>
        <Button
          onClick={() => {
            setShowAdd(true);
            setEditingId(null);
            setForm({ name: "", email: "", role: "recruiter", department: "" });
          }}
        >
          <Plus className="w-4 h-4 mr-2" /> Invite User
        </Button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search users..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 flex items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading users…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.full_name}</TableCell>
                      <TableCell className="text-sm">{u.email}</TableCell>
                      <TableCell className="capitalize text-sm">
                        {u.role_key.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="text-sm">{u.metadata?.department ?? ""}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            u.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {u.active ? "active" : "inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(u)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => toggleActive(u)}
                          >
                            <Power
                              className={`w-4 h-4 ${u.active ? "text-green-500" : "text-gray-400"}`}
                            />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-sm text-muted-foreground py-8"
                      >
                        No users yet — invite your first teammate.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit User" : "Invite User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Full name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                disabled={!!editingId}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1"
              />
              {!editingId && (
                <p className="text-xs text-muted-foreground mt-1">
                  We'll email a sign-in link to this address.
                </p>
              )}
            </div>
            <div>
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as UserRole })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Department</Label>
              <Input
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAdd(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={saveUser} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingId ? "Update" : "Send invite"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
// keep alias so any stale imports don't crash
export type _AppUser = User;
