/*
  Warnings:

  - You are about to drop the column `createdAt` on the `pimenta_packages` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `profile_views` table. All the data in the column will be lost.
  - The primary key for the `subscription_plans` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `durationInDays` on the `subscription_plans` table. All the data in the column will be lost.
  - You are about to alter the column `id` on the `subscription_plans` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - You are about to drop the column `amount_in_cents` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `pagbank_charge_id` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `product_id` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `product_name` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `product_type` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the `photos` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `posts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `videos` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[pagbankChargeId]` on the table `transactions` will be added. If there are existing duplicate values, this will fail.
  - Made the column `viewer_id` on table `profile_views` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `amountInCents` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pagbankChargeId` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productId` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productName` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productType` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `photos` DROP FOREIGN KEY `photos_author_id_fkey`;

-- DropForeignKey
ALTER TABLE `posts` DROP FOREIGN KEY `posts_author_id_fkey`;

-- DropForeignKey
ALTER TABLE `profile_views` DROP FOREIGN KEY `profile_views_viewed_profile_id_fkey`;

-- DropForeignKey
ALTER TABLE `profile_views` DROP FOREIGN KEY `profile_views_viewer_id_fkey`;

-- DropForeignKey
ALTER TABLE `transactions` DROP FOREIGN KEY `transactions_userId_fkey`;

-- DropForeignKey
ALTER TABLE `users` DROP FOREIGN KEY `users_subscriptionPlanId_fkey`;

-- DropForeignKey
ALTER TABLE `videos` DROP FOREIGN KEY `videos_author_id_fkey`;

-- DropIndex
DROP INDEX `profile_views_viewed_profile_id_fkey` ON `profile_views`;

-- DropIndex
DROP INDEX `profile_views_viewer_id_fkey` ON `profile_views`;

-- DropIndex
DROP INDEX `transactions_pagbank_charge_id_key` ON `transactions`;

-- DropIndex
DROP INDEX `transactions_userId_fkey` ON `transactions`;

-- AlterTable
ALTER TABLE `pimenta_packages` DROP COLUMN `createdAt`;

-- AlterTable
ALTER TABLE `profile_views` DROP COLUMN `created_at`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `viewer_id` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `subscription_plans` DROP PRIMARY KEY,
    DROP COLUMN `durationInDays`,
    MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `transactions` DROP COLUMN `amount_in_cents`,
    DROP COLUMN `created_at`,
    DROP COLUMN `pagbank_charge_id`,
    DROP COLUMN `product_id`,
    DROP COLUMN `product_name`,
    DROP COLUMN `product_type`,
    ADD COLUMN `amountInCents` INTEGER NOT NULL,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `pagbankChargeId` VARCHAR(191) NOT NULL,
    ADD COLUMN `productId` INTEGER NOT NULL,
    ADD COLUMN `productName` VARCHAR(191) NOT NULL,
    ADD COLUMN `productType` VARCHAR(191) NOT NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- DropTable
DROP TABLE `photos`;

-- DropTable
DROP TABLE `posts`;

-- DropTable
DROP TABLE `users`;

-- DropTable
DROP TABLE `videos`;

-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `password` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `subscriptionPlanId` INTEGER NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Profile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bio` TEXT NULL,
    `cover_photo_url` VARCHAR(191) NULL,
    `avatar_url` VARCHAR(191) NULL,
    `userId` INTEGER NOT NULL,

    UNIQUE INDEX `Profile_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Photo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `url` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `author_id` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Video` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `url` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `author_id` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Post` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `author_id` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LiveStream` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `roomName` VARCHAR(191) NOT NULL,
    `hostId` INTEGER NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `LiveStream_roomName_key`(`roomName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Like` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `likerId` INTEGER NOT NULL,
    `likedUserId` INTEGER NOT NULL,

    UNIQUE INDEX `Like_likerId_likedUserId_key`(`likerId`, `likedUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Follow` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `followerId` INTEGER NOT NULL,
    `followingId` INTEGER NOT NULL,

    UNIQUE INDEX `Follow_followerId_followingId_key`(`followerId`, `followingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `transactions_pagbankChargeId_key` ON `transactions`(`pagbankChargeId`);

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_subscriptionPlanId_fkey` FOREIGN KEY (`subscriptionPlanId`) REFERENCES `subscription_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Profile` ADD CONSTRAINT `Profile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Photo` ADD CONSTRAINT `Photo_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Video` ADD CONSTRAINT `Video_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Post` ADD CONSTRAINT `Post_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LiveStream` ADD CONSTRAINT `LiveStream_hostId_fkey` FOREIGN KEY (`hostId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `profile_views` ADD CONSTRAINT `profile_views_viewer_id_fkey` FOREIGN KEY (`viewer_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `profile_views` ADD CONSTRAINT `profile_views_viewed_profile_id_fkey` FOREIGN KEY (`viewed_profile_id`) REFERENCES `Profile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Like` ADD CONSTRAINT `Like_likerId_fkey` FOREIGN KEY (`likerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Like` ADD CONSTRAINT `Like_likedUserId_fkey` FOREIGN KEY (`likedUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Follow` ADD CONSTRAINT `Follow_followerId_fkey` FOREIGN KEY (`followerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Follow` ADD CONSTRAINT `Follow_followingId_fkey` FOREIGN KEY (`followingId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
