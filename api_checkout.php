<?php
// api_checkout.php - RAW QUERY VERSION

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Koneksi Database
$conn = new mysqli('localhost', 'root', '', 'toko_rahmat');

if ($conn->connect_error) {
    echo json_encode(['success' => false, 'message' => 'DB Connection Failed: ' . $conn->connect_error]);
    exit();
}

// Baca input
$input_data = file_get_contents('php://input');
$data = json_decode($input_data, true);

if (!$data || !isset($data['cart'])) {
    echo json_encode(['success' => false, 'message' => 'Invalid data']);
    exit();
}

// Process customer name
$customer_name = "Pelanggan";
if (isset($data['customer_name']) && !empty(trim($data['customer_name']))) {
    $customer_name = trim($data['customer_name']);
} 
elseif (isset($data['customerNameFromJS']) && !empty(trim($data['customerNameFromJS']))) {
    $customer_name = trim($data['customerNameFromJS']);
}

// Validate customer name
if ($customer_name === "0" || $customer_name === "Customer") {
    $customer_name = "Pelanggan";
}

$cart = $data['cart'];
$notes = isset($data['notes']) ? $conn->real_escape_string($data['notes']) : '';
$sale_time = date('Y-m-d H:i:s');

$conn->begin_transaction();
$inserted_ids = [];

try {
    // GUNAKAN RAW QUERY - Hindari prepared statement
    foreach ($cart as $item) {
        $product_code = $conn->real_escape_string($item['code']);
        $product_name = $conn->real_escape_string($item['name']);
        $price = floatval($item['price']);
        $quantity = intval($item['qty']);
        $total = floatval($item['total']);
        $customer_name_escaped = $conn->real_escape_string($customer_name);
        
        // RAW SQL QUERY
        $sql = "INSERT INTO sales (sale_date, product_code, product_name, price, quantity, total, customer_name, notes, status) 
                VALUES ('$sale_time', '$product_code', '$product_name', $price, $quantity, $total, '$customer_name_escaped', '$notes', 'pending')";
        
        if ($conn->query($sql)) {
            $last_id = $conn->insert_id;
            $inserted_ids[] = $last_id;
            
            // Immediate verification
            $verify_sql = "SELECT customer_name FROM sales WHERE id = $last_id";
            $verify_result = $conn->query($verify_sql);
            if ($verify_row = $verify_result->fetch_assoc()) {
                file_put_contents('debug_raw.log', 
                    "RAW QUERY - Expected: '$customer_name', Got: '" . $verify_row['customer_name'] . "'\n", 
                    FILE_APPEND
                );
            }
        } else {
            throw new Exception('Insert failed: ' . $conn->error);
        }
    }

    $conn->commit();
    
    echo json_encode([
        'success' => true,
        'message' => 'Pesanan berhasil!',
        'data' => [
            'customer_name' => $customer_name,
            'order_ids' => $inserted_ids
        ]
    ]);

} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(['success' => false, 'message' => 'Failed: ' . $e->getMessage()]);
}

$conn->close();
?>