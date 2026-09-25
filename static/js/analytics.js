(function () {
    'use strict';

    const DATA_ID = 'finflowAnalyticsInvoiceData';

    function getInvoices() {
        const rawData = document.getElementById(DATA_ID);

        if (!rawData) {
            return [];
        }

        try {
            const parsed = JSON.parse(rawData.textContent || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error('[FinFlow] Analytics data parse error:', error);
            return [];
        }
    }

    function normalizeCurrency(value) {
        return window.FinFlowMoney
            ? window.FinFlowMoney.normalizeCurrency(value)
            : String(value || 'EUR').trim().toUpperCase();
    }

    function money(value, currency) {
        const code = normalizeCurrency(currency);

        return window.FinFlowMoney
            ? window.FinFlowMoney.formatMoney(value, code)
            : `${code} ${Number(value || 0).toLocaleString('uk-UA', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })}`;
    }

    function number(value) {
        const result = Number(value);
        return Number.isFinite(result) ? result : 0;
    }

    function activeInvoices(invoices) {
        return invoices.filter(function (invoice) {
            return String(invoice.status || '').toUpperCase() !== 'CANCELLED';
        });
    }

    function getFilters() {
        const company = document.getElementById('filterCompany');
        const product = document.getElementById('filterProduct');

        return {
            company: company ? company.value : '',
            product: product ? product.value : ''
        };
    }

    function invoiceCompanyId(invoice) {
        return String(
            invoice.company_id ??
            invoice.companyId ??
            invoice.company?.id ??
            ''
        );
    }

    function invoiceCompanyName(invoice) {
        return (
            invoice.company?.name ||
            invoice.company_name ||
            'Неизвестно'
        );
    }

    function invoiceProduct(invoice) {
        return String(
            invoice.software ||
            invoice.product ||
            'ALPHA'
        ).toUpperCase();
    }

    function invoiceCurrency(invoice) {
        return normalizeCurrency(
            invoice.currency ||
            invoice.currency_code ||
            'EUR'
        );
    }

    function invoiceAmount(invoice) {
        return number(
            invoice.amount_eur ??
            invoice.amount ??
            0
        );
    }

    function invoiceDate(invoice) {
        return String(
            invoice.invoice_date ||
            invoice.date ||
            ''
        ).slice(0, 10);
    }

    function filteredInvoices(invoices) {
        const filters = getFilters();

        return activeInvoices(invoices).filter(function (invoice) {
            if (
                filters.company &&
                invoiceCompanyId(invoice) !== String(filters.company)
            ) {
                return false;
            }

            if (
                filters.product &&
                invoiceProduct(invoice) !== String(filters.product).toUpperCase()
            ) {
                return false;
            }

            return true;
        });
    }

    function groupByCurrency(items) {
        const result = {};

        items.forEach(function (item) {
            const currency = item.currency;

            if (!result[currency]) {
                result[currency] = 0;
            }

            result[currency] += number(item.amount);
        });

        return result;
    }

    function setText(id, value) {
        const element = document.getElementById(id);

        if (element) {
            element.textContent = value;
        }
    }

    function renderKpis(selected) {
        const currencyTotals = groupByCurrency(
            selected.map(function (invoice) {
                return {
                    currency: invoiceCurrency(invoice),
                    amount: invoiceAmount(invoice)
                };
            })
        );

        const currencies = Object.keys(currencyTotals);

        if (!currencies.length) {
            setText('analyticsTotal', money(0, 'EUR'));
        } else if (currencies.length === 1) {
            const currency = currencies[0];

            setText(
                'analyticsTotal',
                money(currencyTotals[currency], currency)
            );
        } else {
            setText(
                'analyticsTotal',
                currencies.map(function (currency) {
                    return money(currencyTotals[currency], currency);
                }).join(' · ')
            );
        }

        const companies = new Set(
            selected.map(invoiceCompanyName)
        );

        const products = new Set(
            selected.map(invoiceProduct)
        );

        setText('analyticsCompanyCount', companies.size);
        setText('analyticsProductCount', products.size);
        setText('analyticsInvoiceCount', selected.length);
    }

    function emptyState(icon, text) {
        return `
            <div class="ff-analytics-empty">
                <i class="bi ${icon}"></i>
                <span>${text}</span>
            </div>
        `;
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(
            /[&<>'"]/g,
            function (char) {
                return {
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    "'": '&#39;',
                    '"': '&quot;'
                }[char];
            }
        );
    }

    function renderCompanyBars(selected) {
        const target = document.getElementById('companyBars');

        if (!target) {
            return;
        }

        const totals = {};

        selected.forEach(function (invoice) {
            const company = invoiceCompanyName(invoice);
            const currency = invoiceCurrency(invoice);
            const key = `${company}|||${currency}`;

            if (!totals[key]) {
                totals[key] = {
                    company: company,
                    currency: currency,
                    amount: 0
                };
            }

            totals[key].amount += invoiceAmount(invoice);
        });

        const rows = Object.values(totals)
            .sort(function (a, b) {
                return b.amount - a.amount;
            });

        if (!rows.length) {
            target.innerHTML = emptyState(
                'bi-bar-chart',
                'Нет данных о расходах'
            );
            return;
        }

        const maxByCurrency = {};

        rows.forEach(function (row) {
            maxByCurrency[row.currency] = Math.max(
                maxByCurrency[row.currency] || 0,
                row.amount
            );
        });

        target.innerHTML = rows.map(function (row) {
            const max = maxByCurrency[row.currency] || 0;
            const width = max
                ? Math.min(100, (row.amount / max) * 100)
                : 0;

            return `
                <div class="ff-analytics-bar-row">
                    <div class="ff-analytics-bar-header">
                        <span class="ff-analytics-bar-name">
                            ${escapeHtml(row.company)}
                        </span>

                        <span class="ff-analytics-bar-value">
                            ${money(row.amount, row.currency)}
                        </span>
                    </div>

                    <div class="ff-analytics-bar-track">
                        <div
                            class="ff-analytics-bar-fill ff-analytics-bar-fill-company"
                            style="width:${width.toFixed(2)}%">
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderProductBars(selected) {
        const target = document.getElementById('productBars');

        if (!target) {
            return;
        }

        const totals = {};

        selected.forEach(function (invoice) {
            const product = invoiceProduct(invoice);
            const currency = invoiceCurrency(invoice);
            const key = `${product}|||${currency}`;

            if (!totals[key]) {
                totals[key] = {
                    product: product,
                    currency: currency,
                    amount: 0
                };
            }

            totals[key].amount += invoiceAmount(invoice);
        });

        const rows = Object.values(totals)
            .sort(function (a, b) {
                return b.amount - a.amount;
            });

        if (!rows.length) {
            target.innerHTML = emptyState(
                'bi-pie-chart',
                'Нет данных о продуктах'
            );
            return;
        }

        const maxByCurrency = {};

        rows.forEach(function (row) {
            maxByCurrency[row.currency] = Math.max(
                maxByCurrency[row.currency] || 0,
                row.amount
            );
        });

        target.innerHTML = rows.map(function (row) {
            const max = maxByCurrency[row.currency] || 0;
            const width = max
                ? Math.min(100, (row.amount / max) * 100)
                : 0;

            const fillClass =
                row.product === 'BETA'
                    ? 'ff-analytics-bar-fill-product'
                    : 'ff-analytics-bar-fill-company';

            return `
                <div class="ff-analytics-bar-row">
                    <div class="ff-analytics-bar-header">
                        <span class="ff-analytics-bar-name">
                            ${escapeHtml(row.product)}
                        </span>

                        <span class="ff-analytics-bar-value">
                            ${money(row.amount, row.currency)}
                        </span>
                    </div>

                    <div class="ff-analytics-bar-track">
                        <div
                            class="ff-analytics-bar-fill ${fillClass}"
                            style="width:${width.toFixed(2)}%">
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function monthLabel(month) {
        const date = new Date(`${month}-01T00:00:00`);

        if (Number.isNaN(date.getTime())) {
            return month;
        }

        return date.toLocaleDateString('uk-UA', {
            month: 'short',
            year: 'numeric'
        }).replace('.', '');
    }

    function renderMonthly(selected) {
        const target = document.getElementById('monthlyChart');

        if (!target) {
            return;
        }

        const totals = {};

        selected.forEach(function (invoice) {
            const date = invoiceDate(invoice);

            if (!date || date.length < 7) {
                return;
            }

            const month = date.slice(0, 7);
            const currency = invoiceCurrency(invoice);
            const key = `${month}|||${currency}`;

            if (!totals[key]) {
                totals[key] = {
                    month: month,
                    currency: currency,
                    amount: 0
                };
            }

            totals[key].amount += invoiceAmount(invoice);
        });

        const rows = Object.values(totals)
            .sort(function (a, b) {
                if (a.month === b.month) {
                    return a.currency.localeCompare(b.currency);
                }

                return a.month.localeCompare(b.month);
            });

        if (!rows.length) {
            target.innerHTML = emptyState(
                'bi-graph-up',
                'Нет данных по месяцам'
            );
            return;
        }

        const currencies = [
            ...new Set(rows.map(function (row) {
                return row.currency;
            }))
        ];

        const maxByCurrency = {};

        currencies.forEach(function (currency) {
            maxByCurrency[currency] = Math.max(
                ...rows
                    .filter(function (row) {
                        return row.currency === currency;
                    })
                    .map(function (row) {
                        return row.amount;
                    }),
                0
            );
        });

        const months = [
            ...new Set(rows.map(function (row) {
                return row.month;
            }))
        ];

        target.classList.toggle(
            'ff-analytics-monthly-multi',
            currencies.length > 1
        );

        target.innerHTML = months.map(function (month) {
            const monthRows = rows.filter(function (row) {
                return row.month === month;
            });

            return `
                <div class="ff-analytics-month-column">

                    <div class="ff-analytics-month-bars">
                        ${monthRows.map(function (row) {
                            const max = maxByCurrency[row.currency] || 0;
                            const height = max
                                ? Math.max(
                                    4,
                                    (row.amount / max) * 100
                                )
                                : 0;

                            return `
                                <div class="ff-analytics-month-series">
                                    <div
                                        class="ff-analytics-month-value">
                                        ${money(row.amount, row.currency)}
                                    </div>

                                    <div class="ff-analytics-month-track">
                                        <div
                                            class="ff-analytics-month-fill"
                                            style="height:${height.toFixed(2)}%">
                                        </div>
                                    </div>

                                    <div class="ff-analytics-month-currency">
                                        ${row.currency}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>

                    <div class="ff-analytics-month-label">
                        ${escapeHtml(monthLabel(month))}
                    </div>

                </div>
            `;
        }).join('');

        const legend = currencies.map(function (currency) {
            return `
                <span class="ff-analytics-chart-legend-item">
                    <span class="ff-analytics-chart-legend-dot"></span>
                    ${currency}
                </span>
            `;
        }).join('');

        target.insertAdjacentHTML(
            'beforebegin',
            `
                <div class="ff-analytics-chart-legend">
                    ${legend}
                </div>
            `
        );

        const previousLegend =
            target.previousElementSibling;

        if (
            previousLegend &&
            previousLegend.classList.contains(
                'ff-analytics-chart-legend'
            )
        ) {
            previousLegend.dataset.analyticsLegend = '1';
        }
    }

    function cleanupMonthlyLegend() {
        document
            .querySelectorAll(
                '[data-analytics-legend="1"]'
            )
            .forEach(function (element) {
                element.remove();
            });
    }

    function renderAnalytics(invoices) {
        const selected = filteredInvoices(invoices);

        cleanupMonthlyLegend();

        renderKpis(selected);
        renderCompanyBars(selected);
        renderProductBars(selected);
        renderMonthly(selected);
    }

    function bindFilters(invoices) {
        const apply = document.getElementById('applyFilters');
        const reset = document.getElementById('resetFilters');

        if (apply) {
            apply.addEventListener('click', function () {
                renderAnalytics(invoices);
            });
        }

        if (reset) {
            reset.addEventListener('click', function () {
                const company =
                    document.getElementById('filterCompany');

                const product =
                    document.getElementById('filterProduct');

                if (company) {
                    company.value = '';
                }

                if (product) {
                    product.value = '';
                }

                renderAnalytics(invoices);
            });
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        const invoices = getInvoices();

        bindFilters(invoices);
        renderAnalytics(invoices);

        console.log(
            '[FinFlow] Analytics initialized:',
            invoices.length,
            'invoices'
        );
    });

})();
