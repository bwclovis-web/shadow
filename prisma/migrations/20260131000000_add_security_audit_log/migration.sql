-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "SecurityAuditAction" AS ENUM (
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
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "SecurityAuditSeverity" AS ENUM ('low', 'info', 'warning', 'error', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SecurityAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" "SecurityAuditAction" NOT NULL,
    "severity" "SecurityAuditSeverity" NOT NULL DEFAULT 'info',
    "resource" TEXT,
    "resourceId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "details" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityAuditLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey (only if table was created)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'SecurityAuditLog') THEN
        ALTER TABLE "SecurityAuditLog" ADD CONSTRAINT "SecurityAuditLog_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
