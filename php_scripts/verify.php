<?php
// verify.php - Paystack Verification and Wallet Balance Credit
// Put this file in your InfinityFree htdocs folder

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);
if (!is_array($input)) {
    $input = !empty($_POST) ? $_POST : $_GET;
}

$reference = isset($input['reference']) ? trim($input['reference']) : '';
$uid = isset($input['uid']) ? trim($input['uid']) : '';
$isJson = isset($input['format']) && $input['format'] === 'json';
if (!$isJson && isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false) {
    $isJson = true;
}

// ⚠️ Configuration
$secrets = file_exists(__DIR__ . '/secrets.php') ? require(__DIR__ . '/secrets.php') : [];
$paystack_secret = $secrets['PAYSTACK_SECRET'] ?? getenv('PAYSTACK_SECRET') ?? "sk_test_YOUR_PAYSTACK_SECRET";
$firebase_api_key = getenv('FIREBASE_API_KEY') ?: "AIzaSyDiZ5-3wYhOBH3y70uctTLhAW4EK_TPN60";
$firebase_project_id = getenv('FIREBASE_PROJECT_ID') ?: "coursearena-8c761";
$admin_email = $secrets['ADMIN_EMAIL'] ?? getenv('ADMIN_EMAIL') ?? "admin@coursearena.app";
$admin_password = $secrets['ADMIN_PASSWORD'] ?? getenv('ADMIN_PASSWORD') ?? "admin_password";

if (!$reference || !$uid) {
    if ($isJson) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(["success" => false, "error" => "Invalid reference or user ID"]);
        exit;
    }
    die("Invalid request: Missing reference or user ID.");
}

// 1. Verify Paystack Transaction
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "https://api.paystack.co/transaction/verify/" . rawurlencode($reference));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer " . $paystack_secret]);
$verify_res_raw = curl_exec($ch);
$verify_res = json_decode($verify_res_raw, true);

if (!isset($verify_res['data']['status']) || $verify_res['data']['status'] !== 'success') {
    if ($isJson) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(["success" => false, "error" => "Payment failed or not verified", "details" => $verify_res_raw]);
        exit;
    }
    die("Payment failed or not verified. Paystack response: " . $verify_res_raw . " | Reference: " . $reference);
}

$amountGhs = $verify_res['data']['amount'] / 100;

// 2. Login to Firebase as Admin to get an idToken
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
    if ($isJson) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(["success" => false, "error" => "Firebase Admin Login Failed"]);
        exit;
    }
    die("Firebase Admin Login Failed. Response: " . $auth_res_raw);
}
$idToken = $auth_res['idToken'];

// 3. Check if transaction already credited in Firestore
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
    if ($isJson) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(["success" => true, "already_credited" => true, "amount" => $amountGhs, "new_balance" => $current_balance]);
        exit;
    }
    header("Location: coursearena://wallet");
    exit;
}

$new_balance = round($current_balance + $amountGhs, 2);

// 4. Update the Balance in Firestore securely
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

// 5. Create Transaction Document in Firestore
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
        "description" => ["stringValue" => "Paystack Deposit"],
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

if ($isJson) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(["success" => true, "already_credited" => false, "amount" => $amountGhs, "new_balance" => $new_balance]);
    exit;
}

// 6. Success! Redirect the browser back to the mobile app seamlessly
header("Location: coursearena://wallet");
exit;
?>
