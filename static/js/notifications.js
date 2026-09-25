(function () {
    'use strict';

    const state = {
        notifications: [],
        filter: 'all',
        loading: false
    };


    // =========================================================
    // HELPERS
    // =========================================================

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }


    function formatDate(value) {
        if (!value) {
            return '—';
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return '—';
        }

        return new Intl.DateTimeFormat(
            document.documentElement.lang === 'en'
                ? 'en-GB'
                : 'uk-UA',
            {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }
        ).format(date);
    }


    function notificationIcon(item) {
        switch (item.type) {
            case 'OVERDUE_INVOICE':
                return 'bi-receipt-cutoff';

            case 'BUDGET_EXCEEDED':
                return 'bi-graph-down-arrow';

            case 'BUDGET_CRITICAL':
                return 'bi-exclamation-octagon';

            case 'BUDGET_WARNING':
                return 'bi-exclamation-triangle';

            case 'CONTRACT_EXPIRING':
                return 'bi-calendar-x';

            default:
                return 'bi-bell';
        }
    }


    function notificationTypeLabel(type) {
        switch (type) {
            case 'OVERDUE_INVOICE':
                return 'Просроченный счёт';

            case 'BUDGET_EXCEEDED':
                return 'Превышение бюджета';

            case 'BUDGET_CRITICAL':
                return 'Критическое состояние бюджета';

            case 'BUDGET_WARNING':
                return 'Предупреждение по бюджету';

            case 'CONTRACT_EXPIRING':
                return 'Завершение договора';

            default:
                return 'Системное уведомление';
        }
    }


    function levelLabel(level) {
        switch (level) {
            case 'critical':
                return 'Критично';

            case 'warning':
                return 'Внимание';

            case 'info':
                return 'Информация';

            default:
                return level || 'Информация';
        }
    }


    function visibleNotifications() {
        switch (state.filter) {
            case 'unread':
                return state.notifications.filter(
                    item => !item.is_read
                );

            case 'critical':
                return state.notifications.filter(
                    item => item.level === 'critical'
                );

            case 'warning':
                return state.notifications.filter(
                    item => item.level === 'warning'
                );

            default:
                return state.notifications;
        }
    }


    function updateBadge() {
        const badge =
            document.getElementById('ff-notification-badge');

        if (!badge) {
            return;
        }

        const unread = state.notifications.filter(
            item => !item.is_read
        ).length;

        badge.textContent =
            unread > 99
                ? '99+'
                : String(unread);

        badge.classList.toggle(
            'hidden',
            unread === 0
        );
    }


    function updateSummary() {
        const all = state.notifications.length;

        const unread = state.notifications.filter(
            item => !item.is_read
        ).length;

        const critical = state.notifications.filter(
            item => item.level === 'critical'
        ).length;

        const warning = state.notifications.filter(
            item => item.level === 'warning'
        ).length;

        const values = {
            'notification-total': all,
            'notification-count-all': all,
            'notification-count-unread': unread,
            'notification-count-critical': critical,
            'notification-count-warning': warning
        };

        Object.keys(values).forEach(function (id) {
            const element = document.getElementById(id);

            if (element) {
                element.textContent = values[id];
            }
        });
    }


    function updateFilterLabel() {
        const label =
            document.getElementById(
                'notification-filter-label'
            );

        if (!label) {
            return;
        }

        const labels = {
            all: 'Все уведомления',
            unread: 'Непрочитанные',
            critical: 'Критические',
            warning: 'Предупреждения'
        };

        label.textContent =
            labels[state.filter] || labels.all;
    }


    // =========================================================
    // RENDER
    // =========================================================

    function render() {
        updateSummary();
        updateBadge();
        updateFilterLabel();

        const list =
            document.getElementById('notification-list');

        if (!list) {
            return;
        }

        const items = visibleNotifications();

        if (!items.length) {
            list.innerHTML = `
                <div class="ff-notification-empty">
                    <span class="ff-notification-empty-icon">
                        <i class="bi bi-check2-circle"></i>
                    </span>

                    <div>
                        <strong>
                            ${state.filter === 'unread'
                                ? 'Непрочитанных уведомлений нет'
                                : 'Уведомлений нет'}
                        </strong>

                        <span>
                            Все контрольные события в выбранной категории
                            отсутствуют.
                        </span>
                    </div>
                </div>
            `;

            return;
        }

        list.innerHTML = items.map(renderNotification).join('');
    }


    function renderNotification(item) {
        const unreadClass =
            item.is_read
                ? ''
                : ' is-unread';

        const levelClass =
            ` is-${escapeHtml(item.level || 'info')}`;

        const expandedClass =
            item.expanded
                ? ' is-expanded'
                : '';

        const companyMeta =
            item.title
                ? escapeHtml(item.title)
                : 'FinFlow';

        const contextParts = [];

        if (item.software) {
            contextParts.push(
                escapeHtml(item.software)
            );
        }

        if (item.invoice_id) {
            contextParts.push(
                `Счёт #${escapeHtml(item.invoice_id)}`
            );
        }

        const context =
            contextParts.length
                ? contextParts.join(' · ')
                : 'Системное событие';

        return `
            <article
                class="ff-notification-item${unreadClass}${levelClass}${expandedClass}"
                data-notification-id="${escapeHtml(item.id)}"
                tabindex="0"
                role="button"
                aria-expanded="${item.expanded ? 'true' : 'false'}">

                <div class="ff-notification-item-icon">
                    <i class="bi ${notificationIcon(item)}"></i>
                </div>

                <div class="ff-notification-item-main">

                    <div class="ff-notification-item-top">

                        <div class="ff-notification-item-heading">

                            <span class="ff-notification-level">
                                ${escapeHtml(levelLabel(item.level))}
                            </span>

                            <h3>
                                ${companyMeta}
                            </h3>

                        </div>

                        <time>
                            ${escapeHtml(formatDate(item.created_at))}
                        </time>

                    </div>

                    <div class="ff-notification-item-type">
                        ${escapeHtml(
                            notificationTypeLabel(item.type)
                        )}
                        <span>·</span>
                        ${context}
                    </div>

                    <p class="ff-notification-item-message">
                        ${escapeHtml(item.message)}
                    </p>

                    <div class="ff-notification-item-details">

                        <div class="ff-notification-detail-row">
                            <span>Событие</span>
                            <strong>
                                ${escapeHtml(
                                    notificationTypeLabel(item.type)
                                )}
                            </strong>
                        </div>

                        ${
                            item.software
                                ? `
                                    <div class="ff-notification-detail-row">
                                        <span>Продукт</span>
                                        <strong>
                                            ${escapeHtml(item.software)}
                                        </strong>
                                    </div>
                                `
                                : ''
                        }

                        ${
                            item.invoice_id
                                ? `
                                    <div class="ff-notification-detail-row">
                                        <span>Счёт</span>
                                        <strong>
                                            #${escapeHtml(item.invoice_id)}
                                        </strong>
                                    </div>
                                `
                                : ''
                        }

                        <div class="ff-notification-detail-row">
                            <span>Создано</span>
                            <strong>
                                ${escapeHtml(formatDate(item.created_at))}
                            </strong>
                        </div>

                        <div class="ff-notification-detail-message">
                            ${escapeHtml(item.message)}
                        </div>

                    </div>

                    <div class="ff-notification-item-footer">

                        <span class="ff-notification-status">
                            <i class="bi ${
                                item.is_read
                                    ? 'bi-check2'
                                    : 'bi-dot'
                            }"></i>

                            ${
                                item.is_read
                                    ? 'Прочитано'
                                    : 'Новое уведомление'
                            }
                        </span>

                        <div class="ff-notification-item-actions">

                            ${
                                item.is_read
                                    ? ''
                                    : `
                                        <button
                                            type="button"
                                            class="ff-notification-read"
                                            data-read-id="${escapeHtml(item.id)}">

                                            <i class="bi bi-check2"></i>
                                            Прочитать
                                        </button>
                                    `
                            }

                            <button
                                type="button"
                                class="ff-notification-delete"
                                data-delete-id="${escapeHtml(item.id)}"
                                aria-label="Удалить уведомление"
                                title="Удалить уведомление">

                                <i class="bi bi-trash3"></i>
                                Удалить
                            </button>

                        </div>

                    </div>

                </div>

            </article>
        `;
    }

    // =========================================================
    // API
    // =========================================================

    async function loadNotifications() {
        if (state.loading) {
            return;
        }

        state.loading = true;

        try {
            const response = await fetch(
                '/api/notifications',
                {
                    headers: {
                        'Accept': 'application/json'
                    },
                    credentials: 'same-origin'
                }
            );

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}`
                );
            }

            const data = await response.json();

            if (
                !data ||
                !Array.isArray(data.notifications)
            ) {
                throw new Error(
                    'Invalid notification response'
                );
            }

            state.notifications =
                data.notifications;

            render();

        } catch (error) {
            console.debug(
                '[FinFlow] Notification load failed',
                error
            );

            const list =
                document.getElementById(
                    'notification-list'
                );

            if (list) {
                list.innerHTML = `
                    <div class="ff-notification-error">
                        <span class="ff-notification-state-icon">
                            <i class="bi bi-wifi-off"></i>
                        </span>

                        <div>
                            <strong>
                                Не удалось загрузить уведомления
                            </strong>

                            <span>
                                Проверьте соединение с сервером и обновите страницу.
                            </span>
                        </div>
                    </div>
                `;
            }

        } finally {
            state.loading = false;
        }
    }


    async function markAsRead(notificationId) {
        try {
            const response = await fetch(
                `/api/notifications/${encodeURIComponent(notificationId)}/read`,
                {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json'
                    },
                    credentials: 'same-origin'
                }
            );

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}`
                );
            }

            const data = await response.json();

            if (data.status !== 'ok') {
                throw new Error(
                    data.message || 'Unable to mark notification'
                );
            }

            const item =
                state.notifications.find(
                    notification =>
                        String(notification.id) ===
                        String(notificationId)
                );

            if (item) {
                item.is_read = true;
                item.read_at =
                    data.notification?.read_at ||
                    new Date().toISOString();
            }

            render();

        } catch (error) {
            console.debug(
                '[FinFlow] Mark notification as read failed',
                error
            );
        }
    }


    async function markAllAsRead() {
        const unread =
            state.notifications.filter(
                item => !item.is_read
            );

        if (!unread.length) {
            return;
        }

        try {
            const response = await fetch(
                '/api/notifications/read-all',
                {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json'
                    },
                    credentials: 'same-origin'
                }
            );

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}`
                );
            }

            const data = await response.json();

            if (data.status !== 'ok') {
                throw new Error(
                    data.message || 'Unable to mark notifications'
                );
            }

            state.notifications.forEach(function (item) {
                item.is_read = true;

                if (!item.read_at) {
                    item.read_at =
                        new Date().toISOString();
                }
            });

            render();

        } catch (error) {
            console.debug(
                '[FinFlow] Mark all notifications failed',
                error
            );
        }
    }


    // =========================================================
    // FILTERS / EVENTS
    // =========================================================

    function setFilter(filter) {
        state.filter = filter || 'all';

        document
            .querySelectorAll(
                '[data-notification-filter]'
            )
            .forEach(function (button) {
                button.classList.toggle(
                    'is-active',
                    button.dataset.notificationFilter ===
                        state.filter
                );
            });

        render();
    }


    function bindEvents() {
        document
            .querySelectorAll(
                '[data-notification-filter]'
            )
            .forEach(function (button) {
                button.addEventListener(
                    'click',
                    function () {
                        setFilter(
                            button.dataset.notificationFilter
                        );
                    }
                );
            });


        const readAll =
            document.getElementById(
                'notification-read-all'
            );

        if (readAll) {
            readAll.addEventListener(
                'click',
                markAllAsRead
            );
        }


        document.addEventListener(
            'click',
            function (event) {
                const deleteButton =
                    event.target.closest(
                        '[data-delete-id]'
                    );

                if (deleteButton) {
                    event.stopPropagation();

                    deleteNotification(
                        deleteButton.dataset.deleteId
                    );

                    return;
                }

                const readButton =
                    event.target.closest(
                        '[data-read-id]'
                    );

                if (readButton) {
                    event.stopPropagation();

                    markAsRead(
                        readButton.dataset.readId
                    );

                    return;
                }

                const itemElement =
                    event.target.closest(
                        '.ff-notification-item'
                    );

                if (!itemElement) {
                    return;
                }

                toggleNotification(
                    itemElement.dataset.notificationId
                );
            }
        );


        document.addEventListener(
            'keydown',
            function (event) {
                if (
                    event.key !== 'Enter' &&
                    event.key !== ' '
                ) {
                    return;
                }

                const itemElement =
                    event.target.closest(
                        '.ff-notification-item'
                    );

                if (!itemElement) {
                    return;
                }

                event.preventDefault();

                toggleNotification(
                    itemElement.dataset.notificationId
                );
            }
        );
    }


    async function deleteNotification(notificationId) {
        const item = state.notifications.find(
            notification =>
                String(notification.id) ===
                String(notificationId)
        );

        if (!item) {
            return;
        }

        const confirmed = window.confirm(
            'Удалить это уведомление?'
        );

        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch(
                `/api/notifications/${encodeURIComponent(notificationId)}`,
                {
                    method: 'DELETE',
                    credentials: 'same-origin',
                    headers: {
                        'Accept': 'application/json'
                    }
                }
            );

            const data = await response.json();

            if (!response.ok || data.status !== 'ok') {
                throw new Error(
                    data.message ||
                    'Не удалось удалить уведомление'
                );
            }

            state.notifications =
                state.notifications.filter(
                    notification =>
                        String(notification.id) !==
                        String(notificationId)
                );

            render();

        } catch (error) {
            console.debug(
                '[FinFlow] Delete notification failed',
                error
            );

            window.alert(
                'Не удалось удалить уведомление.'
            );
        }
    }


    function toggleNotification(notificationId) {
        const item = state.notifications.find(
            notification =>
                String(notification.id) ===
                String(notificationId)
        );

        if (!item) {
            return;
        }

        item.expanded = !item.expanded;

        if (
            item.expanded &&
            !item.is_read
        ) {
            markAsRead(notificationId);
            return;
        }

        render();
    }


    // =========================================================
    // GLOBAL BADGE SUPPORT
    // =========================================================

    function updateGlobalBadge(notifications) {
        const badge =
            document.getElementById(
                'ff-notification-badge'
            );

        if (!badge) {
            return;
        }

        const unread =
            notifications.filter(
                item => !item.is_read
            ).length;

        badge.textContent =
            unread > 99
                ? '99+'
                : String(unread);

        badge.classList.toggle(
            'hidden',
            unread === 0
        );
    }


    // Keep compatibility with finflow-i18n.js.
    window.renderNotificationCenter =
        function () {
            render();
        };


    // =========================================================
    // INIT
    // =========================================================

    document.addEventListener(
        'DOMContentLoaded',
        function () {
            bindEvents();
            loadNotifications();

            window.setInterval(
                loadNotifications,
                30000
            );
        }
    );

})();
