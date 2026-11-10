<?php
// Copy to contact-config.php (NOT committed; see .gitignore) or, better, to ../oryx-config/contact-config.php
// outside public_html on Hostinger. Only override what you need. Never commit real credentials.
return [
    'to'          => 'admin@oryxmainland.ca',
    'from'        => 'admin@oryxmainland.ca',
    'transport'   => 'mail',        // switch to 'smtp' if mail() delivery is unreliable
    'smtp_host'   => 'SMTP_HOST',   // e.g. the Hostinger mailbox's SMTP server (check hPanel > Emails)
    'smtp_port'   => 465,
    'smtp_secure' => 'ssl',
    'smtp_user'   => 'SMTP_USER',
    'smtp_pass'   => 'SMTP_PASSWORD',
];
