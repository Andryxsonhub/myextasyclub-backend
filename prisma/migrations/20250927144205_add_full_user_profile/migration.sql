/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `users` ADD COLUMN `desires` JSON NULL,
    ADD COLUMN `fetishes` JSON NULL,
    ADD COLUMN `interests` JSON NULL,
    ADD COLUMN `profile_type` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `users_name_key` ON `users`(`name`);
