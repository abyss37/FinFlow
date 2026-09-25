(function () {
    'use strict';

    /*
     * FinFlow — Overview
     *
     * Lightweight presentation layer.
     * Backend/API contracts remain unchanged.
     */

    const DATA_ID = 'finflow-dashboard-data';

    // =========================================================
    // HELPERS
    // =========================================================

    function byId(id) {
        return document.getElementById(id);
    }


    function canonicalCurrency(value) {
        return window.FinFlowMoney
            ? window.FinFlowMoney.normalizeCurrency(value)
            : String(value || 'EUR').trim().toUpperCase();
    }


    function money(value, currency) {
        return window.FinFlowMoney
            ? window.FinFlowMoney.formatMoney(value, canonicalCurrency(currency))
            : `${canonicalCurrency(currency)} ${Number(value || 0).toLocaleString('uk-UA', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })}`;
    }


    function percent(value) {
        return `${Number(value || 0).toLocaleString('uk-UA', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        })}%`;
    }


    function getData() {
        const element = byId(DATA_ID);

        if (!element) {
            return {
                metrics: {},
                invoices: []
            };
        }

        try {
            return JSON.parse(element.textContent || '{}');
        } catch (error) {
            console.error(
                '[FinFlow] Overview data parse error',
                error
            );

            return {
                metrics: {},
                invoices: []
            };
        }
    }


    // =========================================================
    // CURRENCY METRICS
    // =========================================================

    function currencyMetrics(metrics) {
        const grouped = metrics && metrics.by_currency;

        if (
            grouped &&
            typeof grouped === 'object' &&
            Object.keys(grouped).length
        ) {
            return Object.values(grouped);
        }

        return [{
            currency: 'EUR',
            total_budget: Number(metrics.total_budget || 0),
            total_spent: Number(metrics.total_spent || 0),
            remaining: Number(metrics.remaining || 0),
            utilization: Number(metrics.utilization || 0)
        }];
    }


    function renderMoneyByCurrency(items, field) {
        if (!items.length) {
            return '—';
        }

        return items
            .filter(item => Number(item[field] || 0) !== 0)
            .map(item => `<div>${money(
                item[field],
                item.currency
            )}</div>`)
            .join('') || '—';
    }


    function renderRemaining(items) {
        if (!items.length) {
            return '—';
        }

        return items
            .filter(item => Number(item.total_budget || 0) > 0)
            .map(item => `<div>${money(
                item.remaining,
                item.currency
            )}</div>`)
            .join('') || '—';
    }


    function renderUtilization(items) {
        if (!items.length) {
            return '—';
        }

        if (items.length === 1) {
            return percent(items[0].utilization);
        }

        const active = items.filter(
            item => Number(item.total_budget || 0) > 0
        );

        if (!active.length) {
            return '—';
        }

        return active
            .map(item => {
                return `${percent(item.utilization)} · ${canonicalCurrency(item.currency)}`;
            })
            .join(' · ');
    }


    // =========================================================
    // INVOICE SUMMARY
    // =========================================================

    function activeInvoices(invoices) {
        return (Array.isArray(invoices) ? invoices : [])
            .filter(invoice => {
                return String(invoice.status || '')
                    .toUpperCase() !== 'CANCELLED';
            });
    }


    function paidInvoices(invoices) {
        return invoices.filter(invoice => {
            const status = String(
                invoice.payment_status || ''
            ).toUpperCase();

            return (
                status === 'PAID' ||
                Number(invoice.paid_amount_eur || 0) > 0
            );
        });
    }


    // =========================================================
    // RENDER
    // =========================================================

    function renderOverview(data) {
        const metrics = data.metrics || {};
        const invoices = Array.isArray(data.invoices)
            ? data.invoices
            : [];

        const grouped = currencyMetrics(metrics);
        const active = activeInvoices(invoices);
        const paid = paidInvoices(active);


        // Companies
        const companies = byId('kpi-companies');

        if (companies && !companies.textContent.trim()) {
            companies.textContent = '0';
        }


        // Products
        const products = byId('kpi-products');
        const productCard = products?.closest('.ff-overview-card');
        const productMeta = productCard?.querySelector('.ff-overview-card-meta');

        if (products) {
            const activeProducts = Array.isArray(data.products)
                ? data.products
                : [];

            products.textContent = String(activeProducts.length);

            if (productMeta) {
                productMeta.textContent = activeProducts.length
                    ? activeProducts.map(product => product.name).filter(Boolean).join(' · ')
                    : 'Нет активных продуктов';
            }
        }


        // Total budget
        const totalBudget = byId('kpi-total-budget');

        if (totalBudget) {
            totalBudget.innerHTML =
                renderMoneyByCurrency(
                    grouped,
                    'total_budget'
                );
        }


        // Active invoices
        const invoiceCount = byId('kpi-invoices-count');

        if (invoiceCount) {
            invoiceCount.textContent = String(active.length);
        }


        const invoiceMeta = byId('kpi-invoices-meta');

        if (invoiceMeta) {
            invoiceMeta.textContent =
                active.length === 1
                    ? 'активный счёт'
                    : 'активных счетов';
        }


        // Active invoice summary
        const activeInvoicesElement =
            byId('overview-active-invoices');

        if (activeInvoicesElement) {
            activeInvoicesElement.textContent =
                String(active.length);
        }


        // Paid invoice summary
        const paidInvoicesElement =
            byId('overview-paid-invoices');

        if (paidInvoicesElement) {
            paidInvoicesElement.textContent =
                String(paid.length);
        }


        // Remaining budget
        const remaining = byId('kpi-remaining');

        if (remaining) {
            remaining.innerHTML =
                renderRemaining(grouped);
        }


        // Utilization
        const utilization = byId('kpi-utilization');

        if (utilization) {
            utilization.textContent =
                renderUtilization(grouped);
        }
    }


    // =========================================================
    // INIT
    // =========================================================

    function init() {
        const data = getData();

        renderOverview(data);

        console.info(
            '[FinFlow] Overview initialized'
        );
    }


    document.addEventListener(
        'DOMContentLoaded',
        init
    );

})();
