-- AlterTable
ALTER TABLE `users` ADD COLUMN `pimentaBalance` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `pimenta_packages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `priceInCents` INTEGER NOT NULL,
    `pimentaAmount` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
