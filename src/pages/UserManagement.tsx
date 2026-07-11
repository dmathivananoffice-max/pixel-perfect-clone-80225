import { useState } from 'react';
import { mockUsers } from '@/lib/mockData';
import type { User } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Search, Edit, Power } from 'lucide-react';
import toast from 'react-hot-toast';

const roleOptions: string[] = [
  'super_admin', 'managing_director', 'sales_executive', 'recruiter',
  'documentation_officer', 'german_trainer', 'agency_partner', 'employer', 'candidate',
];

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '', email: '', role: 'recruiter', department: '', mfa_enabled: false,
  });

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (user: typeof mockUsers[0]) => {
    setForm({ name: user.name, email: user.email, role: user.role, department: user.department || '', mfa_enabled: user.mfa_enabled });
    setEditingUser(user.id);
    setShowAdd(true);
  };

  const saveUser = () => {
    if (!form.name || !form.email) {
      toast.error('Name and email are required');
      return;
    }
    if (editingUser) {
      setUsers(users.map((u) => u.id === editingUser ? { ...u, name: form.name, email: form.email, role: form.role as User['role'], department: form.department, mfa_enabled: form.mfa_enabled } : u));
      toast.success('User updated');
    } else {
      const newUser: User = {
        id: `user-${Date.now()}`,
        name: form.name,
        email: form.email,
        role: form.role as User['role'],
        department: form.department,
        status: 'active',
        mfa_enabled: form.mfa_enabled,
        created_at: new Date().toISOString(),
      };
      setUsers([...users, newUser]);
      toast.success('User created');
    }
    setShowAdd(false);
    setEditingUser(null);
    setForm({ name: '', email: '', role: 'recruiter', department: '', mfa_enabled: false });
  };

  const toggleStatus = (id: string) => {
    setUsers(users.map((u) =>
      u.id === id ? { ...u, status: u.status === 'active' ? 'inactive' as const : 'active' as const } : u
    ));
    toast.success('Status updated');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground">Manage users, roles, and access</p>
        </div>
        <Button onClick={() => { setShowAdd(true); setEditingUser(null); setForm({ name: '', email: '', role: 'recruiter', department: '', mfa_enabled: false }); }}>
          <Plus className="w-4 h-4 mr-2" /> Add User
        </Button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search users..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>MFA</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="text-sm">{user.email}</TableCell>
                    <TableCell className="capitalize text-sm">{user.role.replace('_', ' ')}</TableCell>
                    <TableCell className="text-sm">{user.department}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {user.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {user.mfa_enabled ? (
                        <span className="text-green-600 text-xs font-medium">Enabled</span>
                      ) : (
                        <span className="text-gray-400 text-xs">Off</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(user)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleStatus(user.id)}>
                          <Power className={`w-4 h-4 ${user.status === 'active' ? 'text-green-500' : 'text-gray-400'}`} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Add User'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r} value={r}>{r.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Department</Label>
              <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="mt-1" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={saveUser}>{editingUser ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
