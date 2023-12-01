<?php
$timeZone = new DateTimeZone('Europe/Zurich');
$offset = $timeZone->getOffset(new DateTime) / 3600;
print($offset);
?>
