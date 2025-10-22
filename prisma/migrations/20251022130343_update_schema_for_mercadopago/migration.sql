/*
  Warnings:

  - You are about to drop the column `subscriptionPlanId` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[mercadopagoPaymentId]` on the table `transactions` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `users` DROP FOREIGN KEY `users_subscriptionPlanId_fkey`;

-- DropIndex
DROP INDEX `users_subscriptionPlanId_fkey` ON `users`;

-- AlterTable
ALTER TABLE `transactions` ADD COLUMN `mercadopagoPaymentId` VARCHAR(191) NULL,
    MODIFY `pagbankChargeId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `users` DROP COLUMN `subscriptionPlanId`;

-- CreateTable
CREATE TABLE `subscriptions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `planId` INTEGER NOT NULL,
    `mercadopagoSubscriptionId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `subscriptions_userId_key`(`userId`),
    UNIQUE INDEX `subscriptions_mercadopagoSubscriptionId_key`(`mercadopagoSubscriptionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `transactions_mercadopagoPaymentId_key` ON `transactions`(`mercadopagoPaymentId`);

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `subscription_plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
