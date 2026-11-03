<?php
// Router for local preview with PHP's built-in server. It mimics the parts of
// .htaccess that matter for testing (blocked folders and the 404 page).
//   php -S 127.0.0.1:8080 tests/router.php
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');
$root = dirname(__DIR__);
// Send the same security headers as .htaccess so CSP problems show up in tests.
if (preg_match_all('/Header always set ([\w-]+) "([^"]+)"/', (string)file_get_contents($root . '/.htaccess'), $m, PREG_SET_ORDER)) {
    foreach ($m as $h) {
        header($h[1] . ': ' . $h[2]);
    }
}
$notFound = static function () use ($root) {
    http_response_code(404);
    header('Content-Type: text/html; charset=utf-8');
    readfile($root . '/404.html');
    return true;
};
if (preg_match('#^/(docs|scripts|tests|private|api/lib)(/|$)#i', $path)
    || preg_match('#(^|/)\.(?!well-known/)#', $path)
    || preg_match('#\.(md|env|example|py|cjs|mjs|ttf|log|sh|ini|lock)$#i', $path)) {
    return $notFound();
}
if ($path === '/api/enquiry.php') {
    require $root . '/api/enquiry.php';
    return true;
}
$file = realpath($root . $path);
if ($path === '/' || ($file && is_dir($file))) {
    $file = realpath(rtrim($root . $path, '/') . '/index.html');
}
if (!$file || strpos($file, realpath($root)) !== 0 || !is_file($file)) {
    return $notFound();
}
$types = [
    'html' => 'text/html; charset=utf-8', 'css' => 'text/css', 'js' => 'text/javascript', 'json' => 'application/json',
    'xml' => 'application/xml', 'txt' => 'text/plain; charset=utf-8', 'svg' => 'image/svg+xml', 'png' => 'image/png',
    'jpg' => 'image/jpeg', 'webp' => 'image/webp', 'avif' => 'image/avif', 'ico' => 'image/x-icon',
    'woff2' => 'font/woff2', 'webmanifest' => 'application/manifest+json',
];
$ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
header('Content-Length: ' . filesize($file));
readfile($file);
return true;
