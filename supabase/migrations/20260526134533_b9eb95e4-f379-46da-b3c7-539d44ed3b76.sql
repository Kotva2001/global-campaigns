
-- 1. scan_settings: owners only for write/delete
DROP POLICY IF EXISTS editors_insert ON public.scan_settings;
DROP POLICY IF EXISTS editors_update ON public.scan_settings;
DROP POLICY IF EXISTS editors_delete ON public.scan_settings;

CREATE POLICY owners_insert ON public.scan_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_owner(auth.uid()));

CREATE POLICY owners_update ON public.scan_settings
  FOR UPDATE TO authenticated
  USING (public.is_owner(auth.uid()))
  WITH CHECK (public.is_owner(auth.uid()));

CREATE POLICY owners_delete ON public.scan_settings
  FOR DELETE TO authenticated
  USING (public.is_owner(auth.uid()));

-- 2. user_roles: prevent admins from escalating to owner/admin
DROP POLICY IF EXISTS "admins can insert" ON public.user_roles;
DROP POLICY IF EXISTS "admins can update" ON public.user_roles;
DROP POLICY IF EXISTS "admins can delete" ON public.user_roles;

-- Owners can do anything
CREATE POLICY owners_manage_roles ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_owner(auth.uid()))
  WITH CHECK (public.is_owner(auth.uid()));

-- Admins can insert non-admin/non-owner users (editor/viewer only)
CREATE POLICY admins_insert_non_privileged ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND is_owner = false
    AND role <> 'admin'::app_role
  );

-- Admins can update non-admin/non-owner rows, and cannot escalate them
CREATE POLICY admins_update_non_privileged ON public.user_roles
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND is_owner = false
    AND role <> 'admin'::app_role
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND is_owner = false
    AND role <> 'admin'::app_role
  );

-- Admins can delete non-admin/non-owner rows
CREATE POLICY admins_delete_non_privileged ON public.user_roles
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND is_owner = false
    AND role <> 'admin'::app_role
  );
