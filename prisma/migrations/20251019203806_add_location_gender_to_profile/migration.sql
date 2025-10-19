-- AlterTable
ALTER TABLE `photo` ADD COLUMN `description` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `profile` ADD COLUMN `avatar_key` VARCHAR(191) NULL,
    ADD COLUMN `cover_photo_key` VARCHAR(191) NULL,
    ADD COLUMN `gender` VARCHAR(191) NULL,
    ADD COLUMN `location` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `desires` VARCHAR(191) NULL,
    ADD COLUMN `fetishes` VARCHAR(191) NULL,
    ADD COLUMN `interests` VARCHAR(191) NULL,
    ADD COLUMN `last_seen_at` DATETIME(3) NULL,
    ADD COLUMN `pimenta_balance` INTEGER NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `video` ADD COLUMN `description` VARCHAR(191) NULL;
