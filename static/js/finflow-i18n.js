(function () {
    "use strict";

    /*
     * FinFlow global i18n
     *
     * Single source of truth for:
     * Dashboard
     * Analytics
     * Invoice Generator
     * Users
     * Audit Log
     *
     * Languages:
     *   uk
     *   en
     */

    const translations = {
        uk: {

            /* ==================== COMMON ==================== */

            "FinFlow": "FinFlow",
            "Control": "Контроль",
            "FinFlow — Financial Control": "FinFlow — Фінансовий контроль",
            "Financial control platform": "Платформа фінансового контролю",
            "Financial overview": "Фінансовий огляд",

            "Dashboard": "Панель керування",
            "Analytics": "Аналітика",
            "Audit Log": "Журнал аудиту",

            "Financial control for contracts, invoices & budgets":
                "Фінансовий контроль договорів, рахунків і бюджетів",

            "Know where your budget stands.":
                "Контролюйте стан бюджету.",

            "Track contract budgets, invoices and remaining spend in one place — with early warnings before a budget becomes a problem.":
                "Контролюйте бюджети договорів, рахунки та залишок коштів в одному місці — з ранніми попередженнями про ризики.",

            "New invoice": "Новий рахунок",
            "Add invoice": "Додати рахунок",
            "Create invoice": "Створити рахунок",
            "Create invoice PDF": "Створити рахунок PDF",

            "Save": "Зберегти",
            "Close": "Закрити",
            "Cancel": "Скасувати",
            "Edit": "Редагувати",
            "Apply": "Застосувати",
            "Reset": "Скинути",
            "View": "Докладніше",
            "View details": "Докладніше",
            "Hide": "Сховати",
            "Generate": "Створити",
            "Draft": "Чернетка",

            /* ==================== NOTIFICATIONS ==================== */

            "Notifications": "Сповіщення",
            "Notification center": "Центр сповіщень",
            "Recent system alerts": "Останні системні події",
            "Mark all as read": "Прочитати всі",
            "Mark as read": "Позначити як прочитане",
            "Information": "Інформація",
            "All clear": "Усе чисто",
            "No active notifications.": "Немає активних сповіщень.",
            "Critical": "Критично",
            "Warning": "Попередження",
            "Info": "Інформація",
            "Just now": "Щойно",
            "minute": "хвилина",
            "minutes": "хвилин",
            "hour": "година",
            "hours": "годин",
            "day": "день",
            "days": "днів",
            "Overdue invoice": "Прострочений рахунок",
            "Budget warning": "Попередження про бюджет",
            "Critical budget level": "Критичний рівень бюджету",
            "Budget exceeded": "Бюджет перевищено",
            "Contract expiring": "Завершення договору",
            "Recent system alerts": "Останні системні події",
            "Mark all as read": "Прочитати всі",
            "All clear": "Усе чисто",
            "No active notifications.": "Немає активних сповіщень.",
            "Mark as read": "Позначити як прочитане",
            "alerts": "попереджень",

            /* ==================== SUMMARY ==================== */

            "Total budget": "Загальний бюджет",
            "All active products": "Усі активні продукти",
            "Invoiced": "Виставлено рахунків",
            "Recorded spend": "Враховані витрати",
            "Remaining": "Залишок",
            "Available budget": "Доступний бюджет",
            "Utilization": "Використання",
            "Budget consumed": "Використано бюджету",

            "Attention needed": "Потрібна увага",
            "Issues that may affect contract or budget control.":
                "Проблеми, які можуть вплинути на контроль договорів або бюджету.",

            "Everything looks healthy": "Усе гаразд",

            "No budgets above 80% and no contracts ending within 30 days.":
                "Немає бюджетів понад 80% і договорів, що завершуються протягом найближчих 30 днів.",

            "No budgets above 85% and no contracts ending within 30 days.":
                "Немає бюджетів понад 85% і договорів, що завершуються протягом найближчих 30 днів.",

            /* ==================== ANALYTICS ==================== */

            "Financial Analytics": "Фінансова аналітика",
            "FINANCIAL ANALYTICS": "ФІНАНСОВА АНАЛІТИКА",
            "Financial control dashboard": "Панель фінансового контролю",

            "Detailed financial analysis":
                "Детальний фінансовий аналіз",

            "Explore budget utilization, invoice exposure and spending trends.":
                "Аналізуйте використання бюджету, виставлені рахунки та динаміку витрат.",

            "A compact view of budget utilization, invoice exposure and spending trends.":
                "Компактний огляд використання бюджету, виставлених рахунків і динаміки витрат.",

            "Live dashboard": "Дані в реальному часі",
            "Overall utilization": "Загальне використання",
            "Invoiced amount against total budget":
                "Виставлена сума відносно загального бюджету",
            "of total budget": "від загального бюджету",
            "Exposure": "Обсяг зобов'язань",

            "Spend by company": "Сума рахунків за компаніями",
            "Active invoiced amount by company.":
                "Сума активних рахунків за компаніями",
            "Companies": "Компанії",

            "Spend by product": "Сума рахунків за продуктами",
            "Active invoiced amount by product.":
                "Сума активних рахунків за продуктами",
            "ALPHA · BETA": "ALPHA · BETA",

            "Monthly spending": "Сума рахунків за місяцями",
            "Active invoiced amount grouped by invoice month.":
                "Сума активних рахунків у розрізі місяців",

            "Invoice activity by date":
                "Динаміка виставлених рахунків",

            "Timeline": "Динаміка",
            "No active invoice spending yet.":
                "Активних виставлених рахунків поки немає",

            "No dated invoices yet.": "Рахунків із датою поки немає.",

            /* ==================== BUDGET ==================== */

            "Budget": "Бюджет",
            "Budget utilization": "Використання бюджету",
            "Budget health": "Стан бюджету",
            "Budget overview": "Огляд бюджету",
            "Editing archive template": "Редагується шаблон з архіву",
            "Editing archive template:": "Редагується шаблон з архіву:",
            "Bank account selection": "Вибір банківських рахунків",
            "Show banks in invoice": "Відображати банки в інвойсі:",
            "Invoice archive": "Архів інвойсів",
            "Create blank": "Створити порожній",
            "New": "Новий",
            "Search archive...": "Пошук в архіві...",
            "Archive is empty": "Архів порожній",
            "Saving invoice": "Збереження інвойсу",
            "You are editing a previously saved invoice": "Ви редагуєте раніше збережений інвойс",
            "Choose an action: update the existing invoice in the archive or save the current version as a new invoice.": "Оберіть дію: оновити наявний інвойс в архіві або зберегти поточну версію як новий інвойс.",
            "Save (update this invoice)": "Зберегти (оновити цей інвойс)",
            "Save as new": "Зберегти як новий",
            "Invoice successfully updated!": "Інвойс успішно оновлено!",
            "New invoice successfully saved to registry!": "Новий інвойс успішно збережено до реєстру!",
            "Invoice save error": "Помилка збереження інвойсу:",
            "Could not connect to server": "Не вдалося підключитися до сервера",


            "Selected product budget and invoice overview":
                "Огляд бюджету та рахунків вибраного продукту",

            "Remaining budget by company":
                "Залишок бюджету за компаніями",

            "Click for detailed overview":
                "Натисніть для докладного огляду",

            "Click to view full budget overview":
                "Натисніть, щоб переглянути повний огляд бюджету",

            "Budget exceeded": "Бюджет перевищено",
            "Budget attention": "Бюджет потребує уваги",
            "Budget almost exhausted": "Бюджет майже вичерпано",

            "USED": "ВИКОРИСТАНО",
            "Used": "Використано",
            "% used": "% використано",

            "Active invoiced": "Активно виставлено",

            /* ==================== WORKSPACE ==================== */

            "Workspace": "Робоча область",
            "Companies & contracts": "Компанії та договори",

            "Set budgets, review spend and spot risk at a glance.":
                "Встановлюйте бюджети, контролюйте витрати та одразу помічайте ризики.",

            "Search companies...": "Пошук компаній...",
            "Click to view invoices":
                "Натисніть, щоб переглянути рахунки",

            "Contract budget (€)": "Бюджет договору (€)",
            "Contract end": "Завершення договору",

            "No companies yet. Create your first invoice to get started.":
                "Компаній поки немає. Створіть перший рахунок, щоб почати.",

            /* ==================== INVOICES ==================== */

            "Invoice registry": "Реєстр рахунків",
            "Recent invoices": "Останні рахунки",
            "Search invoices...": "Пошук рахунків...",

            "Invoice": "Рахунок",
            "Invoices": "Рахунки",
            "Date": "Дата",
            "Company": "Компанія",
            "Product": "Продукт",
            "Amount": "Сума",
            "Status": "Статус",

            "ISSUED": "ВИСТАВЛЕНО",
            "Issued": "Виставлено",

            "CANCELLED": "СКАСОВАНО",
            "Cancelled": "Скасовано",

            "PAID": "ОПЛАЧЕНО",
            "PARTIAL": "ЧАСТКОВО",
            "UNPAID": "НЕ ОПЛАЧЕНО",
            "OVERDUE": "ПРОСТРОЧЕНО",
            "HISTORY": "ІСТОРІЯ",
            "OVER BUDGET": "ПЕРЕВИЩЕННЯ БЮДЖЕТУ",
            "HIGH USAGE": "ВИСОКЕ ЗАВАНТАЖЕННЯ",
            "HEALTHY": "У НОРМІ",

            "Paid": "Оплачено",
            "Outstanding": "До сплати",
            "paid": "оплачено",
            "due": "до сплати",
            "day": "день",
            "days": "днів",

            "Paid amount for invoice": "Сума оплати за рахунком",
            "Total": "Усього",
            "Currently paid": "Наразі оплачено",
            "Remaining": "Залишок",
            "Enter total paid amount": "Введіть загальну суму оплати",
            "Please enter a valid non-negative amount.": "Введіть коректну невід'ємну суму.",
            "Paid amount cannot exceed invoice total": "Сума оплати не може перевищувати загальну суму рахунку",

            "Update payment": "Оновити оплату",
            "Cancel invoice": "Скасувати рахунок",
            "Users": "Користувачі",
            "Logout": "Вийти",
            "Administrator": "Адміністратор",
            "Manager": "Менеджер",
            "Viewer": "Переглядач",

            "No invoices yet.": "Рахунків поки немає.",
            "No invoices": "Рахунків немає",
            "Total:": "Разом:",
            "No data yet": "Даних поки немає",
            "No budget data": "Немає даних щодо бюджету",

            "Invoices · ": "Рахунки · ",

            /* ==================== INVOICE FORMS ==================== */

            "Quickly add an invoice directly to the registry":
                "Швидко додайте рахунок безпосередньо до реєстру",

            "Company name": "Назва компанії",
            "Software Product": "Програмний продукт",
            "Invoice number": "Номер рахунку",
            "Invoice date": "Дата рахунку",
            "Completion date": "Дата завершення",
            "Amount (€)": "Сума (€)",

            "Save to Registry": "Зберегти до реєстру",

            "Edit invoice": "Редагувати рахунок",
            "Cancel invoice": "Скасувати рахунок",
            "Update payment": "Оновити оплату",

            "Cancellation reason:": "Причина скасування:",
            "Cancellation reason is required.":
                "Необхідно вказати причину скасування.",

            "Cancel this invoice? It will remain in the registry as CANCELLED.":
                "Скасувати цей рахунок? Він залишиться в реєстрі зі статусом «СКАСОВАНО».",

            "Cancelled invoices cannot be edited":
                "Скасовані рахунки не можна редагувати",

            "Cancelled invoices cannot be edited.":
                "Скасовані рахунки не можна редагувати.",

            "Cancelled invoices remain in history but are excluded from active spend and remaining budget.":
                "Скасовані рахунки залишаються в історії, але не враховуються в активних витратах і залишку бюджету.",

            "Cancellation failed":
                "Не вдалося скасувати рахунок",

            "Payment update failed":
                "Не вдалося оновити оплату",

            "Save failed": "Не вдалося зберегти",
            "Save failed.": "Не вдалося зберегти.",
            "Could not save invoice.": "Не вдалося зберегти рахунок.",

            "PNG export is unavailable.": "Експорт PNG недоступний.",
            "Could not save PNG.": "Не вдалося зберегти PNG.",
            "Save PNG": "Зберегти PNG",

            /* ==================== GENERATOR ==================== */

            "Invoice Generator": "Генератор рахунків",

            "Client / Company Name":
                "Назва клієнта / компанії",

            "Payment Terms": "Умови оплати",
            "Notes": "Примітки",
            "Terms": "Умови",

            "Notes - any relevant information not already covered":
                "Примітки — додаткова інформація",

            "Terms - late fees, payment methods, delivery schedules":
                "Умови — штрафи, способи оплати, строки постачання",

            "Search in archive...": "Пошук в архіві...",
            "Пошук в архіві...": "Пошук в архіві...",

            "Редагується рахунок з архіву:":
                "Редагується рахунок з архіву:",

            /* ==================== USERS ==================== */

            "Users": "Користувачі",
            "Administrator": "Адміністратор",

            "Manage FinFlow users, roles and access.":
                "Керування користувачами FinFlow, ролями та доступом.",

            "Create user": "Створити користувача",

            "Add a new account with an initial role and password.":
                "Додайте новий обліковий запис із початковою роллю та паролем.",

            "Username": "Ім'я користувача",
            "Password": "Пароль",
            "Role": "Роль",
            "Minimum 8 characters": "Мінімум 8 символів",
            "username": "ім'я користувача",

            "User accounts": "Облікові записи",

            "Username is the stable identity used in the audit log.":
                "Ім'я користувача — постійний ідентифікатор, що використовується в журналі аудиту.",

            "User": "Користувач",
            "Created": "Створено",
            "Last login": "Останній вхід",
            "Actions": "Дії",

            "You": "Ви",
            "Active": "Активний",
            "Inactive": "Неактивний",
            "Never": "Ніколи",

            "Change password": "Змінити пароль",
            "Activate": "Активувати",
            "Deactivate": "Деактивувати",
            "New password": "Новий пароль",

            "Password must contain at least 8 characters.":
                "Пароль має містити щонайменше 8 символів.",

            "No users found.": "Користувачів не знайдено.",

            "Your role cannot be changed here.":
                "Вашу роль не можна змінити тут.",

            "You cannot deactivate your own account.":
                "Ви не можете деактивувати власний обліковий запис.",

            "Back to dashboard":
                "Повернутися до панелі керування",

            "Admin": "Адміністратор",
            "Manager": "Менеджер",
            "Viewer": "Переглядач",

            /* ==================== AUDIT ==================== */

            "Filters": "Фільтри",
            "Filter the analytics view": "Фільтрація аналітики",

            "Date from": "Дата від",
            "Date to": "Дата до",

            "All companies": "Усі компанії",
            "All products": "Усі продукти",

            "Complete history of financial and system changes":
                "Повна історія фінансових і системних змін",

            "Narrow the audit history by event, company, product or date.":
                "Фільтруйте історію за подією, компанією, продуктом або датою.",

            "Search": "Пошук",
            "Invoice, description, ID...":
                "Рахунок, опис, ID...",

            "Action": "Дія",
            "All actions": "Усі дії",

            "Company created": "Компанію створено",
            "Invoice created": "Рахунок створено",
            "Invoice updated": "Рахунок змінено",
            "Invoice cancelled": "Рахунок скасовано",
            "Budget updated": "Бюджет змінено",
            "Contract date updated": "Дату договору змінено",

            "From": "Від",
            "To": "До",
            "Date & Time": "Дата й час",
            "Entity": "Об'єкт",
            "Description": "Опис",
            "Details": "Деталі",
            "Changes": "Зміни",

            "No additional details.":
                "Додаткових деталей немає.",

            "Page": "Сторінка",
            "of": "із",
            "event": "подія",
            "events": "подій",
            "total": "усього",

            "Paid amount": "Оплачено",
            "Payment status": "Статус оплати",
            "Invoice ID": "ID рахунку",
            "Contract date": "Дата договору",
            "Contract budget": "Бюджет договору",
            "Cancellation reason": "Причина скасування",

            "company_budget": "Бюджет компанії",
            "invoice": "Рахунок",

            /* ==================== LANDING ==================== */

            "Sign in": "Увійти",
            "Sign in to FinFlow": "Увійти до FinFlow",

            "Financial Operations Platform":
                "Платформа фінансових операцій",

            "A modern self-hosted platform for managing budgets, invoices, payments, contracts, analytics, notifications and financial operations in one controlled environment.":
                "Сучасна self-hosted платформа для керування бюджетами, рахунками, платежами, договорами, аналітикою, сповіщеннями та фінансовими операціями в одному контрольованому середовищі.",

            "Financial control for contracts, invoices & budgets":
                "Фінансовий контроль договорів, рахунків і бюджетів",

            "Know where your budget stands.":
                "Завжди знайте стан свого бюджету.",

            "Track contract budgets, invoices and remaining spend in one place — with early warnings before a budget becomes a problem.":
                "Контролюйте бюджети договорів, рахунки та залишок коштів в одному місці — з ранніми попередженнями до того, як проблема стане критичною.",

            "Sign in to your FinFlow workspace":
                "Увійдіть до робочого простору FinFlow",

            "Self-hosted":
                "Self-hosted",

            "Private by design":
                "Приватність за задумом",

            "Your financial data stays under your control.":
                "Ваші фінансові дані залишаються під вашим контролем."

        },

        en: {}
    };

    Object.keys(translations.uk).forEach(function (key) {
        translations.en[key] = key;
    });


    /* =========================================================
       LANGUAGE
       ========================================================= */

    function getLang() {
        const stored = localStorage.getItem("finflow-language");

        if (stored === "ru") {
            localStorage.setItem("finflow-language", "uk");
            return "uk";
        }

        return stored === "en" ? "en" : "uk";
    }


    function getLanguage() {
        return getLang();
    }


    function setLang(lang) {
        lang = lang === "en" ? "en" : "uk";

        localStorage.setItem("finflow-language", lang);

        applyLanguage(lang);

        window.dispatchEvent(
            new CustomEvent("finflow-language-changed", {
                detail: { lang: lang }
            })
        );
    }


    /* =========================================================
       TRANSLATION
       ========================================================= */

    const ukrainianToEnglish = {};

    Object.keys(translations.uk).forEach(function (english) {
        ukrainianToEnglish[translations.uk[english]] = english;
    });


    function translate(value, lang) {
        if (!value) return value;

        lang = lang || getLang();

        const text = String(value);

        if (lang === "uk") {

            if (translations.uk[text]) {
                return translations.uk[text];
            }

            const lower = text.toLowerCase();

            const englishKey =
                Object.keys(translations.uk).find(function (key) {
                    return key.toLowerCase() === lower;
                });

            return englishKey
                ? translations.uk[englishKey]
                : text;
        }


        if (lang === "en") {

            if (ukrainianToEnglish[text]) {
                return ukrainianToEnglish[text];
            }

            const lower = text.toLowerCase();

            const ukrainianKey =
                Object.keys(ukrainianToEnglish).find(function (key) {
                    return key.toLowerCase() === lower;
                });

            return ukrainianKey
                ? ukrainianToEnglish[ukrainianKey]
                : text;
        }


        return text;
    }


    function translateSmart(value, lang) {

        let result = translate(value, lang);

        if (!result) return result;


        if (lang === "uk") {

            result = result.replace(
                /\bISSUED\b/gi,
                "ВИСТАВЛЕНО"
            );

            result = result.replace(
                /\bCANCELLED\b/gi,
                "СКАСОВАНО"
            );

            result = result.replace(
                /\bPAID\b/gi,
                "ОПЛАЧЕНО"
            );

            result = result.replace(
                /\bPARTIAL\b/gi,
                "ЧАСТКОВО"
            );

            result = result.replace(
                /\bUNPAID\b/gi,
                "НЕ ОПЛАЧЕНО"
            );

            result = result.replace(
                /\bOVERDUE\b/gi,
                "ПРОСТРОЧЕНО"
            );

            result = result.replace(
                /\bHISTORY\b/gi,
                "ІСТОРІЯ"
            );

            result = result.replace(
                /\bHEALTHY\b/gi,
                "У НОРМІ"
            );

            result = result.replace(
                /\bHIGH USAGE\b/gi,
                "ВИСОКЕ ЗАВАНТАЖЕННЯ"
            );

            result = result.replace(
                /\bOVER BUDGET\b/gi,
                "ПЕРЕВИЩЕННЯ БЮДЖЕТУ"
            );

            result = result.replace(
                /\bused\b/gi,
                "використано"
            );

            result = result.replace(
                /\balerts\b/gi,
                "попереджень"
            );

            result = result.replace(
                /Budget exceeded by €([\d,.]+)/gi,
                "Бюджет перевищено на €$1"
            );

            result = result.replace(
                /([\d.]+)% of the budget has been invoiced\. €([\d,.]+) remains\./gi,
                "Виставлено $1% бюджету. Залишок: €$2."
            );

            result = result.replace(
                /Contract ends in (\d+) day(?:s)?/gi,
                "До завершення договору $1 дн"
            );
        }


        if (lang === "en") {

            result = result.replace(
                /\bВИСТАВЛЕНО\b/gi,
                "ISSUED"
            );

            result = result.replace(
                /\bСКАСОВАНО\b/gi,
                "CANCELLED"
            );

            result = result.replace(
                /\bОПЛАЧЕНО\b/gi,
                "PAID"
            );

            result = result.replace(
                /\bЧАСТИЧНО\b/gi,
                "PARTIAL"
            );

            result = result.replace(
                /\bНЕ ОПЛАЧЕНО\b/gi,
                "UNPAID"
            );

            result = result.replace(
                /\bПРОСТРОЧЕНО\b/gi,
                "OVERDUE"
            );

            result = result.replace(
                /\bІСТОРІЯ\b/gi,
                "HISTORY"
            );

            result = result.replace(
                /\bУ НОРМІ\b/gi,
                "HEALTHY"
            );

            result = result.replace(
                /\bВИСОКЕ НАВАНТАЖЕННЯ\b/gi,
                "HIGH USAGE"
            );

            result = result.replace(
                /\bПЕРЕВИЩЕННЯ БЮДЖЕТУ\b/gi,
                "OVER BUDGET"
            );

            result = result.replace(
                /\bВИКОРИСТАНО\b/gi,
                "used"
            );

            result = result.replace(
                /\bпопереджень\b/gi,
                "alerts"
            );

            result = result.replace(
                /Бюджет перевищено на €([\d,.]+)/gi,
                "Budget exceeded by €$1"
            );

            result = result.replace(
                /Виставлено ([\d.]+)% бюджету\. Залишок: €([\d,.]+)\./gi,
                "$1% of the budget has been invoiced. €$2 remains."
            );

            result = result.replace(
                /До завершення договору (\d+) дн/gi,
                "Contract ends in $1 day"
            );
        }


        return result;
    }


    /* =========================================================
       DOM TRANSLATION
       ========================================================= */

    const originalTextNodes = new WeakMap();


    function sourceText(node) {

        if (!originalTextNodes.has(node)) {
            originalTextNodes.set(node, node.nodeValue);
        }

        return originalTextNodes.get(node);
    }


    function isProtected(node) {

        return !!(
            node &&
            node.closest &&
            node.closest(
                '[data-finflow-no-i18n], .invoice-document, #invoiceDocument, .print-invoice'
            )
        );
    }


    function translateDom(root, lang) {

        if (!root) return;


        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT
        );


        const nodes = [];
        let node;


        while ((node = walker.nextNode())) {
            nodes.push(node);
        }


        nodes.forEach(function (textNode) {

            if (isProtected(textNode.parentElement)) {
                return;
            }


            const parent = textNode.parentElement;

            if (
                parent &&
                parent.closest &&
                parent.closest(
                    "script, style"
                )
            ) {
                return;
            }


            const original = sourceText(textNode);
            const trimmed = original.trim();


            if (!trimmed) return;


            const translated =
                translateSmart(trimmed, lang);


            if (translated !== trimmed) {

                textNode.nodeValue =
                    original.replace(
                        trimmed,
                        translated
                    );

            } else {

                textNode.nodeValue = original;
            }
        });


        if (
            root.querySelectorAll
        ) {

            root.querySelectorAll(
                "input, textarea, select, button, [title], [aria-label]"
            ).forEach(function (el) {

                if (isProtected(el)) {
                    return;
                }


                [
                    "placeholder",
                    "title",
                    "aria-label"
                ].forEach(function (attr) {

                    if (!el.hasAttribute(attr)) {
                        return;
                    }


                    const marker =
                        "data-finflow-original-" + attr;


                    if (!el.hasAttribute(marker)) {

                        el.setAttribute(
                            marker,
                            el.getAttribute(attr)
                        );
                    }


                    const original =
                        el.getAttribute(marker);


                    el.setAttribute(
                        attr,
                        translateSmart(
                            original,
                            lang
                        )
                    );
                });
            });
        }


        /* Explicit data-i18n support */

        root.querySelectorAll &&
        root.querySelectorAll("[data-i18n]").forEach(function (el) {

            const key = el.dataset.i18n;

            el.textContent =
                lang === "uk"
                    ? (translations.uk[key] || key)
                    : key;
        });


        root.querySelectorAll &&
        root.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {

            const key =
                el.dataset.i18nPlaceholder;

            el.placeholder =
                lang === "uk"
                    ? (translations.uk[key] || key)
                    : key;
        });


        root.querySelectorAll &&
        root.querySelectorAll("[data-i18n-title]").forEach(function (el) {

            const key =
                el.dataset.i18nTitle;

            el.title =
                lang === "uk"
                    ? (translations.uk[key] || key)
                    : key;
        });
    }


    /* =========================================================
       SWITCHER
       ========================================================= */

    function updateSwitcher(lang) {

        const button =
            document.getElementById(
                "finflow-lang-button"
            );

        if (!button) {
            return;
        }

        button.textContent =
            lang === "uk"
                ? "UK"
                : "EN";

        button.setAttribute(
            "aria-label",
            lang === "uk"
                ? "Switch language to Ukrainian"
                : "Переключити мову на англійську"
        );

        button.title =
            lang === "uk"
                ? "Switch to Ukrainian"
                : "Переключити на англійську";
    }

    function addLanguageSwitcher() {

        /*
         * The language switcher is intentionally available
         * only on the main Dashboard.
         *
         * All other pages use the same localStorage language
         * preference but do not render their own switcher.
         */

        const userMenu =
            document.getElementById(
                "ff-user-menu"
            );

        if (
            !userMenu ||
            !userMenu.parentElement
        ) {
            return;
        }


        if (
            document.getElementById(
                "finflow-lang-button"
            )
        ) {
            updateSwitcher(getLang());
            return;
        }


        const button =
            document.createElement("button");


        button.id =
            "finflow-lang-button";


        button.type =
            "button";


        button.className =
            "inline-flex items-center justify-center min-w-[42px] h-[42px] px-2.5 rounded-xl border border-slate-700/70 bg-slate-900/60 text-slate-300 text-[11px] font-black transition hover:border-emerald-400/35 hover:bg-slate-900/90 hover:text-white";


        button.addEventListener(
            "click",
            function () {

                setLang(
                    getLang() === "uk"
                        ? "en"
                        : "uk"
                );
            }
        );


        userMenu.parentElement.insertBefore(
            button,
            userMenu
        );


        updateSwitcher(getLang());
    }


    function updateLandingSwitcher(lang) {

        const button =
            document.getElementById(
                "ff-landing-lang-button"
            );

        if (!button) {
            return;
        }

        button.textContent =
            lang === "uk"
                ? "UK"
                : "EN";

        button.setAttribute(
            "aria-label",
            lang === "uk"
                ? "Switch language to English"
                : "Переключити мову на українську"
        );

        button.title =
            lang === "uk"
                ? "Switch to English"
                : "Переключити на українську";
    }


    function addLandingLanguageSwitcher() {

        const button =
            document.getElementById(
                "ff-landing-lang-button"
            );

        if (!button) {
            return;
        }

        button.addEventListener(
            "click",
            function () {

                setLang(
                    getLang() === "uk"
                        ? "en"
                        : "uk"
                );
            }
        );

        updateLandingSwitcher(
            getLang()
        );
    }


    /* =========================================================
       LANGUAGE APPLICATION
       ========================================================= */

    function applyLanguage(lang) {

        lang = lang === "en"
            ? "en"
            : "uk";


        document.documentElement.lang =
            lang;


        translateDom(
            document.body,
            lang
        );


        updateSwitcher(lang);
        updateLandingSwitcher(lang);


        /*
         * Dashboard dynamic UI
         */

        if (
            typeof window.renderNotificationCenter ===
            "function"
        ) {
            window.renderNotificationCenter();
        }


        if (
            typeof window.updateSummaryCards ===
            "function"
        ) {
            window.updateSummaryCards();
        }


        if (
            typeof window.updateProductCardMetrics ===
            "function"
        ) {
            window.updateProductCardMetrics();
        }
    }


    /* =========================================================
       BROWSER DIALOGS
       ========================================================= */

    const originalAlert =
        window.alert;

    const originalConfirm =
        window.confirm;

    const originalPrompt =
        window.prompt;


    window.alert =
        function (message) {

            return originalAlert(
                translateSmart(
                    String(message),
                    getLang()
                )
            );
        };


    window.confirm =
        function (message) {

            return originalConfirm(
                translateSmart(
                    String(message),
                    getLang()
                )
            );
        };


    window.prompt =
        function (
            message,
            defaultValue
        ) {

            return originalPrompt(
                translateSmart(
                    String(message),
                    getLang()
                ),
                defaultValue
            );
        };


    /* =========================================================
       DYNAMIC DOM
       ========================================================= */

    const observer =
        new MutationObserver(
            function (mutations) {

                const lang =
                    getLang();


                mutations.forEach(
                    function (mutation) {

                        mutation.addedNodes.forEach(
                            function (node) {

                                if (
                                    node.nodeType ===
                                    Node.ELEMENT_NODE
                                ) {

                                    translateDom(
                                        node,
                                        lang
                                    );
                                }
                            }
                        );
                    }
                );
            }
        );


    /* =========================================================
       PUBLIC API
       ========================================================= */

    document.documentElement.setAttribute(
        "data-finflow-i18n-loaded",
        "yes"
    );

    window.finflowI18n = {

        getLang,
        getLanguage,
        translate,
        translateSmart,
        setLang,
        applyLanguage,
        addLanguageSwitcher,
        addLandingLanguageSwitcher,
        addSwitcher: addLanguageSwitcher
    };


    /* =========================================================
       INIT
       ========================================================= */

    document.addEventListener(
        "DOMContentLoaded",
        function () {

            addLanguageSwitcher();
            addLandingLanguageSwitcher();

            applyLanguage(
                getLang()
            );


            observer.observe(
                document.body,
                {
                    childList: true,
                    subtree: true
                }
            );
        }
    );

})();
