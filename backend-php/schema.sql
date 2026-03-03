-- Database Schema for Cricket Live Scoring Backend

CREATE TABLE IF NOT EXISTS `matches` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `match_id` VARCHAR(50) NOT NULL UNIQUE,
    `last_runs` INT DEFAULT 0,
    `last_wickets` INT DEFAULT 0,
    `last_over` DECIMAL(4,1) DEFAULT 0.0,
    `innings` INT DEFAULT 1,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `events_log` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `match_id` VARCHAR(50) NOT NULL,
    `event_type` ENUM('WICKET', 'FIFTY', 'CENTURY', 'INNINGS_BREAK') NOT NULL,
    `event_data` TEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (`match_id`),
    INDEX (`event_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
