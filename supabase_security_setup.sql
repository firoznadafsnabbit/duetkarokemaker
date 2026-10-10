-- ====================================================================
-- Duet Karaoke Maker - Database Security & Row Level Security (RLS) Setup
-- Run this script in the Supabase SQL Editor (https://supabase.com/dashboard)
-- ====================================================================

-- 1. Ensure profiles table structure with constraints
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  credits INTEGER NOT NULL DEFAULT 6,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. ENABLE ROW LEVEL SECURITY (Mandatory)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop any previous insecure or overlapping policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable all for users" ON public.profiles;

-- 3. STRICT READ POLICY: Users can ONLY read their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- 4. STRICT INSERT POLICY: User can only insert their own row on first signup
CREATE POLICY "Users can insert own profile on signup" 
ON public.profiles 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

-- 5. PREVENT CLIENT-SIDE CREDIT TAMPERING:
-- Direct client updates to the 'credits' column are forbidden.
-- Users cannot modify their own credits via client-side supabase.from('profiles').update().
REVOKE UPDATE (credits) ON public.profiles FROM authenticated, anon;

-- 6. ATOMIC, SERVER-CONTROLLED TOKEN DEDUCTION (RPC)
-- Runs with SECURITY DEFINER so it can modify credits safely on behalf of the authenticated user.
CREATE OR REPLACE FUNCTION public.deduct_tokens(tokens_needed INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_current_credits INT;
  v_new_credits INT;
BEGIN
  -- Verify caller is logged in
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF tokens_needed <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid token amount requested');
  END IF;

  -- Lock row for update to prevent race conditions
  SELECT credits INTO v_current_credits
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF v_current_credits IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  IF v_current_credits < tokens_needed THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Insufficient credits', 
      'credits', v_current_credits
    );
  END IF;

  v_new_credits := v_current_credits - tokens_needed;

  UPDATE public.profiles
  SET credits = v_new_credits, updated_at = timezone('utc'::text, now())
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'credits', v_new_credits);
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.deduct_tokens(INT) TO authenticated;

-- 7. SECURE ADMIN RPC FUNCTIONS (Protected by Admin Email Check)
CREATE OR REPLACE FUNCTION public.admin_get_all_users()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_email TEXT;
  v_result JSONB;
BEGIN
  -- Verify caller email
  SELECT email INTO v_caller_email FROM auth.users WHERE id = auth.uid();
  
  -- Only allow designated master admin
  IF v_caller_email IS NULL OR lower(v_caller_email) NOT IN ('feroznadafm@gmail.com') THEN
    RETURN jsonb_build_object('error', 'Unauthorized: Admin access required');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'email', p.email,
      'credits', p.credits,
      'created_at', p.created_at
    )
  ) INTO v_result
  FROM public.profiles p
  ORDER BY p.created_at DESC;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_all_users() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_credits(target_email TEXT, new_credits INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_email TEXT;
BEGIN
  SELECT email INTO v_caller_email FROM auth.users WHERE id = auth.uid();

  IF v_caller_email IS NULL OR lower(v_caller_email) NOT IN ('feroznadafm@gmail.com') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin access required');
  END IF;

  IF new_credits < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Credits cannot be negative');
  END IF;

  UPDATE public.profiles
  SET credits = new_credits, updated_at = timezone('utc'::text, now())
  WHERE lower(email) = lower(trim(target_email));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User with email not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'email', target_email, 'credits', new_credits);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_credits(TEXT, INT) TO authenticated;

-- ====================================================================
-- 7. HIGH CONCURRENCY CONNECTION POOLING CONFIGURATION (SUPAVISOR - PORT 6543)
-- To support thousands of concurrent users on the Supabase free tier:
-- 1. In Supabase Dashboard -> Project Settings -> Database -> Connection string:
--    Select "Transaction" mode (Port 6543) instead of "Session" (Port 5432).
-- 2. Supavisor Transaction Pooler reuses small physical PostgreSQL connections
--    instantly across thousands of concurrent client requests.
-- ====================================================================

-- Optimize profile indexes for high concurrent queries (avoids sequential table scans)
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON public.profiles (lower(email));
CREATE INDEX IF NOT EXISTS idx_profiles_credits ON public.profiles (credits);

-- Ensure atomic read/write performance
ALTER TABLE public.profiles SET (fillfactor = 90);

-- ====================================================================
-- Database Security & Concurrency Configuration Complete!
-- ====================================================================
