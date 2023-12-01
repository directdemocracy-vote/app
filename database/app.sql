SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";

CREATE TABLE `participation` (
  `id` int(11) NOT NULL,
  `version` int(11) NOT NULL,
  `key` blob NOT NULL,
  `signature` blob NOT NULL,
  `published` datetime NOT NULL,
  `appKey` blob NOT NULL,
  `appSignature` blob NOT NULL,
  `citizen` blob NOT NULL,
  `referendum` blob NOT NULL,
  `encryptedVote` blob NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `participation`
  ADD PRIMARY KEY (`id`);
  ADD KEY `referendum` (`referendum`);

ALTER TABLE `participation`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

COMMIT;
