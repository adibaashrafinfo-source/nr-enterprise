<?php
// Copy to config.php and fill in. NEVER commit config.php. chmod 640.
return [
    'APP_ENV'            => 'production',      // production | testing | local
    'APP_URL'            => 'https://example.com',
    'APP_KEY'            => 'CHANGE_ME_64_HEX_CHARS',
    'DB_HOST'            => 'localhost',
    'DB_PORT'            => 3306,
    'DB_NAME'            => 'cpuser_nre',
    'DB_USER'            => 'cpuser_nreapp',
    'DB_PASS'            => '',
    'ALLOW_REGISTRATION' => false,             // first account is always allowed (becomes admin); keep false afterwards
    'SESSION_NAME'       => 'nre_sid',
    'SESSION_LIFETIME'   => 28800,             // 8 hours
    'TIMEZONE'           => 'Asia/Dhaka',
    'ENQUIRY_NOTIFY_TO'  => '',                // email to notify on new enquiry (optional)
    'MAIL_FROM'          => 'no-reply@example.com',
    'HEALTHCHECK_KEY'    => 'CHANGE_ME_RANDOM',
    'UPLOAD_DIR'         => '',                // default: <public_html>/uploads (auto)
    'STORAGE_DIR'        => '',                // default: nre_backend/storage (auto)
];
