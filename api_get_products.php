<?php
// api_get_products.php

// ===== DEBUGGING =====
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
// =====================

// Set header JSON di awal
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

// Log request
file_put_contents('debug.log', "\n" . date('Y-m-d H:i:s') . " - Get Products Request\n", FILE_APPEND);

// --- Koneksi Database ---
$config = [
    'host' => 'localhost',
    'user' => 'root',
    'password' => '',
    'database' => 'toko_rahmat'
];

// Cek ekstensi mysqli
if (!function_exists('mysqli_connect')) {
    $error = 'Error: Ekstensi MySQLi tidak diaktifkan.';
    file_put_contents('debug.log', $error . "\n", FILE_APPEND);
    echo json_encode(['success' => false, 'message' => $error]);
    exit();
}

$conn = new mysqli(
    $config['host'], 
    $config['user'], 
    $config['password'], 
    $config['database']
);

if ($conn->connect_error) {
    $error = 'Koneksi database gagal: ' . $conn->connect_error;
    file_put_contents('debug.log', $error . "\n", FILE_APPEND);
    echo json_encode(['success' => false, 'message' => $error]);
    exit();
}

// --- Ambil Data Produk ---
try {
    $products = [];
    
    // Query untuk mengambil produk
    $sql = "SELECT id, code, name, price FROM products ORDER BY 
            CASE 
                WHEN code LIKE 'MK%' THEN 1 
                WHEN code LIKE 'MN%' THEN 2 
                ELSE 3 
            END, name";
    
    file_put_contents('debug.log', "Executing query: $sql\n", FILE_APPEND);
    
    $result = $conn->query($sql);

    if ($result) {
        while($row = $result->fetch_assoc()) {
            // Ensure price is numeric
            $row['price'] = floatval($row['price']);
            $products[] = $row;
        }
        
        $result->free();
        
        file_put_contents('debug.log', "Successfully fetched " . count($products) . " products\n", FILE_APPEND);
        
        echo json_encode([
            'success' => true, 
            'products' => $products,
            'count' => count($products),
            'timestamp' => date('Y-m-d H:i:s')
        ]);
        
    } else {
        throw new Exception('Query gagal: ' . $conn->error);
    }
    
} catch (Exception $e) {
    file_put_contents('debug.log', "Error: " . $e->getMessage() . "\n", FILE_APPEND);
    echo json_encode([
        'success' => false, 
        'message' => $e->getMessage(),
        'timestamp' => date('Y-m-d H:i:s')
    ]);
}

$conn->close();
?>