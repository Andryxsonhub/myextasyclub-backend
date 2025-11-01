-- AlterTable
ALTER TABLE `users` ADD COLUMN `data_expiracao_plano` DATETIME(3) NULL,
    ADD COLUMN `status` VARCHAR(191) NULL DEFAULT 'ativo',
    ADD COLUMN `tipo_plano` VARCHAR(191) NULL DEFAULT 'gratuito',
    MODIFY `pimenta_balance` INTEGER NULL DEFAULT 0;
