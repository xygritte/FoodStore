<?php
header('Content-Type: text/plain');
$conn = new mysqli('localhost', 'root', '', 'toko_rahmat');

// Test dengan data yang sama persis seperti API
$test_data = [
    'sale_date' => date('Y-m-d H:i:s'),
    'product_code' => 'TEST_API',
    'product_name' => 'Test API Product', 
    'price' => 20000,
    'quantity' => 1,
    'total' => 20000,
    'customer_name' => 'TEST_CUSTOMER_API',
    'notes' => '',
    'status' => 'pending'
];

echo "Testing with customer_name: 'TEST_CUSTOMER_API'\n";

$stmt = $conn->prepare("INSERT INTO sales (sale_date, product_code, product_name, price, quantity, total, customer_name, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
$stmt->bind_param("sssdissss", 
    $test_data['sale_date'],
    $test_data['product_code'], 
    $test_data['product_name'],
    $test_data['price'],
    $test_data['quantity'],
    $test_data['total'],
    $test_data['customer_name'],
    $test_data['notes'],
    $test_data['status']
);

if ($stmt->execute()) {
    $id = $conn->insert_id;
    echo "✓ Inserted ID: $id\n";
    
    $result = $conn->query("SELECT customer_name FROM sales WHERE id = $id");
    $row = $result->fetch_assoc();
    echo "✓ Stored customer_name: '" . $row['customer_name'] . "'\n";
    echo "✓ Match: " . ($row['customer_name'] === 'TEST_CUSTOMER_API' ? 'YES' : 'NO') . "\n";
} else {
    echo "✗ Failed: " . $stmt->error . "\n";
}

$conn->close();
?>