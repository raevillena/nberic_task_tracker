-- Create demo users for quick login
-- Password: demo123 (hashed with bcrypt, salt rounds 12)

-- Demo Manager
INSERT IGNORE INTO users (email, password_hash, first_name, last_name, role, is_active, token_version, created_at, updated_at)
VALUES (
  'manager@demo.com',
  '$2b$12$rBMovGmxWuWRZ/7rcSzzjubIphvcap32x623.iMu0iWIMe6j1/z7a',
  'Demo',
  'Manager',
  'Manager',
  true,
  0,
  NOW(),
  NOW()
);

-- Demo Researcher
INSERT IGNORE INTO users (email, password_hash, first_name, last_name, role, is_active, token_version, created_at, updated_at)
VALUES (
  'researcher@demo.com',
  '$2b$12$1pDflzlVyzvLo6Ufw.Pe3erk8u9RMI91SmmxcdI8QSom0hCbkvsb2',
  'Demo',
  'Researcher',
  'Researcher',
  true,
  0,
  NOW(),
  NOW()
);
