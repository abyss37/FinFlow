(function () {
    const translations = {
        ru: {
            "Dashboard": "Панель управления",
            "Analytics": "Аналитика",
            "Audit Log": "Журнал аудита",

            "Financial Analytics": "Финансовая аналитика",
            "Detailed financial analysis": "Детальный финансовый анализ",
            "Explore budget utilization, invoice exposure and spending trends.": "Анализируйте использование бюджета, выставленные счета и динамику расходов.",

            "Filters": "Фильтры",
            "Filter the analytics view": "Фильтрация аналитики",
            "Date from": "Дата от",
            "Date to": "Дата до",
            "Company": "Компания",
            "All companies": "Все компании",
            "Product": "Продукт",
            "All products": "Все продукты",
            "Apply": "Применить",
            "Reset": "Сбросить",

            "Budget": "Бюджет",
            "Invoiced": "Выставлено счетов",
            "Remaining": "Остаток",
            "Budget utilization": "Использование бюджета",
            "Budget health": "Состояние бюджета",
            "Budget overview": "Обзор бюджета",
            "Spend by company": "Сумма счетов по компаниям",
            "Spend by product": "Сумма счетов по продуктам",
            "Monthly spending": "Сумма счетов по месяцам",
            "Invoice activity by date": "Динамика выставленных счетов",
            "Invoiced amount against total budget": "Выставлено счетов относительно общего бюджета",
            "Timeline": "Динамика",

            "Complete history of financial and system changes": "Полная история финансовых и системных изменений",
            "Narrow the audit history by event, company, product or date.": "Фильтруйте историю по событию, компании, продукту или дате.",
            "Search": "Поиск",
            "Invoice, description, ID...": "Счёт, описание, ID...",
            "Action": "Действие",
            "All actions": "Все действия",
            "Company created": "Компания создана",
            "Invoice created": "Счёт создан",
            "Invoice updated": "Счёт изменён",
            "Invoice cancelled": "Счёт аннулирован",
            "Budget updated": "Бюджет изменён",
            "Contract date updated": "Дата договора изменена",

            "From": "От",
            "To": "До",
            "Date & Time": "Дата и время",
            "Entity": "Объект",
            "Description": "Описание",
            "Details": "Детали",
            "Changes": "Изменения",
            "No additional details.": "Дополнительных деталей нет.",

            "View": "Подробнее",
            "Hide": "Скрыть",
            "Page": "Страница",
            "of": "из",
            "event": "событие",
            "events": "событий",
            "total": "всего",

            "Amount": "Сумма",
            "Paid amount": "Оплачено",
            "Payment status": "Статус оплаты",
            "Invoice number": "Номер счёта",
            "Invoice ID": "ID счёта",
            "Invoice date": "Дата счёта",
            "Completion date": "Дата окончания",
            "Contract date": "Дата договора",
            "Contract budget": "Бюджет договора",
            "Cancellation reason": "Причина аннулирования",

            "company_budget": "Бюджет компании",
            "invoice": "Счёт",
            "Status": "Статус"
        },

        en: {}
    };

    Object.keys(translations.ru).forEach(function (key) {
        translations.en[key] = key;
    });

    function getLang() {
        return localStorage.getItem("finflow-language") || "ru";
    }

    function translate(value) {
        const lang = getLang();
        if (lang === "en") return value;
        return translations.ru[value] || value;
    }

    function getLanguage() {
        return getLang();
    }

    function setLang(lang) {
        localStorage.setItem("finflow-language", lang);
        applyLanguage();

        window.dispatchEvent(
            new CustomEvent("finflow-language-changed", {
                detail: { lang: lang }
            })
        );
    }

    function applyLanguage() {
        const lang = getLang();
        document.documentElement.lang = lang;

        document.querySelectorAll("[data-i18n]").forEach(function (el) {
            const key = el.dataset.i18n;
            el.textContent = lang === "ru"
                ? (translations.ru[key] || key)
                : key;
        });

        document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
            const key = el.dataset.i18nPlaceholder;
            el.placeholder = lang === "ru"
                ? (translations.ru[key] || key)
                : key;
        });

        document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
            const key = el.dataset.i18nTitle;
            el.title = lang === "ru"
                ? (translations.ru[key] || key)
                : key;
        });

        document.querySelectorAll("[data-i18n-option]").forEach(function (el) {
            const key = el.dataset.i18nOption;
            el.textContent = lang === "ru"
                ? (translations.ru[key] || key)
                : key;
        });

        updateSwitcher();
    }

    function updateSwitcher() {
        const ru = document.getElementById("finflow-lang-ru");
        const en = document.getElementById("finflow-lang-en");

        if (!ru || !en) return;

        const lang = getLang();

        ru.className = "px-2.5 py-1.5 rounded-lg text-[11px] font-black transition " +
            (lang === "ru" ? "bg-violet-500 text-white" : "text-slate-400");

        en.className = "px-2.5 py-1.5 rounded-lg text-[11px] font-black transition " +
            (lang === "en" ? "bg-violet-500 text-white" : "text-slate-400");
    }

    function addSwitcher() {
        if (window.location.pathname !== "/") {
            return;
        }

        if (document.getElementById("finflow-language-switcher")) return;

        const wrapper = document.createElement("div");
        wrapper.id = "finflow-language-switcher";
        wrapper.className =
            "inline-flex shrink-0 items-center gap-1 p-1 rounded-xl bg-slate-900/95 border border-slate-700 shadow-xl backdrop-blur whitespace-nowrap";

        wrapper.innerHTML = `
            <button id="finflow-lang-ru" type="button">RU</button>
            <button id="finflow-lang-en" type="button">EN</button>
        `;

        const slot = document.getElementById("finflow-language-slot");

        if (slot) {
            slot.appendChild(wrapper);
        } else {
            document.body.appendChild(wrapper);
        }

        document.getElementById("finflow-lang-ru").onclick = function () {
            setLang("ru");
        };

        document.getElementById("finflow-lang-en").onclick = function () {
            setLang("en");
        };

        updateSwitcher();
    }

    window.finflowI18n = {
        getLang,
        getLanguage,
        translate,
        setLang,
        applyLanguage,
        addSwitcher
    };

    document.addEventListener("DOMContentLoaded", function () {
        addSwitcher();
        applyLanguage();
    });
})();
