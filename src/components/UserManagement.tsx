import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Trash2, Plus, UserPlus, Copy } from "lucide-react";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";

type Row = {
  id: string;
  user_id: string | null;
  email: string;
  display_name: string | null;
  role: AppRole;
  last_login_at: string | null;
};

export const UserManagement = () => {
  const { user: me } = useUserRole();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("viewer");
  const [adding, setAdding] = useState(false);

  // Create account state
  const [caEmail, setCaEmail] = useState("");
  const [caName, setCaName] = useState("");
  const [caPassword, setCaPassword] = useState("");
  const [caRole, setCaRole] = useState<AppRole>("viewer");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_roles")
      .select("id,user_id,email,display_name,role,last_login_at")
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) {
      toast.error("Could not load users", { description: error.message });
      return;
    }
    setRows((data ?? []) as Row[]);
  };

  useEffect(() => { void load(); }, []);

  const addUser = async () => {
    const e = newEmail.trim().toLowerCase();
    if (!e) return;
    setAdding(true);
    const { error } = await supabase
      .from("user_roles")
      .insert({ email: e, display_name: newName.trim() || null, role: newRole });
    setAdding(false);
    if (error) {
      toast.error("Could not add user", { description: error.message });
      return;
    }
    setNewEmail(""); setNewName(""); setNewRole("viewer");
    toast.success("User added");
    void load();
  };

  const updateRole = async (row: Row, role: AppRole) => {
    const { error } = await supabase.from("user_roles").update({ role }).eq("id", row.id);
    if (error) {
      toast.error("Update failed", { description: error.message });
      return;
    }
    setRows((r) => r.map((x) => (x.id === row.id ? { ...x, role } : x)));
  };

  const remove = async (row: Row) => {
    if (row.user_id && row.user_id === me?.id) {
      toast.error("You cannot remove yourself.");
      return;
    }
    if (!confirm(`Remove access for ${row.email}?`)) return;
    const { error } = await supabase.from("user_roles").delete().eq("id", row.id);
    if (error) {
      toast.error("Delete failed", { description: error.message });
      return;
    }
    setRows((r) => r.filter((x) => x.id !== row.id));
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let out = "";
    const arr = new Uint32Array(14);
    crypto.getRandomValues(arr);
    for (let i = 0; i < arr.length; i++) out += chars[arr[i] % chars.length];
    setCaPassword(out);
  };

  const createAccount = async () => {
    const e = caEmail.trim().toLowerCase();
    if (!e || caPassword.length < 8) {
      toast.error("Email and password (min 8 chars) required");
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: {
        email: e,
        password: caPassword,
        display_name: caName.trim() || null,
        role: caRole,
      },
    });
    setCreating(false);
    if (error || (data && (data as { error?: string }).error)) {
      const msg = (data as { error?: string } | null)?.error ?? error?.message ?? "Failed";
      toast.error("Could not create account", { description: msg });
      return;
    }
    toast.success("Account created");
    setCreated({ email: e, password: caPassword });
    setCaEmail(""); setCaName(""); setCaPassword(""); setCaRole("viewer");
    void load();
  };

  const copyCreds = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(`Email: ${created.email}\nPassword: ${created.password}`);
    toast.success("Credentials copied");
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <h3 className="text-base font-semibold">User Management</h3>
        <p className="text-xs text-muted-foreground">
          Grant access by adding a Google account email. Roles take effect on next login.
        </p>
      </div>

      {/* Create Account (admin) */}
      <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-3">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Create account</h4>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Creates an email/password account and assigns a role. Share the credentials with the user; they should change the password on first login.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Email</Label>
            <Input type="email" value={caEmail} onChange={(e) => setCaEmail(e.target.value)} placeholder="user@example.com" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Display name</Label>
            <Input value={caName} onChange={(e) => setCaName(e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Temporary password</Label>
            <div className="flex gap-2">
              <Input value={caPassword} onChange={(e) => setCaPassword(e.target.value)} placeholder="Min 8 characters" className="font-mono text-xs" />
              <Button type="button" variant="outline" size="sm" onClick={generatePassword}>Generate</Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Role</Label>
            <Select value={caRole} onValueChange={(v) => setCaRole(v as AppRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={createAccount} disabled={creating || !caEmail || caPassword.length < 8} size="sm" className="w-full gap-1.5">
              <UserPlus className="h-4 w-4" /> {creating ? "Creating…" : "Create account"}
            </Button>
          </div>
        </div>
        {created && (
          <div className="rounded-md border border-success/40 bg-success/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold">Account ready — share these credentials</div>
              <Button type="button" size="sm" variant="ghost" onClick={copyCreds} className="h-7 gap-1.5">
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
            </div>
            <div className="font-mono text-xs space-y-0.5">
              <div><span className="text-muted-foreground">Email:</span> {created.email}</div>
              <div><span className="text-muted-foreground">Password:</span> {created.password}</div>
            </div>
            <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => setCreated(null)}>Dismiss</Button>
          </div>
        )}
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Invite by email (no password)</h4>
        <p className="text-[11px] text-muted-foreground">Pre-assign a role; user signs in via Google or after an admin creates their password account.</p>
      </div>

      <div className="grid grid-cols-[1fr_1fr_140px_auto] gap-2 items-end">
        <div className="space-y-1.5">
          <Label htmlFor="nu-email" className="text-xs">Email</Label>
          <Input id="nu-email" type="email" placeholder="user@example.com"
            value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nu-name" className="text-xs">Display name</Label>
          <Input id="nu-name" placeholder="Optional" value={newName} onChange={(e) => setNewName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Role</Label>
          <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={addUser} disabled={adding || !newEmail.trim()} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Last login</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {!loading && rows.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground">No users yet</TableCell></TableRow>
            )}
            {rows.map((row) => {
              const isMe = row.user_id && row.user_id === me?.id;
              return (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.email}{isMe && <span className="ml-2 text-[10px] text-primary">(you)</span>}</TableCell>
                  <TableCell className="text-xs">{row.display_name ?? "—"}</TableCell>
                  <TableCell>
                    <Select value={row.role} onValueChange={(v) => updateRole(row, v as AppRole)} disabled={!!isMe}>
                      <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.last_login_at ? new Date(row.last_login_at).toLocaleString() : "Never"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!!isMe} onClick={() => remove(row)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};