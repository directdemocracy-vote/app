<?php
$timezone = new DateTimeZone('Europe/Zurich');
$offset = $timezone->getOffset(new DateTime);
print($offset);
?>
