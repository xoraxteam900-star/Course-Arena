<?php
// pay.php
// Put this file in your InfinityFree htdocs folder

header('Content-Type: application/json');

$amount = isset($_GET['amount']) ? floatval($_GET['amount']) * 100 : 0; // Paystack uses pesewas/kobo
$email = isset($_GET['email']) ? $_GET['email'] : 'user@coursearena.com';
$uid = isset($_GET['uid']) ? $_GET['uid'] : '';

// ⚠️ REPLACE THIS WITH YOUR PAYSTACK SECRET KEY
$paystack_secret = "sk_test_YOUR_PAYSTACK_SECRET"; 

if (!$amount || !$uid) {
    die("Missing amount or user ID.");
}

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
    // Redirect user to the Paystack checkout page!
    header("Location: " . $json['data']['authorization_url']);
    exit;
} else {
    echo "Paystack error: " . $result;
}
?>
