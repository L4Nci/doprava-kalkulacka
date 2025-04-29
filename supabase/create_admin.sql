INSERT INTO admin_profiles (id, email, full_name, is_super_admin)
VALUES (
  '<<VLOŽTE_ZDE_UUID_Z_AUTH>>', -- UUID z Authentication > Users
  'admin@example.com',          -- stejný email jako v Authentication
  'Admin Name',                 -- jméno admina
  true                         -- je super admin
);
