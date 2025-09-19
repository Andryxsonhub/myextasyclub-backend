/*
  Warnings:

  - You are about to drop the column `author_id` on the `post` table. All the data in the column will be lost.
  - You are about to drop the column `media_url` on the `post` table. All the data in the column will be lost.
  - You are about to drop the column `certification_level` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `last_seen_at` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `user` table. All the data in the column will be lost.
  - Added the required column `authorId` to the `Post` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `post` DROP FOREIGN KEY `Post_author_id_fkey`;

-- DropIndex
DROP INDEX `Post_author_id_fkey` ON `post`;

-- AlterTable
ALTER TABLE `post` DROP COLUMN `author_id`,
    DROP COLUMN `media_url`,
    ADD COLUMN `authorId` INTEGER NOT NULL,
    MODIFY `content` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `user` DROP COLUMN `certification_level`,
    DROP COLUMN `last_seen_at`,
    DROP COLUMN `updatedAt`,
    ADD COLUMN `lastSeenAt` DATETIME(3) NULL,
    MODIFY `bio` TEXT NULL;

-- AddForeignKey
ALTER TABLE `Post` ADD CONSTRAINT `Post_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
