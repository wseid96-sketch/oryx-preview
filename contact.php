<?php
/**
 * Oryx Mainland Logistics: quote form handler.
 *
 * Handles BOTH site forms (form_type=booking from book.html, form_type=contact from contact.html).
 * Sends the enquiry to admin@oryxmainland.ca using PHP mail() (default) or SMTP.
 * Settings come from contact-config.php, which is NOT committed (see contact-config.example.php).
 * Looks for the config one level above the web root first (safer), then next to this file.
 *
 * Responds with JSON when the request sends "Accept: application/json" (the site's JS does),
 * otherwise redirects to thanks.html or contact.html?status=error (works without JS).
 */
declare(strict_types=1);
date_default_timezone_set('America/Vancouver');

$config = [
    'to'          => 'admin@oryxmainland.ca',
    'from'        => 'admin@oryxmainland.ca',   // must be a mailbox on the domain or Hostinger may reject it
    'from_name'   => 'Oryx Mainland website',
    'transport'   => 'mail',                    // 'mail' or 'smtp'
    'smtp_host'   => '',
    'smtp_port'   => 465,
    'smtp_secure' => 'ssl',                     // 'ssl' (465) or 'tls' (587, STARTTLS)
    'smtp_user'   => '',
    'smtp_pass'   => '',
    'min_seconds' => 3,                         // faster than this = bot
];
foreach ([dirname(__DIR__) . '/oryx-config/contact-config.php', __DIR__ . '/contact-config.php'] as $file) {
    if (is_file($file)) { $local = require $file; if (is_array($local)) { $config = array_merge($config, $local); } break; }
}

$wantsJson = stripos($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json') !== false;
$formType  = (($_POST['form_type'] ?? '') === 'booking') ? 'booking' : 'contact';

function respond(bool $ok, array $errors = [], string $message = ''): void {
    global $wantsJson, $formType;
    if ($wantsJson) {
        http_response_code($ok ? 200 : ($errors ? 422 : 500));
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => $ok, 'errors' => (object) $errors, 'message' => $message]);
    } else {
        header('Location: ' . ($ok ? 'thanks.html' : ($formType === 'booking' ? 'book.html' : 'contact.html') . '?status=error'), true, 303);
    }
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    http_response_code(405);
    exit('Method not allowed');
}

/** Trim, strip control chars, cap length. */
function field(string $key, int $max): string {
    $v = isset($_POST[$key]) && is_string($_POST[$key]) ? $_POST[$key] : '';
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? '';
    return mb_substr(trim($v), 0, $max);
}
/** Single-line values must not carry line breaks (header injection). */
function oneLine(string $v): string { return trim(preg_replace('/[\r\n]+/', ' ', $v) ?? ''); }

// Spam checks: honeypot filled, or submitted impossibly fast. Pretend success so bots learn nothing.
if (field('website', 200) !== '') { respond(true); }
$ts = (int) field('ts', 20);
if ($ts > 0 && (time() - $ts) < (int) $config['min_seconds']) { respond(true); }

$help = [];
if (isset($_POST['help']) && is_array($_POST['help'])) {
    foreach (array_slice($_POST['help'], 0, 5) as $h) { if (is_string($h)) { $help[] = oneLine(mb_substr($h, 0, 60)); } }
}
$data = [
    'name'      => oneLine(field('name', 100)),
    'company'   => oneLine(field('company', 120)),
    'email'     => oneLine(field('email', 160)),
    'phone'     => oneLine(field('phone', 40)),
    'service'   => oneLine(field('service', 80)),
    'pickup'    => oneLine(field('pickup', 160)),
    'dropoff'   => oneLine(field('dropoff', 160)),
    'date'      => oneLine(field('date', 10)),
    'window'    => oneLine(field('window', 60)),
    'frequency' => oneLine(field('frequency', 30)),
    'weight'    => oneLine(field('weight', 60)),
    'pieces'    => oneLine(field('pieces', 60)),
    'help'      => implode(', ', $help),
    'message'   => field('message', 4000),
];

$errors = [];
if (mb_strlen($data['name']) < 2)                      { $errors['name'] = 'Please enter your name.'; }
if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) { $errors['email'] = 'Please enter a valid email address.'; }
if ($data['phone'] !== '' && !preg_match('/^[0-9+().\-\s]{7,40}$/', $data['phone'])) { $errors['phone'] = 'Please check the phone number.'; }
if ($data['date'] !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $data['date']))      { $errors['date'] = 'Please pick a valid date.'; }
if (mb_strlen($data['message']) < 10)                  { $errors['message'] = 'Please add a few more details.'; }
if ($formType === 'booking') {
    if ($data['phone'] === '')   { $errors['phone'] = 'Please enter a phone number we can reach you on.'; }
    if ($data['pickup'] === '')  { $errors['pickup'] = 'Please add the pickup address or area.'; }
    if ($data['dropoff'] === '') { $errors['dropoff'] = 'Please add the delivery address or area.'; }
    if ($data['date'] === '')    { $errors['date'] = 'Please pick a date.'; }
}
if ($errors) { respond(false, $errors, 'Please fix the highlighted fields.'); }

if ($formType === 'booking') {
    $labels = ['name' => 'Name', 'company' => 'Company', 'email' => 'Email', 'phone' => 'Phone', 'service' => 'Service',
               'pickup' => 'Pickup', 'dropoff' => 'Delivery', 'date' => 'Date', 'window' => 'Time window', 'frequency' => 'How often',
               'weight' => 'Weight', 'pieces' => 'Pieces', 'help' => 'Site/loading'];
    $intro = "New BOOKING REQUEST from oryxmainland.ca (not confirmed: reply with rate + slot)\n\n";
    $msgLabel = "What are we moving:";
    $subjectBase = 'Booking request';
} else {
    $labels = ['name' => 'Name', 'company' => 'Company', 'email' => 'Email', 'phone' => 'Phone'];
    $intro = "New message from the oryxmainland.ca contact form\n\n";
    $msgLabel = "Message:";
    $subjectBase = 'Website message';
}
$body = $intro;
foreach ($labels as $k => $label) { $body .= str_pad($label . ':', 14) . ($data[$k] !== '' ? $data[$k] : '-') . "\n"; }
$body .= "\n" . $msgLabel . "\n" . $data['message'] . "\n\n--\nSent " . date('Y-m-d H:i T') . ' from ' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . "\n";

$subject  = $subjectBase . ': ' . $data['name'] . ($data['company'] !== '' ? ' (' . $data['company'] . ')' : '') . ($formType === 'booking' && $data['date'] !== '' ? ' - ' . $data['date'] : '');
$encSubj  = '=?UTF-8?B?' . base64_encode($subject) . '?=';
$fromName = '=?UTF-8?B?' . base64_encode($config['from_name']) . '?=';
$headers  = [
    'From: ' . $fromName . ' <' . $config['from'] . '>',
    'Reply-To: ' . $data['email'],
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'X-Mailer: oryxmainland-contact',
];

$sent = $config['transport'] === 'smtp'
    ? smtp_send($config, $config['to'], $encSubj, $body, $headers)
    : mail($config['to'], $encSubj, $body, implode("\r\n", $headers), '-f' . $config['from']);

if (!$sent) { error_log('oryx contact form: send failed via ' . $config['transport']); }
respond($sent, [], $sent ? '' : "Sorry, the message didn't send. Please email admin@oryxmainland.ca directly.");

/**
 * Minimal authenticated SMTP sender (AUTH LOGIN over SSL or STARTTLS). No external libraries.
 * Returns true when the server accepts the message.
 */
function smtp_send(array $c, string $to, string $subject, string $body, array $headers): bool {
    if ($c['smtp_host'] === '' || $c['smtp_user'] === '' || $c['smtp_pass'] === '') { error_log('oryx contact: SMTP not configured'); return false; }
    $remote = ($c['smtp_secure'] === 'ssl' ? 'ssl://' : 'tcp://') . $c['smtp_host'] . ':' . (int) $c['smtp_port'];
    $fp = @stream_socket_client($remote, $errno, $errstr, 15);
    if (!$fp) { error_log("oryx contact: SMTP connect failed $errno $errstr"); return false; }
    stream_set_timeout($fp, 15);
    $read = function () use ($fp): string { $out = ''; while (($line = fgets($fp, 515)) !== false) { $out .= $line; if (isset($line[3]) && $line[3] === ' ') break; } return $out; };
    $cmd  = function (string $line, array $ok) use ($fp, $read): bool { fwrite($fp, $line . "\r\n"); $r = $read(); $good = in_array((int) substr($r, 0, 3), $ok, true); if (!$good) error_log('oryx contact SMTP: ' . trim($r)); return $good; };
    $host = $_SERVER['SERVER_NAME'] ?? 'localhost';
    if ((int) substr($read(), 0, 3) !== 220) { fclose($fp); return false; }
    if (!$cmd("EHLO $host", [250])) { fclose($fp); return false; }
    if ($c['smtp_secure'] === 'tls') {
        if (!$cmd('STARTTLS', [220]) || !stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) { fclose($fp); return false; }
        if (!$cmd("EHLO $host", [250])) { fclose($fp); return false; }
    }
    $ok = $cmd('AUTH LOGIN', [334]) && $cmd(base64_encode($c['smtp_user']), [334]) && $cmd(base64_encode($c['smtp_pass']), [235])
       && $cmd('MAIL FROM:<' . $c['from'] . '>', [250]) && $cmd('RCPT TO:<' . $to . '>', [250, 251]) && $cmd('DATA', [354]);
    if ($ok) {
        $msg = implode("\r\n", array_merge($headers, ['To: <' . $to . '>', 'Subject: ' . $subject, 'Date: ' . date('r')])) . "\r\n\r\n"
             . preg_replace('/^\./m', '..', str_replace(["\r\n", "\n"], ["\n", "\r\n"], $body));
        $ok = $cmd($msg . "\r\n.", [250]);
    }
    $cmd('QUIT', [221]);
    fclose($fp);
    return $ok;
}
