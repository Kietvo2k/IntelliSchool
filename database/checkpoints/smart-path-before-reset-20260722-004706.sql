--
-- PostgreSQL database dump
--

\restrict tlBqB5T7IwyNPeLBBhoKEUtuI1M3ghYk7qywCJ8ae54jMgFRvakIzUtX7WBtMQO

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

DROP POLICY IF EXISTS submissions_tenant_policy ON public.submissions;
DROP POLICY IF EXISTS student_credentials_tenant_policy ON public.student_credentials;
DROP POLICY IF EXISTS schools_tenant_policy ON public.schools;
DROP POLICY IF EXISTS school_requests_public_insert_policy ON public.school_requests;
DROP POLICY IF EXISTS school_requests_platform_admin_policy ON public.school_requests;
DROP POLICY IF EXISTS school_memberships_tenant_policy ON public.school_memberships;
DROP POLICY IF EXISTS resources_tenant_policy ON public.resources;
DROP POLICY IF EXISTS lessons_tenant_policy ON public.lessons;
DROP POLICY IF EXISTS learning_events_tenant_policy ON public.learning_events;
DROP POLICY IF EXISTS classes_tenant_policy ON public.classes;
DROP POLICY IF EXISTS career_share_grants_tenant_policy ON public.career_share_grants;
DROP POLICY IF EXISTS audit_events_tenant_policy ON public.audit_events;
DROP POLICY IF EXISTS assignments_tenant_policy ON public.assignments;
ALTER TABLE IF EXISTS ONLY public.submissions DROP CONSTRAINT IF EXISTS submissions_student_id_fkey;
ALTER TABLE IF EXISTS ONLY public.submissions DROP CONSTRAINT IF EXISTS submissions_school_id_fkey;
ALTER TABLE IF EXISTS ONLY public.submissions DROP CONSTRAINT IF EXISTS submissions_assignment_id_fkey;
ALTER TABLE IF EXISTS ONLY public.student_credentials DROP CONSTRAINT IF EXISTS student_credentials_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.student_credentials DROP CONSTRAINT IF EXISTS student_credentials_school_id_fkey;
ALTER TABLE IF EXISTS ONLY public.student_credentials DROP CONSTRAINT IF EXISTS student_credentials_class_id_fkey;
ALTER TABLE IF EXISTS ONLY public.schools DROP CONSTRAINT IF EXISTS schools_owner_id_fkey;
ALTER TABLE IF EXISTS ONLY public.school_requests DROP CONSTRAINT IF EXISTS school_requests_reviewed_by_fkey;
ALTER TABLE IF EXISTS ONLY public.school_memberships DROP CONSTRAINT IF EXISTS school_memberships_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.school_memberships DROP CONSTRAINT IF EXISTS school_memberships_school_id_fkey;
ALTER TABLE IF EXISTS ONLY public.resources DROP CONSTRAINT IF EXISTS resources_uploaded_by_fkey;
ALTER TABLE IF EXISTS ONLY public.resources DROP CONSTRAINT IF EXISTS resources_school_id_fkey;
ALTER TABLE IF EXISTS ONLY public.resources DROP CONSTRAINT IF EXISTS resources_lesson_id_fkey;
ALTER TABLE IF EXISTS ONLY public.lessons DROP CONSTRAINT IF EXISTS lessons_school_id_fkey;
ALTER TABLE IF EXISTS ONLY public.lessons DROP CONSTRAINT IF EXISTS lessons_created_by_fkey;
ALTER TABLE IF EXISTS ONLY public.learning_events DROP CONSTRAINT IF EXISTS learning_events_submission_id_fkey;
ALTER TABLE IF EXISTS ONLY public.learning_events DROP CONSTRAINT IF EXISTS learning_events_student_id_fkey;
ALTER TABLE IF EXISTS ONLY public.learning_events DROP CONSTRAINT IF EXISTS learning_events_school_id_fkey;
ALTER TABLE IF EXISTS ONLY public.classes DROP CONSTRAINT IF EXISTS classes_teacher_id_fkey;
ALTER TABLE IF EXISTS ONLY public.classes DROP CONSTRAINT IF EXISTS classes_school_id_fkey;
ALTER TABLE IF EXISTS ONLY public.career_share_grants DROP CONSTRAINT IF EXISTS career_share_grants_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.career_share_grants DROP CONSTRAINT IF EXISTS career_share_grants_school_id_fkey;
ALTER TABLE IF EXISTS ONLY public.career_profiles DROP CONSTRAINT IF EXISTS career_profiles_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.audit_events DROP CONSTRAINT IF EXISTS audit_events_school_id_fkey;
ALTER TABLE IF EXISTS ONLY public.audit_events DROP CONSTRAINT IF EXISTS audit_events_actor_id_fkey;
ALTER TABLE IF EXISTS ONLY public.assignments DROP CONSTRAINT IF EXISTS assignments_teacher_id_fkey;
ALTER TABLE IF EXISTS ONLY public.assignments DROP CONSTRAINT IF EXISTS assignments_school_id_fkey;
ALTER TABLE IF EXISTS ONLY public.assignments DROP CONSTRAINT IF EXISTS assignments_class_id_fkey;
DROP INDEX IF EXISTS public.idx_submissions_school_assignment;
DROP INDEX IF EXISTS public.idx_learning_events_school_student;
DROP INDEX IF EXISTS public.idx_classes_school;
DROP INDEX IF EXISTS public.idx_audit_events_school_created;
DROP INDEX IF EXISTS public.idx_assignments_school_class;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE IF EXISTS ONLY public.submissions DROP CONSTRAINT IF EXISTS submissions_student_id_idempotency_key_key;
ALTER TABLE IF EXISTS ONLY public.submissions DROP CONSTRAINT IF EXISTS submissions_pkey;
ALTER TABLE IF EXISTS ONLY public.student_credentials DROP CONSTRAINT IF EXISTS student_credentials_user_id_key;
ALTER TABLE IF EXISTS ONLY public.student_credentials DROP CONSTRAINT IF EXISTS student_credentials_school_id_student_code_key;
ALTER TABLE IF EXISTS ONLY public.student_credentials DROP CONSTRAINT IF EXISTS student_credentials_school_id_identity_fingerprint_key;
ALTER TABLE IF EXISTS ONLY public.student_credentials DROP CONSTRAINT IF EXISTS student_credentials_pkey;
ALTER TABLE IF EXISTS ONLY public.schools DROP CONSTRAINT IF EXISTS schools_pkey;
ALTER TABLE IF EXISTS ONLY public.schools DROP CONSTRAINT IF EXISTS schools_code_key;
ALTER TABLE IF EXISTS ONLY public.school_requests DROP CONSTRAINT IF EXISTS school_requests_pkey;
ALTER TABLE IF EXISTS ONLY public.school_memberships DROP CONSTRAINT IF EXISTS school_memberships_pkey;
ALTER TABLE IF EXISTS ONLY public.resources DROP CONSTRAINT IF EXISTS resources_pkey;
ALTER TABLE IF EXISTS ONLY public.resources DROP CONSTRAINT IF EXISTS resources_object_key_key;
ALTER TABLE IF EXISTS ONLY public.lessons DROP CONSTRAINT IF EXISTS lessons_pkey;
ALTER TABLE IF EXISTS ONLY public.learning_events DROP CONSTRAINT IF EXISTS learning_events_pkey;
ALTER TABLE IF EXISTS ONLY public.classes DROP CONSTRAINT IF EXISTS classes_pkey;
ALTER TABLE IF EXISTS ONLY public.career_share_grants DROP CONSTRAINT IF EXISTS career_share_grants_school_id_user_id_scope_key;
ALTER TABLE IF EXISTS ONLY public.career_share_grants DROP CONSTRAINT IF EXISTS career_share_grants_pkey;
ALTER TABLE IF EXISTS ONLY public.career_profiles DROP CONSTRAINT IF EXISTS career_profiles_pkey;
ALTER TABLE IF EXISTS ONLY public.audit_events DROP CONSTRAINT IF EXISTS audit_events_pkey;
ALTER TABLE IF EXISTS ONLY public.assignments DROP CONSTRAINT IF EXISTS assignments_pkey;
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.submissions;
DROP TABLE IF EXISTS public.student_credentials;
DROP TABLE IF EXISTS public.schools;
DROP TABLE IF EXISTS public.school_requests;
DROP TABLE IF EXISTS public.school_memberships;
DROP TABLE IF EXISTS public.resources;
DROP TABLE IF EXISTS public.lessons;
DROP TABLE IF EXISTS public.learning_events;
DROP TABLE IF EXISTS public.classes;
DROP TABLE IF EXISTS public.career_share_grants;
DROP TABLE IF EXISTS public.career_profiles;
DROP TABLE IF EXISTS public.audit_events;
DROP TABLE IF EXISTS public.assignments;
DROP FUNCTION IF EXISTS public.app_is_platform_admin();
DROP FUNCTION IF EXISTS public.app_current_school_id();
DROP TYPE IF EXISTS public.smartclass_role;
DROP TYPE IF EXISTS public.school_request_status;
DROP TYPE IF EXISTS public.resource_status;
DROP EXTENSION IF EXISTS pgcrypto;
DROP EXTENSION IF EXISTS citext;
--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: resource_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.resource_status AS ENUM (
    'QUARANTINED',
    'READY',
    'REJECTED'
);


--
-- Name: school_request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.school_request_status AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


--
-- Name: smartclass_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.smartclass_role AS ENUM (
    'PLATFORM_ADMIN',
    'SCHOOL_OWNER',
    'SCHOOL_ADMIN',
    'TEACHER',
    'COUNSELOR',
    'STUDENT'
);


--
-- Name: app_current_school_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_current_school_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT NULLIF(current_setting('app.school_id', true), '')::uuid
$$;


--
-- Name: app_is_platform_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_is_platform_admin() RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT current_user = 'smartclass_platform_admin'
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    class_id uuid NOT NULL,
    teacher_id uuid NOT NULL,
    title text NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    due_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT assignments_title_check CHECK (((char_length(title) >= 3) AND (char_length(title) <= 200)))
);

ALTER TABLE ONLY public.assignments FORCE ROW LEVEL SECURITY;


--
-- Name: audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid,
    actor_id uuid,
    action text NOT NULL,
    target_type text NOT NULL,
    target_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.audit_events FORCE ROW LEVEL SECURITY;


--
-- Name: career_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.career_profiles (
    user_id uuid NOT NULL,
    riasec_scores jsonb DEFAULT '{}'::jsonb NOT NULL,
    aptitude_scores jsonb DEFAULT '{}'::jsonb NOT NULL,
    academic_scores jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: career_share_grants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.career_share_grants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    user_id uuid NOT NULL,
    scope text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT career_share_grants_scope_check CHECK ((scope = ANY (ARRAY['PROFILE'::text, 'RESULTS'::text, 'FULL'::text])))
);

ALTER TABLE ONLY public.career_share_grants FORCE ROW LEVEL SECURITY;


--
-- Name: classes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    teacher_id uuid NOT NULL,
    name text NOT NULL,
    subject text NOT NULL,
    school_year text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT classes_name_check CHECK (((char_length(name) >= 1) AND (char_length(name) <= 120))),
    CONSTRAINT classes_subject_check CHECK (((char_length(subject) >= 1) AND (char_length(subject) <= 120)))
);

ALTER TABLE ONLY public.classes FORCE ROW LEVEL SECURITY;


--
-- Name: learning_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    student_id uuid NOT NULL,
    submission_id uuid,
    kind text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.learning_events FORCE ROW LEVEL SECURITY;


--
-- Name: lessons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lessons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    title text NOT NULL,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lessons_title_check CHECK (((char_length(title) >= 3) AND (char_length(title) <= 200)))
);

ALTER TABLE ONLY public.lessons FORCE ROW LEVEL SECURITY;


--
-- Name: resources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    lesson_id uuid,
    object_key text NOT NULL,
    original_name text NOT NULL,
    mime_type text NOT NULL,
    byte_size bigint NOT NULL,
    sha256 character(64) NOT NULL,
    status public.resource_status DEFAULT 'QUARANTINED'::public.resource_status NOT NULL,
    uploaded_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT resources_byte_size_check CHECK ((byte_size > 0))
);

ALTER TABLE ONLY public.resources FORCE ROW LEVEL SECURITY;


--
-- Name: school_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.school_memberships (
    school_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.smartclass_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.school_memberships FORCE ROW LEVEL SECURITY;


--
-- Name: school_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.school_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_name text NOT NULL,
    principal_name text NOT NULL,
    principal_email public.citext NOT NULL,
    province text NOT NULL,
    status public.school_request_status DEFAULT 'PENDING'::public.school_request_status NOT NULL,
    review_reason text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT school_requests_principal_name_check CHECK (((char_length(principal_name) >= 3) AND (char_length(principal_name) <= 120))),
    CONSTRAINT school_requests_province_check CHECK (((char_length(province) >= 2) AND (char_length(province) <= 100))),
    CONSTRAINT school_requests_school_name_check CHECK (((char_length(school_name) >= 3) AND (char_length(school_name) <= 160)))
);

ALTER TABLE ONLY public.school_requests FORCE ROW LEVEL SECURITY;


--
-- Name: schools; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schools (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    province text NOT NULL,
    owner_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT schools_code_check CHECK ((code ~ '^SC-[A-Z0-9]{6}$'::text)),
    CONSTRAINT schools_name_check CHECK (((char_length(name) >= 3) AND (char_length(name) <= 160))),
    CONSTRAINT schools_province_check CHECK (((char_length(province) >= 2) AND (char_length(province) <= 100)))
);

ALTER TABLE ONLY public.schools FORCE ROW LEVEL SECURITY;


--
-- Name: student_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    class_id uuid NOT NULL,
    user_id uuid NOT NULL,
    student_code text NOT NULL,
    identity_fingerprint bytea,
    activation_code_hash text NOT NULL,
    activation_expires_at timestamp with time zone NOT NULL,
    activated_at timestamp with time zone,
    password_hash text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT student_credentials_student_code_check CHECK ((student_code ~ '^[A-Z0-9-]{3,32}$'::text))
);

ALTER TABLE ONLY public.student_credentials FORCE ROW LEVEL SECURITY;


--
-- Name: submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_id uuid NOT NULL,
    assignment_id uuid NOT NULL,
    student_id uuid NOT NULL,
    idempotency_key text NOT NULL,
    answers jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.submissions FORCE ROW LEVEL SECURITY;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display_name text NOT NULL,
    email public.citext,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT users_display_name_check CHECK (((char_length(display_name) >= 1) AND (char_length(display_name) <= 120)))
);


--
-- Data for Name: assignments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.assignments (id, school_id, class_id, teacher_id, title, items, due_at, created_at) FROM stdin;
\.


--
-- Data for Name: audit_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_events (id, school_id, actor_id, action, target_type, target_id, metadata, created_at) FROM stdin;
d2748e3c-4c1d-4290-9e16-c32981f149ed	\N	\N	SCHOOL_REQUEST_APPROVED	school_request	6f6ee5b4-49bf-465e-8492-2c85a5793a88	{"schoolCode": "SC-B62528"}	2026-07-22 17:12:30.164029+00
ed0ab16f-0c30-4c8a-8285-39350e5a2c10	\N	\N	SCHOOL_REQUEST_APPROVED	school_request	e5184b08-7d51-4b3a-9b9a-32e889cc3601	{"schoolCode": "SC-07DC8E"}	2026-07-22 17:12:48.638357+00
dde849d1-f27f-4a8e-be63-09057e0bab26	\N	\N	SCHOOL_REQUEST_APPROVED	school_request	4a04f3c2-763c-4821-bde3-8cc86d6add04	{"schoolCode": "SC-04A723"}	2026-07-22 17:17:33.682205+00
91c35d68-4a94-4f1e-915f-861785c2fa09	\N	\N	SCHOOL_REQUEST_APPROVED	school_request	0c82f1b9-7104-459c-bbf7-548165d8f52b	{"schoolCode": "SC-C74B58"}	2026-07-22 17:20:39.16509+00
915ea241-25e7-4830-8d9e-db0ea7c51d4e	\N	\N	SCHOOL_REQUEST_APPROVED	school_request	e8922793-6899-4e07-8f5d-be5ed0c09ba3	{"schoolCode": "SC-502AA3"}	2026-07-22 17:21:07.762897+00
c1571031-bf26-4531-a44e-6881f3602e63	\N	\N	SCHOOL_REQUEST_APPROVED	school_request	64036a39-df97-4774-b342-7f07f1389627	{"schoolCode": "SC-71B7F8"}	2026-07-22 17:44:11.325527+00
\.


--
-- Data for Name: career_profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.career_profiles (user_id, riasec_scores, aptitude_scores, academic_scores, updated_at) FROM stdin;
\.


--
-- Data for Name: career_share_grants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.career_share_grants (id, school_id, user_id, scope, granted_at, revoked_at) FROM stdin;
\.


--
-- Data for Name: classes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.classes (id, school_id, teacher_id, name, subject, school_year, created_at) FROM stdin;
\.


--
-- Data for Name: learning_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.learning_events (id, school_id, student_id, submission_id, kind, payload, created_at) FROM stdin;
\.


--
-- Data for Name: lessons; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.lessons (id, school_id, title, content, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: resources; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.resources (id, school_id, lesson_id, object_key, original_name, mime_type, byte_size, sha256, status, uploaded_by, created_at) FROM stdin;
\.


--
-- Data for Name: school_memberships; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.school_memberships (school_id, user_id, role, created_at) FROM stdin;
\.


--
-- Data for Name: school_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.school_requests (id, school_name, principal_name, principal_email, province, status, review_reason, reviewed_by, reviewed_at, created_at) FROM stdin;
\.


--
-- Data for Name: schools; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.schools (id, code, name, province, owner_id, created_at) FROM stdin;
\.


--
-- Data for Name: student_credentials; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.student_credentials (id, school_id, class_id, user_id, student_code, identity_fingerprint, activation_code_hash, activation_expires_at, activated_at, password_hash, created_at) FROM stdin;
\.


--
-- Data for Name: submissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.submissions (id, school_id, assignment_id, student_id, idempotency_key, answers, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, display_name, email, created_at, updated_at) FROM stdin;
\.


--
-- Name: assignments assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_pkey PRIMARY KEY (id);


--
-- Name: audit_events audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_pkey PRIMARY KEY (id);


--
-- Name: career_profiles career_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.career_profiles
    ADD CONSTRAINT career_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: career_share_grants career_share_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.career_share_grants
    ADD CONSTRAINT career_share_grants_pkey PRIMARY KEY (id);


--
-- Name: career_share_grants career_share_grants_school_id_user_id_scope_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.career_share_grants
    ADD CONSTRAINT career_share_grants_school_id_user_id_scope_key UNIQUE (school_id, user_id, scope);


--
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


--
-- Name: learning_events learning_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_events
    ADD CONSTRAINT learning_events_pkey PRIMARY KEY (id);


--
-- Name: lessons lessons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_pkey PRIMARY KEY (id);


--
-- Name: resources resources_object_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resources
    ADD CONSTRAINT resources_object_key_key UNIQUE (object_key);


--
-- Name: resources resources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resources
    ADD CONSTRAINT resources_pkey PRIMARY KEY (id);


--
-- Name: school_memberships school_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_memberships
    ADD CONSTRAINT school_memberships_pkey PRIMARY KEY (school_id, user_id);


--
-- Name: school_requests school_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_requests
    ADD CONSTRAINT school_requests_pkey PRIMARY KEY (id);


--
-- Name: schools schools_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schools
    ADD CONSTRAINT schools_code_key UNIQUE (code);


--
-- Name: schools schools_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schools
    ADD CONSTRAINT schools_pkey PRIMARY KEY (id);


--
-- Name: student_credentials student_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_credentials
    ADD CONSTRAINT student_credentials_pkey PRIMARY KEY (id);


--
-- Name: student_credentials student_credentials_school_id_identity_fingerprint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_credentials
    ADD CONSTRAINT student_credentials_school_id_identity_fingerprint_key UNIQUE (school_id, identity_fingerprint);


--
-- Name: student_credentials student_credentials_school_id_student_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_credentials
    ADD CONSTRAINT student_credentials_school_id_student_code_key UNIQUE (school_id, student_code);


--
-- Name: student_credentials student_credentials_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_credentials
    ADD CONSTRAINT student_credentials_user_id_key UNIQUE (user_id);


--
-- Name: submissions submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_pkey PRIMARY KEY (id);


--
-- Name: submissions submissions_student_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_student_id_idempotency_key_key UNIQUE (student_id, idempotency_key);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_assignments_school_class; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignments_school_class ON public.assignments USING btree (school_id, class_id);


--
-- Name: idx_audit_events_school_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_events_school_created ON public.audit_events USING btree (school_id, created_at DESC);


--
-- Name: idx_classes_school; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classes_school ON public.classes USING btree (school_id);


--
-- Name: idx_learning_events_school_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_events_school_student ON public.learning_events USING btree (school_id, student_id, created_at DESC);


--
-- Name: idx_submissions_school_assignment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_school_assignment ON public.submissions USING btree (school_id, assignment_id);


--
-- Name: assignments assignments_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: assignments assignments_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;


--
-- Name: assignments assignments_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.users(id);


--
-- Name: audit_events audit_events_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: audit_events audit_events_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE SET NULL;


--
-- Name: career_profiles career_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.career_profiles
    ADD CONSTRAINT career_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: career_share_grants career_share_grants_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.career_share_grants
    ADD CONSTRAINT career_share_grants_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;


--
-- Name: career_share_grants career_share_grants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.career_share_grants
    ADD CONSTRAINT career_share_grants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: classes classes_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;


--
-- Name: classes classes_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.users(id);


--
-- Name: learning_events learning_events_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_events
    ADD CONSTRAINT learning_events_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;


--
-- Name: learning_events learning_events_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_events
    ADD CONSTRAINT learning_events_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id);


--
-- Name: learning_events learning_events_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_events
    ADD CONSTRAINT learning_events_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(id) ON DELETE SET NULL;


--
-- Name: lessons lessons_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: lessons lessons_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;


--
-- Name: resources resources_lesson_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resources
    ADD CONSTRAINT resources_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id) ON DELETE SET NULL;


--
-- Name: resources resources_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resources
    ADD CONSTRAINT resources_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;


--
-- Name: resources resources_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resources
    ADD CONSTRAINT resources_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: school_memberships school_memberships_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_memberships
    ADD CONSTRAINT school_memberships_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;


--
-- Name: school_memberships school_memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_memberships
    ADD CONSTRAINT school_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: school_requests school_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_requests
    ADD CONSTRAINT school_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: schools schools_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schools
    ADD CONSTRAINT schools_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: student_credentials student_credentials_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_credentials
    ADD CONSTRAINT student_credentials_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: student_credentials student_credentials_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_credentials
    ADD CONSTRAINT student_credentials_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;


--
-- Name: student_credentials student_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_credentials
    ADD CONSTRAINT student_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: submissions submissions_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;


--
-- Name: submissions submissions_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;


--
-- Name: submissions submissions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id);


--
-- Name: assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: assignments assignments_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY assignments_tenant_policy ON public.assignments USING (((school_id = public.app_current_school_id()) OR public.app_is_platform_admin())) WITH CHECK (((school_id = public.app_current_school_id()) OR public.app_is_platform_admin()));


--
-- Name: audit_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_events audit_events_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_events_tenant_policy ON public.audit_events USING (((school_id = public.app_current_school_id()) OR public.app_is_platform_admin())) WITH CHECK (((school_id = public.app_current_school_id()) OR public.app_is_platform_admin()));


--
-- Name: career_share_grants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.career_share_grants ENABLE ROW LEVEL SECURITY;

--
-- Name: career_share_grants career_share_grants_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY career_share_grants_tenant_policy ON public.career_share_grants USING (((school_id = public.app_current_school_id()) OR public.app_is_platform_admin())) WITH CHECK (((school_id = public.app_current_school_id()) OR public.app_is_platform_admin()));


--
-- Name: classes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

--
-- Name: classes classes_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY classes_tenant_policy ON public.classes USING (((school_id = public.app_current_school_id()) OR public.app_is_platform_admin())) WITH CHECK (((school_id = public.app_current_school_id()) OR public.app_is_platform_admin()));


--
-- Name: learning_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learning_events ENABLE ROW LEVEL SECURITY;

--
-- Name: learning_events learning_events_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY learning_events_tenant_policy ON public.learning_events USING (((school_id = public.app_current_school_id()) OR public.app_is_platform_admin())) WITH CHECK (((school_id = public.app_current_school_id()) OR public.app_is_platform_admin()));


--
-- Name: lessons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

--
-- Name: lessons lessons_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lessons_tenant_policy ON public.lessons USING (((school_id = public.app_current_school_id()) OR public.app_is_platform_admin())) WITH CHECK (((school_id = public.app_current_school_id()) OR public.app_is_platform_admin()));


--
-- Name: resources; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

--
-- Name: resources resources_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY resources_tenant_policy ON public.resources USING (((school_id = public.app_current_school_id()) OR public.app_is_platform_admin())) WITH CHECK (((school_id = public.app_current_school_id()) OR public.app_is_platform_admin()));


--
-- Name: school_memberships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.school_memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: school_memberships school_memberships_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY school_memberships_tenant_policy ON public.school_memberships USING (((school_id = public.app_current_school_id()) OR public.app_is_platform_admin())) WITH CHECK (((school_id = public.app_current_school_id()) OR public.app_is_platform_admin()));


--
-- Name: school_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.school_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: school_requests school_requests_platform_admin_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY school_requests_platform_admin_policy ON public.school_requests TO smartclass_platform_admin USING (true) WITH CHECK (true);


--
-- Name: school_requests school_requests_public_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY school_requests_public_insert_policy ON public.school_requests FOR INSERT TO smartclass_public WITH CHECK (((status = 'PENDING'::public.school_request_status) AND (reviewed_by IS NULL) AND (reviewed_at IS NULL) AND (review_reason IS NULL)));


--
-- Name: schools; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

--
-- Name: schools schools_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY schools_tenant_policy ON public.schools USING (((id = public.app_current_school_id()) OR public.app_is_platform_admin())) WITH CHECK (((id = public.app_current_school_id()) OR public.app_is_platform_admin()));


--
-- Name: student_credentials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_credentials ENABLE ROW LEVEL SECURITY;

--
-- Name: student_credentials student_credentials_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY student_credentials_tenant_policy ON public.student_credentials USING (((school_id = public.app_current_school_id()) OR public.app_is_platform_admin())) WITH CHECK (((school_id = public.app_current_school_id()) OR public.app_is_platform_admin()));


--
-- Name: submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: submissions submissions_tenant_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY submissions_tenant_policy ON public.submissions USING (((school_id = public.app_current_school_id()) OR public.app_is_platform_admin())) WITH CHECK (((school_id = public.app_current_school_id()) OR public.app_is_platform_admin()));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO smartclass_app;
GRANT USAGE ON SCHEMA public TO smartclass_platform_admin;
GRANT USAGE ON SCHEMA public TO smartclass_public;


--
-- Name: TABLE assignments; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.assignments TO smartclass_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.assignments TO smartclass_platform_admin;


--
-- Name: TABLE audit_events; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.audit_events TO smartclass_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.audit_events TO smartclass_platform_admin;


--
-- Name: TABLE career_profiles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.career_profiles TO smartclass_platform_admin;


--
-- Name: TABLE career_share_grants; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.career_share_grants TO smartclass_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.career_share_grants TO smartclass_platform_admin;


--
-- Name: TABLE classes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.classes TO smartclass_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.classes TO smartclass_platform_admin;


--
-- Name: TABLE learning_events; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.learning_events TO smartclass_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.learning_events TO smartclass_platform_admin;


--
-- Name: TABLE lessons; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.lessons TO smartclass_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.lessons TO smartclass_platform_admin;


--
-- Name: TABLE resources; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.resources TO smartclass_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.resources TO smartclass_platform_admin;


--
-- Name: TABLE school_memberships; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.school_memberships TO smartclass_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.school_memberships TO smartclass_platform_admin;


--
-- Name: TABLE school_requests; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.school_requests TO smartclass_platform_admin;
GRANT INSERT ON TABLE public.school_requests TO smartclass_public;


--
-- Name: TABLE schools; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.schools TO smartclass_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.schools TO smartclass_platform_admin;


--
-- Name: TABLE student_credentials; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.student_credentials TO smartclass_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.student_credentials TO smartclass_platform_admin;


--
-- Name: TABLE submissions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.submissions TO smartclass_app;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.submissions TO smartclass_platform_admin;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.users TO smartclass_platform_admin;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE smartclass IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO smartclass_platform_admin;


--
-- PostgreSQL database dump complete
--

\unrestrict tlBqB5T7IwyNPeLBBhoKEUtuI1M3ghYk7qywCJ8ae54jMgFRvakIzUtX7WBtMQO

