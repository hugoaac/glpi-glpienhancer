<?php

declare(strict_types=1);

namespace GlpiPlugin\Glpienhancer;

use Glpi\Plugin\Hooks;

/**
 * Ponto central de registro do plugin e seus hooks oficiais.
 */
final class Plugin
{
    public static function init(array &$pluginHooks): void
    {
        $pluginHooks[Hooks::ITEM_ADD]['glpienhancer'] = [
            \Ticket::class => 'plugin_glpienhancer_ticket_post_add',
        ];

        $pluginHooks['add_css']['glpienhancer'] = ['css/enhancer.css'];
        $pluginHooks[Hooks::ADD_CSS_ANONYMOUS_PAGE]['glpienhancer'] = 'css/enhancer.css';
        $pluginHooks['add_javascript']['glpienhancer'] = ['js/enhancer.js'];
        $pluginHooks[Hooks::ADD_JAVASCRIPT_ANONYMOUS_PAGE]['glpienhancer'] = 'js/enhancer.js';
        $pluginHooks[Hooks::ADD_HEADER_TAG]['glpienhancer'] = self::buildHeaderTags();
        $pluginHooks[Hooks::ADD_HEADER_TAG_ANONYMOUS_PAGE]['glpienhancer'] = self::buildHeaderTags();

        Logger::debug('Hooks ITEM_ADD, assets públicos, páginas anônimas e metadados de configuração foram registrados.');
    }

    /**
     * @return array<int, array{tag: string, properties: array<string, string>}>
     */
    private static function buildHeaderTags(): array
    {
        $tags = [
            [
                'tag'        => 'meta',
                'properties' => [
                    'name'    => 'glpienhancer-marker-prefix',
                    'content' => TicketNotifier::TOKEN_PREFIX . '|',
                ],
            ],
        ];

        $pendingNotification = TicketNotifier::consumePendingNotification();
        if ($pendingNotification !== null) {
            $tags[] = [
                'tag'        => 'meta',
                'properties' => [
                    'name'    => 'glpienhancer-pending-ticket-id',
                    'content' => (string) $pendingNotification['ticket_id'],
                ],
            ];
            $tags[] = [
                'tag'        => 'meta',
                'properties' => [
                    'name'    => 'glpienhancer-pending-ticket-url',
                    'content' => (string) $pendingNotification['ticket_url'],
                ],
            ];
        }

        if (PageAssets::isTicketListPage()) {
            $clientConfig = TicketAutoRefresh::getClientConfig();

            $tags[] = [
                'tag'        => 'meta',
                'properties' => [
                    'name'    => 'glpienhancer-refresh-interval-ms',
                    'content' => (string) ($clientConfig['interval_ms'] ?? TicketAutoRefresh::DEFAULT_INTERVAL_MS),
                ],
            ];
            $tags[] = [
                'tag'        => 'meta',
                'properties' => [
                    'name'    => 'glpienhancer-idle-threshold-ms',
                    'content' => (string) ($clientConfig['idle_ms'] ?? TicketAutoRefresh::IDLE_THRESHOLD_MS),
                ],
            ];
            $tags[] = [
                'tag'        => 'meta',
                'properties' => [
                    'name'    => 'glpienhancer-storage-key',
                    'content' => (string) ($clientConfig['storage_key'] ?? TicketAutoRefresh::STORAGE_KEY),
                ],
            ];
            $tags[] = [
                'tag'        => 'meta',
                'properties' => [
                    'name'    => 'glpienhancer-interval-storage-key',
                    'content' => (string) ($clientConfig['interval_storage_key'] ?? TicketAutoRefresh::INTERVAL_STORAGE_KEY),
                ],
            ];
            $tags[] = [
                'tag'        => 'meta',
                'properties' => [
                    'name'    => 'glpienhancer-interval-options-ms',
                    'content' => implode(',', $clientConfig['interval_options_ms'] ?? []),
                ],
            ];
        }

        return $tags;
    }
}
