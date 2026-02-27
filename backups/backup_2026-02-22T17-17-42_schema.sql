--
-- PostgreSQL database dump
--

\restrict NMLsfShxeH7gSVHJvfA6bD1EE1SKu3whtM1P6YV7CvWdvMKTgwhc1Sya2hBpJJ4

-- Dumped from database version 18.2
-- Dumped by pg_dump version 18.2

-- Started on 2026-02-22 12:17:46

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

DROP DATABASE IF EXISTS new_scent;
--
-- TOC entry 5272 (class 1262 OID 16601)
-- Name: new_scent; Type: DATABASE; Schema: -; Owner: -
--

CREATE DATABASE new_scent WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'English_United States.1252';


\unrestrict NMLsfShxeH7gSVHJvfA6bD1EE1SKu3whtM1P6YV7CvWdvMKTgwhc1Sya2hBpJJ4
\connect new_scent
\restrict NMLsfShxeH7gSVHJvfA6bD1EE1SKu3whtM1P6YV7CvWdvMKTgwhc1Sya2hBpJJ4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 5273 (class 0 OID 0)
-- Dependencies: 4
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- TOC entry 871 (class 1247 OID 16603)
-- Name: AlertType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AlertType" AS ENUM (
    'wishlist_available',
    'decant_interest',
    'pending_submission_approval'
);


--
-- TOC entry 874 (class 1247 OID 16610)
-- Name: HouseType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."HouseType" AS ENUM (
    'niche',
    'designer',
    'indie',
    'celebrity',
    'drugstore'
);


--
-- TOC entry 877 (class 1247 OID 16622)
-- Name: PendingSubmissionStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PendingSubmissionStatus" AS ENUM (
    'pending',
    'approved',
    'rejected'
);


--
-- TOC entry 880 (class 1247 OID 16630)
-- Name: PendingSubmissionType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PendingSubmissionType" AS ENUM (
    'perfume',
    'perfume_house'
);


--
-- TOC entry 883 (class 1247 OID 16636)
-- Name: PerfumeNoteType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PerfumeNoteType" AS ENUM (
    'open',
    'heart',
    'base'
);


--
-- TOC entry 886 (class 1247 OID 16644)
-- Name: PerfumeType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PerfumeType" AS ENUM (
    'eauDeParfum',
    'eauDeToilette',
    'eauDeCologne',
    'parfum',
    'extraitDeParfum',
    'extraitOil',
    'oil',
    'waterMist',
    'ipmSpray'
);


--
-- TOC entry 889 (class 1247 OID 16664)
-- Name: SecurityAuditAction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SecurityAuditAction" AS ENUM (
    'LOGIN_SUCCESS',
    'LOGIN_FAILED',
    'LOGOUT',
    'PASSWORD_CHANGE',
    'PROFILE_UPDATE',
    'ADMIN_ACCESS',
    'DATA_ACCESS',
    'DATA_MODIFICATION',
    'DATA_DELETION',
    'SUSPICIOUS_ACTIVITY',
    'RATE_LIMIT_EXCEEDED',
    'INVALID_TOKEN',
    'UNAUTHORIZED_ACCESS',
    'CSRF_VIOLATION',
    'SQL_INJECTION_ATTEMPT',
    'XSS_ATTEMPT',
    'FILE_UPLOAD',
    'API_ACCESS',
    'SYSTEM_ERROR',
    'SECURITY_SCAN'
);


--
-- TOC entry 892 (class 1247 OID 16706)
-- Name: SecurityAuditSeverity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SecurityAuditSeverity" AS ENUM (
    'low',
    'info',
    'warning',
    'error',
    'critical'
);


--
-- TOC entry 895 (class 1247 OID 16718)
-- Name: SubscriptionStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SubscriptionStatus" AS ENUM (
    'free',
    'paid',
    'cancelled'
);


--
-- TOC entry 898 (class 1247 OID 16726)
-- Name: TradePreference; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TradePreference" AS ENUM (
    'cash',
    'trade',
    'both'
);


--
-- TOC entry 901 (class 1247 OID 16734)
-- Name: UserRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."UserRole" AS ENUM (
    'user',
    'admin',
    'editor'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 219 (class 1259 OID 16741)
-- Name: MigrationState; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MigrationState" (
    id text NOT NULL,
    "tableName" text NOT NULL,
    "lastMigratedAt" timestamp(3) without time zone NOT NULL,
    "recordCount" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 220 (class 1259 OID 16754)
-- Name: PendingSubmission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PendingSubmission" (
    id text NOT NULL,
    "submissionType" public."PendingSubmissionType" NOT NULL,
    "submittedBy" text,
    status public."PendingSubmissionStatus" DEFAULT 'pending'::public."PendingSubmissionStatus" NOT NULL,
    "submissionData" jsonb NOT NULL,
    "adminNotes" text,
    "reviewedBy" text,
    "reviewedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 221 (class 1259 OID 16767)
-- Name: Perfume; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Perfume" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    image text,
    "perfumeHouseId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    slug text NOT NULL
);


--
-- TOC entry 222 (class 1259 OID 16778)
-- Name: PerfumeHouse; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PerfumeHouse" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    image text,
    website text,
    country text,
    founded text,
    email text,
    phone text,
    address text,
    type public."HouseType" DEFAULT 'indie'::public."HouseType" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    slug text NOT NULL
);


--
-- TOC entry 223 (class 1259 OID 16791)
-- Name: PerfumeNoteRelation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PerfumeNoteRelation" (
    id text NOT NULL,
    "perfumeId" text NOT NULL,
    "noteId" text NOT NULL,
    "noteType" public."PerfumeNoteType" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 224 (class 1259 OID 16804)
-- Name: PerfumeNotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PerfumeNotes" (
    id text NOT NULL,
    name text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "perfumeCloseId" text,
    "perfumeHeartId" text,
    "perfumeOpenId" text
);


--
-- TOC entry 225 (class 1259 OID 16815)
-- Name: ScentProfile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ScentProfile" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "noteWeights" jsonb NOT NULL,
    "avoidNoteIds" jsonb NOT NULL,
    "preferredPriceRange" jsonb,
    "seasonHint" text,
    "browsingStyle" text,
    "lastQuizAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 226 (class 1259 OID 16828)
-- Name: SecurityAuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SecurityAuditLog" (
    id text NOT NULL,
    "userId" text,
    action public."SecurityAuditAction" NOT NULL,
    severity public."SecurityAuditSeverity" DEFAULT 'info'::public."SecurityAuditSeverity" NOT NULL,
    resource text,
    "resourceId" text,
    "ipAddress" text,
    "userAgent" text,
    details jsonb,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 227 (class 1259 OID 16839)
-- Name: TraderContactMessage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TraderContactMessage" (
    id text NOT NULL,
    "senderId" text NOT NULL,
    "recipientId" text NOT NULL,
    subject text,
    message text NOT NULL,
    read boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 228 (class 1259 OID 16852)
-- Name: TraderFeedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TraderFeedback" (
    id text NOT NULL,
    "traderId" text NOT NULL,
    "reviewerId" text NOT NULL,
    rating integer NOT NULL,
    comment text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 229 (class 1259 OID 16864)
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    "firstName" text,
    "lastName" text,
    username text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    role public."UserRole" DEFAULT 'user'::public."UserRole" NOT NULL,
    "isEarlyAdopter" boolean DEFAULT false NOT NULL,
    "subscriptionId" text,
    "subscriptionStartDate" timestamp(3) without time zone,
    "subscriptionStatus" public."SubscriptionStatus" DEFAULT 'free'::public."SubscriptionStatus" NOT NULL
);


--
-- TOC entry 230 (class 1259 OID 16881)
-- Name: UserAlert; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserAlert" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "perfumeId" text NOT NULL,
    "alertType" public."AlertType" NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    "isRead" boolean DEFAULT false NOT NULL,
    "isDismissed" boolean DEFAULT false NOT NULL,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "readAt" timestamp(3) without time zone,
    "dismissedAt" timestamp(3) without time zone
);


--
-- TOC entry 231 (class 1259 OID 16898)
-- Name: UserAlertPreferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserAlertPreferences" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "wishlistAlertsEnabled" boolean DEFAULT true NOT NULL,
    "decantAlertsEnabled" boolean DEFAULT true NOT NULL,
    "emailWishlistAlerts" boolean DEFAULT false NOT NULL,
    "emailDecantAlerts" boolean DEFAULT false NOT NULL,
    "maxAlerts" integer DEFAULT 10 NOT NULL
);


--
-- TOC entry 232 (class 1259 OID 16915)
-- Name: UserPerfume; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserPerfume" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "perfumeId" text NOT NULL,
    amount text DEFAULT '0'::text NOT NULL,
    available text DEFAULT '0'::text NOT NULL,
    price text,
    "placeOfPurchase" text,
    "tradePrice" text,
    "tradePreference" public."TradePreference" DEFAULT 'cash'::public."TradePreference" NOT NULL,
    "tradeOnly" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    type public."PerfumeType" DEFAULT 'eauDeParfum'::public."PerfumeType" NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 233 (class 1259 OID 16937)
-- Name: UserPerfumeComment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserPerfumeComment" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "perfumeId" text NOT NULL,
    "userPerfumeId" text NOT NULL,
    comment text NOT NULL,
    "isPublic" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 234 (class 1259 OID 16952)
-- Name: UserPerfumeRating; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserPerfumeRating" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "perfumeId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    gender integer,
    longevity integer,
    overall integer,
    "priceValue" integer,
    sillage integer,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- TOC entry 235 (class 1259 OID 16963)
-- Name: UserPerfumeReview; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserPerfumeReview" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "perfumeId" text NOT NULL,
    review text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isApproved" boolean DEFAULT true NOT NULL
);


--
-- TOC entry 236 (class 1259 OID 16977)
-- Name: UserPerfumeWishlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserPerfumeWishlist" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "perfumeId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "isPublic" boolean DEFAULT false NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 237 (class 1259 OID 16991)
-- Name: WishlistNotification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WishlistNotification" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "perfumeId" text NOT NULL,
    "notifiedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- TOC entry 238 (class 1259 OID 17003)
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- TOC entry 5014 (class 2606 OID 17099)
-- Name: MigrationState MigrationState_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MigrationState"
    ADD CONSTRAINT "MigrationState_pkey" PRIMARY KEY (id);


--
-- TOC entry 5017 (class 2606 OID 17101)
-- Name: PendingSubmission PendingSubmission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PendingSubmission"
    ADD CONSTRAINT "PendingSubmission_pkey" PRIMARY KEY (id);


--
-- TOC entry 5028 (class 2606 OID 17103)
-- Name: PerfumeHouse PerfumeHouse_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PerfumeHouse"
    ADD CONSTRAINT "PerfumeHouse_pkey" PRIMARY KEY (id);


--
-- TOC entry 5036 (class 2606 OID 17105)
-- Name: PerfumeNoteRelation PerfumeNoteRelation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PerfumeNoteRelation"
    ADD CONSTRAINT "PerfumeNoteRelation_pkey" PRIMARY KEY (id);


--
-- TOC entry 5040 (class 2606 OID 17107)
-- Name: PerfumeNotes PerfumeNotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PerfumeNotes"
    ADD CONSTRAINT "PerfumeNotes_pkey" PRIMARY KEY (id);


--
-- TOC entry 5021 (class 2606 OID 17109)
-- Name: Perfume Perfume_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Perfume"
    ADD CONSTRAINT "Perfume_pkey" PRIMARY KEY (id);


--
-- TOC entry 5042 (class 2606 OID 17111)
-- Name: ScentProfile ScentProfile_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ScentProfile"
    ADD CONSTRAINT "ScentProfile_pkey" PRIMARY KEY (id);


--
-- TOC entry 5046 (class 2606 OID 17113)
-- Name: SecurityAuditLog SecurityAuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SecurityAuditLog"
    ADD CONSTRAINT "SecurityAuditLog_pkey" PRIMARY KEY (id);


--
-- TOC entry 5048 (class 2606 OID 17115)
-- Name: TraderContactMessage TraderContactMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TraderContactMessage"
    ADD CONSTRAINT "TraderContactMessage_pkey" PRIMARY KEY (id);


--
-- TOC entry 5053 (class 2606 OID 17117)
-- Name: TraderFeedback TraderFeedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TraderFeedback"
    ADD CONSTRAINT "TraderFeedback_pkey" PRIMARY KEY (id);


--
-- TOC entry 5066 (class 2606 OID 17119)
-- Name: UserAlertPreferences UserAlertPreferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserAlertPreferences"
    ADD CONSTRAINT "UserAlertPreferences_pkey" PRIMARY KEY (id);


--
-- TOC entry 5062 (class 2606 OID 17121)
-- Name: UserAlert UserAlert_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserAlert"
    ADD CONSTRAINT "UserAlert_pkey" PRIMARY KEY (id);


--
-- TOC entry 5074 (class 2606 OID 17123)
-- Name: UserPerfumeComment UserPerfumeComment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPerfumeComment"
    ADD CONSTRAINT "UserPerfumeComment_pkey" PRIMARY KEY (id);


--
-- TOC entry 5076 (class 2606 OID 17125)
-- Name: UserPerfumeRating UserPerfumeRating_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPerfumeRating"
    ADD CONSTRAINT "UserPerfumeRating_pkey" PRIMARY KEY (id);


--
-- TOC entry 5080 (class 2606 OID 17127)
-- Name: UserPerfumeReview UserPerfumeReview_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPerfumeReview"
    ADD CONSTRAINT "UserPerfumeReview_pkey" PRIMARY KEY (id);


--
-- TOC entry 5082 (class 2606 OID 17129)
-- Name: UserPerfumeReview UserPerfumeReview_userId_perfumeId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPerfumeReview"
    ADD CONSTRAINT "UserPerfumeReview_userId_perfumeId_key" UNIQUE ("userId", "perfumeId");


--
-- TOC entry 5085 (class 2606 OID 17131)
-- Name: UserPerfumeWishlist UserPerfumeWishlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPerfumeWishlist"
    ADD CONSTRAINT "UserPerfumeWishlist_pkey" PRIMARY KEY (id);


--
-- TOC entry 5069 (class 2606 OID 17133)
-- Name: UserPerfume UserPerfume_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPerfume"
    ADD CONSTRAINT "UserPerfume_pkey" PRIMARY KEY (id);


--
-- TOC entry 5059 (class 2606 OID 17135)
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- TOC entry 5089 (class 2606 OID 17137)
-- Name: WishlistNotification WishlistNotification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WishlistNotification"
    ADD CONSTRAINT "WishlistNotification_pkey" PRIMARY KEY (id);


--
-- TOC entry 5092 (class 2606 OID 17139)
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- TOC entry 5015 (class 1259 OID 17140)
-- Name: MigrationState_tableName_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "MigrationState_tableName_key" ON public."MigrationState" USING btree ("tableName");


--
-- TOC entry 5018 (class 1259 OID 17141)
-- Name: PendingSubmission_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PendingSubmission_status_createdAt_idx" ON public."PendingSubmission" USING btree (status, "createdAt");


--
-- TOC entry 5019 (class 1259 OID 17142)
-- Name: PendingSubmission_submissionType_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PendingSubmission_submissionType_status_idx" ON public."PendingSubmission" USING btree ("submissionType", status);


--
-- TOC entry 5026 (class 1259 OID 17143)
-- Name: PerfumeHouse_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PerfumeHouse_name_key" ON public."PerfumeHouse" USING btree (name);


--
-- TOC entry 5029 (class 1259 OID 17144)
-- Name: PerfumeHouse_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PerfumeHouse_slug_key" ON public."PerfumeHouse" USING btree (slug);


--
-- TOC entry 5031 (class 1259 OID 17145)
-- Name: PerfumeNoteRelation_noteId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PerfumeNoteRelation_noteId_idx" ON public."PerfumeNoteRelation" USING btree ("noteId");


--
-- TOC entry 5032 (class 1259 OID 17146)
-- Name: PerfumeNoteRelation_noteType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PerfumeNoteRelation_noteType_idx" ON public."PerfumeNoteRelation" USING btree ("noteType");


--
-- TOC entry 5033 (class 1259 OID 17147)
-- Name: PerfumeNoteRelation_perfumeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PerfumeNoteRelation_perfumeId_idx" ON public."PerfumeNoteRelation" USING btree ("perfumeId");


--
-- TOC entry 5034 (class 1259 OID 17148)
-- Name: PerfumeNoteRelation_perfumeId_noteId_noteType_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PerfumeNoteRelation_perfumeId_noteId_noteType_key" ON public."PerfumeNoteRelation" USING btree ("perfumeId", "noteId", "noteType");


--
-- TOC entry 5038 (class 1259 OID 17149)
-- Name: PerfumeNotes_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PerfumeNotes_name_key" ON public."PerfumeNotes" USING btree (name);


--
-- TOC entry 5022 (class 1259 OID 17150)
-- Name: Perfume_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Perfume_slug_key" ON public."Perfume" USING btree (slug);


--
-- TOC entry 5043 (class 1259 OID 17151)
-- Name: ScentProfile_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ScentProfile_userId_idx" ON public."ScentProfile" USING btree ("userId");


--
-- TOC entry 5044 (class 1259 OID 17152)
-- Name: ScentProfile_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ScentProfile_userId_key" ON public."ScentProfile" USING btree ("userId");


--
-- TOC entry 5049 (class 1259 OID 17153)
-- Name: TraderContactMessage_recipientId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TraderContactMessage_recipientId_createdAt_idx" ON public."TraderContactMessage" USING btree ("recipientId", "createdAt");


--
-- TOC entry 5050 (class 1259 OID 17154)
-- Name: TraderContactMessage_senderId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TraderContactMessage_senderId_createdAt_idx" ON public."TraderContactMessage" USING btree ("senderId", "createdAt");


--
-- TOC entry 5051 (class 1259 OID 17155)
-- Name: TraderContactMessage_senderId_recipientId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TraderContactMessage_senderId_recipientId_createdAt_idx" ON public."TraderContactMessage" USING btree ("senderId", "recipientId", "createdAt");


--
-- TOC entry 5054 (class 1259 OID 17156)
-- Name: TraderFeedback_reviewerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TraderFeedback_reviewerId_idx" ON public."TraderFeedback" USING btree ("reviewerId");


--
-- TOC entry 5055 (class 1259 OID 17157)
-- Name: TraderFeedback_traderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TraderFeedback_traderId_idx" ON public."TraderFeedback" USING btree ("traderId");


--
-- TOC entry 5056 (class 1259 OID 17158)
-- Name: TraderFeedback_traderId_reviewerId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TraderFeedback_traderId_reviewerId_key" ON public."TraderFeedback" USING btree ("traderId", "reviewerId");


--
-- TOC entry 5067 (class 1259 OID 17159)
-- Name: UserAlertPreferences_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UserAlertPreferences_userId_key" ON public."UserAlertPreferences" USING btree ("userId");


--
-- TOC entry 5063 (class 1259 OID 17160)
-- Name: UserAlert_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserAlert_userId_createdAt_idx" ON public."UserAlert" USING btree ("userId", "createdAt");


--
-- TOC entry 5064 (class 1259 OID 17161)
-- Name: UserAlert_userId_isRead_isDismissed_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserAlert_userId_isRead_isDismissed_idx" ON public."UserAlert" USING btree ("userId", "isRead", "isDismissed");


--
-- TOC entry 5077 (class 1259 OID 17162)
-- Name: UserPerfumeRating_userId_perfumeId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UserPerfumeRating_userId_perfumeId_key" ON public."UserPerfumeRating" USING btree ("userId", "perfumeId");


--
-- TOC entry 5057 (class 1259 OID 17163)
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- TOC entry 5060 (class 1259 OID 17164)
-- Name: User_username_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_username_key" ON public."User" USING btree (username);


--
-- TOC entry 5090 (class 1259 OID 17165)
-- Name: WishlistNotification_userId_perfumeId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "WishlistNotification_userId_perfumeId_key" ON public."WishlistNotification" USING btree ("userId", "perfumeId");


--
-- TOC entry 5030 (class 1259 OID 17166)
-- Name: idx_house_type_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_house_type_name ON public."PerfumeHouse" USING btree (type, name);


--
-- TOC entry 5037 (class 1259 OID 17167)
-- Name: idx_note_relation_note_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_note_relation_note_type ON public."PerfumeNoteRelation" USING btree ("noteId", "noteType");


--
-- TOC entry 5023 (class 1259 OID 17168)
-- Name: idx_perfume_house_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_perfume_house_created ON public."Perfume" USING btree ("perfumeHouseId", "createdAt");


--
-- TOC entry 5024 (class 1259 OID 17169)
-- Name: idx_perfume_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_perfume_name ON public."Perfume" USING btree (name);


--
-- TOC entry 5025 (class 1259 OID 17170)
-- Name: idx_perfume_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_perfume_slug ON public."Perfume" USING btree (slug);


--
-- TOC entry 5078 (class 1259 OID 17171)
-- Name: idx_rating_perfume_overall; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rating_perfume_overall ON public."UserPerfumeRating" USING btree ("perfumeId", overall);


--
-- TOC entry 5083 (class 1259 OID 17172)
-- Name: idx_review_perfume_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_review_perfume_created ON public."UserPerfumeReview" USING btree ("perfumeId", "createdAt");


--
-- TOC entry 5070 (class 1259 OID 17173)
-- Name: idx_user_perfume_available; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_perfume_available ON public."UserPerfume" USING btree (available) WHERE (available <> '0'::text);


--
-- TOC entry 5071 (class 1259 OID 17174)
-- Name: idx_user_perfume_perfume_available; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_perfume_perfume_available ON public."UserPerfume" USING btree ("perfumeId", available);


--
-- TOC entry 5072 (class 1259 OID 17175)
-- Name: idx_user_perfume_user_available; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_perfume_user_available ON public."UserPerfume" USING btree ("userId", available);


--
-- TOC entry 5086 (class 1259 OID 17176)
-- Name: idx_wishlist_perfume; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wishlist_perfume ON public."UserPerfumeWishlist" USING btree ("perfumeId");


--
-- TOC entry 5087 (class 1259 OID 17177)
-- Name: idx_wishlist_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wishlist_user_created ON public."UserPerfumeWishlist" USING btree ("userId", "createdAt");


--
-- TOC entry 5093 (class 2606 OID 17178)
-- Name: PendingSubmission PendingSubmission_reviewedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PendingSubmission"
    ADD CONSTRAINT "PendingSubmission_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 5094 (class 2606 OID 17183)
-- Name: PendingSubmission PendingSubmission_submittedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PendingSubmission"
    ADD CONSTRAINT "PendingSubmission_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 5096 (class 2606 OID 17188)
-- Name: PerfumeNoteRelation PerfumeNoteRelation_noteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PerfumeNoteRelation"
    ADD CONSTRAINT "PerfumeNoteRelation_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES public."PerfumeNotes"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5097 (class 2606 OID 17193)
-- Name: PerfumeNoteRelation PerfumeNoteRelation_perfumeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PerfumeNoteRelation"
    ADD CONSTRAINT "PerfumeNoteRelation_perfumeId_fkey" FOREIGN KEY ("perfumeId") REFERENCES public."Perfume"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5095 (class 2606 OID 17198)
-- Name: Perfume Perfume_perfumeHouseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Perfume"
    ADD CONSTRAINT "Perfume_perfumeHouseId_fkey" FOREIGN KEY ("perfumeHouseId") REFERENCES public."PerfumeHouse"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 5098 (class 2606 OID 17203)
-- Name: ScentProfile ScentProfile_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ScentProfile"
    ADD CONSTRAINT "ScentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 5099 (class 2606 OID 17208)
-- Name: SecurityAuditLog SecurityAuditLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SecurityAuditLog"
    ADD CONSTRAINT "SecurityAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 5100 (class 2606 OID 17213)
-- Name: TraderContactMessage TraderContactMessage_recipientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TraderContactMessage"
    ADD CONSTRAINT "TraderContactMessage_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5101 (class 2606 OID 17218)
-- Name: TraderContactMessage TraderContactMessage_senderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TraderContactMessage"
    ADD CONSTRAINT "TraderContactMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5102 (class 2606 OID 17223)
-- Name: TraderFeedback TraderFeedback_reviewerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TraderFeedback"
    ADD CONSTRAINT "TraderFeedback_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5103 (class 2606 OID 17228)
-- Name: TraderFeedback TraderFeedback_traderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TraderFeedback"
    ADD CONSTRAINT "TraderFeedback_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5106 (class 2606 OID 17233)
-- Name: UserAlertPreferences UserAlertPreferences_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserAlertPreferences"
    ADD CONSTRAINT "UserAlertPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5104 (class 2606 OID 17238)
-- Name: UserAlert UserAlert_perfumeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserAlert"
    ADD CONSTRAINT "UserAlert_perfumeId_fkey" FOREIGN KEY ("perfumeId") REFERENCES public."Perfume"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5105 (class 2606 OID 17243)
-- Name: UserAlert UserAlert_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserAlert"
    ADD CONSTRAINT "UserAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5109 (class 2606 OID 17248)
-- Name: UserPerfumeComment UserPerfumeComment_perfumeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPerfumeComment"
    ADD CONSTRAINT "UserPerfumeComment_perfumeId_fkey" FOREIGN KEY ("perfumeId") REFERENCES public."Perfume"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5110 (class 2606 OID 17253)
-- Name: UserPerfumeComment UserPerfumeComment_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPerfumeComment"
    ADD CONSTRAINT "UserPerfumeComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5111 (class 2606 OID 17258)
-- Name: UserPerfumeComment UserPerfumeComment_userPerfumeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPerfumeComment"
    ADD CONSTRAINT "UserPerfumeComment_userPerfumeId_fkey" FOREIGN KEY ("userPerfumeId") REFERENCES public."UserPerfume"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5112 (class 2606 OID 17263)
-- Name: UserPerfumeRating UserPerfumeRating_perfumeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPerfumeRating"
    ADD CONSTRAINT "UserPerfumeRating_perfumeId_fkey" FOREIGN KEY ("perfumeId") REFERENCES public."Perfume"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5113 (class 2606 OID 17268)
-- Name: UserPerfumeRating UserPerfumeRating_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPerfumeRating"
    ADD CONSTRAINT "UserPerfumeRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5114 (class 2606 OID 17273)
-- Name: UserPerfumeReview UserPerfumeReview_perfumeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPerfumeReview"
    ADD CONSTRAINT "UserPerfumeReview_perfumeId_fkey" FOREIGN KEY ("perfumeId") REFERENCES public."Perfume"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5115 (class 2606 OID 17278)
-- Name: UserPerfumeReview UserPerfumeReview_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPerfumeReview"
    ADD CONSTRAINT "UserPerfumeReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5116 (class 2606 OID 17283)
-- Name: UserPerfumeWishlist UserPerfumeWishlist_perfumeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPerfumeWishlist"
    ADD CONSTRAINT "UserPerfumeWishlist_perfumeId_fkey" FOREIGN KEY ("perfumeId") REFERENCES public."Perfume"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5117 (class 2606 OID 17288)
-- Name: UserPerfumeWishlist UserPerfumeWishlist_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPerfumeWishlist"
    ADD CONSTRAINT "UserPerfumeWishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5107 (class 2606 OID 17293)
-- Name: UserPerfume UserPerfume_perfumeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPerfume"
    ADD CONSTRAINT "UserPerfume_perfumeId_fkey" FOREIGN KEY ("perfumeId") REFERENCES public."Perfume"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5108 (class 2606 OID 17298)
-- Name: UserPerfume UserPerfume_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPerfume"
    ADD CONSTRAINT "UserPerfume_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5118 (class 2606 OID 17303)
-- Name: WishlistNotification WishlistNotification_perfumeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WishlistNotification"
    ADD CONSTRAINT "WishlistNotification_perfumeId_fkey" FOREIGN KEY ("perfumeId") REFERENCES public."Perfume"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- TOC entry 5119 (class 2606 OID 17308)
-- Name: WishlistNotification WishlistNotification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WishlistNotification"
    ADD CONSTRAINT "WishlistNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


-- Completed on 2026-02-22 12:17:47

--
-- PostgreSQL database dump complete
--

\unrestrict NMLsfShxeH7gSVHJvfA6bD1EE1SKu3whtM1P6YV7CvWdvMKTgwhc1Sya2hBpJJ4

