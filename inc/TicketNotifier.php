<?php

declare(strict_types=1);

namespace GlpiPlugin\Glpienhancer;

/**
 * Responsável por transformar a criação de um chamado em uma notificação transitória.
 */
final class TicketNotifier
{
    public const TOKEN_PREFIX = 'GLPIENHANCER_TICKET_CREATED';
    private const SESSION_KEY = 'glpienhancer_pending_ticket_notification';

    public static function handleTicketCreated(\CommonDBTM $item): void
    {
        if (!$item instanceof \Ticket) {
            Logger::warning('handleTicketCreated recebeu item que não é Ticket.');
            return;
        }

        $ticketId = (int) ($item->fields['id'] ?? $item->getID() ?? 0);
        if ($ticketId <= 0) {
            Logger::warning('Hook ITEM_ADD executado, mas o ID do chamado não pôde ser resolvido.');
            return;
        }

        $ticketUrl = self::buildTicketUrl($ticketId);
        self::storePendingNotification($ticketId, $ticketUrl);

        Logger::info(sprintf('Chamado criado detectado pelo plugin. Ticket #%d | URL: %s', $ticketId, $ticketUrl));
        Logger::debug(sprintf('Notificação do chamado #%d será entregue apenas pelo canal de sessão/metadados.', $ticketId));
    }

    /**
     * @return array{ticket_id:int,ticket_url:string}|null
     */
    public static function consumePendingNotification(): ?array
    {
        if (!isset($_SESSION) || !is_array($_SESSION)) {
            return null;
        }

        $payload = $_SESSION[self::SESSION_KEY] ?? null;
        unset($_SESSION[self::SESSION_KEY]);

        if (!is_array($payload)) {
            return null;
        }

        $ticketId = (int) ($payload['ticket_id'] ?? 0);
        $ticketUrl = trim((string) ($payload['ticket_url'] ?? ''));
        if ($ticketId <= 0 || $ticketUrl === '') {
            return null;
        }

        Logger::debug(sprintf('Notificação pendente consumida para Ticket #%d.', $ticketId));

        return [
            'ticket_id'  => $ticketId,
            'ticket_url' => $ticketUrl,
        ];
    }

    private static function storePendingNotification(int $ticketId, string $ticketUrl): void
    {
        if (!isset($_SESSION) || !is_array($_SESSION)) {
            Logger::warning('Sessão indisponível ao tentar armazenar notificação pendente de chamado criado.');
            return;
        }

        $_SESSION[self::SESSION_KEY] = [
            'ticket_id'  => $ticketId,
            'ticket_url' => $ticketUrl,
        ];

        Logger::debug(sprintf('Notificação pendente armazenada em sessão para Ticket #%d.', $ticketId));
    }

    private static function buildTicketUrl(int $ticketId): string
    {
        global $CFG_GLPI;

        $rootDoc = rtrim((string) ($CFG_GLPI['root_doc'] ?? ''), '/');

        return $rootDoc . '/front/ticket.form.php?id=' . $ticketId;
    }

}
