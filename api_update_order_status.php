<?php
// api_update_order_status.php - Untuk update status pesanan

// ===== DEBUGGING =====
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
// =====================

// Set header JSON di awal
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
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

// --- Proses Update Status ---
$input_data = file_get_contents('php://input');
$data = json_decode($input_data, true);

if (!$data || !isset($data['order_id']) || !isset($data['status'])) {
    echo json_encode([
        'success' => false, 
        'message' => 'Data order_id dan status diperlukan'
    ]);
    $conn->close();
    exit();
}

$order_id = intval($data['order_id']);
$status = $data['status'];
$allowed_statuses = ['pending', 'confirmed', 'cancelled'];

if (!in_array($status, $allowed_statuses)) {
    echo json_encode([
        'success' => false, 
        'message' => 'Status tidak valid. Harus: pending, confirmed, atau cancelled'
    ]);
    $conn->close();
    exit();
}

try {
    if ($status == 'confirmed') {
        $sql = "UPDATE sales SET status = ?, confirmed_at = NOW() WHERE id = ?";
    } else {
        $sql = "UPDATE sales SET status = ? WHERE id = ?";
    }
    
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("si", $status, $order_id);
    
    if ($stmt->execute()) {
        if ($stmt->affected_rows > 0) {
            echo json_encode([
                'success' => true, 
                'message' => "Status pesanan berhasil diupdate menjadi $status",
                'order_id' => $order_id,
                'new_status' => $status
            ]);
        } else {
            echo json_encode([
                'success' => false, 
                'message' => 'Pesanan tidak ditemukan atau tidak ada perubahan'
            ]);
        }
    } else {
        throw new Exception('Gagal execute update: ' . $stmt->error);
    }
    
    $stmt->close();
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false, 
        'message' => $e->getMessage()
    ]);
}

$conn->close();
?>