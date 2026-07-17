import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Search, Plus, MoreHorizontal, Copy, Pencil, Trash2, ShieldCheck, Users,
  ChevronDown, ChevronRight, History, Lock, Filter, ArrowUpDown, CheckCheck, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  PERMISSION_GROUPS, ROLE_TEMPLATES, ACTION_LABEL, MOCK_USERS_BY_ROLE, INITIAL_AUDIT,
  type Role, type PermissionAction, type AuditEntry, type RoleUser,
} from '@/lib/rbac';
import { supabase } from '@/integrations/supabase/client';

type SortMode = 'name' | 'users' | 'modified';

export default function RolesPermissions() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [roles, setRoles] = useState<Role[]>(ROLE_TEMPLATES);
  const [selectedId, setSelectedId] = useState<string>(ROLE_TEMPLATES[0].id);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('name');
  const [permSearch, setPermSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PERMISSION_GROUPS.map((g) => [g.id, true]))
  );
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | 'duplicate'>('create');
  const [roleForm, setRoleForm] = useState({ name: '', description: '' });
  const [confirmDelete, setConfirmDelete] = useState<Role | null>(null);
  const [confirmChange, setConfirmChange] = useState<null | {
    permKey: string; action: PermissionAction; enable: boolean; label: string;
  }>(null);
  const [showUsers, setShowUsers] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [audit, setAudit] = useState<AuditEntry[]>(INITIAL_AUDIT);

  const filteredRoles = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = roles.filter((r) => !q || r.name.toLowerCase().includes(q));
    list = [...list].sort((a, b) => {
      if (sort === 'users') return b.userCount - a.userCount;
      if (sort === 'modified') return b.lastModified.localeCompare(a.lastModified);
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [roles, search, sort]);

  const selectedRole = roles.find((r) => r.id === selectedId) ?? roles[0];

  const visibleGroups = useMemo(() => {
    const q = permSearch.trim().toLowerCase();
    if (!q) return PERMISSION_GROUPS;
    return PERMISSION_GROUPS
      .map((g) => ({
        ...g,
        permissions: g.permissions.filter(
          (p) => p.label.toLowerCase().includes(q) || p.key.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.permissions.length > 0);
  }, [permSearch]);

  const totalActions = useMemo(() => {
    let total = 0;
    let selected = 0;
    for (const g of PERMISSION_GROUPS) {
      for (const p of g.permissions) {
        total += p.actions.length;
        selected += (selectedRole.grants[p.key]?.length ?? 0);
      }
    }
    return { total, selected };
  }, [selectedRole]);

  // ---------- Mutations ----------

  const logAudit = (entry: Omit<AuditEntry, 'id' | 'timestamp' | 'roleId' | 'roleName'>) => {
    const roleId = selectedRole.id;
    const roleName = selectedRole.name;
    const timestamp = new Date().toISOString();
    setAudit((prev) => [
      {
        ...entry,
        id: `a-${Date.now()}`,
        timestamp,
        roleId,
        roleName,
      },
      ...prev,
    ]);
    // Persist to audit_events so it shows up in the Dashboard activity feed.
    void supabase.from('audit_events').insert({
      entity_type: 'role',
      entity_id: crypto.randomUUID(),
      event_type: 'role_permission_change',
      actor_name: entry.actor,
      new_value: {
        role: roleName,
        note: entry.summary,
        before: entry.before,
        after: entry.after,
      },
    });
  };

  const updateRole = (id: string, patch: Partial<Role>) => {
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch, lastModified: new Date().toISOString() } : r)));
  };

  const toggleAction = (permKey: string, action: PermissionAction, enable: boolean, isCritical: boolean) => {
    if (!isSuperAdmin) {
      toast.error('Only Super Administrator can change permissions');
      return;
    }
    if (isCritical && !confirmChange) {
      setConfirmChange({ permKey, action, enable, label: `${permKey} · ${ACTION_LABEL[action]}` });
      return;
    }
    const current = selectedRole.grants[permKey] ?? [];
    const before = current.join(', ') || '—';
    const next = enable
      ? Array.from(new Set([...current, action]))
      : current.filter((a) => a !== action);
    const grants = { ...selectedRole.grants, [permKey]: next };
    if (next.length === 0) delete grants[permKey];

    // Guardrail: prevent Super Admin from removing their own access to roles module
    if (
      selectedRole.id === 'role-super-admin' &&
      permKey.startsWith('roles.') &&
      !enable
    ) {
      toast.error('Super Administrator cannot remove its own access to Roles & Permissions');
      return;
    }

    updateRole(selectedRole.id, { grants });
    logAudit({
      actor: user?.name ?? 'Unknown',
      summary: `${enable ? 'Enabled' : 'Disabled'} ${ACTION_LABEL[action]} on ${permKey}`,
      before,
      after: next.join(', ') || '—',
    });
  };

  const applyGroup = (groupId: string, mode: 'all' | 'clear') => {
    if (!isSuperAdmin) return;
    const group = PERMISSION_GROUPS.find((g) => g.id === groupId);
    if (!group) return;
    const grants = { ...selectedRole.grants };
    for (const p of group.permissions) {
      if (mode === 'all') grants[p.key] = [...p.actions];
      else delete grants[p.key];
    }
    updateRole(selectedRole.id, { grants });
    logAudit({
      actor: user?.name ?? 'Unknown',
      summary: `${mode === 'all' ? 'Selected all' : 'Cleared all'} in ${group.name}`,
    });
  };

  const selectAll = (mode: 'all' | 'clear') => {
    if (!isSuperAdmin) return;
    const grants: Record<string, PermissionAction[]> = {};
    if (mode === 'all') {
      for (const g of PERMISSION_GROUPS) for (const p of g.permissions) grants[p.key] = [...p.actions];
    }
    updateRole(selectedRole.id, { grants });
    logAudit({
      actor: user?.name ?? 'Unknown',
      summary: mode === 'all' ? 'Selected every permission' : 'Cleared every permission',
    });
  };

  const openCreate = () => {
    if (!isSuperAdmin) { toast.error('Only Super Administrator can create roles'); return; }
    setDialogMode('create'); setRoleForm({ name: '', description: '' }); setShowRoleDialog(true);
  };
  const openEdit = () => {
    if (!isSuperAdmin) { toast.error('Only Super Administrator can rename roles'); return; }
    setDialogMode('edit');
    setRoleForm({ name: selectedRole.name, description: selectedRole.description });
    setShowRoleDialog(true);
  };
  const openDuplicate = () => {
    if (!isSuperAdmin) { toast.error('Only Super Administrator can duplicate roles'); return; }
    setDialogMode('duplicate');
    setRoleForm({ name: `${selectedRole.name} (Copy)`, description: selectedRole.description });
    setShowRoleDialog(true);
  };

  const saveRoleDialog = () => {
    const name = roleForm.name.trim();
    if (!name) { toast.error('Role name is required'); return; }
    if (dialogMode === 'edit') {
      updateRole(selectedRole.id, { name, description: roleForm.description });
      logAudit({ actor: user?.name ?? 'Unknown', summary: `Renamed role to "${name}"` });
      toast.success('Role updated');
    } else {
      const base = dialogMode === 'duplicate' ? selectedRole.grants : {};
      const id = `role-${Date.now()}`;
      const newRole: Role = {
        id, name, description: roleForm.description, system: false,
        userCount: 0, createdBy: user?.name ?? 'Unknown',
        lastModified: new Date().toISOString(), grants: { ...base },
      };
      setRoles((prev) => [newRole, ...prev]);
      setSelectedId(id);
      toast.success(dialogMode === 'duplicate' ? 'Role duplicated' : 'Role created');
    }
    setShowRoleDialog(false);
  };

  const deleteRole = (role: Role) => {
    if (role.system) { toast.error('System roles cannot be deleted'); return; }
    if (role.userCount > 0) { toast.error(`Reassign ${role.userCount} users before deleting`); return; }
    setRoles((prev) => prev.filter((r) => r.id !== role.id));
    if (selectedId === role.id) setSelectedId(roles[0]?.id);
    setConfirmDelete(null);
    toast.success('Role deleted');
  };

  // ---------- Render ----------

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Authorization</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Roles &amp; Permissions</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage every role, module and action across the Workforce Europe platform.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAudit(true)}>
              <History className="w-4 h-4 mr-2" /> Audit trail
            </Button>
            {!isSuperAdmin && (
              <Badge variant="outline" className="gap-1.5">
                <Lock className="w-3 h-3" /> Read-only view
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        {/* LEFT — role list */}
        <aside className="rounded-xl border bg-card">
          <div className="p-4 border-b space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search roles"
                  className="pl-9 h-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9" title="Sort">
                    <ArrowUpDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSort('name')}>Sort by name</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSort('users')}>Sort by user count</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSort('modified')}>Sort by last modified</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Button className="w-full h-9" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" /> New role
            </Button>
          </div>

          <div className="max-h-[calc(100vh-18rem)] overflow-y-auto py-2">
            {filteredRoles.map((role) => {
              const active = role.id === selectedId;
              return (
                <button
                  key={role.id}
                  onClick={() => setSelectedId(role.id)}
                  className={cn(
                    'w-full text-left px-4 py-3 border-l-2 transition-colors',
                    active
                      ? 'border-primary bg-accent/60'
                      : 'border-transparent hover:bg-muted/60'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{role.name}</span>
                        {role.system && (
                          <Lock className="w-3 h-3 text-muted-foreground shrink-0" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {role.userCount} {role.userCount === 1 ? 'user' : 'users'}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
            {filteredRoles.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No roles match "{search}"
              </div>
            )}
          </div>
        </aside>

        {/* RIGHT — role details */}
        <section className="rounded-xl border bg-card">
          {/* Header */}
          <div className="p-6 border-b">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-semibold tracking-tight">{selectedRole.name}</h2>
                  {selectedRole.system && (
                    <Badge variant="outline" className="gap-1"><Lock className="w-3 h-3" /> System</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                  {selectedRole.description}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowUsers(true)}>
                  <Users className="w-4 h-4 mr-2" />
                  {selectedRole.userCount} {selectedRole.userCount === 1 ? 'user' : 'users'}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={openEdit}>
                      <Pencil className="w-4 h-4 mr-2" /> Edit role
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={openDuplicate}>
                      <Copy className="w-4 h-4 mr-2" /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      disabled={selectedRole.system}
                      onClick={() => setConfirmDelete(selectedRole)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Meta grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <Meta label="Users" value={String(selectedRole.userCount)} />
              <Meta label="Permissions" value={`${totalActions.selected} / ${totalActions.total}`} />
              <Meta label="Created by" value={selectedRole.createdBy} />
              <Meta label="Last modified" value={new Date(selectedRole.lastModified).toLocaleDateString()} />
            </div>
          </div>

          {/* Toolbar */}
          <div className="p-4 border-b flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search permissions"
                className="pl-9 h-9"
                value={permSearch}
                onChange={(e) => setPermSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setExpanded(Object.fromEntries(PERMISSION_GROUPS.map((g) => [g.id, true])))}>
                Expand all
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setExpanded({})}>
                Collapse all
              </Button>
              <span className="w-px h-5 bg-border mx-1" />
              <Button variant="ghost" size="sm" onClick={() => selectAll('all')} disabled={!isSuperAdmin}>
                <CheckCheck className="w-4 h-4 mr-1.5" /> Select all
              </Button>
              <Button variant="ghost" size="sm" onClick={() => selectAll('clear')} disabled={!isSuperAdmin}>
                <X className="w-4 h-4 mr-1.5" /> Clear
              </Button>
            </div>
            <Select onValueChange={(v) => {
              const preset = ROLE_TEMPLATES.find((r) => r.id === v);
              if (!preset || !isSuperAdmin) return;
              updateRole(selectedRole.id, { grants: { ...preset.grants } });
              logAudit({ actor: user?.name ?? 'Unknown', summary: `Applied preset "${preset.name}"` });
              toast.success(`Preset applied: ${preset.name}`);
            }}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="Apply preset…" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_TEMPLATES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Groups */}
          <div className="divide-y">
            {visibleGroups.map((group) => {
              const open = expanded[group.id] ?? true;
              const groupSelected = group.permissions.reduce(
                (n, p) => n + (selectedRole.grants[p.key]?.length ?? 0), 0
              );
              const groupTotal = group.permissions.reduce((n, p) => n + p.actions.length, 0);
              return (
                <div key={group.id}>
                  <button
                    onClick={() => setExpanded((prev) => ({ ...prev, [group.id]: !open }))}
                    className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {open ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                            : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                      <span className="text-sm font-medium truncate">{group.name}</span>
                      <Badge variant="outline" className="text-[10px] font-normal ml-1">
                        {groupSelected} / {groupTotal}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs"
                        onClick={() => applyGroup(group.id, 'all')} disabled={!isSuperAdmin}>
                        All
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs"
                        onClick={() => applyGroup(group.id, 'clear')} disabled={!isSuperAdmin}>
                        None
                      </Button>
                    </div>
                  </button>
                  {open && (
                    <div className="px-6 pb-5 pt-1">
                      {group.description && (
                        <p className="text-xs text-muted-foreground mb-3">{group.description}</p>
                      )}
                      <div className="rounded-lg border bg-background/50 overflow-hidden">
                        {group.permissions.map((perm, idx) => {
                          const granted = selectedRole.grants[perm.key] ?? [];
                          return (
                            <div
                              key={perm.key}
                              className={cn(
                                'grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 px-4 py-3',
                                idx < group.permissions.length - 1 && 'border-b'
                              )}
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-medium">{perm.label}</div>
                                <div className="text-[11px] text-muted-foreground font-mono">{perm.key}</div>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-2 md:justify-end">
                                {perm.actions.map((a) => {
                                  const checked = granted.includes(a);
                                  const isCritical =
                                    a === 'delete' || a === 'approve' || perm.key.startsWith('roles.');
                                  return (
                                    <label
                                      key={a}
                                      className={cn(
                                        'flex items-center gap-1.5 text-xs cursor-pointer select-none',
                                        !isSuperAdmin && 'opacity-60 cursor-not-allowed'
                                      )}
                                    >
                                      <Checkbox
                                        checked={checked}
                                        disabled={!isSuperAdmin}
                                        onCheckedChange={(v) =>
                                          toggleAction(perm.key, a, !!v, isCritical)
                                        }
                                      />
                                      <span className={cn(
                                        'capitalize',
                                        checked ? 'text-foreground' : 'text-muted-foreground'
                                      )}>
                                        {ACTION_LABEL[a]}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {visibleGroups.length === 0 && (
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                No permissions match "{permSearch}"
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Create / edit / duplicate dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create' && 'New role'}
              {dialogMode === 'edit' && 'Edit role'}
              {dialogMode === 'duplicate' && 'Duplicate role'}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'duplicate'
                ? 'Creates a new role with the same permissions as the current one.'
                : 'Roles group permissions and are assigned to users.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input className="mt-1.5" value={roleForm.name}
                onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea className="mt-1.5" rows={3} value={roleForm.description}
                onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>Cancel</Button>
            <Button onClick={saveRoleDialog}>
              {dialogMode === 'edit' ? 'Save changes' : 'Create role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete role</DialogTitle>
            <DialogDescription>
              This will permanently remove <span className="font-medium">{confirmDelete?.name}</span>. This action is audited and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmDelete && deleteRole(confirmDelete)}>
              Delete role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Critical change confirmation */}
      <Dialog open={!!confirmChange} onOpenChange={(v) => !v && setConfirmChange(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm permission change</DialogTitle>
            <DialogDescription>
              You are about to {confirmChange?.enable ? 'enable' : 'disable'}{' '}
              <span className="font-mono text-foreground">{confirmChange?.label}</span> for{' '}
              <span className="font-medium">{selectedRole.name}</span>. Critical permissions affect production access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmChange(null)}>Cancel</Button>
            <Button onClick={() => {
              if (!confirmChange) return;
              const { permKey, action, enable } = confirmChange;
              setConfirmChange(null);
              // apply without re-prompting
              const current = selectedRole.grants[permKey] ?? [];
              const before = current.join(', ') || '—';
              const next = enable
                ? Array.from(new Set([...current, action]))
                : current.filter((a) => a !== action);
              const grants = { ...selectedRole.grants, [permKey]: next };
              if (next.length === 0) delete grants[permKey];
              updateRole(selectedRole.id, { grants });
              logAudit({
                actor: user?.name ?? 'Unknown',
                summary: `${enable ? 'Enabled' : 'Disabled'} ${ACTION_LABEL[action]} on ${permKey}`,
                before, after: next.join(', ') || '—',
                reason: 'Confirmed critical change',
              });
            }}>
              Confirm change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assigned users sheet */}
      <Sheet open={showUsers} onOpenChange={setShowUsers}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Users in {selectedRole.name}</SheetTitle>
            <SheetDescription>Assign, remove or transfer users for this role.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Add user by email…" className="flex-1" />
              <Button variant="outline">Assign</Button>
            </div>
            <div className="rounded-lg border divide-y">
              {(MOCK_USERS_BY_ROLE[selectedRole.id] ?? []).map((u: RoleUser) => (
                <div key={u.id} className="flex items-center justify-between p-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{u.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{u.email} · {u.department}</div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Transfer to another role…</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive">
                        Remove from role
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
              {(MOCK_USERS_BY_ROLE[selectedRole.id] ?? []).length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No users assigned yet.
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Audit trail sheet */}
      <Sheet open={showAudit} onOpenChange={setShowAudit}>
        <SheetContent className="sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Audit trail</SheetTitle>
            <SheetDescription>Every permission change is logged with who, what and when.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3 max-h-[calc(100vh-8rem)] overflow-y-auto pr-1">
            {audit.map((a) => (
              <div key={a.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium truncate">{a.summary}</div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {new Date(a.timestamp).toLocaleString()}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {a.actor} · {a.roleName}
                </div>
                {(a.before || a.after) && (
                  <div className="grid grid-cols-2 gap-2 mt-3 text-[11px] font-mono">
                    <div className="rounded bg-muted/60 px-2 py-1.5">
                      <div className="text-muted-foreground mb-0.5">Before</div>
                      <div className="text-foreground break-words">{a.before ?? '—'}</div>
                    </div>
                    <div className="rounded bg-muted/60 px-2 py-1.5">
                      <div className="text-muted-foreground mb-0.5">After</div>
                      <div className="text-foreground break-words">{a.after ?? '—'}</div>
                    </div>
                  </div>
                )}
                {a.reason && (
                  <div className="text-xs text-muted-foreground mt-2 italic">"{a.reason}"</div>
                )}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-1">{value}</div>
    </div>
  );
}
