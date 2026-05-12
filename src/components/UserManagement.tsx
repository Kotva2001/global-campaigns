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
import { Trash2, Plus } from "lucide-react";
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

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <h3 className="text-base font-semibold">User Management</h3>
        <p className="text-xs text-muted-foreground">
          Grant access by adding a Google account email. Roles take effect on next login.
        </p>
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