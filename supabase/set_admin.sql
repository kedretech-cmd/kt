-- ============================================================
-- KEDRE TECH — Set Admin by UID
-- Run this in: https://supabase.com/dashboard/project/yfwaoxntkeacutkzazmp/sql
-- ============================================================

-- Step 1: Ensure profile row exists for this user
-- (auto-created on signup, but just in case)
INSERT INTO public.profiles (id, is_admin)
VALUES ('9466ed36-a7fc-44b1-a362-34ba822da709', true)
ON CONFLICT (id) DO UPDATE SET is_admin = true;

-- Step 2: Verify it worked
SELECT id, full_name, is_admin, created_at
FROM public.profiles
WHERE id = '9466ed36-a7fc-44b1-a362-34ba822da709';
