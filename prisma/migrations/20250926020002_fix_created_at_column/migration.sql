/*
  Warnings:

  - You are about to drop the column `authorId` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `posts` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `desires` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `favorited_suggestions` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `fetishes` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `interests` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `lastSeenAt` on the `users` table. All the data in the column will be lost.
  - Added the required column `author_id` to the `posts` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `posts` DROP FOREIGN KEY `posts_authorId_fkey`;

-- DropIndex
DROP INDEX `posts_authorId_fkey` ON `posts`;

-- DropIndex
DROP INDEX `users_name_key` ON `users`;

-- AlterTable
ALTER TABLE `posts` DROP COLUMN `authorId`,
    DROP COLUMN `createdAt`,
    DROP COLUMN `updatedAt`,
    ADD COLUMN `author_id` INTEGER NOT NULL,
    ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `users` DROP COLUMN `createdAt`,
    DROP COLUMN `desires`,
    DROP COLUMN `favorited_suggestions`,
    DROP COLUMN `fetishes`,
    DROP COLUMN `interests`,
    DROP COLUMN `lastSeenAt`,
    ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `last_seen_at` DATETIME(3) NULL,
    MODIFY `profile_picture_url` VARCHAR(255) NULL;

-- AddForeignKey
ALTER TABLE `posts` ADD CONSTRAINT `posts_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
