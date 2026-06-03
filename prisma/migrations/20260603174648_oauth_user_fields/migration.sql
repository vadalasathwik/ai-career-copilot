-- AlterTable
ALTER TABLE "User" ADD COLUMN     "image" TEXT,
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'local',
ADD COLUMN     "providerId" TEXT,
ALTER COLUMN "password" DROP NOT NULL;
