<?php
$timezone = new DateTimeZone('Europe/Zurich');
$offset = $timezone->getOffset(new DateTime) / 3600;
print($offset);
?>
