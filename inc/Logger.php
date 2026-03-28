<?php

declare(strict_types=1);

namespace GlpiPlugin\Glpienhancer;

/**
 * Camada mínima de rastreabilidade do plugin.
 */
final class Logger
{
    private const FILE = 'glpienhancer';

    public static function debug(string $message): void
    {
        self::write('DEBUG', $message);
    }

    public static function info(string $message): void
    {
        self::write('INFO', $message);
    }

    public static function warning(string $message): void
    {
        self::write('WARNING', $message);
    }

    private static function write(string $level, string $message): void
    {
        if (!class_exists(\Toolbox::class)) {
            return;
        }

        $line = sprintf("[%s] %s\n", $level, $message);
        \Toolbox::logInFile(self::FILE, $line);
    }
}
