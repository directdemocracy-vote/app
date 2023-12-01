<?php
$offset = new DateTimeZone('Europe/Zurich')->getOffset(new DateTime) / 3600;
print($offset);
?>
