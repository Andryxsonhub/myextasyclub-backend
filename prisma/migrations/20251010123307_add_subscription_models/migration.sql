/*
  Warnings:

  - You are about to drop the column `package_id` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `package_name` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `pimenta_amount` on the `transactions` table. All the data in the column will be lost.
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
ALTER TABLE `users` ADD COLUMN `subscriptionPlanId` VARCHAR(191) NULL,
    ADD COLUMN `subscription_expires_at` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `subscription_plans` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `priceInCents` INTEGER NOT NULL,
    `durationInDays` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_subscriptionPlanId_fkey` FOREIGN KEY (`subscriptionPlanId`) REFERENCES `subscription_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
