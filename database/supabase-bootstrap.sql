-- Chạy một lần trên Supabase SQL Editor (role postgres) trước khi trỏ Smart Path sang Supabase.
-- Thay mật khẩu cho khớp ba URL trong .env. Không dùng chung user postgres cho cả ba URL
-- (user đó bypass RLS, phá cô lập trường).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'smartpath_api') THEN
    CREATE ROLE smartpath_api LOGIN PASSWORD 'replace-api-password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'smartpath_public') THEN
    CREATE ROLE smartpath_public LOGIN PASSWORD 'replace-public-password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'smartpath_control') THEN
    CREATE ROLE smartpath_control LOGIN PASSWORD 'replace-control-password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;

GRANT smartpath_api, smartpath_public, smartpath_control TO postgres;
