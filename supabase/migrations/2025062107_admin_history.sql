CREATE TABLE IF NOT EXISTS admin_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  ip_address TEXT,
  browser TEXT,
  device TEXT,
  os TEXT,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_history_admin_id ON admin_history(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_history_event_type ON admin_history(event_type);
CREATE INDEX IF NOT EXISTS idx_admin_history_created_at ON admin_history(created_at DESC);

ALTER TABLE admin_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read own history"
  ON admin_history FOR SELECT
  TO authenticated
  USING (admin_id = auth.uid());

CREATE POLICY "Admins can insert own history"
  ON admin_history FOR INSERT
  TO authenticated
  WITH CHECK (admin_id = auth.uid());
