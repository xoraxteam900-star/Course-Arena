<?php
// reset.php - Course Arena Mobile Web Password Reset for InfinityFree Hosting
// Progressive Step 1 (Email) -> Step 2 (Verify OTP) -> Step 3 (New Password) -> Step 4 (Success)

session_start();

$CREDENTIALS_FILE = __DIR__ . '/firebase_credentials.json';
$OTP_FILE = __DIR__ . '/otps.json';

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

function sendSmtpEmail($to, $otp) {
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

    $subject = "Your Course Arena Password Reset Code";
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
    $message .= "Your Course Arena password reset code is: $otp\n\nThis code expires in 15 minutes.\r\n";

    // HTML version
    $message .= "--$boundary\r\n";
    $message .= "Content-Type: text/html; charset=\"UTF-8\"\r\n";
    $message .= "Content-Transfer-Encoding: 7bit\r\n\r\n";
    $message .= "<!DOCTYPE html><html><body style='margin:0;padding:24px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,sans-serif;'>";
    $message .= "<div style='max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 4px 12px rgba(0,0,0,0.06);text-align:center;'>";
    $message .= "<h2 style='color:#1769E0;margin-top:0;'>Course Arena</h2>";
    $message .= "<p style='color:#374151;font-size:15px;'>Use the code below to reset your password:</p>";
    $message .= "<div style='background:#eff6ff;border:2px dashed #1769E0;border-radius:12px;padding:18px;margin:24px 0;font-size:32px;font-weight:bold;letter-spacing:6px;color:#1e40af;'>$otp</div>";
    $message .= "<p style='color:#6b7280;font-size:13px;'>This code expires in 15 minutes.</p>";
    $message .= "</div></body></html>\r\n";
    $message .= "--$boundary--\r\n";
    $message .= ".\r\n";

    fputs($socket, $message);
    getSmtpResponse($socket);

    fputs($socket, "QUIT\r\n");
    fclose($socket);
    return ["success" => true];
}

function httpRequestJson($url, $method = 'GET', $headers = [], $data = null) {
    $content = is_array($data) ? json_encode($data) : $data;
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            if ($content !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $content);
        }
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        $res = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ['status' => $status, 'body' => $res, 'data' => json_decode($res, true)];
    } else {
        $headerLines = "";
        foreach ($headers as $h) $headerLines .= $h . "\r\n";
        $context = stream_context_create([
            'http' => [
                'method' => $method,
                'header' => $headerLines,
                'content' => $content,
                'ignore_errors' => true,
                'timeout' => 15
            ],
            'ssl' => ['verify_peer' => false, 'verify_peer_name' => false]
        ]);
        $res = @file_get_contents($url, false, $context);
        $status = 0;
        if (isset($http_response_header)) {
            foreach ($http_response_header as $line) {
                if (preg_match('/HTTP\/\S+\s+(\d+)/', $line, $m)) $status = (int)$m[1];
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

// Handle AJAX actions
if (isset($_POST['ajax_action'])) {
    header('Content-Type: application/json; charset=utf-8');
    $action = $_POST['ajax_action'];
    $email = strtolower(trim($_POST['email'] ?? ''));

    // Step 1: Send OTP Code
    if ($action === 'send_code') {
        if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            echo json_encode(['error' => 'Please enter a valid email address.']);
            exit;
        }
        $otp = (string) rand(100000, 999999);
        $otps = getOtpData();
        $otps[$email] = [
            'otp' => $otp,
            'verified' => false,
            'expiresAt' => time() + 900 // 15 mins
        ];
        saveOtpData($otps);

        $sendRes = sendSmtpEmail($email, $otp);
        if ($sendRes['success']) {
            echo json_encode(['success' => true, 'message' => "Verification code sent to $email"]);
        } else {
            echo json_encode(['error' => 'Failed to send email: ' . ($sendRes['error'] ?? 'SMTP error')]);
        }
        exit;
    }

    // Step 2: Verify OTP Code ONLY (Before allowing user to type new password)
    if ($action === 'verify_otp') {
        $otp = trim($_POST['otp'] ?? '');

        if (!$otp || strlen($otp) < 6) {
            echo json_encode(['error' => 'Please enter the complete 6-digit code.']);
            exit;
        }

        $otps = getOtpData();
        if (!isset($otps[$email])) {
            echo json_encode(['error' => 'No verification code requested for this email. Please request a new code.']);
            exit;
        }

        $record = $otps[$email];
        if ($record['otp'] !== $otp) {
            echo json_encode(['error' => 'Incorrect 6-digit code. Please check your email and try again.']);
            exit;
        }

        if (time() > $record['expiresAt']) {
            unset($otps[$email]);
            saveOtpData($otps);
            echo json_encode(['error' => 'This code has expired. Please request a new code.']);
            exit;
        }

        // Mark OTP as verified!
        $otps[$email]['verified'] = true;
        saveOtpData($otps);

        echo json_encode(['success' => true, 'message' => 'Code verified successfully! You can now set your new password.']);
        exit;
    }

    // Step 3: Set New Password (Only allowed if OTP was already verified)
    if ($action === 'set_password') {
        $newPassword = $_POST['new_password'] ?? '';
        $confirmPassword = $_POST['confirm_password'] ?? '';

        if (!$newPassword || strlen($newPassword) < 6) {
            echo json_encode(['error' => 'Password must be at least 6 characters long.']);
            exit;
        }

        if ($confirmPassword !== '' && $newPassword !== $confirmPassword) {
            echo json_encode(['error' => 'Passwords do not match. Please re-enter.']);
            exit;
        }

        $otps = getOtpData();
        if (!isset($otps[$email]) || empty($otps[$email]['verified'])) {
            echo json_encode(['error' => 'Security check failed: You must verify your 6-digit code first.']);
            exit;
        }

        if (time() > $otps[$email]['expiresAt']) {
            unset($otps[$email]);
            saveOtpData($otps);
            echo json_encode(['error' => 'Session expired. Please request a new code.']);
            exit;
        }

        // Attempt Firebase Password Change
        $token = getFirebaseAccessToken($CREDENTIALS_FILE);
        if (!$token) {
            echo json_encode(['error' => 'Server error: unable to authenticate with Firebase credentials.']);
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
            echo json_encode(['error' => 'No Course Arena user found with this email.']);
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
            echo json_encode(['success' => true, 'redirect' => 'coursearena://login?reset=success']);
        } else {
            $msg = $update['data']['error']['message'] ?? 'Password update failed';
            echo json_encode(['error' => "Failed to update password: $msg"]);
        }
        exit;
    }

    echo json_encode(['error' => 'Invalid action']);
    exit;
}

$initialEmail = htmlspecialchars($_GET['email'] ?? '');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <title>Reset Password - Course Arena</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif; }
        body { background: #0F172A; color: #1E293B; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .card { background: #FFFFFF; width: 100%; max-width: 440px; border-radius: 24px; padding: 36px 28px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35); text-align: center; }
        .logo-wrap { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 24px; }
        .logo-icon { width: 44px; height: 44px; background: #EFF6FF; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #1769E0; font-size: 24px; font-weight: 800; }
        .logo-title { font-size: 22px; font-weight: 800; color: #0F172A; }
        .logo-title span { color: #1769E0; }
        
        /* Steps indicator */
        .step-indicator { display: flex; justify-content: center; gap: 8px; margin-bottom: 24px; }
        .step-dot { width: 32px; height: 6px; border-radius: 3px; background: #E2E8F0; transition: all 0.3s; }
        .step-dot.active { background: #1769E0; width: 44px; }
        .step-dot.completed { background: #10B981; }

        h1 { font-size: 22px; font-weight: 800; color: #0F172A; margin-bottom: 8px; }
        p.subtitle { font-size: 14px; color: #64748B; margin-bottom: 24px; line-height: 1.5; }
        .form-group { text-align: left; margin-bottom: 18px; }
        label { display: block; font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 8px; }
        .input-wrap { position: relative; display: flex; align-items: center; }
        input { width: 100%; height: 50px; border: 1.5px solid #E2E8F0; border-radius: 12px; padding: 0 16px; font-size: 15px; color: #0F172A; background: #F8FAFC; transition: all 0.2s; }
        input:focus { outline: none; border-color: #1769E0; background: #FFFFFF; box-shadow: 0 0 0 4px rgba(23, 105, 224, 0.12); }
        .otp-input { letter-spacing: 8px; font-size: 24px; font-weight: 800; text-align: center; }
        
        .eye-toggle { position: absolute; right: 14px; cursor: pointer; color: #94A3B8; font-size: 18px; user-select: none; }
        
        .btn { width: 100%; height: 52px; background: #1769E0; color: #FFFFFF; border: none; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 10px; }
        .btn:hover { background: #1255B8; }
        .btn:disabled { background: #94A3B8; cursor: not-allowed; }
        
        .alert { padding: 12px 16px; border-radius: 12px; font-size: 13px; font-weight: 600; margin-bottom: 18px; text-align: left; display: none; }
        .alert-error { background: #FEF2F2; color: #DC2626; border: 1px solid #FEE2E2; }
        .alert-success { background: #F0FDF4; color: #16A34A; border: 1px solid #DCFCE7; }
        
        .step { display: none; }
        .step.active { display: block; }
        
        .link-row { display: flex; justify-content: space-between; align-items: center; margin-top: 18px; font-size: 14px; }
        .link-btn { color: #64748B; font-weight: 600; text-decoration: none; cursor: pointer; background: none; border: none; font-size: 14px; }
        .link-btn:hover { color: #1769E0; }
        .link-primary { color: #1769E0; font-weight: 700; }
        
        .success-icon { width: 68px; height: 68px; background: #DCFCE7; color: #16A34A; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 16px; }
    </style>
</head>
<body>

<div class="card">
    <div class="logo-wrap">
        <div class="logo-icon">🎓</div>
        <div class="logo-title">Course <span>Arena</span></div>
    </div>

    <!-- Progress Indicator -->
    <div class="step-indicator">
        <div id="dot1" class="step-dot active"></div>
        <div id="dot2" class="step-dot"></div>
        <div id="dot3" class="step-dot"></div>
    </div>

    <div id="alertBox" class="alert"></div>

    <!-- STEP 1: Enter Email -->
    <div id="step1" class="step active">
        <h1>Forgot Password?</h1>
        <p class="subtitle">Enter your Course Arena email and we'll send a 6-digit verification code.</p>
        <form id="requestCodeForm">
            <div class="form-group">
                <label for="email">Account Email</label>
                <input type="email" id="email" required placeholder="name@example.com" value="<?= $initialEmail ?>">
            </div>
            <button type="submit" id="sendBtn" class="btn">Send Verification Code</button>
        </form>
    </div>

    <!-- STEP 2: Verify OTP Code (User must verify OTP first) -->
    <div id="step2" class="step">
        <h1>Verify Code</h1>
        <p class="subtitle">Enter the 6-digit code sent to <strong id="displayEmail" style="color:#0F172A;"></strong>.</p>
        <form id="verifyOtpForm">
            <div class="form-group">
                <label for="otpCode">6-Digit Verification Code</label>
                <input type="text" id="otpCode" class="otp-input" required maxlength="6" placeholder="------" pattern="\d*" inputmode="numeric" autocomplete="one-time-code">
            </div>
            <button type="submit" id="verifyBtn" class="btn">Verify Code</button>
        </form>
        <div class="link-row">
            <button type="button" class="link-btn" onclick="goToStep(1)">← Change email</button>
            <button type="button" id="resendBtn" class="link-btn link-primary" onclick="resendCode()">Resend Code</button>
        </div>
    </div>

    <!-- STEP 3: Create New Password (Only unlocked AFTER OTP is verified) -->
    <div id="step3" class="step">
        <h1>New Password</h1>
        <p class="subtitle">Code verified! Please create a strong new password for your account.</p>
        <form id="setPasswordForm">
            <div class="form-group">
                <label for="newPassword">New Password</label>
                <div class="input-wrap">
                    <input type="password" id="newPassword" required minlength="6" placeholder="At least 6 characters">
                    <span class="eye-toggle" onclick="togglePassword('newPassword', this)">👁</span>
                </div>
            </div>
            <div class="form-group">
                <label for="confirmPassword">Confirm Password</label>
                <div class="input-wrap">
                    <input type="password" id="confirmPassword" required minlength="6" placeholder="Repeat your new password">
                    <span class="eye-toggle" onclick="togglePassword('confirmPassword', this)">👁</span>
                </div>
            </div>
            <button type="submit" id="savePasswordBtn" class="btn">Set New Password</button>
        </form>
    </div>

    <!-- STEP 4: Success State -->
    <div id="step4" class="step">
        <div class="success-icon">✓</div>
        <h1>Password Updated!</h1>
        <p class="subtitle">Your password has been changed successfully. You can now sign in with your new credentials.</p>
        <a id="returnAppBtn" href="coursearena://login?reset=success" class="btn">Return to Course Arena</a>
    </div>
</div>

<script>
    const alertBox = document.getElementById('alertBox');
    let currentEmail = "<?= $initialEmail ?>";

    function showAlert(msg, isError = true) {
        alertBox.textContent = msg;
        alertBox.className = 'alert ' + (isError ? 'alert-error' : 'alert-success');
        alertBox.style.display = 'block';
    }

    function hideAlert() {
        alertBox.style.display = 'none';
    }

    function goToStep(stepNum) {
        hideAlert();
        document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
        document.getElementById('step' + stepNum).classList.add('active');

        // Update dot progress
        const d1 = document.getElementById('dot1');
        const d2 = document.getElementById('dot2');
        const d3 = document.getElementById('dot3');

        if (stepNum === 1) {
            d1.className = 'step-dot active';
            d2.className = 'step-dot';
            d3.className = 'step-dot';
        } else if (stepNum === 2) {
            d1.className = 'step-dot completed';
            d2.className = 'step-dot active';
            d3.className = 'step-dot';
            setTimeout(() => document.getElementById('otpCode').focus(), 150);
        } else if (stepNum === 3) {
            d1.className = 'step-dot completed';
            d2.className = 'step-dot completed';
            d3.className = 'step-dot active';
            setTimeout(() => document.getElementById('newPassword').focus(), 150);
        } else if (stepNum === 4) {
            d1.className = 'step-dot completed';
            d2.className = 'step-dot completed';
            d3.className = 'step-dot completed';
        }
    }

    function togglePassword(inputId, toggleEl) {
        const inp = document.getElementById(inputId);
        if (inp.type === 'password') {
            inp.type = 'text';
            toggleEl.textContent = '🙈';
        } else {
            inp.type = 'password';
            toggleEl.textContent = '👁';
        }
    }

    // 1. Send Code
    document.getElementById('requestCodeForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        hideAlert();
        const email = document.getElementById('email').value.trim();
        if (!email) return showAlert('Please enter your email.');

        const btn = document.getElementById('sendBtn');
        btn.disabled = true;
        btn.textContent = 'Sending code...';

        try {
            const formData = new FormData();
            formData.append('ajax_action', 'send_code');
            formData.append('email', email);

            const res = await fetch('reset.php', { method: 'POST', body: formData });
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            currentEmail = email;
            document.getElementById('displayEmail').textContent = email;
            goToStep(2);
            showAlert('Verification code sent! Please check your inbox or spam.', false);
        } catch (err) {
            showAlert(err.message || 'Failed to send verification code.');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Send Verification Code';
        }
    });

    async function resendCode() {
        if (!currentEmail) return;
        const resendBtn = document.getElementById('resendBtn');
        resendBtn.disabled = true;
        resendBtn.textContent = 'Sending...';

        try {
            const formData = new FormData();
            formData.append('ajax_action', 'send_code');
            formData.append('email', currentEmail);

            const res = await fetch('reset.php', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            showAlert('New 6-digit code sent!', false);
        } catch (err) {
            showAlert(err.message || 'Failed to resend code.');
        } finally {
            setTimeout(() => {
                resendBtn.disabled = false;
                resendBtn.textContent = 'Resend Code';
            }, 3000);
        }
    }

    // 2. Verify Code ONLY
    document.getElementById('verifyOtpForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        hideAlert();
        const otp = document.getElementById('otpCode').value.trim();

        if (!otp || otp.length < 6) return showAlert('Please enter the full 6-digit code.');

        const btn = document.getElementById('verifyBtn');
        btn.disabled = true;
        btn.textContent = 'Verifying...';

        try {
            const formData = new FormData();
            formData.append('ajax_action', 'verify_otp');
            formData.append('email', currentEmail);
            formData.append('otp', otp);

            const res = await fetch('reset.php', { method: 'POST', body: formData });
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            // Successfully verified! Move to Step 3 (Set New Password)
            goToStep(3);
            showAlert('Code verified! Enter your new password.', false);
        } catch (err) {
            showAlert(err.message || 'Verification failed.');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Verify Code';
        }
    });

    // 3. Set New Password
    document.getElementById('setPasswordForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        hideAlert();
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!newPassword || newPassword.length < 6) return showAlert('Password must be at least 6 characters.');
        if (newPassword !== confirmPassword) return showAlert('Passwords do not match. Please re-enter.');

        const btn = document.getElementById('savePasswordBtn');
        btn.disabled = true;
        btn.textContent = 'Updating password...';

        try {
            const formData = new FormData();
            formData.append('ajax_action', 'set_password');
            formData.append('email', currentEmail);
            formData.append('new_password', newPassword);
            formData.append('confirm_password', confirmPassword);

            const res = await fetch('reset.php', { method: 'POST', body: formData });
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            goToStep(4);
            if (data.redirect) {
                setTimeout(() => {
                    window.location.href = data.redirect;
                }, 1200);
            }
        } catch (err) {
            showAlert(err.message || 'Failed to update password.');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Set New Password';
        }
    });
</script>

</body>
</html>
