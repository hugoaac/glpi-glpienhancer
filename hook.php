<?php

declare(strict_types=1);

use GlpiPlugin\Glpienhancer\TicketNotifier;

/**
 * Instalação sem persistência adicional na V1.
 */
function plugin_glpienhancer_install(): bool
{
    return true;
}

/**
 * Desinstalação sem artefatos persistentes na V1.
 */
function plugin_glpienhancer_uninstall(): bool
{
    return true;
}

/**
 * Callback pós-criação de Ticket.
 *
 * Atua como hook oficial de pós-inclusão do item Ticket e prepara a
 * mensagem transitória que será promovida para toast pelo JavaScript.
 */
function plugin_glpienhancer_ticket_post_add(\CommonDBTM $item): void
{
    if (!$item instanceof \Ticket) {
        return;
    }

    TicketNotifier::handleTicketCreated($item);
}
