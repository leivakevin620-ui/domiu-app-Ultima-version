CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ip_address TEXT,
  browser TEXT,
  device TEXT,
  os TEXT,
  is_current BOOLEAN DEFAULT true,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id ON admin_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_is_current ON admin_sessions(is_current);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_last_active ON admin_sessions(last_active_at DESC);

ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read own sessions"
  ON admin_sessions FOR SELECT
  TO authenticated
  USING (admin_id = auth.uid());

CREATE POLICY "Admins can insert own sessions"
  ON admin_sessions FOR INSERT
  TO authenticated
  WITH CHECK (admin_id = auth.uid());

CREATE POLICY "Admins can update own sessions"
  ON admin_sessions FOR UPDATE
  TO authenticated
  USING (admin_id = auth.uid());
