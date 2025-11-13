<?php
// api_get_orders.php - Untuk mendapatkan data pesanan

// ===== DEBUGGING =====
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
// =====================

// Set header JSON di awal
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

// --- Koneksi Database ---
$config = [
    'host' => 'localhost',
    'user' => 'root',
    'password' => '',
    'database' => 'toko_rahmat'
];

$conn = new mysqli(
    $config['host'], 
    $config['user'], 
    $config['password'], 
    $config['database']
);

if ($conn->connect_error) {
    echo json_encode([
        'success' => false, 
        'message' => 'Koneksi database gagal: ' . $conn->connect_error
    ]);
    exit();
}

// --- Ambil Data Pesanan ---
try {
    $orders = [];
    
    // Parameter filter opsional
    $status_filter = isset($_GET['status']) ? $_GET['status'] : '';
    $date_filter = isset($_GET['date']) ? $_GET['date'] : '';
    
    // Build query dengan filter
    $sql = "SELECT * FROM sales WHERE 1=1";
    $params = [];
    $types = "";
    
    if ($status_filter && $status_filter != 'all') {
        $sql .= " AND status = ?";
        $params[] = $status_filter;
        $types .= "s";
    }
    
    if ($date_filter) {
        $sql .= " AND DATE(sale_date) = ?";
        $params[] = $date_filter;
        $types .= "s";
    }
    
    $sql .= " ORDER BY sale_date DESC";
    
    $stmt = $conn->prepare($sql);
    
    if ($params) {
        $stmt->bind_param($types, ...$params);
    }
    
    if ($stmt->execute()) {
        $result = $stmt->get_result();
        while($row = $result->fetch_assoc()) {
            $orders[] = $row;
        }
        $result->free();
    }
    
    $stmt->close();
    
    echo json_encode([
        'success' => true, 
        'orders' => $orders,
        'count' => count($orders),
        'filters' => [
            'status' => $status_filter,
            'date' => $date_filter
        ]
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false, 
        'message' => $e->getMessage()
    ]);
}

$conn->close();
?>