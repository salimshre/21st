<?php
declare(strict_types=1);

$root = __DIR__;
$out = $root . DIRECTORY_SEPARATOR . 'public';

function rrmdir(string $dir): void
{
    if (!is_dir($dir)) {
        return;
    }

    $items = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );

    foreach ($items as $item) {
        $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
    }

    rmdir($dir);
}

function copy_path(string $source, string $dest): void
{
    if (!file_exists($source)) {
        return;
    }

    if (is_file($source)) {
        $parent = dirname($dest);
        if (!is_dir($parent)) {
            mkdir($parent, 0777, true);
        }
        copy($source, $dest);
        return;
    }

    $items = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($source, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );

    foreach ($items as $item) {
        $target = $dest . DIRECTORY_SEPARATOR . $items->getSubPathName();
        if ($item->isDir()) {
            if (!is_dir($target)) {
                mkdir($target, 0777, true);
            }
        } else {
            $parent = dirname($target);
            if (!is_dir($parent)) {
                mkdir($parent, 0777, true);
            }
            copy($item->getPathname(), $target);
        }
    }
}

rrmdir($out);
mkdir($out, 0777, true);

ob_start();
require $root . DIRECTORY_SEPARATOR . 'index.php';
$html = ob_get_clean();

$html = preg_replace_callback(
    '/href="preview\.php\?file=([^"]+)"/',
    static function (array $matches): string {
        $file = rawurldecode($matches[1]);
        return 'href="' . htmlspecialchars($file, ENT_QUOTES) . '"';
    },
    $html
);

$html = preg_replace_callback(
    "/window\.open\('preview\.php\?file=([^']+)', '_blank'\)/",
    static function (array $matches): string {
        $file = rawurldecode($matches[1]);
        return "window.open('" . addslashes($file) . "', '_blank')";
    },
    $html
);

file_put_contents($out . DIRECTORY_SEPARATOR . 'index.html', $html);
file_put_contents($out . DIRECTORY_SEPARATOR . '.nojekyll', '');

copy_path($root . DIRECTORY_SEPARATOR . 'assets', $out . DIRECTORY_SEPARATOR . 'assets');
copy_path($root . DIRECTORY_SEPARATOR . 'journal', $out . DIRECTORY_SEPARATOR . 'journal');

foreach (['README.md', 'improved_routine.md', 'FILE_STRUCTURE.md', 'readme.txt'] as $file) {
    copy_path($root . DIRECTORY_SEPARATOR . $file, $out . DIRECTORY_SEPARATOR . $file);
}

echo "Static site written to public/\n";
