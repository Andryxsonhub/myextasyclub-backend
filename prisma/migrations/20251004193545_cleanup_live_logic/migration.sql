/*
  Warnings:

  - You are about to drop the column `user_id` on the `photos` table. All the data in the column will be lost.
  - You are about to alter the column `url` on the `photos` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to drop the column `amount` on the `pimenta_packages` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `pimenta_packages` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `pimenta_packages` table. All the data in the column will be lost.
  - You are about to drop the column `image_url` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `video_url` on the `posts` table. All the data in the column will be lost.
  - The primary key for the `transactions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `amount` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `price_paid` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `thumbnail_url` on the `videos` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `videos` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `videos` table. All the data in the column will be lost.
  - You are about to alter the column `url` on the `videos` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.
  - You are about to drop the `lives` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[pagbank_charge_id]` on the table `transactions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `author_id` to the `photos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pimentaAmount` to the `pimenta_packages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `priceInCents` to the `pimenta_packages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `amount_in_cents` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `package_name` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pimenta_amount` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `author_id` to the `videos` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `lives` DROP FOREIGN KEY `lives_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `photos` DROP FOREIGN KEY `photos_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `transactions` DROP FOREIGN KEY `transactions_package_id_fkey`;

-- DropForeignKey
ALTER TABLE `transactions` DROP FOREIGN KEY `transactions_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `videos` DROP FOREIGN KEY `videos_user_id_fkey`;

-- DropIndex
DROP INDEX `photos_user_id_fkey` ON `photos`;

-- DropIndex
DROP INDEX `transactions_package_id_fkey` ON `transactions`;

-- DropIndex
DROP INDEX `transactions_user_id_fkey` ON `transactions`;

-- DropIndex
DROP INDEX `videos_user_id_fkey` ON `videos`;

-- AlterTable
ALTER TABLE `photos` DROP COLUMN `user_id`,
    ADD COLUMN `author_id` INTEGER NOT NULL,
    ADD COLUMN `description` TEXT NULL,
    MODIFY `url` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `pimenta_packages` DROP COLUMN `amount`,
    DROP COLUMN `description`,
    DROP COLUMN `price`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `pimentaAmount` INTEGER NOT NULL,
    ADD COLUMN `priceInCents` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `posts` DROP COLUMN `image_url`,
    DROP COLUMN `video_url`;

-- AlterTable
ALTER TABLE `transactions` DROP PRIMARY KEY,
    DROP COLUMN `amount`,
    DROP COLUMN `price_paid`,
    DROP COLUMN `user_id`,
    ADD COLUMN `amount_in_cents` INTEGER NOT NULL,
    ADD COLUMN `package_name` VARCHAR(191) NOT NULL,
    ADD COLUMN `pagbank_charge_id` VARCHAR(191) NULL,
    ADD COLUMN `pimenta_amount` INTEGER NOT NULL,
    ADD COLUMN `userId` INTEGER NOT NULL,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `package_id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `users` ADD COLUMN `date_of_birth` DATE NULL,
    ADD COLUMN `isLive` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `videos` DROP COLUMN `thumbnail_url`,
    DROP COLUMN `title`,
    DROP COLUMN `user_id`,
    ADD COLUMN `author_id` INTEGER NOT NULL,
    MODIFY `url` VARCHAR(191) NOT NULL;

-- DropTable
DROP TABLE `lives`;

-- CreateIndex
CREATE INDEX `photos_author_id_idx` ON `photos`(`author_id`);

-- CreateIndex
CREATE UNIQUE INDEX `transactions_pagbank_charge_id_key` ON `transactions`(`pagbank_charge_id`);

-- CreateIndex
CREATE INDEX `videos_author_id_idx` ON `videos`(`author_id`);

-- AddForeignKey
ALTER TABLE `photos` ADD CONSTRAINT `photos_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `videos` ADD CONSTRAINT `videos_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
