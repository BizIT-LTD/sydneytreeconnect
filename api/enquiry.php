<?php
/**
 * Sydney Tree Connect enquiry handler.
 *
 * Receives the enquiry form, validates it, and emails it (with any photos as
 * attachments) to the operator's enquiry inbox over authenticated SMTP using
 * PHPMailer. Photos are never written to the website; PHP's temporary upload
 * files are discarded at the end of the request.
 *
 * Configuration lives in a private env file OUTSIDE the web root. See
 * .env.example and README.md ("Form configuration").
 *
 * Responses:
 *   - fetch/JSON requests: {"ok":true} with HTTP 200 only after the SMTP
 *     server accepts the message; otherwise {"ok":false,"message":...,"errors":{...}}.
 *   - plain form posts (no JavaScript): 303 redirect to /thank-you.html on
 *     success, or a simple error page.
 */

declare(strict_types=1);

use PHPMailer\PHPMailer\Exception as MailException;
use PHPMailer\PHPMailer\PHPMailer;

const STC_CONSENT_TEXT = 'I agree that Sydney Tree Connect may share my enquiry details and photos with a tree contractor so they can contact me, assess the job and provide a quote. I have read the privacy notice.';
const STC_CONSENT_VERSION = '2026-11-04';
const STC_MAX_PHOTOS = 5;
const STC_MIN_FILL_SECONDS = 4;

const STC_SERVICES = [
    'tree-removal' => 'Tree removal',
    'tree-pruning' => 'Tree pruning or trimming',
    'stump-grinding' => 'Stump grinding',
    'not-sure' => 'Not sure',
];
const STC_AUTHORITY = [
    'owner' => 'Owner',
    'authorised-representative' => 'Authorised representative',
    'other-or-unsure' => 'Other or unsure (guidance only, does not authorise work)',
];
const STC_COUNCIL = [
    'obtained' => 'Approval obtained',
    'pending' => 'Application pending',
    'not-sure' => 'Not sure',
    'believe-exempt' => 'Believes exempt (needs verification)',
];
const STC_CONTACT = ['email' => 'Email', 'phone' => 'Phone'];
// Verified content type => attachment extension. SVG and anything else is refused.
const STC_IMAGE_TYPES = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
    'image/heic' => 'heic',
    'image/heif' => 'heif',
];

require_once __DIR__ . '/lib/PHPMailer/Exception.php';
require_once __DIR__ . '/lib/PHPMailer/PHPMailer.php';
require_once __DIR__ . '/lib/PHPMailer/SMTP.php';

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');

$wantsJson = stc_wants_json();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    stc_fail(405, 'This address only accepts enquiry form submissions.', [], $wantsJson);
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
$config = stc_load_config();
if ($config === null) {
    error_log('[stc-enquiry] Not configured: env file missing or ENQUIRY_ENABLED is not true.');
    stc_fail(503, 'Sorry, online enquiries are not available yet. Nothing has been sent.', [], $wantsJson);
}

// Reject cross-site posts. Browsers send Origin on POST; a mismatch is refused.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && !in_array(rtrim($origin, '/'), $config['allowed_origins'], true)) {
    error_log('[stc-enquiry] Rejected origin.');
    stc_fail(403, 'Sorry, this enquiry could not be accepted.', [], $wantsJson);
}

// Request larger than post_max_size: PHP drops the whole body.
$contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentLength > stc_ini_bytes((string)ini_get('post_max_size')) || ($contentLength > 0 && empty($_POST) && empty($_FILES))) {
    stc_fail(413, 'Your photos are too large to send. Please attach fewer or smaller photos.', ['photos' => 'Your photos are too large to send. Please attach fewer or smaller photos.'], $wantsJson);
}

// ---------------------------------------------------------------------------
// Spam checks and rate limiting
// ---------------------------------------------------------------------------
if (trim((string)($_POST['website'] ?? '')) !== '') {
    error_log('[stc-enquiry] Honeypot triggered.');
    stc_fail(400, 'Sorry, this enquiry could not be accepted.', [], $wantsJson);
}

$startedMs = (string)($_POST['form_started'] ?? '');
if ($startedMs !== '' && ctype_digit($startedMs)) {
    $elapsed = time() - intdiv((int)$startedMs, 1000);
    if ($elapsed >= 0 && $elapsed < STC_MIN_FILL_SECONDS) {
        error_log('[stc-enquiry] Submitted too quickly.');
        stc_fail(400, 'That was very quick. Please check your details and try again.', [], $wantsJson);
    }
}

$clientIp = (string)($_SERVER['REMOTE_ADDR'] ?? '');
$rate = stc_rate_limit($config, $clientIp);
if ($rate === 'limited') {
    header('Retry-After: 3600');
    stc_fail(429, 'Too many enquiries have been sent from your connection. Please try again later.', [], $wantsJson);
}
if ($rate === 'error') {
    error_log('[stc-enquiry] Rate limit storage unavailable.');
    stc_fail(503, 'Sorry, your enquiry could not be sent right now. Nothing has been sent. Please try again later.', [], $wantsJson);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
$errors = [];
$in = [
    'name' => stc_clean_line($_POST['name'] ?? ''),
    'email' => stc_clean_line($_POST['email'] ?? ''),
    'phone' => stc_clean_line($_POST['phone'] ?? ''),
    'contact_method' => stc_clean_line($_POST['contact_method'] ?? ''),
    'suburb' => stc_clean_line($_POST['suburb'] ?? ''),
    'postcode' => stc_clean_line($_POST['postcode'] ?? ''),
    'service' => stc_clean_line($_POST['service'] ?? ''),
    'description' => stc_clean_text($_POST['description'] ?? ''),
    'property_authority' => stc_clean_line($_POST['property_authority'] ?? ''),
    'council_status' => stc_clean_line($_POST['council_status'] ?? ''),
    'consent' => stc_clean_line($_POST['consent'] ?? ''),
];

if ($in['name'] === '') {
    $errors['name'] = 'Enter your name.';
} elseif (mb_strlen($in['name']) > 100) {
    $errors['name'] = 'Name must be 100 characters or fewer.';
}

$email = filter_var($in['email'], FILTER_VALIDATE_EMAIL);
if ($in['email'] === '') {
    $errors['email'] = 'Enter your email address.';
} elseif ($email === false || strlen($in['email']) > 254 || !PHPMailer::validateAddress($in['email'])) {
    $errors['email'] = 'Enter a valid email address, like name@example.com.';
}

$phoneDigits = preg_replace('/\D/', '', $in['phone']);
if ($in['phone'] !== '' && (!preg_match('/^[0-9+()\-\s]{8,20}$/', $in['phone']) || strlen($phoneDigits) < 8 || strlen($phoneDigits) > 15)) {
    $errors['phone'] = 'Enter a valid phone number, like 0400 000 000.';
}

if (!isset(STC_CONTACT[$in['contact_method']])) {
    $errors['contact_method'] = 'Choose email or phone.';
} elseif ($in['contact_method'] === 'phone' && $in['phone'] === '' && !isset($errors['phone'])) {
    $errors['phone'] = 'Enter a phone number, or choose email as your preferred contact method.';
}

if ($in['suburb'] === '') {
    $errors['suburb'] = 'Enter your suburb.';
} elseif (mb_strlen($in['suburb']) > 60) {
    $errors['suburb'] = 'Suburb must be 60 characters or fewer.';
}

if ($in['postcode'] === '') {
    $errors['postcode'] = 'Enter your postcode.';
} elseif (!preg_match('/^2\d{3}$/', $in['postcode'])) {
    $errors['postcode'] = 'Enter a 4-digit NSW postcode, like 2000.';
}

if (!isset(STC_SERVICES[$in['service']])) {
    $errors['service'] = 'Choose the service you need, or Not sure.';
}

$descLength = mb_strlen($in['description']);
if ($descLength === 0) {
    $errors['description'] = 'Describe the job.';
} elseif ($descLength < 10) {
    $errors['description'] = 'Add a little more detail about the job.';
} elseif ($descLength > 3000) {
    $errors['description'] = 'Job description must be 3000 characters or fewer.';
}

if (!isset(STC_AUTHORITY[$in['property_authority']])) {
    $errors['property_authority'] = 'Choose your connection to the property.';
}
if (!isset(STC_COUNCIL[$in['council_status']])) {
    $errors['council_status'] = 'Choose a council approval status. Not sure is fine.';
}
if ($in['consent'] !== 'yes') {
    $errors['consent'] = 'Tick the box to agree to your enquiry being shared with the contractor.';
}

[$photos, $photoError] = stc_collect_photos($config);
if ($photoError !== null) {
    $errors['photos'] = $photoError;
}

if ($errors) {
    stc_fail(422, 'Please check the highlighted fields.', $errors, $wantsJson);
}

// ---------------------------------------------------------------------------
// Build and send the email
// ---------------------------------------------------------------------------
$tz = new DateTimeZone('Australia/Sydney');
$now = new DateTimeImmutable('now', $tz);
$reference = 'STC-' . $now->format('Ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));

$lines = [
    'New enquiry from sydneytreeconnect.com',
    'Reference: ' . $reference,
    'Received: ' . $now->format('j M Y, g:i a T'),
    '',
    'CUSTOMER',
    'Name: ' . $in['name'],
    'Email: ' . $in['email'],
    'Phone: ' . ($in['phone'] !== '' ? $in['phone'] : '(not provided)'),
    'Preferred contact method: ' . STC_CONTACT[$in['contact_method']],
    '',
    'JOB',
    'Suburb: ' . $in['suburb'],
    'Postcode: ' . $in['postcode'],
    'Service required: ' . STC_SERVICES[$in['service']],
    'Connection to property: ' . STC_AUTHORITY[$in['property_authority']],
    'Council approval status: ' . STC_COUNCIL[$in['council_status']],
    'Photos attached: ' . count($photos),
    '',
    'Job description:',
    $in['description'],
    '',
    'CONSENT RECORD',
    'Consent given: Yes (checkbox ticked by the customer)',
    'Consent wording (version ' . STC_CONSENT_VERSION . '): "' . STC_CONSENT_TEXT . '"',
    'Consent time: ' . $now->format(DATE_ATOM),
    'IP address: ' . ($clientIp !== '' ? $clientIp : '(unknown)'),
    'Browser: ' . mb_substr(stc_clean_line($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 200),
    '',
    'NEXT STEPS FOR THE OPERATOR',
    '- Review the enquiry, then forward it to the contractor.',
    '- The customer has not been sent any confirmation email.',
    '- This is not an approval or booking. The contractor must verify authority and approvals.',
    '- Delete this email and any forwarded copies in line with the retention period in the privacy notice.',
];
$body = implode("\r\n", $lines) . "\r\n";

$mail = new PHPMailer(true);
try {
    $mail->CharSet = PHPMailer::CHARSET_UTF8;
    $mail->Encoding = PHPMailer::ENCODING_QUOTED_PRINTABLE;
    $mail->isSMTP();
    $mail->Host = $config['smtp_host'];
    $mail->Port = $config['smtp_port'];
    $mail->SMTPAuth = $config['smtp_user'] !== '';
    $mail->Username = $config['smtp_user'];
    $mail->Password = $config['smtp_pass'];
    if ($config['smtp_secure'] === 'ssl') {
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    } elseif ($config['smtp_secure'] === 'tls') {
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    } else {
        $mail->SMTPSecure = '';
        $mail->SMTPAutoTLS = false;
    }
    $mail->Timeout = 20;
    $mail->XMailer = ' ';

    // Fixed, verified sender. The customer's address only ever goes in Reply-To,
    // after validation, so it can't be used to inject headers or spoof the sender.
    $mail->setFrom($config['mail_from'], $config['mail_from_name'], false);
    $mail->Sender = $config['mail_from'];
    foreach ($config['to'] as $recipient) {
        $mail->addAddress($recipient, $config['to_name']);
    }
    // Display names in headers are limited to plain characters.
    $headerName = trim(mb_substr(preg_replace('/[^\p{L}\p{N} .\'-]/u', '', $in['name']) ?? '', 0, 60));
    $mail->addReplyTo($in['email'], $headerName);

    $subjectName = mb_substr($headerName, 0, 40);
    $mail->Subject = sprintf('Tree enquiry %s: %s, %s (%s)', $reference, STC_SERVICES[$in['service']], $in['suburb'], $subjectName);
    $mail->isHTML(false);
    $mail->Body = $body;

    foreach ($photos as $i => $photo) {
        $mail->addAttachment($photo['tmp'], sprintf('%s-photo-%d.%s', $reference, $i + 1, $photo['ext']), PHPMailer::ENCODING_BASE64, $photo['type']);
    }

    $mail->send();
} catch (MailException $e) {
    // Log the mailer's reason (no customer data) for the operator to diagnose.
    error_log('[stc-enquiry] Send failed: ' . $mail->ErrorInfo);
    stc_fail(502, 'Sorry, your enquiry could not be sent right now. Nothing has been sent. Please try again later.', [], $wantsJson);
}

stc_rate_limit_record($config, $clientIp);

if ($wantsJson) {
    stc_json(200, ['ok' => true, 'reference' => $reference]);
}
header('Location: /thank-you.html', true, 303);
exit;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stc_wants_json(): bool
{
    $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
    return stripos($accept, 'application/json') !== false
        || (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== '');
}

function stc_json(int $status, array $payload): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Fail safely: generic message, field errors, never internal details. */
function stc_fail(int $status, string $message, array $errors, bool $json): void
{
    if ($json) {
        stc_json($status, ['ok' => false, 'message' => $message, 'errors' => (object)$errors]);
    }
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    $items = '';
    foreach ($errors as $text) {
        $items .= '<li>' . htmlspecialchars((string)$text, ENT_QUOTES, 'UTF-8') . '</li>';
    }
    echo '<!doctype html><html lang="en-AU"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<meta name="robots" content="noindex"><title>Enquiry not sent | Sydney Tree Connect</title>'
        . '<link rel="stylesheet" href="/assets/css/styles.css"></head><body><main class="page"><div class="wrap prose">'
        . '<h1>Your enquiry was not sent</h1><p>' . htmlspecialchars($message, ENT_QUOTES, 'UTF-8') . '</p>'
        . ($items !== '' ? '<ul>' . $items . '</ul>' : '')
        . '<p><a class="button" href="/#enquiry">Go back to the form</a></p>'
        . '<p class="small">Use your browser’s back button to keep what you typed.</p></div></main></body></html>';
    exit;
}

function stc_clean_line($value): string
{
    if (!is_string($value)) {
        return '';
    }
    // Remove control characters including CR/LF so nothing can break into headers.
    $value = preg_replace('/[\x00-\x1F\x7F\x{2028}\x{2029}]/u', ' ', $value) ?? '';
    return trim(preg_replace('/\s+/u', ' ', $value) ?? '');
}

function stc_clean_text($value): string
{
    if (!is_string($value)) {
        return '';
    }
    $value = str_replace(["\r\n", "\r"], "\n", $value);
    $value = preg_replace('/[\x00-\x08\x0B-\x1F\x7F]/u', '', $value) ?? '';
    $value = preg_replace("/\n{3,}/", "\n\n", $value) ?? '';
    return trim($value);
}

function stc_ini_bytes(string $value): int
{
    $value = trim($value);
    if ($value === '') {
        return PHP_INT_MAX;
    }
    $unit = strtolower(substr($value, -1));
    $n = (int)$value;
    switch ($unit) {
        case 'g': return $n * 1024 * 1024 * 1024;
        case 'm': return $n * 1024 * 1024;
        case 'k': return $n * 1024;
        default: return $n > 0 ? $n : PHP_INT_MAX;
    }
}

/**
 * Validate uploaded photos by count, size and actual content (not the
 * browser-supplied type or file name). Returns [list, error|null].
 */
function stc_collect_photos(array $config): array
{
    if (!isset($_FILES['photos'])) {
        return [[], null];
    }
    $f = $_FILES['photos'];
    if (!is_array($f['name'])) {
        foreach ($f as $k => $v) {
            $f[$k] = [$v];
        }
    }
    $photos = [];
    $total = 0;
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $count = count($f['name']);
    for ($i = 0; $i < $count; $i++) {
        $err = (int)$f['error'][$i];
        if ($err === UPLOAD_ERR_NO_FILE) {
            continue;
        }
        if ($err === UPLOAD_ERR_INI_SIZE || $err === UPLOAD_ERR_FORM_SIZE) {
            return [[], 'Each photo must be 4 MB or smaller.'];
        }
        if ($err !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'][$i])) {
            return [[], 'One of your photos could not be uploaded. Please try again.'];
        }
        if (count($photos) >= STC_MAX_PHOTOS) {
            return [[], 'You can attach up to ' . STC_MAX_PHOTOS . ' photos.'];
        }
        $size = (int)filesize($f['tmp_name'][$i]);
        if ($size <= 0) {
            return [[], 'One of your photos is empty.'];
        }
        if ($size > $config['max_photo_bytes']) {
            return [[], 'Each photo must be 4 MB or smaller.'];
        }
        $total += $size;
        if ($total > $config['max_total_photo_bytes']) {
            return [[], 'Your photos add up to more than 12 MB. Please remove one or two.'];
        }
        $type = (string)$finfo->file($f['tmp_name'][$i]);
        if (!isset(STC_IMAGE_TYPES[$type])) {
            return [[], 'Photos must be JPEG, PNG, WebP or HEIC images.'];
        }
        // For formats PHP can read, also confirm it decodes as an image.
        if (in_array($type, ['image/jpeg', 'image/png', 'image/webp'], true) && @getimagesize($f['tmp_name'][$i]) === false) {
            return [[], 'One of your photos could not be read as an image.'];
        }
        $photos[] = ['tmp' => $f['tmp_name'][$i], 'type' => $type, 'ext' => STC_IMAGE_TYPES[$type]];
    }
    return [$photos, null];
}

/** Read KEY=VALUE pairs from the private env file. */
function stc_load_config(): ?array
{
    $explicit = getenv('STC_ENV_FILE');
    if ($explicit) {
        // An explicit path is the only file used, so tests can never fall back to real settings.
        $candidates = [$explicit];
    } else {
        $candidates = [
            // Hostinger layout: domains/<domain>/public_html/api -> domains/<domain>/private
            dirname(__DIR__, 2) . '/private/stc-enquiry.env',
        ];
        // Local development only (PHP's built-in server): the git-ignored private/ folder in
        // the project. Never used on the live host, where private/ must stay outside public_html.
        if (PHP_SAPI === 'cli-server') {
            $candidates[] = dirname(__DIR__) . '/private/stc-enquiry.env';
        }
    }
    $file = null;
    foreach ($candidates as $c) {
        if (is_file($c) && is_readable($c)) {
            $file = $c;
            break;
        }
    }
    if ($file === null) {
        return null;
    }
    $env = [];
    foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) {
            continue;
        }
        [$k, $v] = array_map('trim', explode('=', $line, 2));
        if (strlen($v) >= 2 && ($v[0] === '"' || $v[0] === "'") && substr($v, -1) === $v[0]) {
            $v = substr($v, 1, -1);
        }
        $env[$k] = $v;
    }
    $get = static fn(string $k, string $d = ''): string => isset($env[$k]) ? (string)$env[$k] : $d;

    if (strtolower($get('ENQUIRY_ENABLED')) !== 'true') {
        return null;
    }
    $to = array_values(array_filter(array_map('trim', explode(',', $get('ENQUIRY_TO'))), static fn($a) => PHPMailer::validateAddress($a)));
    $from = $get('MAIL_FROM');
    $host = $get('SMTP_HOST');
    if (!$to || !PHPMailer::validateAddress($from) || $host === '') {
        error_log('[stc-enquiry] Config incomplete: ENQUIRY_TO, MAIL_FROM and SMTP_HOST are required.');
        return null;
    }
    $secure = strtolower($get('SMTP_SECURE', 'ssl'));
    $rateSecret = $get('RATE_LIMIT_SECRET');
    if (strlen($rateSecret) < 16) {
        error_log('[stc-enquiry] RATE_LIMIT_SECRET must be at least 16 characters.');
        return null;
    }
    $smtpUser = $get('SMTP_USER');
    $smtpPass = $get('SMTP_PASS');
    // Google shows App Passwords as four groups of four letters ("abcd efgh ijkl mnop").
    // Accept them as pasted, but send them without the spaces.
    if (preg_match('/^[a-z]{4}( [a-z]{4}){3}$/i', $smtpPass)) {
        $smtpPass = str_replace(' ', '', $smtpPass);
    }
    if ($smtpUser !== '' && $smtpPass === '') {
        error_log('[stc-enquiry] Config incomplete: SMTP_PASS is empty.');
        return null;
    }
    // Gmail SMTP sends as the signed-in account; another From is rewritten unless it
    // is a verified "Send mail as" alias in that account.
    if (strtolower($host) === 'smtp.gmail.com' && strcasecmp($from, $smtpUser) !== 0) {
        error_log('[stc-enquiry] Warning: with Gmail SMTP, MAIL_FROM should match SMTP_USER.');
    }
    $origins = array_filter(array_map(static fn($o) => rtrim(trim($o), '/'), explode(',', $get('ALLOWED_ORIGINS', 'https://sydneytreeconnect.com,https://www.sydneytreeconnect.com'))));

    return [
        'to' => $to,
        'to_name' => stc_clean_line($get('ENQUIRY_TO_NAME', 'Sydney Tree Connect enquiries')),
        'mail_from' => $from,
        'mail_from_name' => stc_clean_line($get('MAIL_FROM_NAME', 'Sydney Tree Connect website')),
        'smtp_host' => $host,
        'smtp_port' => (int)$get('SMTP_PORT', '465'),
        'smtp_secure' => in_array($secure, ['ssl', 'tls', 'none'], true) ? $secure : 'ssl',
        'smtp_user' => $smtpUser,
        'smtp_pass' => $smtpPass,
        'allowed_origins' => array_values($origins),
        'rate_dir' => $get('RATE_LIMIT_DIR', dirname($file) . '/stc-rate-limit'),
        'rate_secret' => $rateSecret,
        'rate_per_hour' => max(1, (int)$get('RATE_LIMIT_PER_HOUR', '5')),
        'rate_per_day' => max(1, (int)$get('RATE_LIMIT_PER_DAY', '15')),
        'rate_global_per_day' => max(1, (int)$get('RATE_LIMIT_GLOBAL_PER_DAY', '200')),
        'max_photo_bytes' => min(4 * 1024 * 1024, max(1, (int)$get('MAX_PHOTO_BYTES', (string)(4 * 1024 * 1024)))),
        'max_total_photo_bytes' => min(12 * 1024 * 1024, max(1, (int)$get('MAX_TOTAL_PHOTO_BYTES', (string)(12 * 1024 * 1024)))),
    ];
}

/**
 * File-based rate limit keyed by an HMAC of the client IP (the raw IP is not
 * stored). Returns 'ok', 'limited' or 'error'.
 */
function stc_rate_limit(array $config, string $ip): string
{
    $dir = $config['rate_dir'];
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
        return 'error';
    }
    $now = time();
    // Occasionally remove stale entries.
    if (random_int(1, 50) === 1) {
        foreach (glob($dir . '/*.json') ?: [] as $old) {
            if (@filemtime($old) < $now - 172800) {
                @unlink($old);
            }
        }
    }
    foreach ([stc_rate_file($config, $ip), $dir . '/_global.json'] as $idx => $path) {
        $times = stc_rate_read($path, $now);
        if ($times === null) {
            return 'error';
        }
        $lastHour = count(array_filter($times, static fn($t) => $t > $now - 3600));
        if ($idx === 0 && ($lastHour >= $config['rate_per_hour'] || count($times) >= $config['rate_per_day'])) {
            return 'limited';
        }
        if ($idx === 1 && count($times) >= $config['rate_global_per_day']) {
            return 'limited';
        }
    }
    return 'ok';
}

function stc_rate_limit_record(array $config, string $ip): void
{
    $now = time();
    foreach ([stc_rate_file($config, $ip), $config['rate_dir'] . '/_global.json'] as $path) {
        $fh = @fopen($path, 'c+');
        if (!$fh) {
            continue;
        }
        if (flock($fh, LOCK_EX)) {
            $times = json_decode((string)stream_get_contents($fh), true);
            $times = is_array($times) ? array_values(array_filter($times, static fn($t) => is_int($t) && $t > $now - 86400)) : [];
            $times[] = $now;
            ftruncate($fh, 0);
            rewind($fh);
            fwrite($fh, json_encode($times));
            fflush($fh);
            flock($fh, LOCK_UN);
        }
        fclose($fh);
    }
}

function stc_rate_file(array $config, string $ip): string
{
    return $config['rate_dir'] . '/' . hash_hmac('sha256', $ip, $config['rate_secret']) . '.json';
}

function stc_rate_read(string $path, int $now): ?array
{
    if (!is_file($path)) {
        return [];
    }
    $raw = @file_get_contents($path);
    if ($raw === false) {
        return null;
    }
    $times = json_decode($raw, true);
    return is_array($times) ? array_values(array_filter($times, static fn($t) => is_int($t) && $t > $now - 86400)) : [];
}
