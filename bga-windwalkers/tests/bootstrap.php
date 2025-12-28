<?php
/**
 * PHPUnit bootstrap file
 * Sets up the test environment
 */

// Define base path for tests
define('BGA_TESTS_PATH', __DIR__);
define('BGA_ROOT_PATH', dirname(__DIR__));

// Autoload composer dependencies if available
$autoload = BGA_ROOT_PATH . '/vendor/autoload.php';
if (file_exists($autoload)) {
    require_once $autoload;
}

// Load PHPUnit
if (!class_exists('PHPUnit\Framework\TestCase')) {
    // PHPUnit not installed via Composer, this file might be in a different setup
    // Tests can still run if PHPUnit is installed globally
}
