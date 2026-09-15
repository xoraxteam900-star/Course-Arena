<?php
// pay.php - Paystack Mobile Money Direct Charge & Wallet Credit API
// InfinityFree htdocs folder

header('Content-Type: application/json; charset=utf-8');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Load configuration from local secrets file (or environment)
$secrets = file_exists(__DIR__ . '/secrets.php') ? require(__DIR__ . '/secrets.php') : [];
$paystack_secret = $secrets['PAYSTACK_SECRET'] ?? getenv('PAYSTACK_SECRET') ?? "sk_test_YOUR_PAYSTACK_SECRET";
$firebase_api_key = getenv('FIREBASE_API_KEY') ?: "AIzaSyDiZ5-3wYhOBH3y70uctTLhAW4EK_TPN60";
$firebase_project_id = getenv('FIREBASE_PROJECT_ID') ?: "coursearena-8c761";
$admin_email = $secrets['ADMIN_EMAIL'] ?? getenv('ADMIN_EMAIL') ?? "admin@coursearena.app";
$admin_password = $secrets['ADMIN_PASSWORD'] ?? getenv('ADMIN_PASSWORD') ?? "admin_password";

// Support both JSON body and standard POST/GET
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);
if (!is_array($input)) {
    $input = !empty($_POST) ? $_POST : $_GET;
}

$action = trim($input['action'] ?? '');

// Helper: Authenticate with Firebase and credit user balance (Idempotent)
function creditUserBalanceAndRecordTxn($uid, $amountGhs, $reference, $description = "Mobile Money Deposit") {
    global $firebase_api_key, $firebase_project_id, $admin_email, $admin_password;

    if (!$uid || $amountGhs <= 0 || !$reference) {
        return ['success' => false, 'error' => 'Invalid parameters for crediting balance'];
    }

    // 1. Login to Firebase as Admin to get an idToken
    $auth_ch = curl_init();
    curl_setopt($auth_ch, CURLOPT_URL, "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" . $firebase_api_key);
    curl_setopt($auth_ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($auth_ch, CURLOPT_POST, 1);
    curl_setopt($auth_ch, CURLOPT_POSTFIELDS, json_encode([
        "email" => $admin_email,
        "password" => $admin_password,
        "returnSecureToken" => true
    ]));
    curl_setopt($auth_ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json"]);
    $auth_res_raw = curl_exec($auth_ch);
    $auth_res = json_decode($auth_res_raw, true);

    if (!isset($auth_res['idToken'])) {
        return ['success' => false, 'error' => 'Firebase Admin Auth Failed'];
    }
    $idToken = $auth_res['idToken'];

    // 2. Check if transaction already recorded to avoid double-crediting
    $txn_url = "https://firestore.googleapis.com/v1/projects/" . $firebase_project_id . "/databases/(default)/documents/transactions/" . rawurlencode($reference);
    $check_ch = curl_init();
    curl_setopt($check_ch, CURLOPT_URL, $txn_url);
    curl_setopt($check_ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($check_ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer " . $idToken]);
    $check_raw = curl_exec($check_ch);
    $http_code = curl_getinfo($check_ch, CURLINFO_HTTP_CODE);
    $check_res = json_decode($check_raw, true);

    // Get current balance
    $fs_url = "https://firestore.googleapis.com/v1/projects/" . $firebase_project_id . "/databases/(default)/documents/users/" . rawurlencode($uid);
    $get_ch = curl_init();
    curl_setopt($get_ch, CURLOPT_URL, $fs_url);
    curl_setopt($get_ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($get_ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer " . $idToken]);
    $user_res = json_decode(curl_exec($get_ch), true);

    $current_balance = 0;
    if (isset($user_res['fields']['balance']['doubleValue'])) {
        $current_balance = floatval($user_res['fields']['balance']['doubleValue']);
    } elseif (isset($user_res['fields']['balance']['integerValue'])) {
        $current_balance = floatval($user_res['fields']['balance']['integerValue']);
    }

    if ($http_code === 200 && isset($check_res['name'])) {
        // Already credited!
        return [
            'success' => true,
            'already_credited' => true,
            'new_balance' => $current_balance,
            'amount' => $amountGhs
        ];
    }

    $new_balance = round($current_balance + $amountGhs, 2);

    // 3. Update Balance in Firestore
    $update_ch = curl_init();
    curl_setopt($update_ch, CURLOPT_URL, $fs_url . "?updateMask.fieldPaths=balance");
    curl_setopt($update_ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($update_ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
    curl_setopt($update_ch, CURLOPT_POSTFIELDS, json_encode([
        "fields" => [
            "balance" => ["doubleValue" => $new_balance]
        ]
    ]));
    curl_setopt($update_ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer " . $idToken,
        "Content-Type: application/json"
    ]);
    curl_exec($update_ch);

    // 4. Create Transaction record in Firestore
    $create_txn_url = "https://firestore.googleapis.com/v1/projects/" . $firebase_project_id . "/databases/(default)/documents/transactions?documentId=" . rawurlencode($reference);
    $create_ch = curl_init();
    curl_setopt($create_ch, CURLOPT_URL, $create_txn_url);
    curl_setopt($create_ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($create_ch, CURLOPT_POST, 1);
    curl_setopt($create_ch, CURLOPT_POSTFIELDS, json_encode([
        "fields" => [
            "userId" => ["stringValue" => $uid],
            "type" => ["stringValue" => "deposit"],
            "amount" => ["doubleValue" => $amountGhs],
            "description" => ["stringValue" => $description],
            "reference" => ["stringValue" => $reference],
            "status" => ["stringValue" => "completed"],
            "createdAt" => ["timestampValue" => gmdate("Y-m-d\TH:i:s\Z")]
        ]
    ]));
    curl_setopt($create_ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer " . $idToken,
        "Content-Type: application/json"
    ]);
    curl_exec($create_ch);

    return [
        'success' => true,
        'already_credited' => false,
        'new_balance' => $new_balance,
        'amount' => $amountGhs
    ];
}

// -------------------------------------------------------------
// LEGACY GET CHECKOUT REDIRECT (Web Browser fallback)
// -------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET' && !$action && isset($_GET['amount']) && isset($_GET['uid'])) {
    $amount = floatval($_GET['amount']) * 100;
    $email = $_GET['email'] ?? 'user@coursearena.com';
    $uid = $_GET['uid'];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "https://api.paystack.co/transaction/initialize");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
      'amount' => $amount,
      'email' => $email,
      'callback_url' => "https://coursearena.great-site.net/verify.php?uid=" . urlencode($uid)
    ]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
      "Authorization: Bearer " . $paystack_secret,
      "Content-Type: application/json"
    ]);

    $result = curl_exec($ch);
    $json = json_decode($result, true);

    if (isset($json['data']['authorization_url'])) {
        header("Location: " . $json['data']['authorization_url']);
        exit;
    } else {
        echo json_encode(["error" => "Paystack error", "details" => $result]);
        exit;
    }
}

// -------------------------------------------------------------
// ACTION: CHARGE (Direct Mobile Money Charge)
// -------------------------------------------------------------
if ($action === 'charge') {
    $amount = floatval($input['amount'] ?? 0);
    $phone = preg_replace('/[^0-9]/', '', (string)($input['phone'] ?? ''));
    $provider = strtolower(trim($input['provider'] ?? 'mtn'));
    $email = trim($input['email'] ?? 'user@coursearena.com');
    $uid = trim($input['uid'] ?? '');

    if ($amount <= 0 || !$uid) {
        echo json_encode(["success" => false, "error" => "Invalid amount or user ID"]);
        exit;
    }

    if (strlen($phone) < 9) {
        echo json_encode(["success" => false, "error" => "Invalid phone number"]);
        exit;
    }

    // Format phone to 10 digits (e.g. 055...)
    if (strlen($phone) === 9) {
        $phone = '0' . $phone;
    } elseif (strlen($phone) === 12 && substr($phone, 0, 3) === '233') {
        $phone = '0' . substr($phone, 3);
    }

    // Provider normalization for Paystack Ghana MoMo: 'mtn', 'vod', or 'tgo'
    if ($provider === 'telecel' || $provider === 'vodafone') {
        $provider = 'vod';
    } elseif ($provider === 'airteltigo' || $provider === 'at') {
        $provider = 'tgo';
    }

    $amountPesewas = intval(round($amount * 100));

    $payload = [
        'amount' => $amountPesewas,
        'email' => $email,
        'currency' => 'GHS',
        'mobile_money' => [
            'phone' => $phone,
            'provider' => $provider
        ],
        'metadata' => [
            'uid' => $uid,
            'phone' => $phone,
            'provider' => $provider
        ]
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "https://api.paystack.co/charge");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer " . $paystack_secret,
        "Content-Type: application/json"
    ]);

    $raw = curl_exec($ch);
    $res = json_decode($raw, true);

    if (!$res || empty($res['status'])) {
        $msg = $res['message'] ?? "Paystack request failed";
        echo json_encode(["success" => false, "error" => $msg]);
        exit;
    }

    $data = $res['data'] ?? [];
    $chargeStatus = $data['status'] ?? 'pending';
    $reference = $data['reference'] ?? '';

    if ($chargeStatus === 'success') {
        $creditRes = creditUserBalanceAndRecordTxn($uid, $amount, $reference, "Mobile Money Top-Up (" . strtoupper($provider) . ")");
        echo json_encode([
            "success" => true,
            "status" => "success",
            "reference" => $reference,
            "amount" => $amount,
            "new_balance" => $creditRes['new_balance'] ?? null,
            "message" => "Payment successful!"
        ]);
        exit;
    }

    if ($chargeStatus === 'send_otp') {
        echo json_encode([
            "success" => true,
            "status" => "send_otp",
            "reference" => $reference,
            "message" => $data['display_text'] ?? "Please enter the OTP sent to your mobile phone."
        ]);
        exit;
    }

    if ($chargeStatus === 'pay_offline' || $chargeStatus === 'pending') {
        echo json_encode([
            "success" => true,
            "status" => "pay_offline",
            "reference" => $reference,
            "message" => $data['display_text'] ?? "Please check your phone and enter your Mobile Money PIN to approve payment."
        ]);
        exit;
    }

    echo json_encode([
        "success" => false,
        "status" => $chargeStatus,
        "error" => $data['gateway_response'] ?? ($res['message'] ?? "Charge could not be completed.")
    ]);
    exit;
}

// -------------------------------------------------------------
// ACTION: SUBMIT OTP
// -------------------------------------------------------------
if ($action === 'submit_otp') {
    $reference = trim($input['reference'] ?? '');
    $otp = trim($input['otp'] ?? '');
    $uid = trim($input['uid'] ?? '');
    $amount = floatval($input['amount'] ?? 0);

    if (!$reference || !$otp || !$uid) {
        echo json_encode(["success" => false, "error" => "Missing reference, OTP, or user ID"]);
        exit;
    }

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "https://api.paystack.co/charge/submit_otp");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'otp' => $otp,
        'reference' => $reference
    ]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer " . $paystack_secret,
        "Content-Type: application/json"
    ]);

    $raw = curl_exec($ch);
    $res = json_decode($raw, true);

    if (!$res || empty($res['status'])) {
        echo json_encode(["success" => false, "error" => $res['message'] ?? "OTP submission failed."]);
        exit;
    }

    $data = $res['data'] ?? [];
    $status = $data['status'] ?? 'pending';

    if ($status === 'success') {
        $amountGhs = isset($data['amount']) ? ($data['amount'] / 100) : $amount;
        $creditRes = creditUserBalanceAndRecordTxn($uid, $amountGhs, $reference, "Mobile Money Top-Up (OTP Verified)");
        echo json_encode([
            "success" => true,
            "status" => "success",
            "reference" => $reference,
            "amount" => $amountGhs,
            "new_balance" => $creditRes['new_balance'] ?? null,
            "message" => "Payment successfully verified!"
        ]);
        exit;
    }

    if ($status === 'pending' || $status === 'pay_offline') {
        echo json_encode([
            "success" => true,
            "status" => "pending",
            "reference" => $reference,
            "message" => "Waiting for phone confirmation..."
        ]);
        exit;
    }

    echo json_encode([
        "success" => false,
        "status" => $status,
        "error" => $data['gateway_response'] ?? "Payment verification failed."
    ]);
    exit;
}

// -------------------------------------------------------------
// ACTION: VERIFY TRANSACTION (Polling or direct status check)
// -------------------------------------------------------------
if ($action === 'verify') {
    $reference = trim($input['reference'] ?? '');
    $uid = trim($input['uid'] ?? '');

    if (!$reference || !$uid) {
        echo json_encode(["success" => false, "error" => "Missing reference or user ID"]);
        exit;
    }

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "https://api.paystack.co/transaction/verify/" . rawurlencode($reference));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer " . $paystack_secret
    ]);

    $raw = curl_exec($ch);
    $res = json_decode($raw, true);

    if (!$res || empty($res['status'])) {
        echo json_encode(["success" => false, "status" => "pending", "message" => "Checking status..."]);
        exit;
    }

    $data = $res['data'] ?? [];
    $status = $data['status'] ?? 'pending';

    if ($status === 'success') {
        $amountGhs = ($data['amount'] ?? 0) / 100;
        $creditRes = creditUserBalanceAndRecordTxn($uid, $amountGhs, $reference, "Mobile Money Top-Up");
        echo json_encode([
            "success" => true,
            "status" => "success",
            "reference" => $reference,
            "amount" => $amountGhs,
            "new_balance" => $creditRes['new_balance'] ?? null,
            "message" => "Payment completed successfully!"
        ]);
        exit;
    }

    if ($status === 'pending' || $status === 'ongoing') {
        echo json_encode([
            "success" => false,
            "status" => "pending",
            "message" => "Waiting for authorization..."
        ]);
        exit;
    }

    echo json_encode([
        "success" => false,
        "status" => $status,
        "error" => $data['gateway_response'] ?? "Payment was declined or cancelled."
    ]);
    exit;
}

// -------------------------------------------------------------
// ACTION: CHARGE CARD (Direct In-App Card Payment)
// -------------------------------------------------------------
if ($action === 'charge_card') {
    $amount = floatval($input['amount'] ?? 0);
    $email = trim($input['email'] ?? 'user@coursearena.com');
    $uid = trim($input['uid'] ?? '');
    $cardNumber = preg_replace('/[^0-9]/', '', (string)($input['card_number'] ?? ''));
    $cvv = preg_replace('/[^0-9]/', '', (string)($input['cvv'] ?? ''));
    $expiryMonth = trim($input['expiry_month'] ?? '');
    $expiryYear = trim($input['expiry_year'] ?? '');
    $pin = trim($input['pin'] ?? '');

    if ($amount <= 0 || !$uid) {
        echo json_encode(["success" => false, "error" => "Invalid amount or user ID"]);
        exit;
    }

    if (strlen($cardNumber) < 12 || strlen($cvv) < 3 || !$expiryMonth || !$expiryYear) {
        echo json_encode(["success" => false, "error" => "Invalid card details entered"]);
        exit;
    }

    $amountPesewas = intval(round($amount * 100));

    $cardData = [
        'number' => $cardNumber,
        'cvv' => $cvv,
        'expiry_month' => $expiryMonth,
        'expiry_year' => $expiryYear,
    ];
    if ($pin) {
        $cardData['pin'] = $pin;
    }

    $payload = [
        'amount' => $amountPesewas,
        'email' => $email,
        'currency' => 'GHS',
        'card' => $cardData,
        'metadata' => [
            'uid' => $uid,
            'channel' => 'card'
        ]
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "https://api.paystack.co/charge");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer " . $paystack_secret,
        "Content-Type: application/json"
    ]);

    $raw = curl_exec($ch);
    $res = json_decode($raw, true);

    if (!$res || empty($res['status'])) {
        $msg = $res['message'] ?? "Paystack card charge failed";
        echo json_encode(["success" => false, "error" => $msg]);
        exit;
    }

    $data = $res['data'] ?? [];
    $status = $data['status'] ?? 'pending';
    $reference = $data['reference'] ?? '';

    if ($status === 'success') {
        $creditRes = creditUserBalanceAndRecordTxn($uid, $amount, $reference, "Card Top-Up");
        echo json_encode([
            "success" => true,
            "status" => "success",
            "reference" => $reference,
            "amount" => $amount,
            "new_balance" => $creditRes['new_balance'] ?? null,
            "message" => "Card payment successful!"
        ]);
        exit;
    }

    if ($status === 'send_pin') {
        echo json_encode([
            "success" => true,
            "status" => "send_pin",
            "reference" => $reference,
            "message" => $data['display_text'] ?? "Please enter your 4-digit card PIN."
        ]);
        exit;
    }

    if ($status === 'send_otp') {
        echo json_encode([
            "success" => true,
            "status" => "send_otp",
            "reference" => $reference,
            "message" => $data['display_text'] ?? "Please enter the OTP sent by your bank."
        ]);
        exit;
    }

    if ($status === 'open_url') {
        echo json_encode([
            "success" => true,
            "status" => "open_url",
            "reference" => $reference,
            "auth_url" => $data['url'] ?? '',
            "message" => "Bank 3DS authentication required."
        ]);
        exit;
    }

    echo json_encode([
        "success" => false,
        "status" => $status,
        "error" => $data['gateway_response'] ?? ($res['message'] ?? "Card charge failed.")
    ]);
    exit;
}

// -------------------------------------------------------------
// ACTION: SUBMIT CARD PIN
// -------------------------------------------------------------
if ($action === 'submit_pin') {
    $reference = trim($input['reference'] ?? '');
    $pin = trim($input['pin'] ?? '');
    $uid = trim($input['uid'] ?? '');
    $amount = floatval($input['amount'] ?? 0);

    if (!$reference || !$pin || !$uid) {
        echo json_encode(["success" => false, "error" => "Missing reference, PIN, or user ID"]);
        exit;
    }

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "https://api.paystack.co/charge/submit_pin");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'pin' => $pin,
        'reference' => $reference
    ]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bearer " . $paystack_secret,
        "Content-Type: application/json"
    ]);

    $raw = curl_exec($ch);
    $res = json_decode($raw, true);

    if (!$res || empty($res['status'])) {
        echo json_encode(["success" => false, "error" => $res['message'] ?? "Failed to submit PIN."]);
        exit;
    }

    $data = $res['data'] ?? [];
    $status = $data['status'] ?? 'pending';

    if ($status === 'success') {
        $amountGhs = isset($data['amount']) ? ($data['amount'] / 100) : $amount;
        $creditRes = creditUserBalanceAndRecordTxn($uid, $amountGhs, $reference, "Card Top-Up (PIN Verified)");
        echo json_encode([
            "success" => true,
            "status" => "success",
            "reference" => $reference,
            "amount" => $amountGhs,
            "new_balance" => $creditRes['new_balance'] ?? null,
            "message" => "Card payment successful!"
        ]);
        exit;
    }

    if ($status === 'send_otp') {
        echo json_encode([
            "success" => true,
            "status" => "send_otp",
            "reference" => $reference,
            "message" => $data['display_text'] ?? "Please enter the OTP sent by your bank."
        ]);
        exit;
    }

    if ($status === 'open_url') {
        echo json_encode([
            "success" => true,
            "status" => "open_url",
            "reference" => $reference,
            "auth_url" => $data['url'] ?? '',
            "message" => "Bank 3DS authentication required."
        ]);
        exit;
    }

    echo json_encode([
        "success" => false,
        "status" => $status,
        "error" => $data['gateway_response'] ?? "Card PIN verification failed."
    ]);
    exit;
}

echo json_encode(["error" => "Invalid action specified."]);
?>
