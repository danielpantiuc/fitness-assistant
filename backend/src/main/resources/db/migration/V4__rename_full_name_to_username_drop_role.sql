ALTER TABLE users
    RENAME COLUMN full_name TO username;

ALTER TABLE users
    DROP COLUMN role;
