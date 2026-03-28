<?php

declare(strict_types=1);

namespace GlpiPlugin\Glpienhancer;

/**
 * Parâmetros canônicos do auto-refresh inteligente.
 */
final class TicketAutoRefresh
{
    public const DEFAULT_INTERVAL_MS = 60000;
    public const IDLE_THRESHOLD_MS = 30000;
    public const STORAGE_KEY = 'glpienhancer:auto-refresh-enabled';
    public const INTERVAL_STORAGE_KEY = 'glpienhancer:auto-refresh-interval-ms';

    /**
     * @var list<int>
     */
    private const AVAILABLE_INTERVALS_MS = [30000, 60000, 120000, 300000];

    /**
     * @return array{interval_ms:int,idle_ms:int,storage_key:string,interval_storage_key:string,interval_options_ms:list<int>}
     */
    public static function getClientConfig(): array
    {
        return [
            'interval_ms'          => self::DEFAULT_INTERVAL_MS,
            'idle_ms'              => self::IDLE_THRESHOLD_MS,
            'storage_key'          => self::STORAGE_KEY,
            'interval_storage_key' => self::INTERVAL_STORAGE_KEY,
            'interval_options_ms'  => self::AVAILABLE_INTERVALS_MS,
        ];
    }
}
