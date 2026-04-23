-- Account Deletion with 60-Day Grace Period
-- Adds deletion tracking columns and RPC functions
-- Run this in Supabase SQL Editor

-- ── New columns on user_profiles ─────────────────────────────────────────────
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_scheduled_for timestamptz;

-- ── RPC: request_account_deletion ────────────────────────────────────────────
-- Sets deletion timestamps for the calling user. 60-day grace period.
CREATE OR REPLACE FUNCTION request_account_deletion()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_scheduled_for timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  v_scheduled_for := now() + interval '60 days';

  UPDATE user_profiles
  SET deletion_requested_at = now(),
      deletion_scheduled_for = v_scheduled_for,
      updated_at = now()
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'User profile not found');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deletion_scheduled_for', v_scheduled_for
  );
END;
$$;

-- ── RPC: cancel_account_deletion ─────────────────────────────────────────────
-- Clears deletion timestamps. Called when user chooses to keep their account.
CREATE OR REPLACE FUNCTION cancel_account_deletion()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  UPDATE user_profiles
  SET deletion_requested_at = NULL,
      deletion_scheduled_for = NULL,
      updated_at = now()
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'User profile not found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── RPC: check_deletion_status ───────────────────────────────────────────────
-- Returns whether the calling user has a pending deletion request.
CREATE OR REPLACE FUNCTION check_deletion_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_requested_at timestamptz;
  v_scheduled_for timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT deletion_requested_at, deletion_scheduled_for
  INTO v_requested_at, v_scheduled_for
  FROM user_profiles
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('pending_deletion', false);
  END IF;

  RETURN jsonb_build_object(
    'pending_deletion', v_requested_at IS NOT NULL,
    'deletion_requested_at', v_requested_at,
    'deletion_scheduled_for', v_scheduled_for
  );
END;
$$;
