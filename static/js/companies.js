(() => {
    "use strict";

    /* =========================================================
       FINFLOW — COMPANIES / CRM
       ========================================================= */

    const dataElement = document.getElementById("companies-data");

    if (!dataElement) {
        return;
    }

    let DATA = {};

    try {
        DATA = JSON.parse(dataElement.textContent || "{}");
    } catch (error) {
        console.error("FinFlow Companies: invalid page data", error);
        return;
    }

    const companies = Array.isArray(DATA.companies)
        ? DATA.companies
        : [];

    let companyCards = Array.isArray(DATA.companyCards)
        ? DATA.companyCards
        : [];

    let invoices = Array.isArray(DATA.invoices)
        ? DATA.invoices
        : [];

    const currencySymbols = DATA.currencySymbols || {};
    const currentUser = DATA.currentUser || {};

    const canManageCompanies =
        currentUser.role === "admin" ||
        currentUser.role === "manager";

    let activeView = "grid";
    let activeInvoiceFilters = {};
    let openCompanyId = null;


    /* =========================================================
       DOM HELPERS
       ========================================================= */

    const $ = (selector, root = document) =>
        root.querySelector(selector);

    const $$ = (selector, root = document) =>
        Array.from(root.querySelectorAll(selector));

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /* =========================================================
       CSRF
       ========================================================= */

    function csrfToken() {
        return (
            window.FIN_FLOW_CSRF_TOKEN ||
            document.querySelector('meta[name="csrf-token"]')?.content ||
            ""
        );
    }


    /* =========================================================
       MONEY / CURRENCY
       ========================================================= */

    function normalizeCurrency(currency) {
        const value = String(currency || "EUR").toUpperCase();

        if (value === "€") return "EUR";
        if (value === "$") return "USD";
        if (value === "₴") return "UAH";

        return value;
    }

    function number(value) {
        const result = Number(value);
        return Number.isFinite(result) ? result : 0;
    }

    function money(value, currency = "EUR") {
        return window.FinFlowMoney
            ? window.FinFlowMoney.formatMoney(value, currency)
            : `${String(currency || "EUR").toUpperCase()} ${Number(value || 0).toLocaleString("uk-UA", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })}`;
    }

    function parseDate(value) {
        if (!value) {
            return null;
        }

        const date = new Date(`${value}T00:00:00`);

        if (Number.isNaN(date.getTime())) {
            return null;
        }

        return date;
    }

    function formatDate(value) {
        const date = parseDate(value);

        if (!date) {
            return "—";
        }

        return date.toLocaleDateString("uk-UA", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    }

    function daysUntil(value) {
        const date = parseDate(value);

        if (!date) {
            return null;
        }

        const today = new Date();

        const start = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate()
        );

        const target = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate()
        );

        return Math.ceil(
            (target.getTime() - start.getTime()) /
            86400000
        );
    }


    /* =========================================================
       COMPANY DATA
       ========================================================= */

    function getCompanyCard(companyId) {
        return companyCards.find(
            card => Number(card.id) === Number(companyId)
        ) || null;
    }

    function getCompanyInvoices(companyId) {
        return invoices.filter(
            invoice =>
                Number(invoice.company_id) === Number(companyId)
        );
    }

    function getActiveCompanyInvoices(companyId) {
        return getCompanyInvoices(companyId).filter(
            invoice => invoice.status !== "CANCELLED"
        );
    }


    /* =========================================================
       COMPANY FINANCIAL SNAPSHOT
       ========================================================= */

    function buildCompanyFinancial(companyId) {
        const card = getCompanyCard(companyId);

        if (!card) {
            return {
                budget: 0,
                spent: 0,
                remaining: 0,
                utilization: 0,
                currency: "EUR",
                products: "—",
                completionDate: "",
            };
        }

        const products = Array.isArray(card.products)
            ? card.products
            : [];

        /*
         * Products are now the source of truth for the compact
         * company financial snapshot.
         *
         * Do not mix different currencies in one financial group.
         * Products using the first currency are summed together.
         */

        let budget = 0;
        let spent = 0;
        let currency = "EUR";
        let completionDate = "";

        if (products.length) {
            currency = normalizeCurrency(
                products[0].currency
            );

            for (const product of products) {
                const productCurrency =
                    normalizeCurrency(product.currency);

                if (productCurrency === currency) {
                    budget += number(product.budget);
                    spent += number(product.spent);
                }

                if (product.completion_date) {
                    if (!completionDate) {
                        completionDate =
                            product.completion_date;
                    } else {
                        const current =
                            parseDate(completionDate);

                        const productDate =
                            parseDate(product.completion_date);

                        if (
                            current &&
                            productDate &&
                            productDate < current
                        ) {
                            completionDate =
                                product.completion_date;
                        }
                    }
                }
            }
        }

        const remaining = budget - spent;

        const utilization =
            budget > 0
                ? (spent / budget) * 100
                : 0;

        return {
            budget,
            spent,
            remaining,
            utilization,
            currency,
            products: products
                .map(product => product.code)
                .filter(Boolean)
                .join(" · ") || "—",
            completionDate,
        };
    }



    /* =========================================================
       CARD METRICS
       ========================================================= */

    function updateCompanyCardMetrics(companyId) {
        const financial = buildCompanyFinancial(companyId);
        const companyInvoices = getActiveCompanyInvoices(companyId);

        const budgetNode = document.querySelector(
            `[data-company-budget="${companyId}"]`
        );

        const spentNode = document.querySelector(
            `[data-company-spent="${companyId}"]`
        );

        const remainingNode = document.querySelector(
            `[data-company-remaining="${companyId}"]`
        );

        const utilizationNode = document.querySelector(
            `[data-company-utilization="${companyId}"]`
        );

        const progressNode = document.querySelector(
            `[data-company-progress="${companyId}"]`
        );

        const contractNode = document.querySelector(
            `[data-company-contract="${companyId}"]`
        );

        const contractStatusNode = document.querySelector(
            `[data-company-contract-status="${companyId}"]`
        );

        const invoiceCountNode = document.querySelector(
            `[data-company-invoice-count="${companyId}"]`
        );

        if (budgetNode) {
            budgetNode.textContent =
                money(financial.budget, financial.currency);
        }

        if (spentNode) {
            spentNode.textContent =
                money(financial.spent, financial.currency);
        }

        if (remainingNode) {
            remainingNode.textContent =
                money(financial.remaining, financial.currency);
        }

        if (utilizationNode) {
            utilizationNode.textContent =
                `${Math.max(0, financial.utilization).toFixed(1)}%`;
        }

        if (progressNode) {
            const width = Math.max(
                0,
                Math.min(100, financial.utilization)
            );

            progressNode.style.width = `${width}%`;

            progressNode.classList.toggle(
                "is-warning",
                financial.utilization >= 80 &&
                financial.utilization < 90
            );

            progressNode.classList.toggle(
                "is-critical",
                financial.utilization >= 90
            );
        }

        if (invoiceCountNode) {
            invoiceCountNode.textContent =
                companyInvoices.length;
        }

        updateCompanyContract(
            companyId,
            financial.completionDate
        );

        updateListRow(companyId, financial);
    }


    /* =========================================================
       CONTRACT COUNTDOWN
       ========================================================= */

    function updateCompanyContract(companyId, completionDate) {
        const node = document.querySelector(
            `[data-company-contract="${companyId}"]`
        );

        const statusNode = document.querySelector(
            `[data-company-contract-status="${companyId}"]`
        );

        if (!node) {
            return;
        }

        if (!completionDate) {
            node.textContent = "Дата не указана";

            if (statusNode) {
                statusNode.textContent = "";
            }

            return;
        }

        const days = daysUntil(completionDate);

        node.textContent = formatDate(completionDate);

        if (!statusNode) {
            return;
        }

        if (days < 0) {
            statusNode.textContent =
                `завершён ${Math.abs(days)} дн. назад`;

            statusNode.className =
                "ff-contract-status is-expired";

            return;
        }

        if (days === 0) {
            statusNode.textContent = "сегодня";
            statusNode.className =
                "ff-contract-status is-critical";
            return;
        }

        if (days <= 30) {
            statusNode.textContent =
                `${days} дн. осталось`;

            statusNode.className =
                "ff-contract-status is-warning";

            return;
        }

        statusNode.textContent =
            `${days} дн. осталось`;

        statusNode.className =
            "ff-contract-status is-ok";
    }


    /* =========================================================
       LIST VIEW
       ========================================================= */

    function updateListRow(companyId, financial) {
        const productsNode = document.querySelector(
            `[data-list-products="${companyId}"]`
        );

        const budgetNode = document.querySelector(
            `[data-list-budget="${companyId}"]`
        );

        const spentNode = document.querySelector(
            `[data-list-spent="${companyId}"]`
        );

        const remainingNode = document.querySelector(
            `[data-list-remaining="${companyId}"]`
        );

        const contractNode = document.querySelector(
            `[data-list-contract="${companyId}"]`
        );

        const invoiceNode = document.querySelector(
            `[data-list-invoices="${companyId}"]`
        );

        if (productsNode) {
            productsNode.textContent = financial.products;
        }

        if (budgetNode) {
            budgetNode.textContent =
                money(financial.budget, financial.currency);
        }

        if (spentNode) {
            spentNode.textContent =
                money(financial.spent, financial.currency);
        }

        if (remainingNode) {
            remainingNode.textContent =
                money(financial.remaining, financial.currency);
        }

        if (contractNode) {
            const days = daysUntil(financial.completionDate);

            contractNode.textContent =
                financial.completionDate
                    ? (
                        days === null
                            ? formatDate(financial.completionDate)
                            : days < 0
                                ? `Завершён`
                                : `${days} дн.`
                    )
                    : "—";
        }

        if (invoiceNode) {
            invoiceNode.textContent =
                getActiveCompanyInvoices(companyId).length;
        }
    }


    /* =========================================================
       INVOICE STATUS
       ========================================================= */

    function paymentStatus(invoice) {
        const amount = number(invoice.amount);
        const paid = number(invoice.paid_amount);

        if (paid >= amount && amount > 0) {
            return "PAID";
        }

        if (paid > 0) {
            return "PARTIAL";
        }

        return "UNPAID";
    }

    function paymentBadge(invoice) {
        const status =
            invoice.payment_status ||
            paymentStatus(invoice);

        const labels = {
            PAID: "Оплачен",
            PARTIAL: "Частично",
            UNPAID: "Не оплачен",
        };

        const classes = {
            PAID: "ff-payment-paid",
            PARTIAL: "ff-payment-partial",
            UNPAID: "ff-payment-unpaid",
        };

        return `
            <span class="ff-payment-badge ${classes[status] || "ff-payment-unpaid"}">
                ${labels[status] || status}
            </span>
        `;
    }


    /* =========================================================
       OVERDUE
       ========================================================= */

    function isInvoiceOverdue(invoice) {
        if (invoice.status === "CANCELLED") {
            return false;
        }

        const completion = parseDate(
            invoice.completion_date
        );

        if (!completion) {
            return false;
        }

        const amount = number(invoice.amount);
        const paid = number(invoice.paid_amount);

        if (paid >= amount) {
            return false;
        }

        return daysUntil(invoice.completion_date) < 0;
    }

    function overdueDays(invoice) {
        const days = daysUntil(
            invoice.completion_date
        );

        return days === null
            ? 0
            : Math.max(0, Math.abs(days));
    }


    /* =========================================================
       INVOICE TOTALS
       ========================================================= */

    function calculateInvoiceTotals(companyId, software = "ALL") {
        const selected = getCompanyInvoices(companyId)
            .filter(invoice => {
                if (software === "ALL") {
                    return true;
                }

                return String(invoice.software || "")
                    .toUpperCase() === software;
            });

        const groups = {};

        for (const invoice of selected) {
            const currency =
                normalizeCurrency(invoice.currency);

            if (!groups[currency]) {
                groups[currency] = {
                    currency,
                    invoiced: 0,
                    paid: 0,
                    outstanding: 0,
                };
            }

            /*
             * Cancelled invoices remain visible in the historical
             * list, but are excluded from financial totals,
             * matching the original FinFlow business logic.
             */
            if (invoice.status === "CANCELLED") {
                continue;
            }

            const amount = number(invoice.amount);
            const paid = Math.min(
                amount,
                Math.max(0, number(invoice.paid_amount))
            );

            groups[currency].invoiced += amount;
            groups[currency].paid += paid;
            groups[currency].outstanding +=
                Math.max(0, amount - paid);
        }

        return Object.values(groups);
    }


    /* =========================================================
       INVOICE TOTALS RENDER
       ========================================================= */

    function getActiveCompaniesRoot() {
        return activeView === "list"
            ? document.querySelector("#companies-list")
            : document.querySelector("#companies-grid");
    }

    function getActiveCompanyContainer(companyId) {
        const root = getActiveCompaniesRoot();

        if (!root) {
            return null;
        }

        return root.querySelector(
            `[data-company-id="${Number(companyId)}"]`
        );
    }

    function getActiveCompanyElement(companyId, selector) {
        const container =
            getActiveCompanyContainer(companyId);

        if (!container) {
            return null;
        }

        return container.querySelector(selector);
    }


    function renderInvoiceTotals(companyId, software) {
        const container =
            getActiveCompanyElement(
                companyId,
                `[data-invoice-totals="${Number(companyId)}"]`
            );

        if (!container) {
            return;
        }

        const groups =
            calculateInvoiceTotals(companyId, software);

        if (!groups.length) {
            container.innerHTML = "";
            return;
        }

        container.innerHTML = groups.map(group => `
            <div class="ff-invoice-currency-group">

                <div class="ff-invoice-currency-title">
                    <strong>${escapeHtml(group.currency)}</strong>
                    <span>Итого</span>
                </div>

                <div class="ff-invoice-total-row">
                    <span>Счета</span>
                    <strong>
                        ${money(group.invoiced, group.currency)}
                    </strong>
                </div>

                <div class="ff-invoice-total-row">
                    <span>Оплачено</span>
                    <strong>
                        ${money(group.paid, group.currency)}
                    </strong>
                </div>

                <div class="ff-invoice-total-row">
                    <span>Остаток</span>
                    <strong>
                        ${money(group.outstanding, group.currency)}
                    </strong>
                </div>

            </div>
        `).join("");
    }


    /* =========================================================
       INVOICE RENDER
       ========================================================= */

    function renderCompanyInvoices(companyId) {
        const container =
            getActiveCompanyElement(
                companyId,
                `[data-company-invoices="${Number(companyId)}"]`
            );

        if (!container) {
            return;
        }

        const software =
            activeInvoiceFilters[companyId] || "ALL";

        let companyInvoices =
            getCompanyInvoices(companyId);

        if (software !== "ALL") {
            companyInvoices =
                companyInvoices.filter(invoice =>
                    String(invoice.software || "")
                        .toUpperCase() === software
                );
        }

        const countNode =
            getActiveCompanyElement(
                companyId,
                `[data-invoice-count="${Number(companyId)}"]`
            );

        if (countNode) {
            countNode.textContent =
                `${companyInvoices.length} ${
                    companyInvoices.length === 1
                        ? "счёт"
                        : "счетов"
                }`;
        }

        renderInvoiceTotals(companyId, software);

        if (!companyInvoices.length) {
            container.innerHTML = `
                <div class="ff-invoices-empty">
                    <i class="bi bi-receipt"></i>
                    Счетов нет
                </div>
            `;
            return;
        }

        container.innerHTML = companyInvoices.map(
            renderInvoiceRow
        ).join("");
    }


    function renderInvoiceRow(invoice) {
        const amount =
            number(invoice.amount);

        const paid =
            Math.min(
                amount,
                Math.max(0, number(invoice.paid_amount))
            );

        const outstanding =
            Math.max(0, amount - paid);

        const cancelled =
            invoice.status === "CANCELLED";

        const overdue =
            isInvoiceOverdue(invoice);

        const software =
            String(invoice.software || "")
                .toUpperCase();

        let statusHtml = "";

        if (cancelled) {
            statusHtml = `
                <span class="ff-status-badge ff-status-cancelled">
                    Отменён
                </span>
            `;
        } else if (overdue) {
            statusHtml = `
                <span class="ff-status-badge ff-status-overdue">
                    Просрочен · ${overdueDays(invoice)} дн.
                </span>
            `;
        } else {
            statusHtml = paymentBadge(invoice);
        }

        const actions = [];

        if (
            canManageCompanies &&
            !cancelled
        ) {
            actions.push(`
                <button
                    type="button"
                    class="ff-invoice-action"
                    data-invoice-payment="${invoice.id}">
                    <i class="bi bi-credit-card"></i>
                    Оплата
                </button>
            `);

            actions.push(`
                <button
                    type="button"
                    class="ff-invoice-action is-danger"
                    data-invoice-cancel="${invoice.id}">
                    <i class="bi bi-x-circle"></i>
                    Отменить
                </button>
            `);
        }

        let cancellationHtml = "";

        if (
            cancelled &&
            invoice.cancellation_reason
        ) {
            cancellationHtml = `
                <div class="ff-invoice-cancellation">
                    <strong>Причина отмены:</strong>
                    ${escapeHtml(invoice.cancellation_reason)}
                </div>
            `;
        }

        return `
            <div
                class="ff-invoice-row ${cancelled ? "is-cancelled" : ""}"
                data-invoice-id="${invoice.id}">

                <div class="ff-invoice-main">

                    <span class="ff-invoice-number">
                        ${escapeHtml(
                            invoice.invoice_number ||
                            `#${invoice.id}`
                        )}
                    </span>

                    <span class="ff-invoice-date">
                        ${formatDate(invoice.invoice_date)}
                        ${
                            invoice.completion_date
                                ? ` · до ${formatDate(invoice.completion_date)}`
                                : ""
                        }
                    </span>

                </div>

                <div>
                    <span class="ff-invoice-software">
                        ${escapeHtml(software || "—")}
                    </span>
                </div>

                <div class="ff-invoice-amount">
                    ${money(
                        amount,
                        invoice.currency
                    )}
                </div>

                <div class="ff-invoice-payment">

                    ${statusHtml}

                    <strong>
                        Оплачено:
                        ${money(
                            paid,
                            invoice.currency
                        )}
                    </strong>

                    <small>
                        Остаток:
                        ${money(
                            outstanding,
                            invoice.currency
                        )}
                    </small>

                </div>

                <div>
                    ${
                        invoice.contract_details
                            ? `
                                <span
                                    title="${escapeHtml(invoice.contract_details)}"
                                    style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:rgba(148,163,184,.5);font-size:8px;">
                                    ${escapeHtml(invoice.contract_details)}
                                </span>
                              `
                            : ""
                    }
                </div>

                <div class="ff-invoice-actions">
                    ${actions.join("")}
                </div>

                ${cancellationHtml}

            </div>
        `;
    }


    /* =========================================================
       COMPANY EXPAND / COLLAPSE
       ========================================================= */

    function getCompanyViewElements(companyId) {
        const id = Number(companyId);
        const container =
            getActiveCompanyContainer(id);

        if (!container) {
            return {
                card: null,
                row: null,
                details: null,
                container: null,
            };
        }

        const card =
            activeView === "grid"
                ? container
                : null;

        const row =
            activeView === "list"
                ? container
                : null;

        const details =
            container.querySelector(
                `[data-company-details="${id}"]`
            );

        return {
            card,
            row,
            details,
            container,
        };
    }


    function toggleCompany(companyId) {
        const {
            card,
            row,
            details,
            container,
        } = getCompanyViewElements(companyId);

        if (!container || !details) {
            return;
        }

        const isOpen =
            container.classList.contains("is-expanded");

        if (
            openCompanyId &&
            Number(openCompanyId) !== Number(companyId)
        ) {
            closeCompany(openCompanyId);
        }

        if (isOpen) {
            closeCompany(companyId);
            return;
        }

        container.classList.add("is-expanded");

        details.hidden = false;

        $$(`[data-company-toggle="${companyId}"]`)
            .forEach(button => {
                button.setAttribute(
                    "aria-expanded",
                    "true"
                );
            });

        openCompanyId = Number(companyId);

        renderCompanyInvoices(companyId);
    }


    function closeCompany(companyId) {
        const {
            card,
            row,
            details,
        } = getCompanyViewElements(companyId);

        if (card) {
            card.classList.remove("is-expanded");
        }

        if (row) {
            row.classList.remove("is-expanded");
        }

        if (details) {
            details.hidden = true;
        }

        $$(`[data-company-toggle="${companyId}"]`)
            .forEach(button => {
                button.setAttribute(
                    "aria-expanded",
                    "false"
                );
            });

        if (
            openCompanyId &&
            Number(openCompanyId) === Number(companyId)
        ) {
            openCompanyId = null;
        }
    }


    /* =========================================================
       COMPANY MENU
       ========================================================= */

    function closeAllCompanyMenus() {
        $$(".ff-company-menu").forEach(menu => {
            menu.classList.add("hidden");
        });
    }

    function toggleCompanyMenu(companyId) {
        const menu =
            getActiveCompanyElement(
                companyId,
                `[data-company-menu-panel="${Number(companyId)}"]`
            );

        if (!menu) {
            return;
        }

        const wasHidden =
            menu.classList.contains("hidden");

        closeAllCompanyMenus();

        if (wasHidden) {
            menu.classList.remove("hidden");
        }
    }


    /* =========================================================
       SEARCH
       ========================================================= */

    function applySearch() {
        const input = $("#companies-search");
        const query =
            String(input?.value || "")
                .trim()
                .toLowerCase();

        const gridCards =
            $$("#companies-grid .ff-company-card");

        const listRows =
            $$("#companies-list-body .ff-company-list-row");

        let visible = 0;

        gridCards.forEach(card => {
            const name =
                String(
                    card.dataset.companyName || ""
                ).toLowerCase();

            const match =
                !query ||
                name.includes(query);

            card.classList.toggle(
                "search-hidden",
                !match
            );

            card.style.display =
                match ? "" : "none";

            if (match) {
                visible++;
            }
        });

        listRows.forEach(row => {
            const name =
                String(
                    row.dataset.companyName || ""
                ).toLowerCase();

            const match =
                !query ||
                name.includes(query);

            row.classList.toggle(
                "search-hidden",
                !match
            );

            row.style.display =
                match ? "" : "none";
        });

        const countNode =
            $("#companies-visible-count");

        if (countNode) {
            countNode.textContent = visible;
        }

        const empty =
            $("#companies-search-empty");

        if (empty) {
            empty.classList.toggle(
                "hidden",
                visible !== 0 ||
                gridCards.length === 0
            );
        }

        const clear =
            $("#companies-search-clear");

        if (clear) {
            clear.classList.toggle(
                "hidden",
                !query
            );
        }
    }


    /* =========================================================
       VIEW SWITCHER
       ========================================================= */

    function setView(view) {
        activeView =
            view === "list"
                ? "list"
                : "grid";

        const grid =
            $("#companies-grid");

        const list =
            $("#companies-list");

        if (grid) {
            grid.classList.toggle(
                "hidden",
                activeView !== "grid"
            );
        }

        if (list) {
            list.classList.toggle(
                "hidden",
                activeView !== "list"
            );
        }

        $$(".ff-view-button").forEach(button => {
            button.classList.toggle(
                "is-active",
                button.dataset.view === activeView
            );
        });

        try {
            localStorage.setItem(
                "finflow-companies-view",
                activeView
            );
        } catch (_) {
            /* Ignore storage errors. */
        }
    }


    /* =========================================================
       CREATE / EDIT COMPANY
       ========================================================= */

    /* =========================================================
       COMPANY STAMP UI
       ========================================================= */

    function resetCompanyStampUI() {
        const input = $("#company-stamp-input");
        const preview = $("#company-stamp-preview");
        const status = $("#company-stamp-status");
        const button = $("#company-stamp-button");

        if (input) {
            input.value = "";
        }

        if (preview) {
            preview.innerHTML = "";
            preview.classList.add("hidden");
        }

        if (status) {
            status.textContent = "Не загружена";
            status.classList.remove("is-ready");
        }

        if (button) {
            button.disabled = false;

            const label = button.querySelector("span");

            if (label) {
                label.textContent = "Загрузить печать";
            }
        }
    }


    function renderCompanyStamp(company) {
        const preview = $("#company-stamp-preview");
        const status = $("#company-stamp-status");
        const button = $("#company-stamp-button");

        if (!preview || !status || !button) {
            return;
        }

        preview.innerHTML = "";

        const stampUrl = String(
            company?.stamp_url || ""
        ).trim();

        if (!stampUrl) {
            preview.classList.add("hidden");

            status.textContent = "Не загружена";
            status.classList.remove("is-ready");

            const label = button.querySelector("span");

            if (label) {
                label.textContent = "Загрузить печать";
            }

            return;
        }

        const image = document.createElement("img");

        image.src = stampUrl;
        image.alt = "Печать компании";
        image.loading = "lazy";

        preview.appendChild(image);
        preview.classList.remove("hidden");

        status.textContent = "Загружена";
        status.classList.add("is-ready");

        const label = button.querySelector("span");

        if (label) {
            label.textContent = "Заменить печать";
        }
    }


    function previewCompanyStampFile(file) {
        const preview = $("#company-stamp-preview");
        const status = $("#company-stamp-status");
        const button = $("#company-stamp-button");

        if (!preview || !status || !button) {
            return;
        }

        if (!file) {
            return;
        }

        const allowedTypes = [
            "image/png",
            "image/jpeg",
            "image/webp",
        ];

        if (!allowedTypes.includes(file.type)) {
            showFormError(
                "Допустимые форматы печати: PNG, JPG, JPEG или WebP."
            );

            const input = $("#company-stamp-input");

            if (input) {
                input.value = "";
            }

            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showFormError(
                "Размер файла печати не должен превышать 5 МБ."
            );

            const input = $("#company-stamp-input");

            if (input) {
                input.value = "";
            }

            return;
        }

        const reader = new FileReader();

        reader.onload = () => {
            preview.innerHTML = "";

            const image = document.createElement("img");

            image.src = String(reader.result || "");
            image.alt = "Предпросмотр печати";

            preview.appendChild(image);
            preview.classList.remove("hidden");

            status.textContent = "Новая печать";
            status.classList.add("is-ready");

            const label = button.querySelector("span");

            if (label) {
                label.textContent = "Заменить печать";
            }
        };

        reader.readAsDataURL(file);
    }


    function openCompanyStampPicker() {
        const input = $("#company-stamp-input");

        if (!input) {
            return;
        }

        try {
            if (typeof input.showPicker === "function") {
                input.showPicker();
                return;
            }

            input.click();
        } catch (error) {
            console.error(
                "FinFlow: failed to open company stamp picker",
                error
            );

            input.click();
        }
    }


    function openCompanyDialog(companyId = null) {
        const dialog =
            $("#company-dialog");

        const idInput =
            $("#company-form-id");

        const nameInput =
            $("#company-form-name");

        const title =
            $("#company-dialog-title");

        const error =
            $("#company-form-error");

        if (!dialog || !idInput || !nameInput) {
            return;
        }

        if (error) {
            error.textContent = "";
            error.classList.add("hidden");
        }

        if (companyId) {
            const company =
                getCompanyById(companyId);

            if (!company) {
                return;
            }

            idInput.value = company.id;
            nameInput.value = company.name;

            renderCompanyStamp(company);

            if (title) {
                title.textContent =
                    "Редактировать компанию";
            }
        } else {
            idInput.value = "";
            nameInput.value = "";

            resetCompanyStampUI();

            if (title) {
                title.textContent =
                    "Новая компания";
            }
        }

        dialog.classList.remove("hidden");
        dialog.setAttribute(
            "aria-hidden",
            "false"
        );

        requestAnimationFrame(() => {
            nameInput.focus();
            nameInput.select();
        });
    }


    function closeCompanyDialog() {
        const dialog =
            $("#company-dialog");

        if (!dialog) {
            return;
        }

        dialog.classList.add("hidden");
        dialog.setAttribute(
            "aria-hidden",
            "true"
        );
    }


    function getCompanyById(companyId) {
        const id = Number(companyId);

        return (
            window.__finflowCompanies || []
        ).find(
            company =>
                Number(company.id) === id
        ) || null;
    }


    async function saveCompany(event) {
        event.preventDefault();

        if (!canManageCompanies) {
            return;
        }

        const id =
            $("#company-form-id")?.value;

        const name =
            String(
                $("#company-form-name")?.value || ""
            ).trim();

        const error =
            $("#company-form-error");

        const submit =
            $("#company-form-submit");

        if (!name) {
            showFormError(
                "Название компании обязательно."
            );
            return;
        }

        if (name.length > 255) {
            showFormError(
                "Название компании не должно превышать 255 символов."
            );
            return;
        }

        if (submit) {
            submit.disabled = true;
        }

        try {
            const endpoint = id
                ? `/companies/${id}/update`
                : "/companies/create";

            const response =
                await fetch(endpoint, {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                        "X-CSRF-Token":
                            csrfToken(),
                    },
                    body: JSON.stringify({
                        name,
                    }),
                });

            const result =
                await response.json()
                    .catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    result.message ||
                    "Не удалось сохранить компанию."
                );
            }

            const savedCompanyId =
                Number(
                    result.company?.id ||
                    id ||
                    0
                );

            const stampInput =
                $("#company-stamp-input");

            const stampFile =
                stampInput?.files?.[0] || null;

            if (stampFile && savedCompanyId) {
                const formData =
                    new FormData();

                formData.append(
                    "stamp",
                    stampFile
                );

                const stampResponse =
                    await fetch(
                        `/companies/${savedCompanyId}/stamp`,
                        {
                            method: "POST",
                            headers: {
                                "X-CSRF-Token":
                                    csrfToken(),
                            },
                            body: formData,
                        }
                    );

                const stampResult =
                    await stampResponse
                        .json()
                        .catch(() => ({}));

                if (!stampResponse.ok) {
                    throw new Error(
                        stampResult.message ||
                        "Компания сохранена, но печать загрузить не удалось."
                    );
                }
            }

            closeCompanyDialog();

            window.location.reload();

        } catch (err) {
            console.error(err);

            showFormError(
                err.message ||
                "Не удалось сохранить компанию."
            );

        } finally {
            if (submit) {
                submit.disabled = false;
            }
        }
    }


    function showFormError(message) {
        const error =
            $("#company-form-error");

        if (!error) {
            return;
        }

        error.textContent = message;
        error.classList.remove("hidden");
    }


    /* =========================================================
       DELETE COMPANY
       ========================================================= */

    async function deleteCompany(companyId) {
        if (!canManageCompanies) {
            return;
        }

        const company =
            getCompanyById(companyId);

        if (!company) {
            return;
        }

        const confirmed =
            window.confirm(
                `Удалить компанию «${company.name}»?\n\n` +
                "Вместе с компанией будут удалены её счета, " +
                "бюджеты и связанные уведомления.\n\n" +
                "История аудита сохранится."
            );

        if (!confirmed) {
            return;
        }

        try {
            const response =
                await fetch(
                    `/companies/${companyId}/delete`,
                    {
                        method: "POST",
                        headers: {
                            "X-CSRF-Token":
                                csrfToken(),
                        },
                    }
                );

            const result =
                await response.json()
                    .catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    result.message ||
                    "Не удалось удалить компанию."
                );
            }

            window.location.reload();

        } catch (error) {
            console.error(error);

            window.alert(
                error.message ||
                "Не удалось удалить компанию."
            );
        }
    }


    /* =========================================================
       PAYMENT UPDATE
       ========================================================= */

    async function updateInvoicePayment(invoiceId) {
        if (!canManageCompanies) {
            return;
        }

        const invoice =
            invoices.find(
                item => Number(item.id) === Number(invoiceId)
            );

        if (!invoice) {
            return;
        }

        const amount =
            number(invoice.amount);

        const currentPaid =
            number(invoice.paid_amount);

        const value =
            window.prompt(
                `Сколько оплачено по счёту?\n\n` +
                `Сумма счёта: ${money(
                    amount,
                    invoice.currency
                )}\n` +
                `Текущая оплата: ${money(
                    currentPaid,
                    invoice.currency
                )}`,
                currentPaid.toFixed(2)
            );

        if (value === null) {
            return;
        }

        const paid =
            Number(
                String(value)
                    .replace(",", ".")
            );

        if (!Number.isFinite(paid)) {
            window.alert(
                "Введите корректную сумму."
            );
            return;
        }

        if (paid < 0) {
            window.alert(
                "Сумма оплаты не может быть отрицательной."
            );
            return;
        }

        if (paid > amount) {
            window.alert(
                "Сумма оплаты не может превышать сумму счёта."
            );
            return;
        }

        try {
            const response =
                await fetch(
                    `/update_invoice_payment/${invoiceId}`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json",
                            "X-CSRF-Token":
                                csrfToken(),
                        },
                        body: JSON.stringify({
                            paid_amount_eur: paid,
                        }),
                    }
                );

            const result =
                await response.json()
                    .catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    result.message ||
                    "Не удалось обновить оплату."
                );
            }

            if (result.invoice) {
                const index =
                    invoices.findIndex(
                        item =>
                            Number(item.id) ===
                            Number(invoiceId)
                    );

                if (index !== -1) {
                    invoices[index] = {
                        ...invoices[index],
                        paid_amount:
                            number(
                                result.invoice.paid_amount_eur
                            ),
                        payment_status:
                            result.invoice.payment_status,
                    };
                }
            }

            refreshCompany(
                invoice.company_id
            );

        } catch (error) {
            console.error(error);

            window.alert(
                error.message ||
                "Не удалось обновить оплату."
            );
        }
    }


    /* =========================================================
       CANCEL INVOICE
       ========================================================= */

    async function cancelInvoice(invoiceId) {
        if (!canManageCompanies) {
            return;
        }

        const invoice =
            invoices.find(
                item =>
                    Number(item.id) ===
                    Number(invoiceId)
            );

        if (!invoice) {
            return;
        }

        if (invoice.status === "CANCELLED") {
            return;
        }

        const reason =
            window.prompt(
                "Причина отмены счёта:"
            );

        if (reason === null) {
            return;
        }

        const trimmed =
            String(reason).trim();

        if (!trimmed) {
            window.alert(
                "Причина отмены обязательна."
            );
            return;
        }

        const confirmed =
            window.confirm(
                `Отменить счёт ${
                    invoice.invoice_number ||
                    `#${invoice.id}`
                }?\n\n` +
                "Счёт останется в истории, " +
                "но будет исключён из финансовых итогов."
            );

        if (!confirmed) {
            return;
        }

        try {
            const response =
                await fetch(
                    `/cancel_invoice/${invoiceId}`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json",
                            "X-CSRF-Token":
                                csrfToken(),
                        },
                        body: JSON.stringify({
                            reason: trimmed,
                        }),
                    }
                );

            const result =
                await response.json()
                    .catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    result.message ||
                    "Не удалось отменить счёт."
                );
            }

            const index =
                invoices.findIndex(
                    item =>
                        Number(item.id) ===
                        Number(invoiceId)
                );

            if (index !== -1) {
                invoices[index] = {
                    ...invoices[index],
                    status: "CANCELLED",
                    cancelled_at:
                        result.cancelled_at ||
                        new Date().toISOString(),
                    cancellation_reason:
                        result.cancellation_reason ||
                        trimmed,
                };
            }

            refreshCompany(
                invoice.company_id
            );

        } catch (error) {
            console.error(error);

            window.alert(
                error.message ||
                "Не удалось отменить счёт."
            );
        }
    }


    /* =========================================================
       REFRESH COMPANY
       ========================================================= */

    function refreshCompany(companyId) {
        /*
         * The server remains the source of truth for budgets,
         * spent values and invoice state. Reloading the page
         * after a mutation guarantees that the company card,
         * notifications and financial aggregates all match
         * backend state.
         */

        renderCompanyInvoices(companyId);
        updateCompanyCardMetrics(companyId);

        /*
         * Keep the current expanded card open while the
         * browser performs the lightweight refresh.
         */
        window.setTimeout(() => {
            window.location.reload();
        }, 250);
    }


    /* =========================================================
       INVOICE FILTER
       ========================================================= */

    function setInvoiceFilter(companyId, software) {
        activeInvoiceFilters[companyId] =
            software;

        const group =
            getActiveCompanyElement(
                companyId,
                `[data-invoice-filter-group="${Number(companyId)}"]`
            );

        if (group) {
            $$("button", group).forEach(button => {
                button.classList.toggle(
                    "is-active",
                    button.dataset.invoiceFilter === software
                );
            });
        }

        renderCompanyInvoices(companyId);
    }


    /* =========================================================
       EVENT HANDLERS
       ========================================================= */

    document.addEventListener(
        "click",
        event => {

            const toggle =
                event.target.closest(
                    "[data-company-toggle]"
                );

            if (toggle) {
                event.preventDefault();

                toggleCompany(
                    Number(
                        toggle.dataset.companyToggle
                    )
                );

                return;
            }


            const menuButton =
                event.target.closest(
                    "[data-company-menu]"
                );

            if (menuButton) {
                event.preventDefault();
                event.stopPropagation();

                toggleCompanyMenu(
                    Number(
                        menuButton.dataset.companyMenu
                    )
                );

                return;
            }


            const editButton =
                event.target.closest(
                    "[data-company-edit]"
                );

            if (editButton) {
                event.preventDefault();

                closeAllCompanyMenus();

                openCompanyDialog(
                    Number(
                        editButton.dataset.companyEdit
                    )
                );

                return;
            }


            const deleteButton =
                event.target.closest(
                    "[data-company-delete]"
                );

            if (deleteButton) {
                event.preventDefault();

                closeAllCompanyMenus();

                deleteCompany(
                    Number(
                        deleteButton.dataset.companyDelete
                    )
                );

                return;
            }


            const filterButton =
                event.target.closest(
                    "[data-invoice-filter]"
                );

            if (filterButton) {
                event.preventDefault();

                const group =
                    filterButton.closest(
                        "[data-invoice-filter-group]"
                    );

                if (group) {
                    const companyId =
                        Number(
                            group.dataset.invoiceFilterGroup
                        );

                    setInvoiceFilter(
                        companyId,
                        filterButton.dataset.invoiceFilter
                    );
                }

                return;
            }


            const paymentButton =
                event.target.closest(
                    "[data-invoice-payment]"
                );

            if (paymentButton) {
                event.preventDefault();

                updateInvoicePayment(
                    Number(
                        paymentButton.dataset.invoicePayment
                    )
                );

                return;
            }


            const cancelButton =
                event.target.closest(
                    "[data-invoice-cancel]"
                );

            if (cancelButton) {
                event.preventDefault();

                cancelInvoice(
                    Number(
                        cancelButton.dataset.invoiceCancel
                    )
                );

                return;
            }


            if (
                !event.target.closest(
                    ".ff-company-menu"
                ) &&
                !event.target.closest(
                    "[data-company-menu]"
                )
            ) {
                closeAllCompanyMenus();
            }

        }
    );


    /* =========================================================
       SEARCH EVENTS
       ========================================================= */

    const search =
        $("#companies-search");

    if (search) {
        search.addEventListener(
            "input",
            applySearch
        );
    }

    const searchClear =
        $("#companies-search-clear");

    if (searchClear) {
        searchClear.addEventListener(
            "click",
            () => {
                if (search) {
                    search.value = "";
                    search.focus();
                }

                applySearch();
            }
        );
    }

    const searchReset =
        $("#companies-search-reset");

    if (searchReset) {
        searchReset.addEventListener(
            "click",
            () => {
                if (search) {
                    search.value = "";
                }

                applySearch();
            }
        );
    }


    /* =========================================================
       VIEW EVENTS
       ========================================================= */

    $$(".ff-view-button").forEach(button => {
        button.addEventListener(
            "click",
            () => {
                setView(
                    button.dataset.view
                );
            }
        );
    });


    /* =========================================================
       COMPANY DIALOG EVENTS
       ========================================================= */

    const createButton =
        $("#companies-create-button");

    if (createButton) {
        createButton.addEventListener(
            "click",
            () => openCompanyDialog()
        );
    }

    const createEmptyButton =
        $("#companies-create-empty");

    if (createEmptyButton) {
        createEmptyButton.addEventListener(
            "click",
            () => openCompanyDialog()
        );
    }

    const dialogClose =
        $("#company-dialog-close");

    if (dialogClose) {
        dialogClose.addEventListener(
            "click",
            closeCompanyDialog
        );
    }

    const dialogCancel =
        $("#company-dialog-cancel");

    if (dialogCancel) {
        dialogCancel.addEventListener(
            "click",
            closeCompanyDialog
        );
    }

    const dialog =
        $("#company-dialog");

    if (dialog) {
        dialog.addEventListener(
            "click",
            event => {
                if (
                    event.target === dialog
                ) {
                    closeCompanyDialog();
                }
            }
        );
    }

    const companyForm =
        $("#company-form");

    if (companyForm) {
        companyForm.addEventListener(
            "submit",
            saveCompany
        );
    }


    const companyStampButton =
        $("#company-stamp-button");

    if (companyStampButton) {
        companyStampButton.addEventListener(
            "click",
            openCompanyStampPicker
        );
    }


    const companyStampInput =
        $("#company-stamp-input");

    if (companyStampInput) {
        companyStampInput.addEventListener(
            "change",
            event => {
                const file =
                    event.target.files?.[0] || null;

                previewCompanyStampFile(file);
            }
        );
    }


    /* =========================================================
       KEYBOARD
       ========================================================= */

    document.addEventListener(
        "keydown",
        event => {

            if (event.key === "Escape") {
                closeAllCompanyMenus();

                const dialog =
                    $("#company-dialog");

                if (
                    dialog &&
                    !dialog.classList.contains("hidden")
                ) {
                    closeCompanyDialog();
                }
            }

        }
    );


    /* =========================================================
       INITIALIZATION
       ========================================================= */

    function initializeCompanies() {

        /*
         * Keep a normalized company collection in memory.
         * The template intentionally passes IDs only in
         * DATA.companies, so obtain names from the rendered
         * cards/list rows.
         */
        window.__finflowCompanies =
            companies.map(id => {

                const row =
                    document.querySelector(
                        `.ff-company-card[data-company-id="${id}"]`
                    );

                return {
                    id: Number(id),
                    name:
                        row?.querySelector(
                            ".ff-company-title strong"
                        )?.textContent?.trim() ||
                        row?.querySelector(
                            ".ff-list-company strong"
                        )?.textContent?.trim() ||
                        "",
                };
            });

        companyCards.forEach(card => {
            updateCompanyCardMetrics(
                card.id
            );
        });

        try {
            const savedView =
                localStorage.getItem(
                    "finflow-companies-view"
                );

            if (
                savedView === "grid" ||
                savedView === "list"
            ) {
                setView(savedView);
            } else {
                setView("grid");
            }

        } catch (_) {
            setView("grid");
        }

        applySearch();

        /*
         * Keep contract countdown current while the page
         * remains open.
         */
        window.setInterval(
            () => {
                companyCards.forEach(card => {
                    const financial =
                        buildCompanyFinancial(card.id);

                    updateCompanyContract(
                        card.id,
                        financial.completionDate
                    );
                });
            },
            60000
        );
    }


    initializeCompanies();

})();
