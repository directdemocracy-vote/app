<?php
$timezone = new DateTimeZone('Europe/Zurich');
$offset = $timezone->getOffset();
print($offset);
?>
