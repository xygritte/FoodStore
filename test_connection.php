<?php
// test_connection.php - Untuk testing koneksi database

// ===== DEBUGGING =====
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
// =====================

header('Content-Type: application/json');

$config = [
    'host' => 'localhost',
    'user' => 'root',
    'password' => '',
    'database' => 'toko_rahmat'
];

// Test koneksi
try {
    $conn = new mysqli($config['host'], $config['user'], $config['password'], $config['database']);
    
    if ($conn->connect_error) {
        throw new Exception('Koneksi gagal: ' . $conn->connect_error);
    }
    
    // Test query
    $result = $conn->query("SELECT COUNT(*) as product_count FROM products");
    $product_count = $result->fetch_assoc()['product_count'];
    
    $result = $conn->query("SELECT COUNT(*) as sales_count FROM sales");
    $sales_count = $result->fetch_assoc()['sales_count'];
    
    echo json_encode([
        'success' => true,
        'message' => 'Koneksi database berhasil!',
        'database_info' => [
            'host' => $config['host'],
            'database' => $config['database'],
            'product_count' => $product_count,
            'sales_count' => $sales_count
        ]
    ]);
    
    $conn->close();
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
        'config_used' => $config
    ]);
}
?>