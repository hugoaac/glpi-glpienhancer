# Documentação Técnica — GLPIEnhancer

**Versão:** 1.1.0 | **Plataforma:** GLPI 11.x | **PHP:** 8.0+

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Estrutura de Diretórios](#2-estrutura-de-diretórios)
3. [Fluxo de Execução](#3-fluxo-de-execução)
4. [Backend PHP](#4-backend-php)
   - [setup.php](#41-setupphp)
   - [hook.php](#42-hookphp)
   - [Plugin.php](#43-pluginphp)
   - [TicketNotifier.php](#44-ticketnotifierphp)
   - [TicketAutoRefresh.php](#45-ticketautorefreshphp)
   - [PageAssets.php](#46-pageassetsphp)
   - [Logger.php](#47-loggerphp)
5. [Frontend JavaScript](#5-frontend-javascript)
   - [Inicialização e Configuração](#51-inicialização-e-configuração)
   - [Sistema de Toast](#52-sistema-de-toast)
   - [Painel de Auto-Refresh](#53-painel-de-auto-refresh)
   - [Rastreamento de Atividade](#54-rastreamento-de-atividade)
   - [Utilitários](#55-utilitários)
6. [CSS](#6-css)
7. [Integração com GLPI — Hooks](#7-integração-com-glpi--hooks)
8. [Mecanismos de Persistência](#8-mecanismos-de-persistência)
9. [Canal de Comunicação PHP → JS](#9-canal-de-comunicação-php--js)
10. [Logging e Depuração](#10-logging-e-depuração)
11. [Release e Deploy](#11-release-e-deploy)
12. [Guia de Alterações Comuns](#12-guia-de-alterações-comuns)

---

## 1. Visão Geral

O GLPIEnhancer adiciona duas funcionalidades ao GLPI 11:

| Funcionalidade | Descrição |
|---|---|
| **Toast de criação de chamado** | Exibe uma notificação visual (toast) confirmando a criação de um chamado, com link direto para ele. |
| **Auto-refresh da lista de chamados** | Painel de controle que recarrega a lista de chamados automaticamente com base em condições de inatividade do usuário. |

O plugin não possui banco de dados próprio, não realiza chamadas AJAX e não tem dependências externas (zero pacotes Composer/npm).

---

## 2. Estrutura de Diretórios

```
glpienhancer/
├── setup.php                     ← Bootstrap: funções obrigatórias do GLPI
├── hook.php                      ← Callbacks dos hooks (install, uninstall, ITEM_ADD)
├── inc/                          ← Classes PHP (autoload via PSR-4)
│   ├── Plugin.php                ← Registro de todos os hooks e assets
│   ├── TicketNotifier.php        ← Notificação de chamado via sessão PHP
│   ├── TicketAutoRefresh.php     ← Constantes de configuração do auto-refresh
│   ├── PageAssets.php            ← Detecção de contexto de página
│   └── Logger.php                ← Utilitário de log
├── js/
│   └── enhancer.js               ← Fonte JS (mantido para edição)
├── css/
│   └── enhancer.css              ← Fonte CSS (mantido para edição)
├── public/
│   ├── js/enhancer.js            ← Cópia servida pelo GLPI
│   └── css/enhancer.css          ← Cópia servida pelo GLPI
├── front/
│   └── noop.php                  ← Reservado para UI admin futura
└── .github/workflows/
    └── release.yml               ← CI/CD para geração de releases
```

> **Importante:** Os arquivos em `js/` e `css/` são as fontes de edição. Os arquivos em `public/` são cópias que o GLPI serve. Ao editar o JS ou CSS, copie também para `public/`.

---

## 3. Fluxo de Execução

### 3.1 Inicialização do Plugin

```
GLPI carrega setup.php
  └─→ plugin_init_glpienhancer()
        └─→ Plugin::init($PLUGIN_HOOKS)
              ├─→ Registra hook ITEM_ADD para Ticket
              ├─→ Registra CSS e JS (páginas autenticadas e anônimas)
              └─→ Registra callback de meta tags de configuração
```

### 3.2 Criação de Chamado (Toast)

```
Usuário submete formulário de chamado
  └─→ GLPI cria Ticket no banco
        └─→ Hook ITEM_ADD dispara plugin_glpienhancer_ticket_post_add()
              └─→ TicketNotifier::handleTicketCreated($item)
                    ├─→ Extrai ticket_id e monta URL
                    └─→ Armazena em $_SESSION['glpienhancer_pending_ticket_notification']

Próxima página carregada pelo browser
  └─→ Plugin::buildHeaderTags() executa
        └─→ TicketNotifier::consumePendingNotification()
              ├─→ Lê sessão, remove entrada e retorna dados
              └─→ Injeta meta tags: glpienhancer-pending-ticket-id, glpienhancer-pending-ticket-url

  └─→ enhancer.js inicializa
        └─→ promotePendingTicketMetaToToast()
              ├─→ Lê meta tags
              └─→ displayToast(ticketId, ticketUrl)
```

### 3.3 Auto-Refresh (Lista de Chamados)

```
Usuário acessa /front/ticket.php
  └─→ enhancer.js detecta isTicketListPage()
        └─→ mountAutoRefreshPanel()
              ├─→ Lê preferências do localStorage
              ├─→ Renderiza painel de controle no DOM
              └─→ startCountdownLoop()
                    └─→ tickRefreshCycle() a cada 1 segundo
                          ├─→ canRefresh()?
                          │     ├─→ Auto-refresh ativado?
                          │     ├─→ Intervalo decorrido?
                          │     ├─→ Aba visível?
                          │     ├─→ Usuário inativo ≥ 30s?
                          │     └─→ Sem campo editável focado?
                          └─→ SE sim: window.location.reload()
```

---

## 4. Backend PHP

### 4.1 setup.php

Arquivo de bootstrap exigido pelo GLPI. Contém:

| Função | Papel |
|---|---|
| `plugin_version_glpienhancer()` | Retorna metadados do plugin (nome, versão, compatibilidade). |
| `plugin_glpienhancer_check_prerequisites()` | Valida versão do GLPI (11.x) e PHP (≥8.0). |
| `plugin_glpienhancer_check_config()` | Validação de configuração (sempre retorna `true`). |
| `plugin_init_glpienhancer()` | Chama `Plugin::init()` para registrar hooks e assets. |

**Constantes definidas:**

```php
PLUGIN_GLPIENHANCER_VERSION   = '1.1.0'
PLUGIN_GLPIENHANCER_MIN_GLPI  = '11.0.0'
PLUGIN_GLPIENHANCER_MAX_GLPI  = '12.0.0'
PLUGIN_GLPIENHANCER_MIN_PHP   = '8.0.0'
```

**Autoloader:**
Registra via `spl_autoload_register` o namespace `GlpiPlugin\Glpienhancer\` mapeado para `/inc/{ClassName}.php`.

---

### 4.2 hook.php

Contém os callbacks de ciclo de vida do plugin:

| Função | Papel |
|---|---|
| `plugin_glpienhancer_install()` | Executada na instalação. No-op (sem tabelas). |
| `plugin_glpienhancer_uninstall()` | Executada na desinstalação. No-op. |
| `plugin_glpienhancer_ticket_post_add($item)` | Callback do hook `ITEM_ADD`. Delega para `TicketNotifier::handleTicketCreated()`. |

---

### 4.3 Plugin.php

**Classe:** `GlpiPlugin\Glpienhancer\Plugin`
**Localização:** [inc/Plugin.php](inc/Plugin.php)

Ponto central de registro de todos os hooks e assets. Todos os métodos são estáticos.

#### `Plugin::init(array &$pluginHooks): void`

Registra no array global `$PLUGIN_HOOKS`:

```php
// Hook de evento: chamado após criação de Ticket
$pluginHooks[Hooks::ITEM_ADD]['glpienhancer'][\Ticket::class]
    = 'plugin_glpienhancer_ticket_post_add';

// Assets em páginas autenticadas
$pluginHooks['add_css']['glpienhancer']       = ['css/enhancer.css'];
$pluginHooks['add_javascript']['glpienhancer'] = ['js/enhancer.js'];

// Assets em páginas anônimas (ex: login)
$pluginHooks[Hooks::ADD_CSS_ANONYMOUS_PAGE]['glpienhancer']        = 'css/enhancer.css';
$pluginHooks[Hooks::ADD_JAVASCRIPT_ANONYMOUS_PAGE]['glpienhancer'] = 'js/enhancer.js';

// Meta tags de configuração
$pluginHooks[Hooks::ADD_HEADER_TAG]['glpienhancer']               = [Plugin::class, 'buildHeaderTags'];
$pluginHooks[Hooks::ADD_HEADER_TAG_ANONYMOUS_PAGE]['glpienhancer'] = [Plugin::class, 'buildHeaderTags'];

// Conformidade CSRF
$pluginHooks['csrf_compliant']['glpienhancer'] = true;
```

#### `Plugin::buildHeaderTags(): void`

Chamado pelo GLPI ao montar o `<head>` de cada página. Injeta meta tags:

| Meta tag | Valor | Origem |
|---|---|---|
| `glpienhancer-marker-prefix` | `'GLPIENHANCER_TICKET_CREATED'` | Constante |
| `glpienhancer-pending-ticket-id` | ID do chamado recém-criado | `TicketNotifier::consumePendingNotification()` |
| `glpienhancer-pending-ticket-url` | URL do chamado | `TicketNotifier::consumePendingNotification()` |
| `glpienhancer-refresh-interval-ms` | `60000` | `TicketAutoRefresh::DEFAULT_INTERVAL_MS` |
| `glpienhancer-idle-threshold-ms` | `30000` | `TicketAutoRefresh::IDLE_THRESHOLD_MS` |
| `glpienhancer-storage-key` | `'glpienhancer:auto-refresh-enabled'` | `TicketAutoRefresh::STORAGE_KEY` |
| `glpienhancer-interval-storage-key` | `'glpienhancer:auto-refresh-interval-ms'` | `TicketAutoRefresh::INTERVAL_STORAGE_KEY` |
| `glpienhancer-interval-options-ms` | `'30000,60000,120000,300000'` | `TicketAutoRefresh::AVAILABLE_INTERVALS_MS` |

---

### 4.4 TicketNotifier.php

**Classe:** `GlpiPlugin\Glpienhancer\TicketNotifier`
**Localização:** [inc/TicketNotifier.php](inc/TicketNotifier.php)

Gerencia a notificação de criação de chamado via sessão PHP.

| Constante | Valor |
|---|---|
| `TOKEN_PREFIX` | `'GLPIENHANCER_TICKET_CREATED'` |
| `SESSION_KEY` | `'glpienhancer_pending_ticket_notification'` |

#### Métodos

**`handleTicketCreated(\CommonDBTM $item): void`**
- Valida que o item é uma instância de `\Ticket`
- Extrai `ticket_id` via `$item->fields['id']` ou `$item->getID()`
- Constrói URL via `buildTicketUrl()`
- Armazena em `$_SESSION[SESSION_KEY]`

**`consumePendingNotification(): ?array`**
- Lê `$_SESSION[SESSION_KEY]`
- Remove da sessão (entrega única)
- Retorna `['ticket_id' => int, 'ticket_url' => string]` ou `null`

**`buildTicketUrl(int $ticketId): string`**
- Retorna `{$CFG_GLPI['root_doc']}/front/ticket.form.php?id={$ticketId}`

---

### 4.5 TicketAutoRefresh.php

**Classe:** `GlpiPlugin\Glpienhancer\TicketAutoRefresh`
**Localização:** [inc/TicketAutoRefresh.php](inc/TicketAutoRefresh.php)

Classe de configuração pura — apenas constantes e um método de serialização.

| Constante | Valor | Descrição |
|---|---|---|
| `DEFAULT_INTERVAL_MS` | `60000` | Intervalo padrão de refresh (60s) |
| `IDLE_THRESHOLD_MS` | `30000` | Tempo de inatividade para considerar usuário idle (30s) |
| `STORAGE_KEY` | `'glpienhancer:auto-refresh-enabled'` | Chave localStorage para estado do toggle |
| `INTERVAL_STORAGE_KEY` | `'glpienhancer:auto-refresh-interval-ms'` | Chave localStorage para intervalo escolhido |
| `AVAILABLE_INTERVALS_MS` | `[30000, 60000, 120000, 300000]` | Opções disponíveis: 30s, 1min, 2min, 5min |

**`getClientConfig(): array`** — Retorna array pronto para serializar em meta tags.

---

### 4.6 PageAssets.php

**Classe:** `GlpiPlugin\Glpienhancer\PageAssets`
**Localização:** [inc/PageAssets.php](inc/PageAssets.php)

Detecta o contexto de página pelo URI atual.

| Método | Retorno | Detecta |
|---|---|---|
| `getRequestUri(?string $uri): string` | string | URI normalizada (lowercase) |
| `isTicketContext(?string $uri): bool` | bool | Qualquer página de chamados (`ticket.php`, `ticket.form.php`, ou `ticket` no URI) |
| `isTicketListPage(?string $uri): bool` | bool | Especificamente `/front/ticket.php` (listagem principal) |

> Usada atualmente apenas para verificar se deve montar o painel de auto-refresh (do lado JS, não PHP).

---

### 4.7 Logger.php

**Classe:** `GlpiPlugin\Glpienhancer\Logger`
**Localização:** [inc/Logger.php](inc/Logger.php)

Wrapper estático sobre `Toolbox::logInFile()` do GLPI.

| Método | Nível |
|---|---|
| `Logger::debug(string $msg)` | DEBUG |
| `Logger::info(string $msg)` | INFO |
| `Logger::warning(string $msg)` | WARNING |

**Arquivo de log:** `{GLPI_LOG_DIR}/glpienhancer.log`
**Formato:** `[LEVEL] mensagem\n`

---

## 5. Frontend JavaScript

**Arquivo:** [js/enhancer.js](js/enhancer.js) (fonte) / [public/js/enhancer.js](public/js/enhancer.js) (servido)

O script é encapsulado em IIFE e usa um guard `window.__GLPIENHANCER_BOOTED__` para evitar dupla execução.

### 5.1 Inicialização e Configuração

Ao carregar, o script lê as meta tags do `<head>` e monta o objeto `CONFIG`:

```javascript
CONFIG = {
  refreshIntervalMs: 60000,           // Intervalo de refresh padrão
  idleThresholdMs: 30000,             // Threshold de inatividade
  storageKey: 'glpienhancer:auto-refresh-enabled',
  intervalStorageKey: 'glpienhancer:auto-refresh-interval-ms',
  refreshIntervalOptionsMs: [30000, 60000, 120000, 300000],
  countdownStepMs: 1000,              // Frequência de atualização do countdown
  toastDurationMs: 5000,              // Duração do toast em ms
  activityDebounceMs: 1200,           // Debounce do rastreamento de atividade
  markerPrefix: 'GLPIENHANCER_TICKET_CREATED|',
}
```

A função `boot()` é a entrada principal. Ela sequencia:
1. `promotePendingTicketMetaToToast()` — verifica meta tags para toast
2. `promoteTicketCreationFlashToToast()` — varredura legada de DOM
3. `observeMarkerInsertions()` — MutationObserver para inserções tardias
4. Se `isTicketListPage()`: `mountAutoRefreshPanel()`

---

### 5.2 Sistema de Toast

**Propósito:** Exibir confirmação visual após criação de chamado.

#### Formato do Marker (legado via DOM)

O GLPI pode renderizar uma mensagem de flash após criação de chamado. O plugin embute um marcador nessa mensagem:

```
GLPIENHANCER_TICKET_CREATED|{ticketId}|{base64url(ticketUrl)}
```

O JS detecta esse texto no DOM, extrai os dados e remove o texto do marcador da exibição.

#### Funções principais

| Função | Papel |
|---|---|
| `promotePendingTicketMetaToToast()` | Lê meta tags `glpienhancer-pending-ticket-id` e `glpienhancer-pending-ticket-url` e chama `displayToast()` |
| `promoteTicketCreationFlashToToast()` | Varre DOM em busca do marker de texto e chama `displayToast()` |
| `observeMarkerInsertions()` | `MutationObserver` que monitora inserções dinâmicas de nós de texto com o marker |
| `findTicketMarkerCandidate(root)` | Recursivamente busca o nó de texto com o marker |
| `parseMarkerPayload(rawText)` | Parseia o formato `PREFIX|ID|BASE64URL` |
| `cleanupMarkerPresentation(node, rawMarker)` | Remove o marker do DOM sem remover o restante do texto |
| `displayToast(ticketId, ticketUrl)` | Guard contra duplicatas + chama `createToast()` |
| `createToast(ticketId, ticketUrl)` | Constrói o elemento DOM do toast |
| `ensureToastContainer()` | Garante existência do container fixo no canto superior direito |
| `dismissToast(toast)` | Anima e remove o toast do DOM |

#### Estrutura DOM do Toast

```html
<aside class="glpienhancer-toast" role="status" aria-live="polite" data-ticket-id="123">
  <div class="glpienhancer-toast__icon">✓</div>
  <div class="glpienhancer-toast__content">
    <div class="glpienhancer-toast__title">Chamado criado com sucesso</div>
    <div class="glpienhancer-toast__text">
      O chamado <strong>#123</strong> já está disponível.
    </div>
  </div>
  <div class="glpienhancer-toast__actions">
    <a href="..." class="glpienhancer-toast__link">Abrir chamado</a>
    <button class="glpienhancer-toast__close" aria-label="Fechar notificação">×</button>
  </div>
</aside>
```

---

### 5.3 Painel de Auto-Refresh

**Montado apenas em:** `/front/ticket.php`

#### Estado interno

```javascript
let autoRefreshEnabled;    // boolean — lido do localStorage
let currentIntervalMs;     // number — lido do localStorage
let lastRefreshAt;         // timestamp da última recarga
let lastInteractionAt;     // timestamp da última atividade do usuário
let lastInputAt;           // timestamp do último input de teclado
```

#### Condições para disparar `window.location.reload()`

Todas as seguintes devem ser verdadeiras (`canRefresh()`):

1. `autoRefreshEnabled === true`
2. `Date.now() - lastRefreshAt >= currentIntervalMs`
3. `!document.hidden` (aba visível)
4. `Date.now() - lastInteractionAt >= idleThresholdMs`
5. `Date.now() - lastInputAt >= idleThresholdMs`
6. Nenhum campo editável ativo (`textarea`, `input`, `[contenteditable]`)

#### Funções principais

| Função | Papel |
|---|---|
| `mountAutoRefreshPanel()` | Cria e insere o painel no DOM, chama `syncRefreshPanel()` e `startCountdownLoop()` |
| `syncRefreshPanel()` | Atualiza badges, textos, classes e botões conforme estado atual |
| `startCountdownLoop()` | `setInterval` de 1s chamando `tickRefreshCycle()` |
| `tickRefreshCycle()` | Verifica `canRefresh()` e, se não, atualiza countdown; se sim, recarrega |
| `bindActivityTracking()` | Registra listeners de eventos de atividade |
| `registerActivity()` | Debounced, atualiza `lastInteractionAt` |

#### Estrutura DOM do Painel

```html
<section class="glpienhancer-refresh-panel">
  <span class="glpienhancer-refresh-panel__badge" data-state="on">Ativo</span>
  <div class="glpienhancer-refresh-panel__copy">
    <div class="glpienhancer-refresh-panel__label">Auto-refresh</div>
    <div class="glpienhancer-refresh-panel__meta">Atualiza a cada 60s quando inativo</div>
  </div>
  <span class="glpienhancer-refresh-panel__countdown">Próxima checagem em 45s</span>
  <label class="glpienhancer-refresh-panel__interval">
    Prazo
    <select class="glpienhancer-refresh-panel__select">
      <option value="30000">30s</option>
      <option value="60000" selected>1 min</option>
      <option value="120000">2 min</option>
      <option value="300000">5 min</option>
    </select>
  </label>
  <button class="glpienhancer-refresh-panel__toggle" data-state="on">Desligar</button>
</section>
```

---

### 5.4 Rastreamento de Atividade

Eventos monitorados para atualizar `lastInteractionAt` e `lastInputAt`:

```
mousemove, mousedown, keydown, scroll, touchstart,
click, input, change, visibilitychange
```

Eventos de teclado/input também atualizam `lastInputAt` separadamente — isso garante que mesmo que o mouse não se mova, digitar em um campo impede o refresh.

---

### 5.5 Utilitários

| Função | Descrição |
|---|---|
| `getMetaContent(name, fallback)` | Lê `<meta name="..." content="...">` |
| `getMetaNumber(name, fallback)` | Lê meta tag como número |
| `getMetaNumberList(name, fallback)` | Lê meta tag como array de números (CSV) |
| `getStoredPreference()` | Lê auto-refresh ativado/desativado do localStorage |
| `persistPreference(enabled)` | Salva estado no localStorage |
| `getStoredInterval()` | Lê intervalo salvo no localStorage |
| `persistInterval(ms)` | Salva intervalo no localStorage |
| `normalizeInterval(ms)` | Valida contra opções permitidas; retorna padrão se inválido |
| `formatInterval(ms)` | Converte ms para string legível ("30s", "1 min", "2 min") |
| `decodeBase64Url(value)` | Decodifica base64 URL-safe |
| `escapeHtml(value)` | Sanitiza HTML para evitar XSS |
| `escapeSelectorValue(value)` | Escapa valor para uso em seletor CSS |

---

## 6. CSS

**Arquivo:** [css/enhancer.css](css/enhancer.css) (fonte) / [public/css/enhancer.css](public/css/enhancer.css) (servido)

### Variáveis CSS

```css
--glpienhancer-ink-950: #101822        /* texto escuro */
--glpienhancer-ink-800: #223142
--glpienhancer-ink-700: #30465d
--glpienhancer-paper: #f5f8fb          /* fundo claro */
--glpienhancer-line: rgba(22,42,64,.12)
--glpienhancer-shadow: 0 18px 40px rgba(16,24,34,.16)
--glpienhancer-success-700: #0d7a53    /* verde escuro */
--glpienhancer-success-600: #139a68    /* verde principal */
--glpienhancer-success-100: #e9f8f1    /* fundo verde claro */
--glpienhancer-muted-500: #708297      /* texto secundário */
--glpienhancer-muted-200: #d5dee8      /* bordas claras */
--glpienhancer-white: #ffffff
```

### Componentes

| Seletor | Descrição |
|---|---|
| `.glpienhancer-toast-container` | Container fixo topo-direita, z-index 9999 |
| `.glpienhancer-toast` | Card do toast, grid icon+content+actions |
| `.glpienhancer-toast.is-visible` | Estado visível (opacity 1, transform normal) |
| `.glpienhancer-toast.is-leaving` | Animação de saída (opacity 0) |
| `.glpienhancer-toast__icon` | Quadrado verde com ✓ |
| `.glpienhancer-toast__title` | Título em negrito |
| `.glpienhancer-toast__text` | Texto descritivo |
| `.glpienhancer-toast__link` | Botão "Abrir chamado" |
| `.glpienhancer-toast__close` | Botão × para fechar |
| `.glpienhancer-refresh-panel` | Container do painel de auto-refresh |
| `.glpienhancer-refresh-panel__badge` | Pílula "Ativo" / "Desativado" |
| `.glpienhancer-refresh-panel__countdown` | Texto do tempo até próximo refresh |
| `.glpienhancer-refresh-panel__select` | Dropdown de intervalo |
| `.glpienhancer-refresh-panel__toggle` | Botão Ligar/Desligar |

**Responsividade:** Grid horizontal em desktop (≥960px), coluna única em telas menores.

**Acessibilidade:** `prefers-reduced-motion` desativa todas as animações CSS.

---

## 7. Integração com GLPI — Hooks

| Hook | Tipo | Quando dispara | Handler |
|---|---|---|---|
| `plugin_init_glpienhancer` | Init | Plugin ativado / início de requisição | `plugin_init_glpienhancer()` em `setup.php` |
| `Hooks::ITEM_ADD[\Ticket::class]` | Evento | Após criação de qualquer Ticket | `plugin_glpienhancer_ticket_post_add()` em `hook.php` |
| `add_css` | Asset | Renderização de `<head>` autenticado | Carrega `css/enhancer.css` |
| `add_javascript` | Asset | Renderização de `<head>` autenticado | Carrega `js/enhancer.js` |
| `Hooks::ADD_CSS_ANONYMOUS_PAGE` | Asset | Renderização de `<head>` anônimo | Carrega `css/enhancer.css` |
| `Hooks::ADD_JAVASCRIPT_ANONYMOUS_PAGE` | Asset | Renderização de `<head>` anônimo | Carrega `js/enhancer.js` |
| `Hooks::ADD_HEADER_TAG` | Metadata | Renderização de `<head>` autenticado | `Plugin::buildHeaderTags()` |
| `Hooks::ADD_HEADER_TAG_ANONYMOUS_PAGE` | Metadata | Renderização de `<head>` anônimo | `Plugin::buildHeaderTags()` |

---

## 8. Mecanismos de Persistência

### Sessão PHP (servidor)

- **Chave:** `$_SESSION['glpienhancer_pending_ticket_notification']`
- **Dados:** `['ticket_id' => int, 'ticket_url' => string]`
- **Ciclo de vida:** Criado no hook `ITEM_ADD`; consumido e destruído na próxima requisição por `buildHeaderTags()`
- **Entrega:** Uma única vez (one-shot)

### localStorage (cliente)

| Chave | Tipo | Padrão | Descrição |
|---|---|---|---|
| `glpienhancer:auto-refresh-enabled` | `"0"` / `"1"` | `"1"` | Estado do toggle de auto-refresh |
| `glpienhancer:auto-refresh-interval-ms` | string numérica | `"60000"` | Intervalo escolhido pelo usuário |

Ambas persistem entre sessões do browser. Se o localStorage estiver indisponível, o script usa os valores padrão sem erro.

---

## 9. Canal de Comunicação PHP → JS

O backend não tem API. A comunicação é unidirecional via meta tags HTML:

```
PHP (Plugin::buildHeaderTags)
        │
        ▼
<meta name="glpienhancer-..." content="...">  ← no <head>
        │
        ▼
JS (getMetaContent / getMetaNumber / getMetaNumberList)
        │
        ▼
Lógica de toast e auto-refresh
```

Para passar novos dados do PHP para o JS, basta:
1. Adicionar a meta tag em `Plugin::buildHeaderTags()`
2. Ler no JS com `getMetaContent('nome-da-meta', valorPadrão)`

---

## 10. Logging e Depuração

**Arquivo de log:** `{GLPI_LOG_DIR}/glpienhancer.log`

### Mensagens esperadas em operação normal

```
[DEBUG] plugin_init executado. Hooks, conformidade CSRF e assets registrados.
[INFO]  Chamado criado detectado pelo plugin. Ticket #123 | URL: /glpi/front/ticket.form.php?id=123
[DEBUG] Notificação pendente armazenada em sessão para Ticket #123.
[DEBUG] Notificação pendente consumida para Ticket #123.
```

### Mensagens de alerta

```
[WARNING] handleTicketCreated recebeu item que não é Ticket.
[WARNING] Hook ITEM_ADD executado, mas o ID do chamado não pôde ser resolvido.
[WARNING] Sessão indisponível ao tentar armazenar notificação pendente.
```

### Checklist de depuração

1. **Toast não aparece após criar chamado:**
   - Verificar log: linha `[INFO] Chamado criado detectado`?
   - Verificar log: linha `[DEBUG] Notificação pendente consumida`?
   - Inspecionar `<head>` da página seguinte: meta tag `glpienhancer-pending-ticket-id` presente?
   - Console do browser: erros JS?

2. **Auto-refresh não funciona:**
   - Confirmar que está na URL `/front/ticket.php`
   - Verificar meta tag `glpienhancer-refresh-interval-ms` no `<head>`
   - Verificar localStorage: chave `glpienhancer:auto-refresh-enabled` = `"1"`?
   - Mover o mouse e esperar 30s de inatividade

3. **Assets não carregam:**
   - Confirmar que `public/js/enhancer.js` e `public/css/enhancer.css` existem
   - Verificar permissões de arquivo
   - Verificar aba Network do DevTools

---

## 11. Release e Deploy

### Processo de Release (GitHub Actions)

Trigger: push de tag `v*` (ex: `git tag v1.2.0 && git push --tags`)

O workflow:
1. Extrai versão da tag
2. Cria ZIP excluindo: `.git`, `.github`, `.gitignore`, arquivos `.md`, `node_modules`, `vendor`
3. Cria GitHub Release com notas automáticas e ZIP anexado

### Deploy Manual

```bash
# 1. Copiar plugin para o servidor GLPI
cp -r glpienhancer/ /var/www/glpi/plugins/

# 2. Ajustar permissões
chown -R www-data:www-data /var/www/glpi/plugins/glpienhancer/

# 3. Ativar via painel admin GLPI:
#    Administração → Plugins → GLPIEnhancer → Instalar → Ativar
```

### Atualizar JS ou CSS

```bash
# Editar o arquivo fonte
vim js/enhancer.js

# Copiar para public/
cp js/enhancer.js public/js/enhancer.js

# (opcional) Limpar cache do browser
```

---

## 12. Guia de Alterações Comuns

### Adicionar novo intervalo de auto-refresh

1. Editar [inc/TicketAutoRefresh.php](inc/TicketAutoRefresh.php): adicionar valor (em ms) ao array `AVAILABLE_INTERVALS_MS`
2. A meta tag e o `<select>` no JS são gerados dinamicamente — nenhuma outra alteração necessária

### Alterar tempo de exibição do toast

Editar a constante em [js/enhancer.js](js/enhancer.js):
```javascript
toastDurationMs: 5000,  // alterar aqui
```
Copiar para `public/js/enhancer.js`.

### Alterar threshold de inatividade

Backend ([inc/TicketAutoRefresh.php](inc/TicketAutoRefresh.php)):
```php
const IDLE_THRESHOLD_MS = 30000; // alterar aqui (em ms)
```
O valor é passado automaticamente via meta tag para o JS.

### Adicionar suporte a outro tipo de item (além de Ticket)

1. Em [inc/Plugin.php](inc/Plugin.php), adicionar novo hook `ITEM_ADD` para a classe desejada:
   ```php
   $pluginHooks[Hooks::ITEM_ADD]['glpienhancer'][\Change::class]
       = 'plugin_glpienhancer_change_post_add';
   ```
2. Criar callback em `hook.php`
3. Criar handler análogo ao `TicketNotifier` para o novo tipo

### Adicionar configuração administrativa

1. Criar página PHP em `front/` (ex: `front/config.form.php`)
2. Registrar menu em `setup.php` (ver documentação GLPI de plugins)
3. Usar `front/noop.php` como referência de estrutura mínima

### Criar nova feature que depende de contexto de página

Adicionar método em [inc/PageAssets.php](inc/PageAssets.php):
```php
public static function isMinhaNovaPagem(?string $requestUri = null): bool {
    $uri = self::getRequestUri($requestUri);
    return str_contains($uri, '/front/minha-pagina.php');
}
```
No JS, detectar via URL:
```javascript
function isMinhaNovaPage() {
    return window.location.pathname.toLowerCase().includes('/front/minha-pagina.php');
}
```

---

*Documentação gerada em 2026-03-30 com base no código-fonte da versão 1.1.0.*
