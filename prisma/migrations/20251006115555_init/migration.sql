-- AlterTable
ALTER TABLE `users` ADD COLUMN `favoritedsuggestions` LONGTEXT NULL,
    ADD COLUMN `updated_at` DATETIME(3) NULL;
