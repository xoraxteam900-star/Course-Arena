<?php
header('Content-Type: application/json; charset=utf-8');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Support both JSON body and standard POST/GET
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);
if (!is_array($input)) {
    $input = !empty($_POST) ? $_POST : $_GET;
}

$action = trim($input['action'] ?? '');
$email = strtolower(trim($input['email'] ?? ''));

if (!$email || !$action) {
    echo json_encode(["error" => "Missing email or action"]);
    exit;
}

$OTP_FILE = __DIR__ . '/otps.json';
$CREDENTIALS_FILE = __DIR__ . '/firebase_credentials.json';

function getOtpData() {
    global $OTP_FILE;
    if (!file_exists($OTP_FILE)) {
        @file_put_contents($OTP_FILE, json_encode([]));
    }
    $content = @file_get_contents($OTP_FILE);
    $data = json_decode($content, true);
    return is_array($data) ? $data : [];
}

function saveOtpData($data) {
    global $OTP_FILE;
    @file_put_contents($OTP_FILE, json_encode($data, JSON_PRETTY_PRINT));
}

function getSmtpResponse($socket) {
    $data = "";
    while($str = fgets($socket, 515)) {
        $data .= $str;
        if(substr($str, 3, 1) == " ") break;
    }
    return $data;
}

function sendSmtpEmail($to, $otp, $purpose = 'reset') {
    $secrets = file_exists(__DIR__ . '/secrets.php') ? require(__DIR__ . '/secrets.php') : [];
    $host = 'smtp.gmail.com';
    $port = 587;
    $user = $secrets['SMTP_USER'] ?? getenv('SMTP_USER') ?? 'support@coursearena.app';
    $pass = $secrets['SMTP_PASS'] ?? getenv('SMTP_PASS') ?? 'your-smtp-app-password';
    $from = $secrets['SMTP_FROM'] ?? getenv('SMTP_FROM') ?? $user;
    $name = 'Course Arena Support';

    $context = stream_context_create([
        'ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false,
            'allow_self_signed' => true
        ]
    ]);
    
    $socket = @stream_socket_client("tcp://$host:$port", $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $context);
    if (!$socket) {
        return ["success" => false, "error" => "Socket connection failed: $errstr ($errno)"];
    }

    getSmtpResponse($socket);
    fputs($socket, "EHLO $host\r\n");
    getSmtpResponse($socket);

    fputs($socket, "STARTTLS\r\n");
    getSmtpResponse($socket);

    if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT)) {
        fclose($socket);
        return ["success" => false, "error" => "TLS negotiation failed"];
    }

    fputs($socket, "EHLO $host\r\n");
    getSmtpResponse($socket);

    fputs($socket, "AUTH LOGIN\r\n");
    getSmtpResponse($socket);
    fputs($socket, base64_encode($user) . "\r\n");
    getSmtpResponse($socket);
    fputs($socket, base64_encode($pass) . "\r\n");
    $authResp = getSmtpResponse($socket);
    if (strpos($authResp, '235') === false) {
        fclose($socket);
        return ["success" => false, "error" => "SMTP Authentication failed: $authResp"];
    }

    fputs($socket, "MAIL FROM: <$from>\r\n");
    getSmtpResponse($socket);
    fputs($socket, "RCPT TO: <$to>\r\n");
    getSmtpResponse($socket);
    fputs($socket, "DATA\r\n");
    getSmtpResponse($socket);

    $isRegister = ($purpose === 'register');
    $subject = $isRegister 
        ? "Your Course Arena Email Verification Code" 
        : "Your Course Arena Password Reset Code";
    $heading = $isRegister 
        ? "Welcome to Course Arena!" 
        : "Password Reset Request";
    $bodyText = $isRegister
        ? "Thank you for creating an account! To ensure you are a real person and activate your account, please use the verification code below:"
        : "You requested a password reset for your account. Use the code below to reset your password:";
    $ignoreText = $isRegister
        ? "If you did not sign up for Course Arena, you can safely ignore this email."
        : "If you did not request this password reset, you can safely ignore this email.";

    $boundary = "----=_Part_" . md5(uniqid(rand(), true));

    $message  = "From: $name <$from>\r\n";
    $message .= "To: <$to>\r\n";
    $message .= "Subject: $subject\r\n";
    $message .= "MIME-Version: 1.0\r\n";
    $message .= "Content-Type: multipart/alternative; boundary=\"$boundary\"\r\n";
    $message .= "\r\n";

    // Plain text version
    $message .= "--$boundary\r\n";
    $message .= "Content-Type: text/plain; charset=\"UTF-8\"\r\n";
    $message .= "Content-Transfer-Encoding: 7bit\r\n\r\n";
    $message .= "$heading\n\n";
    $message .= "$bodyText\n\n";
    $message .= "Verification Code: $otp\n\n";
    $message .= "This code will expire in 15 minutes.\n";
    $message .= "$ignoreText\r\n\r\n";

    // HTML version
    $message .= "--$boundary\r\n";
    $message .= "Content-Type: text/html; charset=\"UTF-8\"\r\n";
    $message .= "Content-Transfer-Encoding: 7bit\r\n\r\n";
    $message .= "<!DOCTYPE html><html><body style='margin:0;padding:24px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,sans-serif;'>";
    $message .= "<div style='max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 4px 12px rgba(0,0,0,0.06);text-align:center;'>";
    $message .= "<h2 style='color:#1769E0;margin-top:0;font-size:24px;margin-bottom:4px;'>Course Arena</h2>";
    $message .= "<h3 style='color:#1F2937;margin-top:8px;margin-bottom:12px;font-size:18px;'>$heading</h3>";
    $message .= "<p style='color:#374151;font-size:15px;line-height:1.5;'>$bodyText</p>";
    $message .= "<div style='background:#eff6ff;border:2px dashed #1769E0;border-radius:12px;padding:18px;margin:24px 0;font-size:32px;font-weight:bold;letter-spacing:6px;color:#1e40af;'>$otp</div>";
    $message .= "<p style='color:#6b7280;font-size:13px;'>This code expires in 15 minutes.</p>";
    $message .= "<hr style='border:none;border-top:1px solid #e5e7eb;margin:24px 0;'/>";
    $message .= "<p style='color:#9ca3af;font-size:12px;margin-bottom:0;'>$ignoreText</p>";
    $message .= "</div></body></html>\r\n";
    $message .= "--$boundary--\r\n";
    $message .= ".\r\n";

    fputs($socket, $message);
    $dataResp = getSmtpResponse($socket);

    fputs($socket, "QUIT\r\n");
    fclose($socket);
    
    return ["success" => true];
}

// Resilient HTTP request helper (uses cURL if available, else stream_context)
function httpRequestJson($url, $method = 'GET', $headers = [], $data = null) {
    $content = is_array($data) ? json_encode($data) : $data;

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            if ($content !== null) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, $content);
            }
        }
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        $res = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ['status' => $status, 'body' => $res, 'data' => json_decode($res, true)];
    } else {
        $headerLines = "";
        foreach ($headers as $h) {
            $headerLines .= $h . "\r\n";
        }
        $context = stream_context_create([
            'http' => [
                'method' => $method,
                'header' => $headerLines,
                'content' => $content,
                'ignore_errors' => true,
                'timeout' => 15
            ],
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false
            ]
        ]);
        $res = @file_get_contents($url, false, $context);
        $status = 0;
        if (isset($http_response_header)) {
            foreach ($http_response_header as $line) {
                if (preg_match('/HTTP\/\S+\s+(\d+)/', $line, $matches)) {
                    $status = (int)$matches[1];
                }
            }
        }
        return ['status' => $status, 'body' => $res, 'data' => json_decode($res, true)];
    }
}

function getFirebaseAccessToken($jsonPath) {
    if (!file_exists($jsonPath)) return null;
    $json = json_decode(@file_get_contents($jsonPath), true);
    if (!$json || !isset($json['private_key']) || !isset($json['client_email'])) return null;

    $header = json_encode(['alg' => 'RS256', 'typ' => 'JWT']);
    $now = time();
    $payload = json_encode([
        'iss' => $json['client_email'],
        'sub' => $json['client_email'],
        'aud' => 'https://oauth2.googleapis.com/token',
        'iat' => $now,
        'exp' => $now + 3600,
        'scope' => 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform'
    ]);

    $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));

    $signature = '';
    $signed = openssl_sign($base64UrlHeader . "." . $base64UrlPayload, $signature, $json['private_key'], OPENSSL_ALGO_SHA256);
    if (!$signed) return null;

    $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
    $jwt = $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;

    $res = httpRequestJson(
        'https://oauth2.googleapis.com/token',
        'POST',
        ['Content-Type: application/x-www-form-urlencoded'],
        http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => $jwt
        ])
    );

    return $res['data']['access_token'] ?? null;
}

if ($action === 'request') {
    $purpose = strtolower(trim($input['purpose'] ?? 'reset'));

    // Check Firebase for account status if service account credentials are present
    $token = getFirebaseAccessToken($CREDENTIALS_FILE);
    if ($token) {
        $creds = json_decode(@file_get_contents($CREDENTIALS_FILE), true);
        $projectId = $creds['project_id'] ?? '';
        $lookup = httpRequestJson(
            "https://identitytoolkit.googleapis.com/v1/projects/$projectId/accounts:lookup",
            'POST',
            ["Authorization: Bearer $token", "Content-Type: application/json"],
            ['email' => [$email]]
        );

        $userExists = !empty($lookup['data']['users']);
        if ($purpose === 'register' && $userExists) {
            echo json_encode(["error" => "An account with this email already exists. Please sign in instead."]);
            exit;
        }
        if ($purpose === 'reset' && !$userExists) {
            echo json_encode(["error" => "No account found with this email. Please check the spelling or sign up."]);
            exit;
        }
    }

    $otp = (string) rand(100000, 999999);
    
    $otps = getOtpData();
    $otps[$email] = [
        'otp' => $otp,
        'purpose' => $purpose,
        'expiresAt' => time() + 900 // 15 mins
    ];
    saveOtpData($otps);

    $sendResult = sendSmtpEmail($email, $otp, $purpose);
    if ($sendResult['success']) {
        echo json_encode(["success" => true, "message" => "OTP sent successfully"]);
    } else {
        echo json_encode(["error" => "Failed to send email: " . ($sendResult['error'] ?? "Unknown SMTP error")]);
    }
    exit;
}

if ($action === 'verify_otp') {
    $otp = trim($input['otp'] ?? '');
    if (!$otp || strlen($otp) < 6) {
        echo json_encode(["error" => "Please enter the complete 6-digit code"]);
        exit;
    }

    $otps = getOtpData();
    if (!isset($otps[$email])) {
        echo json_encode(["error" => "No pending OTP for this email. Please request a new code."]);
        exit;
    }

    $record = $otps[$email];
    if ($record['otp'] !== $otp) {
        echo json_encode(["error" => "Incorrect OTP code"]);
        exit;
    }

    if (time() > $record['expiresAt']) {
        unset($otps[$email]);
        saveOtpData($otps);
        echo json_encode(["error" => "OTP has expired. Please request a new code."]);
        exit;
    }

    $otps[$email]['verified'] = true;
    saveOtpData($otps);
    echo json_encode(["success" => true, "message" => "OTP verified successfully"]);
    exit;
}

if ($action === 'set_password') {
    $newPassword = $input['newPassword'] ?? '';
    if (!$newPassword || strlen($newPassword) < 6) {
        echo json_encode(["error" => "Password must be at least 6 characters long"]);
        exit;
    }

    $otps = getOtpData();
    if (!isset($otps[$email]) || empty($otps[$email]['verified'])) {
        echo json_encode(["error" => "Security check failed: You must verify your OTP code first."]);
        exit;
    }

    if (time() > $otps[$email]['expiresAt']) {
        unset($otps[$email]);
        saveOtpData($otps);
        echo json_encode(["error" => "Session expired. Please request a new code."]);
        exit;
    }

    $token = getFirebaseAccessToken($CREDENTIALS_FILE);
    if (!$token) {
        echo json_encode(["error" => "Server misconfiguration: firebase_credentials.json is missing or invalid."]);
        exit;
    }

    $creds = json_decode(@file_get_contents($CREDENTIALS_FILE), true);
    $projectId = $creds['project_id'] ?? '';

    $lookup = httpRequestJson(
        "https://identitytoolkit.googleapis.com/v1/projects/$projectId/accounts:lookup",
        'POST',
        ["Authorization: Bearer $token", "Content-Type: application/json"],
        ['email' => [$email]]
    );

    if (!isset($lookup['data']['users'][0]['localId'])) {
        echo json_encode(["error" => "No user account found with this email"]);
        exit;
    }
    $uid = $lookup['data']['users'][0]['localId'];

    $update = httpRequestJson(
        "https://identitytoolkit.googleapis.com/v1/projects/$projectId/accounts:update",
        'POST',
        ["Authorization: Bearer $token", "Content-Type: application/json"],
        ['localId' => $uid, 'password' => $newPassword]
    );

    if ($update['status'] === 200) {
        unset($otps[$email]);
        saveOtpData($otps);
        echo json_encode(["success" => true, "message" => "Password updated successfully"]);
    } else {
        $msg = $update['data']['error']['message'] ?? 'Unknown Firebase error';
        echo json_encode(["error" => "Failed to update password: " . $msg]);
    }
    exit;
}

if ($action === 'verify') {
    $otp = trim($input['otp'] ?? '');
    $newPassword = $input['newPassword'] ?? '';

    if (!$otp || !$newPassword) {
        echo json_encode(["error" => "Missing OTP or New Password"]);
        exit;
    }

    if (strlen($newPassword) < 6) {
        echo json_encode(["error" => "Password must be at least 6 characters long"]);
        exit;
    }

    $otps = getOtpData();
    if (!isset($otps[$email])) {
        echo json_encode(["error" => "No pending OTP for this email. Please request a new code."]);
        exit;
    }

    $record = $otps[$email];
    if ($record['otp'] !== $otp) {
        echo json_encode(["error" => "Incorrect OTP code"]);
        exit;
    }

    if (time() > $record['expiresAt']) {
        unset($otps[$email]);
        saveOtpData($otps);
        echo json_encode(["error" => "OTP has expired. Please request a new code."]);
        exit;
    }

    // Attempt Firebase Password Change
    $token = getFirebaseAccessToken($CREDENTIALS_FILE);
    if (!$token) {
        echo json_encode(["error" => "Server misconfiguration: firebase_credentials.json is missing or invalid."]);
        exit;
    }

    $creds = json_decode(@file_get_contents($CREDENTIALS_FILE), true);
    $projectId = $creds['project_id'] ?? '';

    // 1. Lookup user UID by email
    $lookup = httpRequestJson(
        "https://identitytoolkit.googleapis.com/v1/projects/$projectId/accounts:lookup",
        'POST',
        ["Authorization: Bearer $token", "Content-Type: application/json"],
        ['email' => [$email]]
    );

    if (!isset($lookup['data']['users'][0]['localId'])) {
        echo json_encode(["error" => "No user account found with this email"]);
        exit;
    }
    $uid = $lookup['data']['users'][0]['localId'];

    // 2. Update password in Firebase Auth
    $update = httpRequestJson(
        "https://identitytoolkit.googleapis.com/v1/projects/$projectId/accounts:update",
        'POST',
        ["Authorization: Bearer $token", "Content-Type: application/json"],
        ['localId' => $uid, 'password' => $newPassword]
    );

    if ($update['status'] === 200) {
        unset($otps[$email]);
        saveOtpData($otps);
        echo json_encode(["success" => true, "message" => "Password updated successfully"]);
    } else {
        $msg = $update['data']['error']['message'] ?? 'Unknown Firebase error';
        echo json_encode(["error" => "Failed to update password: " . $msg]);
    }
    exit;
}

echo json_encode(["error" => "Invalid action"]);
