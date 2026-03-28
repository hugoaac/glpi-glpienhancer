<?php

declare(strict_types=1);

namespace GlpiPlugin\Glpienhancer;

/**
 * Utilitário para delimitar contexto de páginas compatíveis com os recursos do plugin.
 */
final class PageAssets
{
    public static function getRequestUri(?string $requestUri = null): string
    {
        return strtolower((string) ($requestUri ?? ($_SERVER['REQUEST_URI'] ?? '')));
    }

    /**
     * Identifica páginas relacionadas a chamados no GLPI.
     */
    public static function isTicketContext(?string $requestUri = null): bool
    {
        $uri = self::getRequestUri($requestUri);

        return str_contains($uri, '/ticket.php')
            || str_contains($uri, '/ticket.form.php')
            || str_contains($uri, 'ticket');
    }

    /**
     * Identifica especificamente a listagem principal de chamados (ticket.php).
     */
    public static function isTicketListPage(?string $requestUri = null): bool
    {
        $uri = self::getRequestUri($requestUri);

        return str_contains($uri, '/front/ticket.php')
            || preg_match('#(?:^|/)ticket\.php(?:\?|$)#', $uri) === 1;
    }
}
