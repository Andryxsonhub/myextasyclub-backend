/*
  Warnings:

  - You are about to drop the column `author_id` on the `photos` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `photos` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `pimenta_packages` table. All the data in the column will be lost.
  - You are about to drop the column `pimentaAmount` on the `pimenta_packages` table. All the data in the column will be lost.
  - You are about to drop the column `priceInCents` on the `pimenta_packages` table. All the data in the column will be lost.
  - The primary key for the `transactions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `amount_in_cents` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `package_name` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `pagbank_charge_id` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `pimenta_amount` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `transactions` table. All the data in the column will be lost.
  - You are about to alter the column `id` on the `transactions` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - You are about to alter the column `package_id` on the `transactions` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - You are about to drop the column `date_of_birth` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `pimentaBalance` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `videos` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `user_id` to the `photos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `amount` to the `pimenta_packages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `price` to the `pimenta_packages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `amount` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `price_paid` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `photos` DROP FOREIGN KEY `photos_author_id_fkey`;

-- DropForeignKey
ALTER TABLE `transactions` DROP FOREIGN KEY `transactions_userId_fkey`;

-- DropForeignKey
ALTER TABLE `videos` DROP FOREIGN KEY `videos_author_id_fkey`;

-- DropIndex
DROP INDEX `photos_author_id_idx` ON `photos`;

-- DropIndex
DROP INDEX `transactions_pagbank_charge_id_key` ON `transactions`;

-- DropIndex
DROP INDEX `transactions_userId_fkey` ON `transactions`;

-- AlterTable
ALTER TABLE `photos` DROP COLUMN `author_id`,
    DROP COLUMN `description`,
    ADD COLUMN `user_id` INTEGER NOT NULL,
    MODIFY `url` VARCHAR(255) NOT NULL;

-- AlterTable
ALTER TABLE `pimenta_packages` DROP COLUMN `createdAt`,
    DROP COLUMN `pimentaAmount`,
    DROP COLUMN `priceInCents`,
    ADD COLUMN `amount` INTEGER NOT NULL,
    ADD COLUMN `description` VARCHAR(191) NULL,
    ADD COLUMN `price` DOUBLE NOT NULL;

-- AlterTable
ALTER TABLE `posts` ADD COLUMN `image_url` VARCHAR(191) NULL,
    ADD COLUMN `video_url` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `transactions` DROP PRIMARY KEY,
    DROP COLUMN `amount_in_cents`,
    DROP COLUMN `package_name`,
    DROP COLUMN `pagbank_charge_id`,
    DROP COLUMN `pimenta_amount`,
    DROP COLUMN `userId`,
    ADD COLUMN `amount` INTEGER NOT NULL,
    ADD COLUMN `price_paid` DOUBLE NOT NULL,
    ADD COLUMN `user_id` INTEGER NOT NULL,
    MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `package_id` INTEGER NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `users` DROP COLUMN `date_of_birth`,
    DROP COLUMN `pimentaBalance`,
    ADD COLUMN `pimenta_balance` INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE `videos`;

-- CreateTable
CREATE TABLE `lives` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `room_name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `lives_user_id_key`(`user_id`),
    UNIQUE INDEX `lives_room_name_key`(`room_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `photos` ADD CONSTRAINT `photos_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_package_id_fkey` FOREIGN KEY (`package_id`) REFERENCES `pimenta_packages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lives` ADD CONSTRAINT `lives_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
