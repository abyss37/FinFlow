(function () {
    'use strict';

    const state = {
        page: 1,
        perPage: 50,
        total: 0,
        pages: 0,
        items: [],
        loading: false,
        filters: {
            search: '',
            action: '',
            company_id: '',
            user_id: '',
            software: '',
            date_from: '',
            date_to: ''
        },
        companies: [],
        users: [],
        actions: new Set()
    };

    const $ = (id) => document.getElementById(id);

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function safeJson(value) {
        if (value === null || value === undefined) {
            return '';
        }

        if (typeof value === 'string') {
            return value;
        }

        try {
            return JSON.stringify(value, null, 2);
        } catch {
            return String(value);
        }
    }

    function formatNumber(value) {
        return new Intl.NumberFormat('ru-RU').format(Number(value || 0));
    }

    function formatDateTime(value) {
        if (!value) {
            return {
                date: '—',
                time: ''
            };
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return {
                date: String(value),
                time: ''
            };
        }

        return {
            date: new Intl.DateTimeFormat('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            }).format(date),
            time: new Intl.DateTimeFormat('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }).format(date)
        };
    }

    function initials(value) {
        const text = String(value || '').trim();

        if (!text) {
            return '—';
        }

        const parts = text.split(/\s+/).filter(Boolean);

        if (parts.length === 1) {
            return parts[0].slice(0, 2).toUpperCase();
        }

        return (parts[0][0] + parts[1][0]).toUpperCase();
    }

    function actionClass(action) {
        const value = String(action || '').toLowerCase();

        if (
            value.includes('create') ||
            value.includes('add') ||
            value.includes('созд') ||
            value.includes('добав')
        ) {
            return 'is-create';
        }

        if (
            value.includes('delete') ||
            value.includes('remove') ||
            value.includes('cancel') ||
            value.includes('удал') ||
            value.includes('отмен')
        ) {
            return 'is-delete';
        }

        if (
            value.includes('update') ||
            value.includes('edit') ||
            value.includes('change') ||
            value.includes('обнов') ||
            value.includes('измен')
        ) {
            return 'is-update';
        }

        if (
            value.includes('login') ||
            value.includes('logout') ||
            value.includes('auth') ||
            value.includes('вход') ||
            value.includes('выход')
        ) {
            return 'is-login';
        }

        return '';
    }

    function normalizeActionLabel(action) {
        if (!action) {
            return '—';
        }

        const labels = {
            CREATE: 'CREATE',
            UPDATE: 'UPDATE',
            DELETE: 'DELETE',
            CANCEL: 'CANCEL',
            LOGIN: 'LOGIN',
            LOGOUT: 'LOGOUT',
            CREATE_COMPANY: 'CREATE',
            UPDATE_COMPANY: 'UPDATE',
            DELETE_COMPANY: 'DELETE',
            CREATE_INVOICE: 'CREATE',
            UPDATE_INVOICE: 'UPDATE',
            CANCEL_INVOICE: 'CANCEL',
            CREATE_BUDGET: 'CREATE',
            UPDATE_BUDGET: 'UPDATE'
        };

        return labels[String(action).toUpperCase()] || String(action);
    }

    function normalizeCompany(item) {
        return item.company || item.company_name || '';
    }

    function renderSelectOptions(select, items, emptyLabel, valueKey, labelKey) {
        if (!select) {
            return;
        }

        const current = select.value;

        select.innerHTML =
            `<option value="">${escapeHtml(emptyLabel)}</option>` +
            items.map(item => {
                const value = item?.[valueKey];
                const label = item?.[labelKey];

                if (value === undefined || value === null) {
                    return '';
                }

                return `<option value="${escapeHtml(value)}">${escapeHtml(label ?? value)}</option>`;
            }).join('');

        if (
            current &&
            Array.from(select.options).some(option => option.value === current)
        ) {
            select.value = current;
        }
    }

    function collectActions(items) {
        items.forEach(item => {
            if (item && item.action) {
                state.actions.add(String(item.action));
            }
        });

        const select = $('filterAction');

        if (!select) {
            return;
        }

        const current = select.value;

        const actions = Array.from(state.actions).sort((a, b) =>
            a.localeCompare(b)
        );

        select.innerHTML =
            '<option value="">Все действия</option>' +
            actions.map(action =>
                `<option value="${escapeHtml(action)}">${escapeHtml(normalizeActionLabel(action))}</option>`
            ).join('');

        if (current && actions.includes(current)) {
            select.value = current;
        }
    }

    function populateFilters(data) {
        if (Array.isArray(data.companies)) {
            state.companies = data.companies;

            renderSelectOptions(
                $('filterCompany'),
                state.companies,
                'Все компании',
                'id',
                'name'
            );
        }

        if (Array.isArray(data.users)) {
            state.users = data.users;

            renderSelectOptions(
                $('filterUser'),
                state.users,
                'Все пользователи',
                'id',
                'username'
            );
        }

        collectActions(state.items);
    }

    function getFiltersFromUi() {
        return {
            search: ($('filterSearch')?.value || '').trim(),
            action: $('filterAction')?.value || '',
            company_id: $('filterCompany')?.value || '',
            user_id: $('filterUser')?.value || '',
            software: $('filterSoftware')?.value || '',
            date_from: $('filterDateFrom')?.value || '',
            date_to: $('filterDateTo')?.value || ''
        };
    }

    function setFiltersToUi(filters) {
        if ($('filterSearch')) $('filterSearch').value = filters.search || '';
        if ($('filterAction')) $('filterAction').value = filters.action || '';
        if ($('filterCompany')) $('filterCompany').value = filters.company_id || '';
        if ($('filterUser')) $('filterUser').value = filters.user_id || '';
        if ($('filterSoftware')) $('filterSoftware').value = filters.software || '';
        if ($('filterDateFrom')) $('filterDateFrom').value = filters.date_from || '';
        if ($('filterDateTo')) $('filterDateTo').value = filters.date_to || '';

        updateSearchClear();
    }

    function buildQuery() {
        const params = new URLSearchParams();

        params.set('page', String(state.page));
        params.set('per_page', String(state.perPage));

        Object.entries(state.filters).forEach(([key, value]) => {
            if (value) {
                params.set(key, value);
            }
        });

        return params.toString();
    }

    async function loadAuditLogs() {
        if (state.loading) {
            return;
        }

        state.loading = true;
        setLoadingState(true);
        hideError();

        try {
            const response = await fetch(`/api/audit-log?${buildQuery()}`, {
                headers: {
                    Accept: 'application/json'
                },
                credentials: 'same-origin'
            });

            if (!response.ok) {
                let message = `HTTP ${response.status}`;

                try {
                    const errorData = await response.json();
                    message = errorData.message || errorData.error || message;
                } catch (_) {
                    // Ignore invalid error payload.
                }

                throw new Error(message);
            }

            const data = await response.json();

            if (data.status && data.status !== 'ok') {
                throw new Error(data.message || 'Ошибка загрузки журнала');
            }

            state.items = Array.isArray(data.items)
                ? data.items
                : [];

            const pagination = data.pagination || {};

            state.page = Number(pagination.page || state.page);
            state.perPage = Number(pagination.per_page || state.perPage);
            state.total = Number(pagination.total || 0);
            state.pages = Number(pagination.pages || 0);

            if (data.filters) {
                state.filters = {
                    ...state.filters,
                    ...data.filters
                };

                setFiltersToUi(state.filters);
            }

            populateFilters(data);

            renderAll();

        } catch (error) {
            console.error('Audit log error:', error);
            showError(error?.message || 'Неизвестная ошибка');
        } finally {
            state.loading = false;
            setLoadingState(false);
        }
    }

    function setLoadingState(isLoading) {
        const refresh = $('auditRefresh');

        if (refresh) {
            refresh.classList.toggle('is-loading', isLoading);
            refresh.disabled = isLoading;
        }

        const status = $('auditSummaryStatus');

        if (status && isLoading) {
            status.textContent = 'Загрузка';
        }
    }

    function showError(message) {
        const tableWrap = document.querySelector('.ff-audit-table-wrap');
        const pagination = $('auditPagination');
        const empty = $('auditEmpty');
        const error = $('auditError');
        const errorMessage = $('auditErrorMessage');

        if (tableWrap) tableWrap.classList.add('hidden');
        if (pagination) pagination.classList.add('hidden');
        if (empty) empty.classList.add('hidden');
        if (error) error.classList.remove('hidden');
        if (errorMessage) errorMessage.textContent = message;

        const status = $('auditSummaryStatus');
        if (status) status.textContent = 'Ошибка';

        const heroMeta = $('auditHeroMeta');
        if (heroMeta) heroMeta.textContent = 'Не удалось загрузить';
    }

    function hideError() {
        const error = $('auditError');
        if (error) error.classList.add('hidden');
    }

    function renderAll() {
        renderSummary();
        renderActiveFilters();
        renderTable();
        renderPagination();
        updateDescription();
    }

    function renderSummary() {
        const total = state.total;
        const pageCount = state.items.length;

        if ($('auditHeroTotal')) {
            $('auditHeroTotal').textContent = formatNumber(total);
        }

        if ($('auditHeroMeta')) {
            $('auditHeroMeta').textContent =
                total === 0
                    ? 'Нет совпадений'
                    : `страница ${state.page} из ${Math.max(state.pages, 1)}`;
        }

        if ($('auditSummaryTotal')) {
            $('auditSummaryTotal').textContent = formatNumber(total);
        }

        if ($('auditSummaryPage')) {
            $('auditSummaryPage').textContent = formatNumber(pageCount);
        }

        if ($('auditSummaryCompanies')) {
            const companies = new Set(
                state.items
                    .map(item => item.company_id)
                    .filter(value => value !== null && value !== undefined && value !== '')
            );

            $('auditSummaryCompanies').textContent =
                formatNumber(companies.size);
        }

        if ($('auditSummaryStatus')) {
            $('auditSummaryStatus').textContent =
                state.loading
                    ? 'Загрузка'
                    : 'Готово';
        }
    }

    function renderActiveFilters() {
        const container = $('auditActiveFilters');

        if (!container) {
            return;
        }

        const chips = [];

        if (state.filters.search) {
            chips.push({
                key: 'search',
                label: `Поиск: ${state.filters.search}`
            });
        }

        if (state.filters.action) {
            chips.push({
                key: 'action',
                label: `Действие: ${normalizeActionLabel(state.filters.action)}`
            });
        }

        if (state.filters.company_id) {
            const company = state.companies.find(
                item => String(item.id) === String(state.filters.company_id)
            );

            chips.push({
                key: 'company_id',
                label: `Компания: ${company?.name || state.filters.company_id}`
            });
        }

        if (state.filters.user_id) {
            const user = state.users.find(
                item => String(item.id) === String(state.filters.user_id)
            );

            chips.push({
                key: 'user_id',
                label: `Пользователь: ${user?.username || state.filters.user_id}`
            });
        }

        if (state.filters.software) {
            chips.push({
                key: 'software',
                label: `Продукт: ${state.filters.software}`
            });
        }

        if (state.filters.date_from) {
            chips.push({
                key: 'date_from',
                label: `От: ${state.filters.date_from}`
            });
        }

        if (state.filters.date_to) {
            chips.push({
                key: 'date_to',
                label: `До: ${state.filters.date_to}`
            });
        }

        container.innerHTML = chips.map(chip => `
            <span class="ff-audit-filter-chip">
                ${escapeHtml(chip.label)}
                <button
                    type="button"
                    data-remove-filter="${escapeHtml(chip.key)}"
                    aria-label="Удалить фильтр">
                    <i class="bi bi-x"></i>
                </button>
            </span>
        `).join('');
    }

    function renderTable() {
        const tbody = $('auditTableBody');
        const tableWrap = document.querySelector('.ff-audit-table-wrap');
        const empty = $('auditEmpty');
        const error = $('auditError');

        if (!tbody) {
            return;
        }

        if (error && !error.classList.contains('hidden')) {
            return;
        }

        if (state.items.length === 0) {
            tbody.innerHTML = '';

            if (tableWrap) tableWrap.classList.add('hidden');
            if (empty) empty.classList.remove('hidden');

            return;
        }

        if (tableWrap) tableWrap.classList.remove('hidden');
        if (empty) empty.classList.add('hidden');

        tbody.innerHTML = state.items.map((item, index) => {
            const dateTime = formatDateTime(
                item.created_at || item.timestamp
            );

            const action = String(item.action || '—');
            const actionLabel = normalizeActionLabel(action);
            const companyName = normalizeCompany(item) || 'Без компании';
            const username = item.username || 'Система';
            const software = item.software || '';
            const description =
                item.description ||
                (typeof item.details === 'string' ? item.details : '') ||
                '—';

            const detailsText = safeJson(item.details);
            const hasDetails = Boolean(detailsText);

            return `
                <tr class="ff-audit-row" data-audit-index="${index}">
                    <td class="ff-audit-date">
                        <div class="ff-audit-date-main">
                            ${escapeHtml(dateTime.date)}
                        </div>
                        <div class="ff-audit-date-sub">
                            ${escapeHtml(dateTime.time)}
                        </div>
                    </td>

                    <td>
                        <span class="ff-audit-action ${actionClass(action)}">
                            ${escapeHtml(actionLabel)}
                        </span>
                    </td>

                    <td>
                        <div class="ff-audit-company">
                            <span class="ff-audit-company-icon">
                                <i class="bi bi-building"></i>
                            </span>
                            <div class="ff-audit-company-copy">
                                <div class="ff-audit-company-name">
                                    ${escapeHtml(companyName)}
                                </div>
                                ${
                                    item.company_id
                                        ? `<div class="ff-audit-company-id">ID ${escapeHtml(item.company_id)}</div>`
                                        : ''
                                }
                            </div>
                        </div>
                    </td>

                    <td>
                        <div class="ff-audit-user">
                            <span class="ff-audit-user-avatar">
                                ${escapeHtml(initials(username))}
                            </span>
                            <div class="ff-audit-user-copy">
                                <div class="ff-audit-user-name">
                                    ${escapeHtml(username)}
                                </div>
                            </div>
                        </div>
                    </td>

                    <td>
                        ${
                            software
                                ? `<span class="ff-audit-product ${software === 'ALPHA' ? 'is-alpha' : software === 'BETA' ? 'is-beta' : ''}">
                                    ${escapeHtml(software)}
                                   </span>`
                                : '<span class="ff-audit-product">—</span>'
                        }
                    </td>

                    <td>
                        <div class="ff-audit-description">
                            <div class="ff-audit-description-main" title="${escapeHtml(description)}">
                                ${escapeHtml(description)}
                            </div>
                            ${
                                item.entity_type || item.entity_id
                                    ? `<div class="ff-audit-description-meta">
                                        ${escapeHtml(item.entity_type || 'entity')}${item.entity_id ? ` · ${escapeHtml(item.entity_id)}` : ''}
                                       </div>`
                                    : ''
                            }
                        </div>
                    </td>

                    <td>
                        ${
                            hasDetails
                                ? `<button
                                    type="button"
                                    class="ff-audit-expand-btn"
                                    data-expand-audit="${index}"
                                    aria-label="Показать детали"
                                    title="Показать детали">
                                    <i class="bi bi-chevron-down"></i>
                                   </button>`
                                : ''
                        }
                    </td>
                </tr>

                ${
                    hasDetails
                        ? `<tr
                            class="ff-audit-details-row"
                            data-details-index="${index}">
                            <td colspan="7" class="ff-audit-details-cell">
                                <pre class="ff-audit-details">${escapeHtml(detailsText)}</pre>
                            </td>
                           </tr>`
                        : ''
                }
            `;
        }).join('');
    }

    function renderPagination() {
        const pagination = $('auditPagination');

        if (!pagination) {
            return;
        }

        if (state.total === 0) {
            pagination.classList.add('hidden');
            return;
        }

        pagination.classList.remove('hidden');

        const start =
            state.total === 0
                ? 0
                : ((state.page - 1) * state.perPage) + 1;

        const end = Math.min(
            state.page * state.perPage,
            state.total
        );

        if ($('auditPaginationInfo')) {
            $('auditPaginationInfo').textContent =
                `${formatNumber(start)}–${formatNumber(end)} из ${formatNumber(state.total)}`;
        }

        if ($('auditPrev')) {
            $('auditPrev').disabled = state.page <= 1;
        }

        if ($('auditNext')) {
            $('auditNext').disabled =
                state.pages === 0 ||
                state.page >= state.pages;
        }

        const numbers = $('auditPageNumbers');

        if (!numbers) {
            return;
        }

        const pages = getPaginationPages(
            state.page,
            Math.max(state.pages, 1)
        );

        numbers.innerHTML = pages.map(page => {
            if (page === '…') {
                return '<span class="ff-audit-page-ellipsis">…</span>';
            }

            return `
                <button
                    type="button"
                    class="ff-audit-page-number ${page === state.page ? 'is-active' : ''}"
                    data-page="${page}">
                    ${page}
                </button>
            `;
        }).join('');
    }

    function getPaginationPages(current, total) {
        if (total <= 7) {
            return Array.from({ length: total }, (_, i) => i + 1);
        }

        const pages = [1];

        if (current > 4) {
            pages.push('…');
        }

        const start = Math.max(2, current - 1);
        const end = Math.min(total - 1, current + 1);

        for (let i = start; i <= end; i++) {
            pages.push(i);
        }

        if (current < total - 3) {
            pages.push('…');
        }

        pages.push(total);

        return pages;
    }

    function updateDescription() {
        const description = $('auditLogDescription');

        if (!description) {
            return;
        }

        const hasFilters = Object.values(state.filters).some(Boolean);

        description.textContent = hasFilters
            ? 'Результаты с учётом выбранных фильтров'
            : 'Последние действия в системе';
    }

    function updateSearchClear() {
        const input = $('filterSearch');
        const clear = $('auditSearchClear');

        if (!input || !clear) {
            return;
        }

        clear.classList.toggle(
            'is-visible',
            Boolean(input.value.trim())
        );
    }

    function resetFilters() {
        state.filters = {
            search: '',
            action: '',
            company_id: '',
            user_id: '',
            software: '',
            date_from: '',
            date_to: ''
        };

        state.page = 1;

        setFiltersToUi(state.filters);
        loadAuditLogs();
    }

    function applyFilters() {
        const from = $('filterDateFrom')?.value || '';
        const to = $('filterDateTo')?.value || '';

        if (from && to && from > to) {
            alert('Дата начала не может быть позже даты окончания.');
            return;
        }

        state.filters = getFiltersFromUi();
        state.page = 1;

        loadAuditLogs();
    }

    function removeFilter(key) {
        if (!(key in state.filters)) {
            return;
        }

        state.filters[key] = '';
        state.page = 1;

        setFiltersToUi(state.filters);
        loadAuditLogs();
    }

    function bindEvents() {
        $('applyFilters')?.addEventListener('click', applyFilters);
        $('resetFilters')?.addEventListener('click', resetFilters);
        $('auditResetTop')?.addEventListener('click', resetFilters);
        $('auditEmptyReset')?.addEventListener('click', resetFilters);
        $('auditRetry')?.addEventListener('click', loadAuditLogs);
        $('auditRefresh')?.addEventListener('click', loadAuditLogs);

        $('auditPrev')?.addEventListener('click', () => {
            if (state.page > 1) {
                state.page -= 1;
                loadAuditLogs();
            }
        });

        $('auditNext')?.addEventListener('click', () => {
            if (state.page < state.pages) {
                state.page += 1;
                loadAuditLogs();
            }
        });

        $('auditPerPage')?.addEventListener('change', event => {
            state.perPage = Number(event.target.value) || 50;
            state.page = 1;
            loadAuditLogs();
        });

        $('auditSearchClear')?.addEventListener('click', () => {
            if ($('filterSearch')) {
                $('filterSearch').value = '';
            }

            updateSearchClear();
        });

        $('filterSearch')?.addEventListener('input', updateSearchClear);

        $('filterSearch')?.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                applyFilters();
            }
        });

        $('auditActiveFilters')?.addEventListener('click', event => {
            const button = event.target.closest('[data-remove-filter]');

            if (!button) {
                return;
            }

            removeFilter(button.dataset.removeFilter);
        });

        $('auditPageNumbers')?.addEventListener('click', event => {
            const button = event.target.closest('[data-page]');

            if (!button) {
                return;
            }

            const page = Number(button.dataset.page);

            if (
                Number.isInteger(page) &&
                page >= 1 &&
                page <= state.pages &&
                page !== state.page
            ) {
                state.page = page;
                loadAuditLogs();
            }
        });

        $('auditTableBody')?.addEventListener('click', event => {
            const button = event.target.closest('[data-expand-audit]');

            if (!button) {
                return;
            }

            const index = Number(button.dataset.expandAudit);

            const row = document.querySelector(
                `.ff-audit-row[data-audit-index="${index}"]`
            );

            const details = document.querySelector(
                `.ff-audit-details-row[data-details-index="${index}"]`
            );

            if (!row || !details) {
                return;
            }

            const expanded = row.classList.toggle('is-expanded');
            details.classList.toggle('is-visible', expanded);

            button.setAttribute(
                'aria-label',
                expanded ? 'Скрыть детали' : 'Показать детали'
            );

            button.setAttribute(
                'title',
                expanded ? 'Скрыть детали' : 'Показать детали'
            );
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        bindEvents();
        updateSearchClear();
        loadAuditLogs();
    });

    window.loadAuditLogs = loadAuditLogs;
})();
