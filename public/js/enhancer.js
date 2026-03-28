/**
 * GLPI Enhancer — Modernismo técnico de laboratório.
 * Filosofia deste arquivo: feedback operacional claro, observabilidade discreta,
 * movimentos curtos e zero agressividade de recarga.
 */
(function () {
  'use strict';

  if (window.__GLPIENHANCER_BOOTED__) {
    return;
  }

  window.__GLPIENHANCER_BOOTED__ = true;

  const CONFIG = {
    refreshIntervalMs: getMetaNumber('glpienhancer-refresh-interval-ms', 60000),
    idleThresholdMs: getMetaNumber('glpienhancer-idle-threshold-ms', 30000),
    storageKey: getMetaContent('glpienhancer-storage-key', 'glpienhancer:auto-refresh-enabled'),
    intervalStorageKey: getMetaContent('glpienhancer-interval-storage-key', 'glpienhancer:auto-refresh-interval-ms'),
    refreshIntervalOptionsMs: getMetaNumberList('glpienhancer-interval-options-ms', [30000, 60000, 120000, 300000]),
    countdownStepMs: 1000,
    toastDurationMs: 5000,
    activityDebounceMs: 1200,
    markerPrefix: getMetaContent('glpienhancer-marker-prefix', 'GLPIENHANCER_TICKET_CREATED|'),
  };

  const state = {
    lastInteractionAt: Date.now(),
    lastInputAt: 0,
    lastRefreshAt: Date.now(),
    refreshEnabled: getStoredPreference(),
    refreshIntervalMs: getStoredInterval(),
    countdownTimer: null,
    countdownRemainingMs: getStoredInterval(),
    refreshBadge: null,
    refreshToggle: null,
    refreshCountdown: null,
    refreshIntervalSelect: null,
    toastContainer: null,
    markerObserver: null,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  function boot() {
    const markerToastShown = promoteTicketCreationFlashToToast();
    const metaToastShown = promotePendingTicketMetaToToast();

    observeMarkerInsertions();

    if (markerToastShown || metaToastShown) {
      registerActivity();
    }

    if (!isTicketListPage()) {
      return;
    }

    mountAutoRefreshPanel();
    bindActivityTracking();
    startCountdownLoop();
  }

  function isTicketListPage() {
    const pathname = String(window.location.pathname || '').toLowerCase();
    return /(^|\/)ticket\.php$/.test(pathname);
  }

  function promoteTicketCreationFlashToToast() {
    const candidate = findTicketMarkerCandidate();
    if (!candidate) {
      return false;
    }

    const payload = parseMarkerPayload(candidate.node.textContent || '');
    if (!payload) {
      return false;
    }

    displayToast(payload.ticketId, payload.ticketUrl);
    cleanupMarkerPresentation(candidate.node, payload.rawMarker);

    return true;
  }

  function promotePendingTicketMetaToToast() {
    const ticketId = getMetaContent('glpienhancer-pending-ticket-id', '').replace(/[^0-9]/g, '');
    const ticketUrl = getMetaContent('glpienhancer-pending-ticket-url', '');

    if (!ticketId || !ticketUrl) {
      return false;
    }

    displayToast(ticketId, ticketUrl);
    return true;
  }

  function displayToast(ticketId, ticketUrl) {
    if (!ticketId || !ticketUrl || hasToastForTicket(ticketId)) {
      return;
    }

    const toast = createToast(ticketId, ticketUrl);
    ensureToastContainer().appendChild(toast);

    window.requestAnimationFrame(function () {
      toast.classList.add('is-visible');
    });

    window.setTimeout(function () {
      dismissToast(toast);
    }, CONFIG.toastDurationMs);
  }

  function hasToastForTicket(ticketId) {
    return Boolean(document.querySelector('.glpienhancer-toast[data-ticket-id="' + escapeSelectorValue(ticketId) + '"]'));
  }

  function findTicketMarkerCandidate(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const candidates = scope.querySelectorAll('.alert, .message_after_redirect, .plugin-message, .glpi-message, li, div, span, p');

    for (const node of candidates) {
      const text = (node.textContent || '').trim();
      if (text.indexOf(CONFIG.markerPrefix) >= 0) {
        return { node: node };
      }
    }

    return null;
  }

  function parseMarkerPayload(rawText) {
    const text = String(rawText || '').trim();
    const markerStart = text.indexOf(CONFIG.markerPrefix);
    if (markerStart < 0) {
      return null;
    }

    const markerText = text.slice(markerStart).trim();
    const parts = markerText.split('|');
    if (parts.length < 3) {
      return null;
    }

    const ticketId = String(parts[1] || '').replace(/[^0-9]/g, '');
    const encodedUrl = parts.slice(2).join('|').split(/\s+/)[0];
    const ticketUrl = decodeBase64Url(encodedUrl);
    const rawMarker = [CONFIG.markerPrefix.slice(0, -1), ticketId, encodedUrl].join('|');

    if (!ticketId || !ticketUrl) {
      return null;
    }

    return { ticketId, ticketUrl, rawMarker };
  }

  function cleanupMarkerPresentation(node, rawMarker) {
    if (!node) {
      return;
    }

    const originalText = String(node.textContent || '');
    if (rawMarker && originalText.indexOf(rawMarker) >= 0) {
      const cleanedText = originalText.replace(rawMarker, '').replace(/\s{2,}/g, ' ').trim();

      if (cleanedText !== '') {
        if (node.childNodes.length === 1 && node.firstChild && node.firstChild.nodeType === Node.TEXT_NODE) {
          node.textContent = cleanedText;
        } else {
          sanitizeTextNodes(node, rawMarker);
        }
      } else {
        const alertRoot = node.closest('.alert, .message_after_redirect, .plugin-message, .glpi-message, li, div');
        if (alertRoot) {
          alertRoot.remove();
        } else {
          node.remove();
        }
      }
    }
  }

  function sanitizeTextNodes(root, rawMarker) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];

    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    textNodes.forEach(function (textNode) {
      const value = String(textNode.nodeValue || '');
      if (value.indexOf(rawMarker) >= 0) {
        textNode.nodeValue = value.replace(rawMarker, '').replace(/\s{2,}/g, ' ');
      }
    });
  }

  function observeMarkerInsertions() {
    if (state.markerObserver || !document.body || typeof MutationObserver === 'undefined') {
      return;
    }

    state.markerObserver = new MutationObserver(function (mutations) {
      for (const mutation of mutations) {
        for (const addedNode of mutation.addedNodes) {
          if (!(addedNode instanceof HTMLElement)) {
            continue;
          }

          const candidate = findTicketMarkerCandidate(addedNode);
          if (!candidate) {
            continue;
          }

          const payload = parseMarkerPayload(candidate.node.textContent || '');
          if (!payload) {
            continue;
          }

          displayToast(payload.ticketId, payload.ticketUrl);
          cleanupMarkerPresentation(candidate.node, payload.rawMarker);
          return;
        }
      }
    });

    state.markerObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function createToast(ticketId, ticketUrl) {
    const wrapper = document.createElement('aside');
    wrapper.className = 'glpienhancer-toast';
    wrapper.dataset.ticketId = ticketId;
    wrapper.setAttribute('role', 'status');
    wrapper.setAttribute('aria-live', 'polite');

    const icon = document.createElement('div');
    icon.className = 'glpienhancer-toast__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '✓';

    const content = document.createElement('div');
    content.className = 'glpienhancer-toast__content';

    const title = document.createElement('div');
    title.className = 'glpienhancer-toast__title';
    title.textContent = 'Chamado criado com sucesso';

    const text = document.createElement('div');
    text.className = 'glpienhancer-toast__text';
    text.innerHTML = 'O chamado <strong class="glpienhancer-toast__id">#' + escapeHtml(ticketId) + '</strong> já está disponível.';

    const actions = document.createElement('div');
    actions.className = 'glpienhancer-toast__actions';

    const openLink = document.createElement('a');
    openLink.className = 'glpienhancer-toast__link';
    openLink.href = ticketUrl;
    openLink.textContent = 'Abrir chamado';

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'glpienhancer-toast__close';
    closeButton.setAttribute('aria-label', 'Fechar notificação');
    closeButton.textContent = '×';
    closeButton.addEventListener('click', function () {
      dismissToast(wrapper);
    });

    actions.appendChild(openLink);
    actions.appendChild(closeButton);
    content.appendChild(title);
    content.appendChild(text);
    wrapper.appendChild(icon);
    wrapper.appendChild(content);
    wrapper.appendChild(actions);

    return wrapper;
  }

  function ensureToastContainer() {
    if (state.toastContainer) {
      return state.toastContainer;
    }

    const container = document.createElement('div');
    container.className = 'glpienhancer-toast-stack';
    document.body.appendChild(container);
    state.toastContainer = container;

    return container;
  }

  function dismissToast(toast) {
    if (!toast || !toast.parentNode) {
      return;
    }

    toast.classList.remove('is-visible');
    toast.classList.add('is-leaving');

    window.setTimeout(function () {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 260);
  }

  function mountAutoRefreshPanel() {
    const anchor = document.querySelector('.central, main, #page, .ticket, .search-page, body');
    if (!anchor) {
      return;
    }

    if (document.querySelector('.glpienhancer-refresh-panel')) {
      return;
    }

    const panel = document.createElement('section');
    panel.className = 'glpienhancer-refresh-panel';
    panel.setAttribute('aria-label', 'Controle de auto-refresh');

    const badge = document.createElement('span');
    badge.className = 'glpienhancer-refresh-panel__badge';

    const label = document.createElement('div');
    label.className = 'glpienhancer-refresh-panel__label';
    label.textContent = 'Auto-refresh';

    const meta = document.createElement('div');
    meta.className = 'glpienhancer-refresh-panel__meta';
    meta.textContent = 'Atualização inteligente apenas na listagem de chamados, com detecção de inatividade e aba ativa';

    const countdown = document.createElement('span');
    countdown.className = 'glpienhancer-refresh-panel__countdown';

    const intervalLabel = document.createElement('label');
    intervalLabel.className = 'glpienhancer-refresh-panel__interval';
    intervalLabel.textContent = 'Prazo';

    const intervalSelect = document.createElement('select');
    intervalSelect.className = 'glpienhancer-refresh-panel__select';
    intervalSelect.setAttribute('aria-label', 'Prazo do auto-refresh');

    CONFIG.refreshIntervalOptionsMs.forEach(function (intervalMs) {
      const option = document.createElement('option');
      option.value = String(intervalMs);
      option.textContent = formatInterval(intervalMs);
      if (intervalMs === state.refreshIntervalMs) {
        option.selected = true;
      }
      intervalSelect.appendChild(option);
    });

    intervalSelect.addEventListener('change', function () {
      const nextInterval = normalizeInterval(Number(intervalSelect.value));
      state.refreshIntervalMs = nextInterval;
      state.lastRefreshAt = Date.now();
      state.countdownRemainingMs = nextInterval;
      persistInterval(nextInterval);
      syncRefreshPanel();
    });

    intervalLabel.appendChild(intervalSelect);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'glpienhancer-refresh-panel__toggle';
    toggle.addEventListener('click', function () {
      state.refreshEnabled = !state.refreshEnabled;
      persistPreference(state.refreshEnabled);
      state.lastRefreshAt = Date.now();
      state.countdownRemainingMs = state.refreshIntervalMs;
      syncRefreshPanel();
    });

    const copy = document.createElement('div');
    copy.className = 'glpienhancer-refresh-panel__copy';
    copy.appendChild(label);
    copy.appendChild(meta);

    panel.appendChild(badge);
    panel.appendChild(copy);
    panel.appendChild(countdown);
    panel.appendChild(intervalLabel);
    panel.appendChild(toggle);

    anchor.insertBefore(panel, anchor.firstChild);

    state.refreshBadge = badge;
    state.refreshToggle = toggle;
    state.refreshCountdown = countdown;
    state.refreshIntervalSelect = intervalSelect;

    syncRefreshPanel();
  }

  function syncRefreshPanel() {
    if (!state.refreshBadge || !state.refreshToggle || !state.refreshCountdown || !state.refreshIntervalSelect) {
      return;
    }

    const isActive = state.refreshEnabled;
    state.refreshBadge.textContent = isActive ? 'Ativo' : 'Desativado';
    state.refreshBadge.dataset.state = isActive ? 'on' : 'off';
    state.refreshToggle.dataset.state = isActive ? 'on' : 'off';
    state.refreshToggle.textContent = isActive ? 'Desligar' : 'Ligar';
    state.refreshIntervalSelect.value = String(state.refreshIntervalMs);

    const seconds = Math.max(0, Math.ceil(state.countdownRemainingMs / 1000));
    state.refreshCountdown.textContent = isActive
      ? 'Auto-refresh ativo (' + formatInterval(state.refreshIntervalMs) + ') · próxima checagem em ' + seconds + 's'
      : 'Auto-refresh pausado';
  }

  function bindActivityTracking() {
    ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'].forEach(function (eventName) {
      document.addEventListener(eventName, registerActivity, { passive: true });
    });

    document.addEventListener('input', function () {
      state.lastInputAt = Date.now();
      registerActivity();
    }, { passive: true });

    document.addEventListener('change', registerActivity, { passive: true });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) {
        registerActivity();
      }
    });
  }

  function registerActivity() {
    const now = Date.now();
    if (now - state.lastInteractionAt < CONFIG.activityDebounceMs) {
      return;
    }

    state.lastInteractionAt = now;
  }

  function startCountdownLoop() {
    if (state.countdownTimer) {
      window.clearInterval(state.countdownTimer);
    }

    state.countdownTimer = window.setInterval(function () {
      tickRefreshCycle();
    }, CONFIG.countdownStepMs);
  }

  function tickRefreshCycle() {
    const now = Date.now();
    state.countdownRemainingMs = Math.max(0, state.refreshIntervalMs - (now - state.lastRefreshAt));
    syncRefreshPanel();

    if (!state.refreshEnabled) {
      return;
    }

    if (now - state.lastRefreshAt < state.refreshIntervalMs) {
      return;
    }

    if (!canRefresh(now)) {
      state.lastRefreshAt = now - (state.refreshIntervalMs - CONFIG.countdownStepMs);
      state.countdownRemainingMs = CONFIG.countdownStepMs;
      syncRefreshPanel();
      return;
    }

    window.location.reload();
  }

  function canRefresh(now) {
    if (document.hidden) {
      return false;
    }

    if (now - state.lastInteractionAt < CONFIG.idleThresholdMs) {
      return false;
    }

    if (now - state.lastInputAt < CONFIG.idleThresholdMs) {
      return false;
    }

    const activeElement = document.activeElement;
    if (activeElement) {
      const tag = (activeElement.tagName || '').toLowerCase();
      const isTypingField = tag === 'textarea'
        || (tag === 'input' && activeElement.type !== 'checkbox' && activeElement.type !== 'radio' && activeElement.type !== 'button' && activeElement.type !== 'submit')
        || activeElement.isContentEditable;

      if (isTypingField) {
        return false;
      }
    }

    return true;
  }

  function getMetaContent(name, fallback) {
    const node = document.querySelector('meta[name="' + name + '"]');
    const value = node ? String(node.getAttribute('content') || '').trim() : '';
    return value !== '' ? value : fallback;
  }

  function getMetaNumber(name, fallback) {
    const raw = getMetaContent(name, String(fallback));
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  function getMetaNumberList(name, fallback) {
    const raw = getMetaContent(name, '');
    if (!raw) {
      return fallback.slice();
    }

    const values = raw
      .split(',')
      .map(function (part) { return Number(String(part).trim()); })
      .filter(function (value) { return Number.isFinite(value) && value > 0; });

    return values.length ? values : fallback.slice();
  }

  function getStoredPreference() {
    try {
      const raw = window.localStorage.getItem(CONFIG.storageKey);
      if (raw === null) {
        return true;
      }

      return raw === '1';
    } catch (error) {
      return true;
    }
  }

  function persistPreference(enabled) {
    try {
      window.localStorage.setItem(CONFIG.storageKey, enabled ? '1' : '0');
    } catch (error) {
      /* noop */
    }
  }

  function getStoredInterval() {
    try {
      const raw = window.localStorage.getItem(CONFIG.intervalStorageKey);
      return normalizeInterval(Number(raw || CONFIG.refreshIntervalMs));
    } catch (error) {
      return normalizeInterval(CONFIG.refreshIntervalMs);
    }
  }

  function persistInterval(intervalMs) {
    try {
      window.localStorage.setItem(CONFIG.intervalStorageKey, String(normalizeInterval(intervalMs)));
    } catch (error) {
      /* noop */
    }
  }

  function normalizeInterval(intervalMs) {
    if (CONFIG.refreshIntervalOptionsMs.indexOf(intervalMs) >= 0) {
      return intervalMs;
    }

    return CONFIG.refreshIntervalMs;
  }

  function formatInterval(intervalMs) {
    const seconds = Math.round(intervalMs / 1000);
    if (seconds < 60) {
      return seconds + 's';
    }

    const minutes = seconds / 60;
    if (Number.isInteger(minutes)) {
      return minutes + ' min';
    }

    return minutes.toFixed(1).replace('.', ',') + ' min';
  }

  function decodeBase64Url(value) {
    try {
      const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
      const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
      return window.atob(normalized + padding);
    } catch (error) {
      return '';
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeSelectorValue(value) {
    return String(value).replace(/(["\\])/g, '\\$1');
  }
})();
