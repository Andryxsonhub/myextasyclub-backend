-- CreateTable
CREATE TABLE `profile_views` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `viewed_profile_id` INTEGER NOT NULL,
    `viewer_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `profile_views` ADD CONSTRAINT `profile_views_viewed_profile_id_fkey` FOREIGN KEY (`viewed_profile_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `profile_views` ADD CONSTRAINT `profile_views_viewer_id_fkey` FOREIGN KEY (`viewer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
