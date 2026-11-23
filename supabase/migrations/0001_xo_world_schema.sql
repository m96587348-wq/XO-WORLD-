-- =============================================================================
-- XO WORLD — XO Sport Academy ("رجّع له البطل اللي جواه")
-- Migration 0001: Complete Core Schema, Constraints, Indexes, and Triggers
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enumerations
CREATE TYPE app_role AS ENUM ('OWNER', 'DELEGATE', 'COACH', 'PARENT', 'PLAYER');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'excused');
CREATE TYPE subscription_status AS ENUM ('active', 'expiring_soon', 'expired', 'frozen');
CREATE TYPE payment_status AS ENUM ('paid', 'pending', 'overdue', 'refunded');
CREATE TYPE media_visibility AS ENUM ('academy', 'group', 'branch', 'private_player');
CREATE TYPE media_kind AS ENUM ('image', 'video');

-- Shared updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 1. PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK (char_length(trim(full_name)) >= 2),
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. USER ROLES (Privileged roles assignable only by OWNER)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  assigned_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, role)
);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE TRIGGER trg_user_roles_updated_at BEFORE UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. BRANCHES (Strictly 2 branches: Miami Gamal Abdel Nasser & Miami Khalil Hamada)
CREATE TABLE public.branches (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL UNIQUE,
  address_ar TEXT NOT NULL,
  phone TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_branches_updated_at BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. SPORTS (Parkour, Kickboxing, MMA, Gymnastics, Taekwondo)
CREATE TABLE public.sports (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description_ar TEXT NOT NULL,
  monthly_fee_egp NUMERIC(10, 2) NOT NULL CHECK (monthly_fee_egp >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_sports_updated_at BEFORE UPDATE ON public.sports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. COACHES
CREATE TABLE public.coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  specialty_sport_id TEXT NOT NULL REFERENCES public.sports(id) ON DELETE RESTRICT,
  primary_branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  bio_ar TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_coaches_branch ON public.coaches(primary_branch_id);
CREATE TRIGGER trg_coaches_updated_at BEFORE UPDATE ON public.coaches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. TRAINING GROUPS
CREATE TABLE public.training_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  sport_id TEXT NOT NULL REFERENCES public.sports(id) ON DELETE RESTRICT,
  age_range TEXT NOT NULL,
  schedule_days TEXT NOT NULL,
  schedule_time TEXT NOT NULL,
  max_capacity INTEGER NOT NULL DEFAULT 20 CHECK (max_capacity > 0 AND max_capacity <= 100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_training_groups_branch_sport ON public.training_groups(branch_id, sport_id);
CREATE TRIGGER trg_training_groups_updated_at BEFORE UPDATE ON public.training_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. COACH GROUPS (Junction)
CREATE TABLE public.coach_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.training_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (coach_id, group_id)
);
CREATE INDEX idx_coach_groups_coach ON public.coach_groups(coach_id);
CREATE INDEX idx_coach_groups_group ON public.coach_groups(group_id);

-- 8. DELEGATES & DELEGATE PERMISSIONS
CREATE TABLE public.delegates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  assigned_branch_ids TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_delegates_updated_at BEFORE UPDATE ON public.delegates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.delegate_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delegate_id UUID NOT NULL REFERENCES public.delegates(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL CHECK (
    permission_key IN (
      'manage_players',
      'manage_attendance',
      'manage_payments',
      'manage_media',
      'manage_events',
      'manage_community',
      'view_reports'
    )
  ),
  granted_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (delegate_id, branch_id, permission_key)
);
CREATE INDEX idx_delegate_permissions_lookup ON public.delegate_permissions(delegate_id, branch_id);

-- 9. PARENTS
CREATE TABLE public.parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  emergency_contact TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_parents_updated_at BEFORE UPDATE ON public.parents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 10. PLAYERS
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
  player_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL CHECK (char_length(trim(full_name)) >= 2),
  birth_date DATE NOT NULL,
  photo_path TEXT,
  branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  sport_id TEXT NOT NULL REFERENCES public.sports(id) ON DELETE RESTRICT,
  group_id UUID REFERENCES public.training_groups(id) ON DELETE SET NULL,
  belt_or_level TEXT NOT NULL DEFAULT 'مبتدئ',
  performance_score INTEGER NOT NULL DEFAULT 75 CHECK (performance_score >= 0 AND performance_score <= 100),
  coach_notes TEXT NOT NULL DEFAULT '',
  medical_notes TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_players_branch ON public.players(branch_id);
CREATE INDEX idx_players_group ON public.players(group_id);
CREATE INDEX idx_players_code ON public.players(player_code);
CREATE TRIGGER trg_players_updated_at BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 11. PARENT-PLAYERS (Strict parent-child isolation link)
CREATE TABLE public.parent_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'ولي أمر',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (parent_id, player_id)
);
CREATE INDEX idx_parent_players_parent ON public.parent_players(parent_id);
CREATE INDEX idx_parent_players_player ON public.parent_players(player_id);

-- 12. ATTENDANCE
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.training_groups(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  session_date DATE NOT NULL,
  status attendance_status NOT NULL,
  note TEXT DEFAULT '',
  recorded_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, group_id, session_date)
);
CREATE INDEX idx_attendance_group_date ON public.attendance(group_id, session_date);
CREATE INDEX idx_attendance_player ON public.attendance(player_id);
CREATE TRIGGER trg_attendance_updated_at BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 13. SUBSCRIPTIONS & PAYMENTS
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  sport_id TEXT NOT NULL REFERENCES public.sports(id) ON DELETE RESTRICT,
  plan_name_ar TEXT NOT NULL,
  monthly_amount_egp NUMERIC(10, 2) NOT NULL CHECK (monthly_amount_egp >= 0),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL CHECK (end_date >= start_date),
  status subscription_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_subscriptions_player ON public.subscriptions(player_id);
CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  amount_egp NUMERIC(10, 2) NOT NULL CHECK (amount_egp >= 0),
  outstanding_balance_egp NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (outstanding_balance_egp >= 0),
  billing_month TEXT NOT NULL, -- YYYY-MM
  payment_method TEXT NOT NULL DEFAULT 'نقدي بالفرع',
  status payment_status NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  recorded_by UUID REFERENCES public.profiles(id),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payments_branch_month ON public.payments(branch_id, billing_month);
CREATE INDEX idx_payments_player ON public.payments(player_id);
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 14. ANNOUNCEMENTS & COMMUNITY
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar TEXT NOT NULL,
  body_ar TEXT NOT NULL,
  branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
  author_id UUID NOT NULL REFERENCES public.profiles(id),
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_announcements_updated_at BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
  title_ar TEXT NOT NULL,
  body_ar TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'عام',
  is_approved BOOLEAN NOT NULL DEFAULT TRUE,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_community_posts_created ON public.community_posts(created_at DESC);
CREATE TRIGGER trg_community_posts_updated_at BEFORE UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.community_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body_ar TEXT NOT NULL CHECK (char_length(trim(body_ar)) >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_community_comments_post ON public.community_comments(post_id);
CREATE TRIGGER trg_community_comments_updated_at BEFORE UPDATE ON public.community_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.community_likes (
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

-- 15. MEDIA
CREATE TABLE public.media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar TEXT NOT NULL,
  album_ar TEXT NOT NULL DEFAULT 'تدريبات الأكاديمية',
  kind media_kind NOT NULL DEFAULT 'image',
  storage_path TEXT NOT NULL,
  visibility media_visibility NOT NULL DEFAULT 'academy',
  branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
  group_id UUID REFERENCES public.training_groups(id) ON DELETE SET NULL,
  player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_media_visibility ON public.media(visibility, branch_id, group_id);
CREATE TRIGGER trg_media_updated_at BEFORE UPDATE ON public.media
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 16. EVENTS & REGISTRATIONS
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar TEXT NOT NULL,
  description_ar TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'بطولة',
  branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
  sport_id TEXT REFERENCES public.sports(id) ON DELETE SET NULL,
  event_date TIMESTAMPTZ NOT NULL,
  location_ar TEXT NOT NULL,
  max_participants INTEGER NOT NULL DEFAULT 50 CHECK (max_participants > 0),
  results_summary_ar TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed', 'cancelled')),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  registered_by UUID NOT NULL REFERENCES public.profiles(id),
  achievement_ar TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'confirmed', 'withdrawn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, player_id)
);
CREATE INDEX idx_event_reg_event ON public.event_registrations(event_id);
CREATE TRIGGER trg_event_registrations_updated_at BEFORE UPDATE ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 17. NOTIFICATIONS & AUDIT LOGS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title_ar TEXT NOT NULL,
  body_ar TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'system',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read);

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role app_role,
  action TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_id TEXT,
  branch_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);
