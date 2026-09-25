(function (window) {
    'use strict';

    const DEFAULT_CURRENCY = 'EUR';

    function normalizeCurrency(currency) {
        const code = String(currency || DEFAULT_CURRENCY).trim().toUpperCase();

        if (code === 'EUR' || code === 'USD' || code === 'UAH') {
            return code;
        }

        return DEFAULT_CURRENCY;
    }

    function formatMoney(value, currency) {
        const code = normalizeCurrency(currency);
        const amount = Number(value || 0);

        if (!Number.isFinite(amount)) {
            return `${code} 0,00`;
        }

        const formatted = new Intl.NumberFormat('uk-UA', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);

        return `${code} ${formatted}`;
    }

    window.FinFlowMoney = {
        formatMoney,
        normalizeCurrency
    };

})(window);
