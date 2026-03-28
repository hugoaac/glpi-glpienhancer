# GLPI Enhancer

O **GLPI Enhancer** é um plugin para **GLPI 11** projetado para melhorar a experiência operacional de técnicos de suporte com intervenções de UX discretas, previsíveis e compatíveis com o fluxo padrão de chamados. Nesta V1, o plugin introduz duas capacidades centrais: a exibição clara do identificador do chamado logo após sua criação, por meio de uma notificação visual do tipo toast, e um mecanismo de **auto-refresh inteligente** nas telas de chamados, respeitando inatividade do usuário e visibilidade da aba.[1]

A implementação foi estruturada sem alteração do core do GLPI e com base em hooks oficiais de plugins. A documentação de desenvolvimento do GLPI confirma tanto o papel do `setup.php` como ponto de bootstrap e registro de hooks quanto o uso dos hooks padronizados de ciclo de vida de itens, além da importação de CSS e JavaScript adicionais a partir da função de inicialização do plugin.[1]

## Escopo funcional da V1

| Recurso | Comportamento implementado | Observações operacionais |
| --- | --- | --- |
| Toast pós-criação de chamado | Após a criação de um `Ticket`, o plugin registra uma mensagem transitória contendo o ID e o link direto do chamado. O JavaScript converte essa mensagem em toast visual moderno com tempo de exibição de 5 segundos. | O fluxo foi desenhado para sobreviver ao redirecionamento padrão do GLPI. |
| Link direto para o chamado | A notificação apresenta ação direta **Abrir chamado** apontando para `front/ticket.form.php?id={ID}`. | O link é construído a partir de `root_doc` do GLPI. |
| Exibição única | A mensagem é consumida apenas uma vez na renderização seguinte, sendo removida da interface depois da promoção para toast. | Atende ao requisito de não reaparecer continuamente. |
| Auto-refresh inteligente | Em páginas relacionadas a chamados, o plugin cria um painel discreto com badge de estado, contador e toggle ON/OFF. | O mecanismo é restrito ao contexto de tickets. |
| Proteção contra reload agressivo | O refresh só ocorre quando a aba está ativa, o usuário está inativo há pelo menos 30 segundos e não há indício de digitação em andamento. | O intervalo padrão foi definido em 60 segundos. |
| Persistência de preferência | O estado do toggle de auto-refresh é salvo em `localStorage`. | A preferência persiste entre navegações do navegador. |

## Arquitetura do plugin

A base foi organizada para permitir evolução futura sem reescrita estrutural. O núcleo PHP concentra a inicialização do plugin, o registro dos hooks e a preparação de dados transitórios. Já os assets de front-end assumem a responsabilidade pela camada visual, pela promoção da mensagem de sessão para toast e pelo ciclo de auto-refresh inteligente. Essa separação reduz acoplamento e facilita futuras extensões, como configurações administrativas, telemetria ou novos aprimoramentos de interface.

| Caminho | Responsabilidade |
| --- | --- |
| `setup.php` | Bootstrap do plugin, definição de versão, requisitos mínimos e chamada do registrador central. |
| `hook.php` | Callbacks globais de instalação, desinstalação e pós-criação de `Ticket`. |
| `inc/Plugin.php` | Registro dos hooks oficiais do GLPI e dos assets CSS/JS do plugin. |
| `inc/TicketNotifier.php` | Criação da mensagem transitória com ID do chamado e link direto após o hook de criação. |
| `inc/PageAssets.php` | Utilitário de contexto para páginas ligadas a chamados. |
| `inc/TicketAutoRefresh.php` | Parâmetros canônicos do mecanismo de auto-refresh inteligente. |
| `js/enhancer.js` | Promoção da mensagem para toast, painel de status, persistência do toggle, detecção de inatividade e reload controlado. |
| `css/enhancer.css` | Aparência enterprise do toast e do painel de auto-refresh. |
| `front/noop.php` | Reserva estrutural para futura interface administrativa do plugin. |

## Estrutura entregue

```text
glpienhancer/
├── setup.php
├── hook.php
├── README.md
├── inc/
│   ├── Plugin.php
│   ├── TicketNotifier.php
│   ├── PageAssets.php
│   └── TicketAutoRefresh.php
├── front/
│   └── noop.php
├── js/
│   └── enhancer.js
└── css/
    └── enhancer.css
```

## Instalação

Para instalar o plugin, copie o diretório `glpienhancer` para a pasta `plugins` da sua instância GLPI. Em uma instalação típica, o destino será semelhante a `glpi/plugins/glpienhancer/`. Em seguida, acesse o painel administrativo do GLPI, abra **Configurar > Plugins**, localize **GLPI Enhancer** na lista e execute primeiro a instalação e depois a ativação.

O plugin foi preparado para operar **exclusivamente em GLPI 11** e **PHP 8+**. Durante a verificação de pré-requisitos, o bootstrap bloqueia a ativação em versões fora dessa faixa para evitar comportamento indefinido.

## Fluxo técnico resumido

Quando um chamado é criado, o hook oficial pós-inclusão do item `Ticket` aciona o callback do plugin. Esse callback delega a criação da mensagem transitória para `TicketNotifier`, que monta um bloco HTML com marcadores de dados contendo o ID e a URL do chamado. Após o redirecionamento padrão do GLPI, o arquivo `enhancer.js` identifica esse marcador, remove a apresentação convencional e o substitui por uma toast notification com estilo próprio.

No mesmo asset JavaScript, o módulo de auto-refresh monta um painel discreto nas telas relacionadas a tickets. O contador regressivo é recalculado continuamente, mas a atualização da página só é permitida quando três condições coexistem: a aba permanece visível, o usuário está inativo há pelo menos 30 segundos e nenhum campo editável sugere digitação em andamento. Essa estratégia busca preservar contexto operacional e, ao mesmo tempo, evitar reload agressivo.[1]

## Limitações e observações de validação

O código foi estruturado para ser compatível com a esteira de plugins do GLPI 11 e com os hooks oficiais documentados. Entretanto, este ambiente de trabalho não dispõe de interpretador PHP instalado, o que impediu a execução de validação sintática automática local antes da entrega. Por isso, a recomendação prática é realizar um teste controlado em ambiente de homologação do GLPI 11 antes da promoção para produção, verificando especialmente o comportamento exato da mensagem pós-redirecionamento na sua instância e no tema em uso.

## Evolução prevista da base

A estrutura atual já foi preparada para receber expansões futuras sem quebra conceitual relevante. Entre as extensões naturais previstas estão um cabeçalho fixo do chamado com destaque para o ID, uma camada de auditoria para eventos de UX, opções administrativas em tela própria e integrações futuras com recursos inteligentes de sugestão operacional.

## Referências

[1]: https://glpi-developer-documentation.readthedocs.io/en/master/plugins/tutorial.html "Plugin development tutorial — GLPI documentation"

## Correção aplicada após validação inicial em ambiente real

Após a primeira instalação em ambiente GLPI 11, foi identificada uma causa raiz provável para a ausência de efeito visual do plugin: os assets de CSS e JavaScript precisam estar acessíveis a partir do diretório `public/` do plugin, e o carregamento efetivo no GLPI moderno depende dessa organização de arquivos.[1] Por isso, a versão revisada deste pacote passa a incluir explicitamente `public/css/enhancer.css` e `public/js/enhancer.js`, mantendo também os arquivos-fonte nas pastas originais para facilitar manutenção do código.

Além disso, a ponte entre o hook PHP e a toast notification foi tornada mais robusta. Em vez de depender de HTML arbitrário na mensagem pós-redirecionamento, o plugin agora grava um marcador textual estruturado e o JavaScript o converte em toast no carregamento da página. Isso reduz a chance de o tema, o escaping do GLPI ou o container da mensagem suprimir o comportamento esperado.

Também foi adicionada uma camada mínima de rastreabilidade em log via `Toolbox::logInFile`, permitindo verificar se o bootstrap do plugin e o hook pós-criação de chamado foram realmente executados. Em uma instalação padrão do GLPI, isso tende a gerar um arquivo de log com nome relacionado a `glpienhancer`, útil para depuração operacional.

## Procedimento de validação recomendado para a versão revisada

| Etapa | Verificação esperada |
| --- | --- |
| Remover a versão anterior do plugin | Evitar cache residual de assets e estrutura antiga sem diretório `public/`. |
| Substituir pela versão revisada | O diretório do plugin deve conter `public/css/enhancer.css` e `public/js/enhancer.js`. |
| Reinstalar ou reativar o plugin no GLPI | O bootstrap deve registrar os hooks e os assets novamente. |
| Criar um novo chamado pelo fluxo padrão | A página seguinte deve exibir a toast com o ID e o link do chamado. |
| Abrir lista ou formulário de ticket | O painel de auto-refresh deve aparecer no topo da tela. |
| Verificar logs | Deve haver rastros de `plugin_init` e, após criação de chamado, um registro do ticket detectado pelo plugin. |

Se a interface ainda não refletir a mudança, o próximo passo mais útil é limpar cache do navegador, confirmar a presença do diretório `public/` no plugin instalado e inspecionar se o arquivo de log do GLPI registrou a execução do `plugin_init`.

