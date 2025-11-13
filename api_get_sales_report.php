<?php
// api_get_sales_report.php - Untuk laporan penjualan

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

// --- Ambil Laporan Penjualan ---
try {
    // Parameter filter
    $start_date = isset($_GET['start_date']) ? $_GET['start_date'] : '';
    $end_date = isset($_GET['end_date']) ? $_GET['end_date'] : '';
    $page = isset($_GET['page']) ? intval($_GET['page']) : 1;
    $page_size = isset($_GET['page_size']) ? intval($_GET['page_size']) : 100;
    
    $offset = ($page - 1) * $page_size;
    
    // Build query untuk data
    $sql_data = "SELECT * FROM sales WHERE 1=1";
    $sql_count = "SELECT COUNT(*) as total FROM sales WHERE 1=1";
    $params = [];
    $types = "";
    
    if ($start_date && $end_date) {
        $sql_data .= " AND DATE(sale_date) BETWEEN ? AND ?";
        $sql_count .= " AND DATE(sale_date) BETWEEN ? AND ?";
        $params[] = $start_date;
        $params[] = $end_date;
        $types .= "ss";
    } elseif ($start_date) {
        $sql_data .= " AND DATE(sale_date) >= ?";
        $sql_count .= " AND DATE(sale_date) >= ?";
        $params[] = $start_date;
        $types .= "s";
    } elseif ($end_date) {
        $sql_data .= " AND DATE(sale_date) <= ?";
        $sql_count .= " AND DATE(sale_date) <= ?";
        $params[] = $end_date;
        $types .= "s";
    }
    
    $sql_data .= " ORDER BY sale_date DESC LIMIT ? OFFSET ?";
    $params[] = $page_size;
    $params[] = $offset;
    $types .= "ii";
    
    // Get total count
    $stmt_count = $conn->prepare($sql_count);
    if ($params) {
        $stmt_count->bind_param($types, ...array_slice($params, 0, count($params)-2));
    }
    $stmt_count->execute();
    $count_result = $stmt_count->get_result();
    $total_count = $count_result->fetch_assoc()['total'];
    $stmt_count->close();
    
    // Get data
    $stmt_data = $conn->prepare($sql_data);
    if ($params) {
        $stmt_data->bind_param($types, ...$params);
    }
    $stmt_data->execute();
    $data_result = $stmt_data->get_result();
    
    $sales_data = [];
    while($row = $data_result->fetch_assoc()) {
        $sales_data[] = $row;
    }
    
    $data_result->free();
    $stmt_data->close();
    
    // Get summary
    $sql_summary = "SELECT 
                   COALESCE(SUM(CASE WHEN status = 'confirmed' THEN total ELSE 0 END), 0) as total_sales,
                   COALESCE(SUM(CASE WHEN status = 'confirmed' THEN quantity ELSE 0 END), 0) as total_items,
                   COUNT(*) as total_orders,
                   COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
                   COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_orders,
                   COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders
                   FROM sales";
    
    if ($start_date && $end_date) {
        $sql_summary .= " WHERE DATE(sale_date) BETWEEN ? AND ?";
    } elseif ($start_date) {
        $sql_summary .= " WHERE DATE(sale_date) >= ?";
    } elseif ($end_date) {
        $sql_summary .= " WHERE DATE(sale_date) <= ?";
    }
    
    $stmt_summary = $conn->prepare($sql_summary);
    if ($start_date || $end_date) {
        if ($start_date && $end_date) {
            $stmt_summary->bind_param("ss", $start_date, $end_date);
        } else {
            $date = $start_date ?: $end_date;
            $stmt_summary->bind_param("s", $date);
        }
    }
    $stmt_summary->execute();
    $summary_result = $stmt_summary->get_result();
    $summary = $summary_result->fetch_assoc();
    $stmt_summary->close();
    
    echo json_encode([
        'success' => true,
        'data' => $sales_data,
        'pagination' => [
            'page' => $page,
            'page_size' => $page_size,
            'total_count' => $total_count,
            'total_pages' => ceil($total_count / $page_size)
        ],
        'summary' => $summary,
        'filters' => [
            'start_date' => $start_date,
            'end_date' => $end_date
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