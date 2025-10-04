-- CreateTable
CREATE TABLE `videos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `url` VARCHAR(255) NOT NULL,
    `thumbnail_url` VARCHAR(255) NULL,
    `title` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `user_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `videos` ADD CONSTRAINT `videos_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
