<?php

declare(strict_types=1);

use GlpiPlugin\Glpienhancer\Logger;
use GlpiPlugin\Glpienhancer\Plugin;

/**
 * Bootstrap do plugin glpienhancer para GLPI 11.
 */
define('PLUGIN_GLPIENHANCER_VERSION', '1.1.0');
define('PLUGIN_GLPIENHANCER_MIN_GLPI', '11.0.0');
define('PLUGIN_GLPIENHANCER_MAX_GLPI', '12.0.0');
define('PLUGIN_GLPIENHANCER_MIN_PHP', '8.0.0');

spl_autoload_register(static function (string $class): void {
    $prefix = 'GlpiPlugin\\Glpienhancer\\';
    if (strpos($class, $prefix) !== 0) {
        return;
    }

    $relative = substr($class, strlen($prefix));
    $relative = str_replace('\\', '/', $relative);
    $file = __DIR__ . '/inc/' . $relative . '.php';

    if (is_file($file)) {
        require_once $file;
    }
});

require_once __DIR__ . '/hook.php';

function plugin_init_glpienhancer(): void
{
    global $PLUGIN_HOOKS;

    $PLUGIN_HOOKS['csrf_compliant']['glpienhancer'] = true;

    Plugin::init($PLUGIN_HOOKS);
    Logger::debug('plugin_init executado. Hooks, conformidade CSRF e assets registrados.');
}

function plugin_version_glpienhancer(): array
{
    return [
        'name'         => 'GLPI Enhancer',
        'version'      => PLUGIN_GLPIENHANCER_VERSION,
        'author'       => 'Manus AI',
        'license'      => 'MIT',
        'homepage'     => '',
        'requirements' => [
            'glpi' => [
                'min' => PLUGIN_GLPIENHANCER_MIN_GLPI,
                'max' => PLUGIN_GLPIENHANCER_MAX_GLPI,
            ],
            'php' => [
                'min' => PLUGIN_GLPIENHANCER_MIN_PHP,
            ],
        ],
    ];
}

function plugin_glpienhancer_check_prerequisites(): bool
{
    if (!defined('GLPI_VERSION')) {
        return false;
    }

    if (version_compare(GLPI_VERSION, PLUGIN_GLPIENHANCER_MIN_GLPI, '<')
        || version_compare(GLPI_VERSION, PLUGIN_GLPIENHANCER_MAX_GLPI, '>=')) {
        echo 'O plugin glpienhancer requer GLPI 11.x.';
        return false;
    }

    if (version_compare(PHP_VERSION, PLUGIN_GLPIENHANCER_MIN_PHP, '<')) {
        echo 'O plugin glpienhancer requer PHP 8.0 ou superior.';
        return false;
    }

    return true;
}

function plugin_glpienhancer_check_config(bool $verbose = false): bool
{
    return true;
}
