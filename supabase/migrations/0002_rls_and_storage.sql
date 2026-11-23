-- =============================================================================
-- XO WORLD — XO Sport Academy
-- Migration 0002: Strict Row Level Security (RLS) & Private Storage Policies
-- Zero public access to private children/player records.
-- =============================================================================

-- Security-Definer Role & Isolation Helpers
CREATE OR REPLACE FUNCTION public.has_role(p_role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = p_role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role('OWNER');
$$;

CREATE OR REPLACE FUNCTION public.delegate_has_permission(p_branch_id TEXT, p_perm TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.delegates d
    JOIN public.delegate_permissions dp ON dp.delegate_id = d.id
    WHERE d.user_id = auth.uid()
      AND d.is_active = TRUE
      AND p_branch_id = ANY(d.assigned_branch_ids)
      AND dp.branch_id = p_branch_id
      AND dp.permission_key = p_perm
  );
$$;

CREATE OR REPLACE FUNCTION public.coach_teaches_group(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.coaches c
    JOIN public.coach_groups cg ON cg.coach_id = c.id
    WHERE c.user_id = auth.uid()
      AND c.is_active = TRUE
      AND cg.group_id = p_group_id
  );
$$;

CREATE OR REPLACE FUNCTION public.parent_owns_player(p_player_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.parents pa
    JOIN public.parent_players pp ON pp.parent_id = pa.id
    WHERE pa.user_id = auth.uid()
      AND pp.player_id = p_player_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_self_player(p_player_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.players pl
    WHERE pl.id = p_player_id AND pl.user_id = auth.uid()
  );
$$;

-- Enable RLS on ALL tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delegates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delegate_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- PROFILES: Own profile or OWNER
CREATE POLICY profiles_select ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_owner());
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_owner())
  WITH CHECK (auth.uid() = id OR public.is_owner());

-- USER ROLES: Read own role; ONLY OWNER can assign/modify roles (prevents self-escalation)
CREATE POLICY user_roles_select ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.is_owner());
CREATE POLICY user_roles_owner_all ON public.user_roles FOR ALL
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- BRANCHES, SPORTS, TRAINING GROUPS, COACHES: Authenticated academy read; OWNER manage
CREATE POLICY branches_auth_read ON public.branches FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY branches_owner_write ON public.branches FOR ALL USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE POLICY sports_auth_read ON public.sports FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY sports_owner_write ON public.sports FOR ALL USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE POLICY groups_auth_read ON public.training_groups FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY groups_owner_write ON public.training_groups FOR ALL USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE POLICY coaches_auth_read ON public.coaches FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY coaches_owner_write ON public.coaches FOR ALL USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE POLICY coach_groups_auth_read ON public.coach_groups FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY coach_groups_owner_write ON public.coach_groups FOR ALL USING (public.is_owner()) WITH CHECK (public.is_owner());

-- DELEGATES & PERMISSIONS: OWNER only (+ delegate viewing own scope)
CREATE POLICY delegates_select ON public.delegates FOR SELECT
  USING (auth.uid() = user_id OR public.is_owner());
CREATE POLICY delegates_owner_write ON public.delegates FOR ALL
  USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE POLICY delegate_perms_select ON public.delegate_permissions FOR SELECT
  USING (
    public.is_owner() OR EXISTS (
      SELECT 1 FROM public.delegates d WHERE d.id = delegate_id AND d.user_id = auth.uid()
    )
  );
CREATE POLICY delegate_perms_owner_write ON public.delegate_permissions FOR ALL
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- PARENTS & PARENT-PLAYERS: Strict isolation
CREATE POLICY parents_select ON public.parents FOR SELECT
  USING (auth.uid() = user_id OR public.is_owner());
CREATE POLICY parents_owner_write ON public.parents FOR ALL
  USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE POLICY parent_players_select ON public.parent_players FOR SELECT
  USING (
    public.is_owner() OR EXISTS (
      SELECT 1 FROM public.parents pa WHERE pa.id = parent_id AND pa.user_id = auth.uid()
    )
  );
CREATE POLICY parent_players_owner_write ON public.parent_players FOR ALL
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- PLAYERS: Strict isolation across OWNER / DELEGATE (branch+perm) / COACH (group) / PARENT (own child) / PLAYER (self)
CREATE POLICY players_select ON public.players FOR SELECT
  USING (
    public.is_owner()
    OR public.delegate_has_permission(branch_id, 'manage_players')
    OR (group_id IS NOT NULL AND public.coach_teaches_group(group_id))
    OR public.parent_owns_player(id)
    OR public.is_self_player(id)
  );

CREATE POLICY players_insert ON public.players FOR INSERT
  WITH CHECK (
    public.is_owner()
    OR public.delegate_has_permission(branch_id, 'manage_players')
  );

CREATE POLICY players_update ON public.players FOR UPDATE
  USING (
    public.is_owner()
    OR public.delegate_has_permission(branch_id, 'manage_players')
    OR (group_id IS NOT NULL AND public.coach_teaches_group(group_id))
  )
  WITH CHECK (
    public.is_owner()
    OR public.delegate_has_permission(branch_id, 'manage_players')
    OR (group_id IS NOT NULL AND public.coach_teaches_group(group_id))
  );

CREATE POLICY players_delete ON public.players FOR DELETE
  USING (public.is_owner());

-- ATTENDANCE: Group-scoped for COACH, branch-scoped for DELEGATE, child-scoped for PARENT, self for PLAYER
CREATE POLICY attendance_select ON public.attendance FOR SELECT
  USING (
    public.is_owner()
    OR public.delegate_has_permission(branch_id, 'manage_attendance')
    OR public.coach_teaches_group(group_id)
    OR public.parent_owns_player(player_id)
    OR public.is_self_player(player_id)
  );

CREATE POLICY attendance_write ON public.attendance FOR INSERT
  WITH CHECK (
    public.is_owner()
    OR public.delegate_has_permission(branch_id, 'manage_attendance')
    OR public.coach_teaches_group(group_id)
  );

CREATE POLICY attendance_update ON public.attendance FOR UPDATE
  USING (
    public.is_owner()
    OR public.delegate_has_permission(branch_id, 'manage_attendance')
    OR public.coach_teaches_group(group_id)
  );

-- SUBSCRIPTIONS & PAYMENTS: Never visible to coaches or other parents!
CREATE POLICY subscriptions_select ON public.subscriptions FOR SELECT
  USING (
    public.is_owner()
    OR public.delegate_has_permission(branch_id, 'manage_payments')
    OR public.parent_owns_player(player_id)
    OR public.is_self_player(player_id)
  );
CREATE POLICY subscriptions_write ON public.subscriptions FOR ALL
  USING (public.is_owner() OR public.delegate_has_permission(branch_id, 'manage_payments'))
  WITH CHECK (public.is_owner() OR public.delegate_has_permission(branch_id, 'manage_payments'));

CREATE POLICY payments_select ON public.payments FOR SELECT
  USING (
    public.is_owner()
    OR public.delegate_has_permission(branch_id, 'manage_payments')
    OR public.parent_owns_player(player_id)
  );
CREATE POLICY payments_write ON public.payments FOR ALL
  USING (public.is_owner() OR public.delegate_has_permission(branch_id, 'manage_payments'))
  WITH CHECK (public.is_owner() OR public.delegate_has_permission(branch_id, 'manage_payments'));

-- ANNOUNCEMENTS & COMMUNITY
CREATE POLICY announcements_read ON public.announcements FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY announcements_write ON public.announcements FOR ALL
  USING (public.is_owner() OR (branch_id IS NOT NULL AND public.delegate_has_permission(branch_id, 'manage_community')))
  WITH CHECK (public.is_owner() OR (branch_id IS NOT NULL AND public.delegate_has_permission(branch_id, 'manage_community')));

CREATE POLICY community_posts_read ON public.community_posts FOR SELECT
  USING (auth.uid() IS NOT NULL AND (is_approved = TRUE OR author_id = auth.uid() OR public.is_owner()));
CREATE POLICY community_posts_insert ON public.community_posts FOR INSERT
  WITH CHECK (auth.uid() = author_id);
CREATE POLICY community_posts_moderate ON public.community_posts FOR UPDATE
  USING (public.is_owner() OR author_id = auth.uid() OR (branch_id IS NOT NULL AND public.delegate_has_permission(branch_id, 'manage_community')));
CREATE POLICY community_posts_delete ON public.community_posts FOR DELETE
  USING (public.is_owner() OR author_id = auth.uid() OR (branch_id IS NOT NULL AND public.delegate_has_permission(branch_id, 'manage_community')));

CREATE POLICY community_comments_read ON public.community_comments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY community_comments_insert ON public.community_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY community_comments_delete ON public.community_comments FOR DELETE USING (public.is_owner() OR author_id = auth.uid());

CREATE POLICY community_likes_all ON public.community_likes FOR ALL
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() = user_id);

-- MEDIA: Visibility-enforced
CREATE POLICY media_select ON public.media FOR SELECT
  USING (
    public.is_owner()
    OR visibility = 'academy'
    OR (visibility = 'branch' AND branch_id IS NOT NULL AND (
      public.delegate_has_permission(branch_id, 'manage_media')
      OR EXISTS (SELECT 1 FROM public.players pl WHERE pl.branch_id = media.branch_id AND (public.parent_owns_player(pl.id) OR public.is_self_player(pl.id)))
    ))
    OR (visibility = 'group' AND group_id IS NOT NULL AND (
      public.coach_teaches_group(group_id)
      OR EXISTS (SELECT 1 FROM public.players pl WHERE pl.group_id = media.group_id AND (public.parent_owns_player(pl.id) OR public.is_self_player(pl.id)))
    ))
    OR (visibility = 'private_player' AND player_id IS NOT NULL AND (
      public.parent_owns_player(player_id) OR public.is_self_player(player_id)
    ))
  );

CREATE POLICY media_write ON public.media FOR ALL
  USING (
    public.is_owner()
    OR (branch_id IS NOT NULL AND public.delegate_has_permission(branch_id, 'manage_media'))
    OR (group_id IS NOT NULL AND public.coach_teaches_group(group_id))
  )
  WITH CHECK (
    public.is_owner()
    OR (branch_id IS NOT NULL AND public.delegate_has_permission(branch_id, 'manage_media'))
    OR (group_id IS NOT NULL AND public.coach_teaches_group(group_id))
  );

-- EVENTS & REGISTRATIONS
CREATE POLICY events_read ON public.events FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY events_write ON public.events FOR ALL
  USING (public.is_owner() OR (branch_id IS NOT NULL AND public.delegate_has_permission(branch_id, 'manage_events')))
  WITH CHECK (public.is_owner() OR (branch_id IS NOT NULL AND public.delegate_has_permission(branch_id, 'manage_events')));

CREATE POLICY event_reg_select ON public.event_registrations FOR SELECT
  USING (
    public.is_owner()
    OR public.parent_owns_player(player_id)
    OR public.is_self_player(player_id)
  );
CREATE POLICY event_reg_insert ON public.event_registrations FOR INSERT
  WITH CHECK (
    public.is_owner()
    OR public.parent_owns_player(player_id)
    OR public.is_self_player(player_id)
  );

-- NOTIFICATIONS & AUDIT LOGS
CREATE POLICY notifications_self ON public.notifications FOR ALL
  USING (auth.uid() = user_id OR public.is_owner())
  WITH CHECK (auth.uid() = user_id OR public.is_owner());

CREATE POLICY audit_logs_owner_only ON public.audit_logs FOR SELECT
  USING (public.is_owner());
CREATE POLICY audit_logs_insert_server ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- PRIVATE STORAGE BUCKET FOR PLAYER PHOTOS & ACADEMY MEDIA
INSERT INTO storage.buckets (id, name, public)
VALUES ('xo-private-media', 'xo-private-media', FALSE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY storage_xo_read ON storage.objects FOR SELECT
  USING (
    bucket_id = 'xo-private-media'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY storage_xo_insert ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'xo-private-media'
    AND (public.is_owner() OR public.has_role('DELEGATE') OR public.has_role('COACH'))
  );

CREATE POLICY storage_xo_delete ON storage.objects FOR DELETE
  USING (
    bucket_id = 'xo-private-media'
    AND public.is_owner()
  );
