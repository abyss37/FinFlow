(() => {
    "use strict";

    const invoices = Array.isArray(window.FINFLOW_INVOICES)
        ? window.FINFLOW_INVOICES
        : [];

    let activeView = "table";

    const $ = (selector) => document.querySelector(selector);

    const els = {
        search: $("#invoiceSearch"),
        company: $("#invoiceCompanyFilter"),
        software: $("#invoiceSoftwareFilter"),
        currency: $("#invoiceCurrencyFilter"),
        status: $("#invoiceStatusFilter"),
        payment: $("#invoicePaymentFilter"),
        stats: $("#invoiceStats"),
        tableBody: $("#invoicesTableBody"),
        cards: $("#invoicesCardsView"),
        table: $("#invoicesTableView"),
        empty: $("#invoiceEmptyState"),
        refresh: $("#invoicesRefresh"),
        create: $("#invoiceCreateButton"),
        generator: $("#invoiceGeneratorButton"),
        detail: $("#invoiceDetail"),
        createForm: $("#invoiceCreateForm"),
        createFormElement: $("#invoiceCreateFormElement"),
        createClose: $("#invoiceCreateClose"),
        createCancel: $("#invoiceCreateCancel"),
        createError: $("#invoiceCreateError"),
    };

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function money(value, currency = "EUR") {
        return window.FinFlowMoney
            ? window.FinFlowMoney.formatMoney(value, currency)
            : `${String(currency || "EUR").toUpperCase()} ${Number(value || 0).toLocaleString("uk-UA", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })}`;
    }

    function formatDate(value) {
        if (!value) return "—";

        const date = new Date(value + "T00:00:00");

        if (Number.isNaN(date.getTime())) return "—";

        return new Intl.DateTimeFormat("uk-UA", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        }).format(date);
    }

    function daysToDate(value) {
        if (!value) return null;

        const target = new Date(value + "T00:00:00");
        if (Number.isNaN(target.getTime())) return null;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return Math.ceil(
            (target.getTime() - today.getTime()) / 86400000
        );
    }

    function paymentLabel(status) {
        const labels = {
            PAID: "Оплачен",
            PARTIAL: "Частично",
            UNPAID: "Не оплачен",
        };

        return labels[status] || status || "Не оплачен";
    }

    function statusLabel(status) {
        return status === "CANCELLED"
            ? "Отменён"
            : "Выставлен";
    }

    function paymentClass(status) {
        return {
            PAID: "is-paid",
            PARTIAL: "is-partial",
            UNPAID: "is-unpaid",
        }[status] || "is-unpaid";
    }

    function statusClass(status) {
        return status === "CANCELLED"
            ? "is-cancelled"
            : "is-issued";
    }

    function deadlineMarkup(invoice) {
        if (invoice.status === "CANCELLED") {
            return '<span class="ff-invoice-muted">—</span>';
        }

        if (!invoice.completion_date) {
            return '<span class="ff-invoice-muted">Не указан</span>';
        }

        const days = daysToDate(invoice.completion_date);

        if (days < 0) {
            return `
                <span class="ff-invoice-deadline is-overdue">
                    Просрочен на ${Math.abs(days)} д.
                </span>
            `;
        }

        if (days === 0) {
            return '<span class="ff-invoice-deadline is-today">Сегодня</span>';
        }

        return `
            <span class="ff-invoice-deadline">
                ${days} дн.
            </span>
        `;
    }

    function filteredInvoices() {
        const query = (els.search.value || "").trim().toLowerCase();

        return invoices.filter((invoice) => {
            const matchesSearch =
                !query ||
                String(invoice.invoice_number || "").toLowerCase().includes(query) ||
                String(invoice.company_name || "").toLowerCase().includes(query);

            const matchesCompany =
                !els.company.value ||
                String(invoice.company_id) === String(els.company.value);

            const matchesSoftware =
                !els.software.value ||
                invoice.software === els.software.value;

            const matchesCurrency =
                !els.currency.value ||
                invoice.currency === els.currency.value;

            const matchesStatus =
                !els.status.value ||
                invoice.status === els.status.value;

            const matchesPayment =
                !els.payment.value ||
                invoice.payment_status === els.payment.value;

            return (
                matchesSearch &&
                matchesCompany &&
                matchesSoftware &&
                matchesCurrency &&
                matchesStatus &&
                matchesPayment
            );
        });
    }

    function populateCompanies() {
        const companies = [...new Map(
            invoices.map((invoice) => [
                invoice.company_id,
                invoice.company_name,
            ])
        ).entries()]
            .sort((a, b) =>
                String(a[1]).localeCompare(String(b[1]), "uk")
            );

        for (const [id, name] of companies) {
            const option = document.createElement("option");
            option.value = id;
            option.textContent = name;
            els.company.appendChild(option);
        }
    }

    function renderStats(list) {
        const active = list.filter(
            (invoice) => invoice.status !== "CANCELLED"
        );

        const issued = active.length;

        const paid = active.filter(
            (invoice) => invoice.payment_status === "PAID"
        ).length;

        const overdue = active.filter((invoice) => {
            const days = daysToDate(invoice.completion_date);
            return (
                days !== null &&
                days < 0 &&
                invoice.payment_status !== "PAID"
            );
        }).length;

        const outstandingByCurrency = active.reduce(
            (totals, invoice) => {
                const currency = String(
                    invoice.currency || "EUR"
                ).toUpperCase();

                totals[currency] =
                    (totals[currency] || 0) +
                    Number(invoice.outstanding_amount || 0);

                return totals;
            },
            {}
        );

        const outstanding = Object.entries(
            outstandingByCurrency
        )
            .sort(([currencyA], [currencyB]) =>
                currencyA.localeCompare(currencyB)
            )
            .map(
                ([currency, amount]) =>
                    `<div>${money(amount, currency)}</div>`
            )
            .join("");

        els.stats.innerHTML = `
            <div class="ff-invoice-stat">
                <span class="ff-invoice-stat-icon">
                    <i class="bi bi-receipt"></i>
                </span>
                <div>
                    <strong>${issued}</strong>
                    <span>Активных счетов</span>
                </div>
            </div>

            <div class="ff-invoice-stat">
                <span class="ff-invoice-stat-icon is-success">
                    <i class="bi bi-check2-circle"></i>
                </span>
                <div>
                    <strong>${paid}</strong>
                    <span>Полностью оплачено</span>
                </div>
            </div>

            <div class="ff-invoice-stat">
                <span class="ff-invoice-stat-icon is-warning">
                    <i class="bi bi-hourglass-split"></i>
                </span>
                <div>
                    <strong>${overdue}</strong>
                    <span>Требуют внимания</span>
                </div>
            </div>

            <div class="ff-invoice-stat">
                <span class="ff-invoice-stat-icon is-accent">
                    <i class="bi bi-wallet2"></i>
                </span>
                <div>
                    <strong class="ff-invoice-outstanding">
                        ${outstanding || "—"}
                    </strong>
                    <span>Остаток к оплате</span>
                </div>
            </div>
        `;
    }

    function renderRow(invoice) {
        return `
            <tr data-invoice-id="${invoice.id}">
                <td>
                    <div class="ff-invoice-number">
                        ${escapeHtml(invoice.invoice_number || `#${invoice.id}`)}
                    </div>
                    <div class="ff-invoice-sub">
                        ID ${invoice.id}
                    </div>
                </td>

                <td>
                    <div class="ff-invoice-company">
                        ${escapeHtml(invoice.company_name)}
                    </div>
                </td>

                <td>
                    <span class="ff-product-badge">
                        ${escapeHtml(invoice.software)}
                    </span>
                </td>

                <td>
                    <span class="ff-invoice-date">
                        ${formatDate(invoice.invoice_date)}
                    </span>
                </td>

                <td>
                    <strong class="ff-invoice-amount">
                        ${money(invoice.amount, invoice.currency)}
                    </strong>
                    <div class="ff-invoice-sub">
                        оплачено ${money(invoice.paid_amount, invoice.currency)}
                    </div>
                </td>

                <td>
                    <span class="ff-invoice-badge ${paymentClass(invoice.payment_status)}">
                        ${paymentLabel(invoice.payment_status)}
                    </span>
                </td>

                <td>
                    ${deadlineMarkup(invoice)}
                </td>

                <td>
                    <span class="ff-invoice-badge ${statusClass(invoice.status)}">
                        ${statusLabel(invoice.status)}
                    </span>
                </td>

                <td>
                    <button
                        type="button"
                        class="ff-invoice-action"
                        data-invoice-action="open"
                        data-invoice-id="${invoice.id}"
                        title="Открыть"
                    >
                        <i class="bi bi-chevron-right"></i>
                    </button>
                </td>
            </tr>
        `;
    }

    function renderCard(invoice) {
        return `
            <article class="ff-invoice-card" data-invoice-id="${invoice.id}">
                <div class="ff-invoice-card-top">
                    <div>
                        <div class="ff-invoice-number">
                            ${escapeHtml(invoice.invoice_number || `#${invoice.id}`)}
                        </div>
                        <div class="ff-invoice-company">
                            ${escapeHtml(invoice.company_name)}
                        </div>
                    </div>

                    <span class="ff-product-badge">
                        ${escapeHtml(invoice.software)}
                    </span>
                </div>

                <div class="ff-invoice-card-amount">
                    ${money(invoice.amount, invoice.currency)}
                </div>

                <div class="ff-invoice-card-grid">
                    <div>
                        <span>Дата</span>
                        <strong>${formatDate(invoice.invoice_date)}</strong>
                    </div>

                    <div>
                        <span>Оплачено</span>
                        <strong>${money(invoice.paid_amount, invoice.currency)}</strong>
                    </div>

                    <div>
                        <span>Оплата</span>
                        <strong>
                            <span class="ff-invoice-badge ${paymentClass(invoice.payment_status)}">
                                ${paymentLabel(invoice.payment_status)}
                            </span>
                        </strong>
                    </div>

                    <div>
                        <span>Срок</span>
                        <strong>${deadlineMarkup(invoice)}</strong>
                    </div>
                </div>

                <div class="ff-invoice-card-footer">
                    <span class="ff-invoice-badge ${statusClass(invoice.status)}">
                        ${statusLabel(invoice.status)}
                    </span>

                    <button
                        type="button"
                        class="ff-btn ff-btn-secondary ff-btn-small"
                        data-invoice-action="open"
                        data-invoice-id="${invoice.id}"
                    >
                        Открыть
                    </button>
                </div>
            </article>
        `;
    }


    function renderInvoiceDetail(invoice) {
        if (!invoice) {
            els.detail.hidden = true;
            els.detail.innerHTML = "";
            return;
        }

        const cancelled = invoice.status === "CANCELLED";

        els.detail.innerHTML = `
            <div class="ff-invoice-detail-head">
                <div>
                    <div class="ff-page-eyebrow">INVOICE DETAILS</div>
                    <h2>${escapeHtml(invoice.invoice_number || `#${invoice.id}`)}</h2>
                    <p>${escapeHtml(invoice.company_name || "—")}</p>
                </div>

                <button
                    type="button"
                    class="ff-invoice-detail-close"
                    id="invoiceDetailClose"
                    title="Закрыть"
                >
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>

            <div class="ff-invoice-detail-grid">

                <div class="ff-invoice-detail-item">
                    <span>Компания</span>
                    <strong>${escapeHtml(invoice.company_name || "—")}</strong>
                </div>

                <div class="ff-invoice-detail-item">
                    <span>Продукт</span>
                    <strong>${escapeHtml(invoice.software || "—")}</strong>
                </div>

                <div class="ff-invoice-detail-item">
                    <span>Дата счёта</span>
                    <strong>${formatDate(invoice.invoice_date)}</strong>
                </div>

                <div class="ff-invoice-detail-item">
                    <span>Срок</span>
                    <strong>${formatDate(invoice.completion_date)}</strong>
                </div>

                <div class="ff-invoice-detail-item">
                    <span>Сумма</span>
                    <strong>${money(invoice.amount, invoice.currency)}</strong>
                </div>

                <div class="ff-invoice-detail-item">
                    <span>Оплачено</span>
                    <strong>${money(invoice.paid_amount, invoice.currency)}</strong>
                </div>

                <div class="ff-invoice-detail-item">
                    <span>Остаток</span>
                    <strong>${money(invoice.outstanding_amount, invoice.currency)}</strong>
                </div>

                <div class="ff-invoice-detail-item">
                    <span>Оплата</span>
                    <strong>
                        <span class="ff-invoice-badge ${paymentClass(invoice.payment_status)}">
                            ${paymentLabel(invoice.payment_status)}
                        </span>
                    </strong>
                </div>

                <div class="ff-invoice-detail-item">
                    <span>Статус</span>
                    <strong>
                        <span class="ff-invoice-badge ${statusClass(invoice.status)}">
                            ${statusLabel(invoice.status)}
                        </span>
                    </strong>
                </div>

                <div class="ff-invoice-detail-item">
                    <span>Срок выполнения</span>
                    <strong>${deadlineMarkup(invoice)}</strong>
                </div>

            </div>

            ${
                invoice.contract_details
                    ? `
                        <div class="ff-invoice-detail-section">
                            <span>Детали контракта</span>
                            <div>${escapeHtml(invoice.contract_details)}</div>
                        </div>
                    `
                    : ""
            }

            ${
                cancelled
                    ? `
                        <div class="ff-invoice-detail-cancelled">
                            <div class="ff-invoice-detail-cancelled-title">
                                <i class="bi bi-exclamation-circle"></i>
                                Счёт отменён
                            </div>
                            ${
                                invoice.cancellation_reason
                                    ? `<div>${escapeHtml(invoice.cancellation_reason)}</div>`
                                    : ""
                            }
                        </div>
                    `
                    : ""
            }

            <div class="ff-invoice-detail-actions">
                ${
                    !cancelled
                        ? `
                            <button
                                type="button"
                                class="ff-btn ff-btn-secondary"
                                data-detail-action="payment"
                                data-invoice-id="${invoice.id}"
                            >
                                <i class="bi bi-credit-card"></i>
                                Обновить оплату
                            </button>

                            <button
                                type="button"
                                class="ff-btn ff-btn-secondary"
                                data-detail-action="edit"
                                data-invoice-id="${invoice.id}"
                            >
                                <i class="bi bi-pencil"></i>
                                Редактировать
                            </button>

                            <button
                                type="button"
                                class="ff-btn ff-btn-secondary"
                                data-detail-action="cancel"
                                data-invoice-id="${invoice.id}"
                            >
                                <i class="bi bi-x-circle"></i>
                                Отменить счёт
                            </button>
                        `
                        : ""
                }

            </div>
        `;

        els.detail.hidden = false;

        requestAnimationFrame(() => {
            els.detail.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
            });
        });

        const closeButton = document.querySelector("#invoiceDetailClose");

        if (closeButton) {
            closeButton.addEventListener("click", () => {
                renderInvoiceDetail(null);
            });
        }
    }

    function render() {
        const list = filteredInvoices();

        renderStats(list);

        els.empty.hidden = list.length !== 0;
        els.table.classList.toggle(
            "hidden",
            activeView !== "table" || list.length === 0
        );
        els.cards.classList.toggle(
            "hidden",
            activeView !== "cards" || list.length === 0
        );

        els.tableBody.innerHTML = list.map(renderRow).join("");
        els.cards.innerHTML = list.map(renderCard).join("");
    }

    function setView(view) {
        activeView = view;

        document.querySelectorAll("[data-invoice-view]").forEach((button) => {
            button.classList.toggle(
                "is-active",
                button.dataset.invoiceView === view
            );
        });

        render();
    }

    function bind() {
        [
            els.search,
            els.company,
            els.software,
            els.currency,
            els.status,
            els.payment,
        ].forEach((element) => {
            element.addEventListener("input", render);
            element.addEventListener("change", render);
        });

        document.querySelectorAll("[data-invoice-view]").forEach((button) => {
            button.addEventListener("click", () => {
                setView(button.dataset.invoiceView);
            });
        });

        els.refresh.addEventListener("click", () => {
            window.location.reload();
        });

        let editingInvoiceId = null;

        function setCreateFormMode(invoice = null) {
            editingInvoiceId = invoice ? Number(invoice.id) : null;

            const title = els.createForm
                ? els.createForm.querySelector(".ff-invoice-create-head h2")
                : null;

            const eyebrow = els.createForm
                ? els.createForm.querySelector(".ff-page-eyebrow")
                : null;

            const description = els.createForm
                ? els.createForm.querySelector(".ff-invoice-create-head p")
                : null;

            const submitButton = els.createFormElement
                ? els.createFormElement.querySelector('button[type="submit"]')
                : null;

            if (editingInvoiceId) {
                if (eyebrow) eyebrow.textContent = "EDIT INVOICE";
                if (title) title.textContent = "Редактирование счёта";
                if (description) {
                    description.textContent =
                        "Изменение данных существующего счёта.";
                }
                if (submitButton) {
                    submitButton.innerHTML =
                        '<i class="bi bi-check2"></i> Сохранить изменения';
                }
            } else {
                if (eyebrow) eyebrow.textContent = "NEW INVOICE";
                if (title) title.textContent = "Новый счёт";
                if (description) {
                    description.textContent =
                        "Создание счёта непосредственно в реестре.";
                }
                if (submitButton) {
                    submitButton.innerHTML =
                        '<i class="bi bi-check2"></i> Создать счёт';
                }
            }
        }

        function parseContractDetails(raw) {
            if (!raw) {
                return {
                    po_number: "",
                    bill_to_details: "",
                    payment_terms: "15 days",
                    notes: "",
                    terms: "",
                    items: [],
                };
            }

            if (typeof raw === "object") {
                return {
                    po_number: raw.po_number || "",
                    bill_to_details: raw.bill_to_details || "",
                    payment_terms: raw.payment_terms || "15 days",
                    notes: raw.notes || "",
                    terms: raw.terms || "",
                    items: Array.isArray(raw.items) ? raw.items : [],
                };
            }

            try {
                const parsed = JSON.parse(String(raw));

                if (parsed && typeof parsed === "object") {
                    return {
                        po_number: parsed.po_number || "",
                        bill_to_details: parsed.bill_to_details || "",
                        payment_terms:
                            parsed.payment_terms || "15 days",
                        notes: parsed.notes || "",
                        terms: parsed.terms || "",
                        items: Array.isArray(parsed.items)
                            ? parsed.items
                            : [],
                    };
                }
            } catch (_) {
                // Старые текстовые contract_details оставляем как notes.
            }

            return {
                po_number: "",
                bill_to_details: "",
                payment_terms: "15 days",
                notes: String(raw),
                terms: "",
                items: [],
            };
        }

        function addInvoiceItemRow(item = {}) {
            const container = document.getElementById("invoiceItems");

            if (!container) return null;

            const row = document.createElement("div");
            row.className = "ff-invoice-item";
            row.dataset.itemRow = "";

            const description =
                typeof item === "string"
                    ? item
                    : item.description || "";

            const qty =
                typeof item === "object" && item.quantity != null
                    ? Number(item.quantity)
                    : 1;

            const rate =
                typeof item === "object" && item.rate != null
                    ? Number(item.rate)
                    : 0;

            row.innerHTML = `
                <input
                    type="text"
                    class="ff-invoice-item-description"
                    placeholder="Software License Agreement"
                    value="${escapeHtml(description)}"
                >

                <input
                    type="number"
                    class="ff-invoice-item-qty"
                    min="0"
                    step="0.01"
                    value="${Number.isFinite(qty) ? qty : 1}"
                >

                <input
                    type="number"
                    class="ff-invoice-item-rate"
                    min="0"
                    step="0.01"
                    value="${Number.isFinite(rate) ? rate : 0}"
                >

                <output class="ff-invoice-item-total">0.00</output>

                <button
                    type="button"
                    class="ff-invoice-item-remove"
                    data-remove-item
                    title="Удалить позицию"
                >
                    <i class="bi bi-trash3"></i>
                </button>
            `;

            container.appendChild(row);

            updateInvoiceItemRow(row);

            return row;
        }

        function updateInvoiceItemRow(row) {
            if (!row) return;

            const qtyInput =
                row.querySelector(".ff-invoice-item-qty");

            const rateInput =
                row.querySelector(".ff-invoice-item-rate");

            const output =
                row.querySelector(".ff-invoice-item-total");

            const qty = Number(qtyInput?.value || 0);
            const rate = Number(rateInput?.value || 0);
            const total =
                Number.isFinite(qty) && Number.isFinite(rate)
                    ? qty * rate
                    : 0;

            if (output) {
                output.textContent = total.toFixed(2);
            }
        }

        function clearInvoiceItems() {
            const container = document.getElementById("invoiceItems");

            if (!container) return;

            container.innerHTML = "";
        }

        function collectInvoiceItems() {
            return Array.from(
                document.querySelectorAll(
                    "#invoiceItems [data-item-row]"
                )
            )
                .map((row) => {
                    const description = String(
                        row.querySelector(
                            ".ff-invoice-item-description"
                        )?.value || ""
                    ).trim();

                    const quantity = Number(
                        row.querySelector(
                            ".ff-invoice-item-qty"
                        )?.value || 0
                    );

                    const rate = Number(
                        row.querySelector(
                            ".ff-invoice-item-rate"
                        )?.value || 0
                    );

                    return {
                        description,
                        quantity: Number.isFinite(quantity)
                            ? quantity
                            : 0,
                        rate: Number.isFinite(rate)
                            ? rate
                            : 0,
                    };
                })
                .filter(
                    (item) =>
                        item.description ||
                        item.quantity ||
                        item.rate
                );
        }

        function buildContractDetails(form) {
            return {
                po_number: String(
                    form.get("po_number") || ""
                ).trim(),

                bill_to_details: String(
                    form.get("bill_to_details") || ""
                ).trim(),

                payment_terms: String(
                    form.get("payment_terms") || "15 days"
                ).trim(),

                notes: String(
                    form.get("notes") || ""
                ).trim(),

                terms: String(
                    form.get("terms") || ""
                ).trim(),

                items: collectInvoiceItems(),
            };
        }

        function showCreateForm(invoice = null) {
            if (!els.createForm || !els.createFormElement) return;

            if (els.detail) {
                els.detail.hidden = true;
            }

            setCreateFormMode(invoice);

            const form = els.createFormElement;

            clearInvoiceItems();

            if (invoice) {
                const details =
                    parseContractDetails(
                        invoice.contract_details
                    );

                form.elements.company_name.value =
                    invoice.company_name || "";

                form.elements.invoice_number.value =
                    invoice.invoice_number || "";

                form.elements.invoice_date.value =
                    invoice.invoice_date || "";

                form.elements.completion_date.value =
                    invoice.completion_date || "";

                form.elements.software.value =
                    invoice.software || "";

                form.elements.currency.value =
                    invoice.currency || "EUR";

                form.elements.amount.value =
                    Number(invoice.amount || 0).toFixed(2);

                form.elements.po_number.value =
                    details.po_number;

                form.elements.bill_to_details.value =
                    details.bill_to_details;

                form.elements.payment_terms.value =
                    details.payment_terms;

                form.elements.notes.value =
                    details.notes;

                form.elements.terms.value =
                    details.terms;

                if (details.items.length) {
                    details.items.forEach((item) => {
                        addInvoiceItemRow(item);
                    });
                } else {
                    addInvoiceItemRow({
                        description: "",
                        quantity: 1,
                        rate: Number(invoice.amount || 0),
                    });
                }
            } else {
                form.reset();

                form.elements.software.value = "";
                form.elements.currency.value = "EUR";
                form.elements.payment_terms.value = "15 days";

                const invoiceDate =
                    form.elements.invoice_date;

                if (invoiceDate && !invoiceDate.value) {
                    invoiceDate.value =
                        new Date()
                            .toISOString()
                            .slice(0, 10);
                }

                addInvoiceItemRow({
                    description: "",
                    quantity: 1,
                    rate: 0,
                });
            }

            if (els.createError) {
                els.createError.hidden = true;
                els.createError.textContent = "";
            }

            els.createForm.hidden = false;

            els.createForm.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });

            const firstInput =
                els.createForm.querySelector(
                    'select[name="company_name"]'
                );

            if (firstInput) {
                setTimeout(
                    () => firstInput.focus(),
                    250
                );
            }
        }

        function hideCreateForm() {
            if (!els.createForm) return;

            editingInvoiceId = null;
            setCreateFormMode(null);

            els.createForm.hidden = true;

            if (els.createFormElement) {
                els.createFormElement.reset();
            }

            if (els.createError) {
                els.createError.hidden = true;
                els.createError.textContent = "";
            }
        }

        async function submitCreateForm(event) {
            event.preventDefault();

            if (!els.createFormElement) return;

            const form = new FormData(
                els.createFormElement
            );

            const contractDetails =
                buildContractDetails(form);

            const payload = {
                company_name: String(
                    form.get("company_name") || ""
                ).trim(),

                invoice_number: String(
                    form.get("invoice_number") || ""
                ).trim(),

                invoice_date: String(
                    form.get("invoice_date") || ""
                ).trim(),

                completion_date: String(
                    form.get("completion_date") || ""
                ).trim(),

                software: String(
                    form.get("software") || ""
                ).trim(),

                currency: String(
                    form.get("currency") || "EUR"
                ).trim(),

                amount_eur: String(
                    form.get("amount") || ""
                ).trim(),

                contract_details:
                    JSON.stringify(contractDetails),
            };

            if (
                !payload.company_name ||
                !payload.invoice_number ||
                !payload.invoice_date ||
                !payload.amount_eur
            ) {
                if (els.createError) {
                    els.createError.textContent =
                        "Заполните компанию, номер счёта, дату и сумму.";
                    els.createError.hidden = false;
                }
                return;
            }

            const amount = Number(
                String(payload.amount_eur).replace(",", ".")
            );

            if (!Number.isFinite(amount) || amount <= 0) {
                if (els.createError) {
                    els.createError.textContent =
                        "Сумма счёта должна быть больше нуля.";
                    els.createError.hidden = false;
                }
                return;
            }

            const submitButton =
                els.createFormElement.querySelector(
                    'button[type="submit"]'
                );

            if (submitButton) {
                submitButton.disabled = true;
            }

            els.createFormElement.classList.add(
                "is-loading"
            );

            if (els.createError) {
                els.createError.hidden = true;
                els.createError.textContent = "";
            }

            const csrfInput =
                document.querySelector(
                    'input[name="csrf_token"]'
                );

            const csrfToken =
                csrfInput ? csrfInput.value : "";

            const url = editingInvoiceId
                ? `/update_generated_invoice/${encodeURIComponent(
                      editingInvoiceId
                  )}`
                : "/save_generated_invoice";

            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",

                        ...(csrfToken
                            ? {
                                  "X-CSRF-Token":
                                      csrfToken,
                              }
                            : {}),
                    },

                    body: JSON.stringify(payload),
                });

                const data =
                    await response
                        .json()
                        .catch(() => ({}));

                if (
                    !response.ok ||
                    data.status !== "ok"
                ) {
                    throw new Error(
                        data.message ||
                        data.error ||
                        "Не удалось сохранить счёт."
                    );
                }

                window.location.reload();
            } catch (error) {
                if (els.createError) {
                    els.createError.textContent =
                        error.message ||
                        "Не удалось сохранить счёт.";

                    els.createError.hidden = false;
                }
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                }

                els.createFormElement.classList.remove(
                    "is-loading"
                );
            }
        }

        function bindInvoiceItemEditor() {
            const addButton =
                document.getElementById("invoiceAddItem");

            if (addButton) {
                addButton.addEventListener("click", () => {
                    const row = addInvoiceItemRow({
                        description: "",
                        quantity: 1,
                        rate: 0,
                    });

                    if (row) {
                        const input = row.querySelector(
                            ".ff-invoice-item-description"
                        );

                        if (input) {
                            input.focus();
                        }
                    }
                });
            }

            document.addEventListener("input", (event) => {
                const row = event.target.closest(
                    "#invoiceItems [data-item-row]"
                );

                if (!row) return;

                if (
                    event.target.matches(
                        ".ff-invoice-item-qty, .ff-invoice-item-rate"
                    )
                ) {
                    updateInvoiceItemRow(row);
                }
            });

            document.addEventListener("click", (event) => {
                const removeButton =
                    event.target.closest(
                        "[data-remove-item]"
                    );

                if (!removeButton) return;

                const row = removeButton.closest(
                    "#invoiceItems [data-item-row]"
                );

                if (!row) return;

                const rows = document.querySelectorAll(
                    "#invoiceItems [data-item-row]"
                );

                if (rows.length <= 1) {
                    const description =
                        row.querySelector(
                            ".ff-invoice-item-description"
                        );

                    const qty =
                        row.querySelector(
                            ".ff-invoice-item-qty"
                        );

                    const rate =
                        row.querySelector(
                            ".ff-invoice-item-rate"
                        );

                    if (description) {
                        description.value = "";
                    }

                    if (qty) {
                        qty.value = "1";
                    }

                    if (rate) {
                        rate.value = "0";
                    }

                    updateInvoiceItemRow(row);
                    return;
                }

                row.remove();
            });
        }

        async function updateInvoicePayment(invoice) {
            if (!invoice || invoice.status === "CANCELLED") return;

            const currentPaid = Number(invoice.paid_amount || 0);
            const amount = Number(invoice.amount || 0);
            const currentDue = Math.max(amount - currentPaid, 0);
            const currency = String(
                invoice.currency || "EUR"
            ).toUpperCase();

            const value = prompt(
                `Оплачено по счёту #${invoice.invoice_number}\n` +
                `Всего: ${money(amount, currency)}\n` +
                `Оплачено сейчас: ${money(currentPaid, currency)}\n` +
                `Остаток: ${money(currentDue, currency)}\n\n` +
                `Введите общую сумму оплаты:`,
                currentPaid.toFixed(2)
            );

            if (value === null) return;

            const paid = Number(
                String(value).replace(",", ".")
            );

            if (!Number.isFinite(paid) || paid < 0) {
                alert(
                    "Введите корректную неотрицательную сумму."
                );
                return;
            }

            if (paid > amount) {
                alert(
                    `Сумма оплаты не может превышать сумму счёта (${money(
                        amount,
                        currency
                    )}).`
                );
                return;
            }

            const csrfInput = document.querySelector(
                'input[name="csrf_token"]'
            );

            const csrfToken = csrfInput ? csrfInput.value : "";

            try {
                const response = await fetch(
                    `/update_invoice_payment/${encodeURIComponent(
                        invoice.id
                    )}`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            ...(csrfToken
                                ? {
                                      "X-CSRF-Token":
                                          csrfToken,
                                  }
                                : {}),
                        },
                        body: JSON.stringify({
                            paid_amount_eur: paid,
                        }),
                    }
                );

                const data = await response
                    .json()
                    .catch(() => ({}));

                if (!response.ok || data.status !== "ok") {
                    throw new Error(
                        data.message ||
                        "Не удалось обновить оплату."
                    );
                }

                window.location.reload();
            } catch (error) {
                alert(
                    error.message ||
                    "Не удалось обновить оплату."
                );
            }
        }

        async function cancelInvoice(invoice) {
            if (!invoice || invoice.status === "CANCELLED") return;

            const reason = prompt(
                "Причина отмены счёта:"
            );

            if (reason === null) return;

            const cleanReason = reason.trim();

            if (!cleanReason) {
                alert("Причина отмены обязательна.");
                return;
            }

            if (
                !confirm(
                    "Отменить этот счёт?\n\n" +
                    "Он останется в реестре со статусом CANCELLED."
                )
            ) {
                return;
            }

            const csrfInput = document.querySelector(
                'input[name="csrf_token"]'
            );

            const csrfToken = csrfInput ? csrfInput.value : "";

            try {
                const response = await fetch(
                    `/cancel_invoice/${encodeURIComponent(
                        invoice.id
                    )}`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            ...(csrfToken
                                ? {
                                      "X-CSRF-Token":
                                          csrfToken,
                                  }
                                : {}),
                        },
                        body: JSON.stringify({
                            reason: cleanReason,
                        }),
                    }
                );

                const data = await response
                    .json()
                    .catch(() => ({}));

                if (!response.ok || data.status !== "ok") {
                    throw new Error(
                        data.message ||
                        "Не удалось отменить счёт."
                    );
                }

                window.location.reload();
            } catch (error) {
                alert(
                    error.message ||
                    "Не удалось отменить счёт."
                );
            }
        }

        bindInvoiceItemEditor();

        els.create.addEventListener("click", () => {
            showCreateForm();
        });

        if (els.createClose) {
            els.createClose.addEventListener("click", hideCreateForm);
        }

        if (els.createCancel) {
            els.createCancel.addEventListener("click", hideCreateForm);
        }

        if (els.createFormElement) {
            els.createFormElement.addEventListener(
                "submit",
                submitCreateForm
            );
        }

        els.generator.addEventListener("click", () => {
            window.location.href = "/generator";
        });

        document.addEventListener("click", (event) => {
            const detailButton = event.target.closest("[data-detail-action]");

            if (detailButton) {
                const invoiceId = detailButton.dataset.invoiceId;
                const invoice = invoices.find(
                    (item) => String(item.id) === String(invoiceId)
                );

                if (!invoice) return;

                const action = detailButton.dataset.detailAction;

                if (action === "payment") {
                    updateInvoicePayment(invoice);
                    return;
                }

                if (action === "edit") {
                    showCreateForm(invoice);
                    return;
                }

                if (action === "cancel") {
                    cancelInvoice(invoice);
                    return;
                }

                return;
            }

            const button = event.target.closest(
                "[data-invoice-action='open']"
            );
            const row = event.target.closest(
                "tr[data-invoice-id]"
            );
            const card = event.target.closest(
                ".ff-invoice-card[data-invoice-id]"
            );

            const target = button || row || card;

            if (!target) return;

            const invoiceId = target.dataset.invoiceId;
            const invoice = invoices.find(
                (item) => String(item.id) === String(invoiceId)
            );

            if (!invoice) return;

            renderInvoiceDetail(invoice);
        });
    }

    populateCompanies();
    bind();
    render();
})();
