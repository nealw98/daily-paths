-- Server-anchored trial start for Android 2.7. Closes the "clear app data
-- → fresh trial" loophole: the trial-start timestamp is recorded once per
-- RC App User ID and replayed on subsequent launches.
--
-- Google Play restores the same RC anonymous App User ID when the user
-- reinstalls on the same Google account, so this naturally re-anchors
-- across reinstalls without a separate account model.

CREATE TABLE IF NOT EXISTS android_trial_starts (
  rc_app_user_id text PRIMARY KEY,
  trial_start_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE android_trial_starts ENABLE ROW LEVEL SECURITY;
