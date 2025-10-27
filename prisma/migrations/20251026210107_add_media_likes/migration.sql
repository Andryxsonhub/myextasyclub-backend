/*
  Warnings:

  - A unique constraint covering the columns `[likerId,likedPhotoId]` on the table `likes` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[likerId,likedVideoId]` on the table `likes` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `likes` ADD COLUMN `likedPhotoId` INTEGER NULL,
    ADD COLUMN `likedVideoId` INTEGER NULL,
    MODIFY `likedUserId` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `likes_likerId_likedPhotoId_key` ON `likes`(`likerId`, `likedPhotoId`);

-- CreateIndex
CREATE UNIQUE INDEX `likes_likerId_likedVideoId_key` ON `likes`(`likerId`, `likedVideoId`);

-- AddForeignKey
ALTER TABLE `likes` ADD CONSTRAINT `likes_likedPhotoId_fkey` FOREIGN KEY (`likedPhotoId`) REFERENCES `photos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `likes` ADD CONSTRAINT `likes_likedVideoId_fkey` FOREIGN KEY (`likedVideoId`) REFERENCES `videos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
