/*
  Warnings:

  - You are about to drop the column `package_id` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `package_name` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `pimenta_amount` on the `transactions` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[username]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `product_id` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `product_name` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `product_type` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `transactions` DROP COLUMN `package_id`,
    DROP COLUMN `package_name`,
    DROP COLUMN `pimenta_amount`,
    ADD COLUMN `product_id` VARCHAR(191) NOT NULL,
    ADD COLUMN `product_name` VARCHAR(191) NOT NULL,
    ADD COLUMN `product_type` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `cover_photo_url` VARCHAR(255) NULL,
    ADD COLUMN `subscriptionPlanId` VARCHAR(191) NULL,
    ADD COLUMN `subscription_expires_at` DATETIME(3) NULL,
    ADD COLUMN `username` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `subscription_plans` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `priceInCents` INTEGER NOT NULL,
    `durationInDays` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `users_username_key` ON `users`(`username`);

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_subscriptionPlanId_fkey` FOREIGN KEY (`subscriptionPlanId`) REFERENCES `subscription_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
