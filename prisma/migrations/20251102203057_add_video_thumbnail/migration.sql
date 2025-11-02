-- AlterTable
ALTER TABLE `comments` ADD COLUMN `videoId` INTEGER NULL;

-- AlterTable
ALTER TABLE `videos` ADD COLUMN `thumbnail_url` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_videoId_fkey` FOREIGN KEY (`videoId`) REFERENCES `videos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
