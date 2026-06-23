<?php
$new = isset($_GET['new']) && $_GET['new'] === '1';
if ($new) {
    $dir = realpath(__DIR__ . '/../../directdemocracy');
    print("<pre>$ cd ../../directdemocracy && git pull\n");
    print(shell_exec("git -C " . escapeshellarg($dir) . " pull"));
} else {
    print("<pre>$ git pull\n");
    print(shell_exec("git pull"));
}
print("\n</pre>");
?>
