<?php
// Enable error reporting for debugging
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Database configuration
$db_host = 'localhost';      // Your database host
$db_name = 'hexamc_rewards';  // Your database name
$db_user = 'root';           // Your database username
$db_pass = '';               // Your database password

// Set headers for CORS and JSON response
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Initialize response array
$response = [
    'success' => false,
    'message' => 'An error occurred.'
];

// Database connection
try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Create claims table if it doesn't exist
    $pdo->exec("CREATE TABLE IF NOT EXISTS claims (
        id VARCHAR(50) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        mcname VARCHAR(255) DEFAULT NULL,
        code VARCHAR(100) NOT NULL,
        reward_type VARCHAR(50) NOT NULL,
        reward_name VARCHAR(255) NOT NULL,
        timestamp DATETIME NOT NULL,
        status VARCHAR(20) DEFAULT 'claimed',
        ip_address VARCHAR(45) DEFAULT NULL,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");
    
} catch (PDOException $e) {
    error_log("Database connection failed: " . $e->getMessage());
    $response['message'] = 'Database connection failed. Please try again later.';
    http_response_code(500);
    echo json_encode($response);
    exit();
}

try {
    // Handle GET requests for admin panel
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        error_log('GET request received. Query params: ' . json_encode($_GET));
        
        // Check for admin authentication
        if (!isset($_GET['admin_key'])) {
            throw new Exception('No admin key provided');
        }
        
        if ($_GET['admin_key'] !== 'your_secure_admin_key') {
            throw new Exception('Invalid admin key');
        }
        
        error_log('Admin authentication successful');
        
        error_log('Executing database query...');
        $stmt = $pdo->query("SELECT * FROM claims ORDER BY created_at DESC");
        if ($stmt === false) {
            $error = $pdo->errorInfo();
            error_log('Database query failed: ' . json_encode($error));
            throw new Exception('Database query failed: ' . $error[2]);
        }
        $claims = $stmt->fetchAll(PDO::FETCH_ASSOC);
        error_log('Fetched ' . count($claims) . ' claims from database');
        
        // Convert timestamp to ISO format for consistency
        foreach ($claims as &$claim) {
            if (isset($claim['timestamp'])) {
                $claim['timestamp'] = date('c', strtotime($claim['timestamp']));
            }
            if (isset($claim['created_at'])) {
                $claim['created_at'] = date('c', strtotime($claim['created_at']));
            }
        }
        
        $response = [
            'success' => true,
            'data' => $claims
        ];
        
        echo json_encode($response, JSON_PRETTY_PRINT);
        exit();
    }
    
    // Handle DELETE requests for admin panel
    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($input['admin_key']) || $input['admin_key'] !== 'your_secure_admin_key') {
            throw new Exception('Unauthorized');
        }
        
        if (empty($input['id'])) {
            throw new Exception('Missing claim ID');
        }
        
        $stmt = $pdo->prepare("DELETE FROM claims WHERE id = ?");
        $stmt->execute([$input['id']]);
        
        $response = [
            'success' => true,
            'message' => 'Claim deleted successfully'
        ];
        
        echo json_encode($response, JSON_PRETTY_PRINT);
        exit();
    }

    // Only accept POST requests for new claims
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Invalid request method. Only POST is allowed.');
    }

    // Get JSON input
    $json = file_get_contents('php://input');
    if (empty($json)) {
        throw new Exception('No input received');
    }
    
    $input = json_decode($json, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Invalid JSON input: ' . json_last_error_msg());
    }
    
    // Get and validate required fields
    $required = ['email', 'code', 'reward_type', 'reward_name'];
    foreach ($required as $field) {
        if (empty($input[$field])) {
            throw new Exception("Missing required field: $field");
        }
    }
    
    $email = filter_var($input['email'], FILTER_SANITIZE_EMAIL);
    $mcname = isset($input['mcname']) ? filter_var($input['mcname'], FILTER_SANITIZE_STRING) : '';
    $code = filter_var($input['code'], FILTER_SANITIZE_STRING);
    $reward_type = filter_var($input['reward_type'], FILTER_SANITIZE_STRING);
    $reward_name = filter_var($input['reward_name'], FILTER_SANITIZE_STRING);
    $timestamp = date('Y-m-d H:i:s');
    $ip_address = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $user_agent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
    
    // Generate a unique ID
    $claimId = uniqid('claim_', true);
    
    // Insert claim into database
    $stmt = $pdo->prepare("INSERT INTO claims 
        (id, email, mcname, code, reward_type, reward_name, timestamp, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    
    $stmt->execute([
        $claimId,
        $email,
        $mcname,
        $code,
        $reward_type,
        $reward_name,
        $timestamp,
        $ip_address,
        $user_agent
    ]);
    
    // Prepare claim data for response
    $claimData = [
        'id' => $claimId,
        'email' => $email,
        'mcname' => $mcname,
        'code' => $code,
        'reward_type' => $reward_type,
        'reward_name' => $reward_name,
        'timestamp' => $timestamp,
        'status' => 'claimed',
        'ip_address' => $ip_address,
        'created_at' => date('c')
    ];
    
    // Try to send email notification (but don't fail the request if this fails)
    $emailSent = false;
    try {
        $to = 'shahidreza62008@gmail.com';
        $subject = "HEXAMC Reward Claimed: $reward_name";
        $body = "A reward has been claimed on HEXAMC.\n\n" .
                "Minecraft Name: $mcname\n" .
                "Email: $email\n" .
                "Code: $code\n" .
                "Reward Type: $reward_type\n" .
                "Reward Name: $reward_name\n" .
                "Date & Time: $timestamp\n" .
                "IP Address: $ip_address\n" .
                "User Agent: $user_agent\n";
        
        $headers = "From: noreply@hexamc.com\r\n" .
                 "Reply-To: noreply@hexamc.com\r\n" .
                 "X-Mailer: PHP/" . phpversion();
        
        $emailSent = @mail($to, $subject, $body, $headers);
    } catch (Exception $e) {
        // Log error but don't fail the request
        error_log("Failed to send email: " . $e->getMessage());
    }
    
    // Return success response
    $response = [
        'success' => true,
        'message' => 'Reward claimed successfully' . ($emailSent ? '. Email notification sent.' : ''),
        'claim' => $claimData,
        'email_sent' => $emailSent
    ];
    
} catch (Exception $e) {
    // Log the error
    error_log("Reward claim error: " . $e->getMessage());
    
    // Return error response
    http_response_code(400);
    $response = [
        'success' => false,
        'message' => $e->getMessage(),
        'error' => true
    ];
}

// Output the JSON response
header('Content-Type: application/json');
echo json_encode($response, JSON_PRETTY_PRINT);