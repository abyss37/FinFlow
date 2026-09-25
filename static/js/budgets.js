(() => {
    "use strict";

    const budgets = Array.isArray(window.FINFLOW_BUDGETS)
        ? window.FINFLOW_BUDGETS
        : [];

    const role = window.FINFLOW_CURRENT_USER_ROLE || "";
    const canEdit = role === "admin" || role === "manager";

    let activeView = "grid";

    const $ = (selector) => document.querySelector(selector);

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function money(value, currency) {
        return window.FinFlowMoney
            ? window.FinFlowMoney.formatMoney(value, currency)
            : `${String(currency || "EUR").toUpperCase()} ${Number(value || 0).toLocaleString("uk-UA", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })}`;
    }

    function health(utilization, total) {
        if (Number(total || 0) <= 0) {
            return {
                key: "empty",
                label: "Не задан",
                icon: "bi-dash-circle",
            };
        }

        if (utilization >= 100) {
            return {
                key: "exceeded",
                label: "Превышен",
                icon: "bi-exclamation-octagon",
            };
        }

        if (utilization >= 90) {
            return {
                key: "critical",
                label: "Критический",
                icon: "bi-exclamation-triangle",
            };
        }

        if (utilization >= 80) {
            return {
                key: "warning",
                label: "Внимание",
                icon: "bi-exclamation-circle",
            };
        }

        return {
            key: "healthy",
            label: "Под контролем",
            icon: "bi-check-circle",
        };
    }

    function contractInfo(value) {
        if (!value) {
            return {
                label: "Дата не задана",
                state: "",
            };
        }

        const date = new Date(value + "T00:00:00");

        if (Number.isNaN(date.getTime())) {
            return {
                label: value,
                state: "",
            };
        }

        const now = new Date();
        const today = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
        );

        const diff = Math.ceil(
            (date.getTime() - today.getTime()) / 86400000
        );

        if (diff < 0) {
            return {
                label: `Просрочен на ${Math.abs(diff)} дн.`,
                state: "overdue",
            };
        }

        if (diff === 0) {
            return {
                label: "Завершается сегодня",
                state: "expiring",
            };
        }

        if (diff <= 30) {
            return {
                label: `${diff} дн. до завершения`,
                state: "expiring",
            };
        }

        return {
            label: `${diff} дн. до завершения`,
            state: "",
        };
    }

    function formatDate(value) {
        if (!value) return "—";

        const date = new Date(value + "T00:00:00");

        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return new Intl.DateTimeFormat("uk-UA", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        }).format(date);
    }

    function getFilteredBudgets() {
        const search = ($("#budgetSearch")?.value || "")
            .trim()
            .toLowerCase();

        const currency = $("#budgetCurrencyFilter")?.value || "ALL";
        const software = $("#budgetSoftwareFilter")?.value || "ALL";

        return budgets.filter((budget) => {
            if (
                search &&
                !String(budget.company_name || "")
                    .toLowerCase()
                    .includes(search)
            ) {
                return false;
            }

            if (
                currency !== "ALL" &&
                budget.currency !== currency
            ) {
                return false;
            }

            if (
                software !== "ALL" &&
                budget.software !== software
            ) {
                return false;
            }

            return true;
        });
    }

    function renderStats() {
        const companies = new Set(
            budgets.map((budget) => budget.company_id)
        );

        const healthy = budgets.filter((budget) => {
            return health(
                Number(budget.utilization),
                Number(budget.total_amount)
            ).key === "healthy";
        }).length;

        const attention = budgets.filter((budget) => {
            const key = health(
                Number(budget.utilization),
                Number(budget.total_amount)
            ).key;

            return ["warning", "critical", "exceeded"].includes(key);
        }).length;

        $("#statBudgetCount").textContent = budgets.length;
        $("#statCompanyCount").textContent = companies.size;
        $("#statHealthyCount").textContent = healthy;
        $("#statAttentionCount").textContent = attention;
    }

    function editButton(budget) {
        if (!canEdit) {
            return "";
        }

        return `
            <button
                type="button"
                class="ff-budget-edit"
                onclick="openBudgetModal(${Number(budget.id)})"
            >
                <i class="bi bi-pencil"></i>
                Изменить
            </button>
        `;
    }

    function renderCard(budget) {
        const utilization = Number(budget.utilization || 0);
        const healthState = health(
            utilization,
            budget.total_amount
        );

        const contract = contractInfo(budget.completion_date);
        const progress = Math.min(Math.max(utilization, 0), 100);

        return `
            <article class="ff-budget-card">
                <div class="ff-budget-card-head">
                    <div>
                        <div class="ff-budget-company">
                            ${escapeHtml(budget.company_name)}
                        </div>

                        <div class="ff-budget-product ${budget.software === "BETA" ? "beta" : ""}">
                            <span class="ff-budget-product-dot"></span>
                            ${escapeHtml(budget.software)}
                            ·
                            ${escapeHtml(budget.currency)}
                        </div>
                    </div>

                    <div class="ff-budget-health ${healthState.key}">
                        <i class="bi ${healthState.icon}"></i>
                        ${escapeHtml(healthState.label)}
                    </div>
                </div>

                <div class="ff-budget-card-finance">
                    <div>
                        <div class="ff-budget-finance-label">Бюджет</div>
                        <div class="ff-budget-finance-value main">
                            ${money(budget.total_amount, budget.currency)}
                        </div>
                    </div>

                    <div>
                        <div class="ff-budget-finance-label">Потрачено</div>
                        <div class="ff-budget-finance-value">
                            ${money(budget.spent_amount, budget.currency)}
                        </div>
                    </div>

                    <div>
                        <div class="ff-budget-finance-label">Остаток</div>
                        <div class="ff-budget-finance-value">
                            ${money(budget.remaining_amount, budget.currency)}
                        </div>
                    </div>
                </div>

                <div class="ff-budget-progress ${healthState.key}">
                    <span style="width:${progress}%"></span>
                </div>

                <div class="ff-budget-card-footer">
                    <div class="ff-budget-date ${contract.state}">
                        <i class="bi bi-calendar3"></i>
                        <span>
                            ${escapeHtml(formatDate(budget.completion_date))}
                        </span>
                        <strong>
                            ${escapeHtml(contract.label)}
                        </strong>
                    </div>

                    ${editButton(budget)}
                </div>
            </article>
        `;
    }

    function renderListRow(budget) {
        const utilization = Number(budget.utilization || 0);
        const healthState = health(
            utilization,
            budget.total_amount
        );

        const contract = contractInfo(budget.completion_date);

        return `
            <div class="ff-budget-list-row">
                <div>
                    <div class="ff-budget-list-company">
                        ${escapeHtml(budget.company_name)}
                    </div>

                    <div class="ff-budget-list-meta">
                        ${escapeHtml(budget.software)}
                        ·
                        ${escapeHtml(budget.currency)}
                    </div>
                </div>

                <div class="ff-budget-list-value">
                    ${money(budget.total_amount, budget.currency)}
                </div>

                <div class="ff-budget-list-value">
                    ${money(budget.spent_amount, budget.currency)}
                </div>

                <div class="ff-budget-list-value">
                    ${money(budget.remaining_amount, budget.currency)}
                </div>

                <div>
                    <div class="ff-budget-health ${healthState.key}">
                        <i class="bi ${healthState.icon}"></i>
                        ${Math.round(utilization * 10) / 10}%
                    </div>

                    <div class="ff-budget-list-meta ${contract.state}">
                        ${escapeHtml(contract.label)}
                    </div>
                </div>

                <div>
                    ${editButton(budget)}
                </div>
            </div>
        `;
    }

    function render() {
        const filtered = getFilteredBudgets();

        const grid = $("#budgetsGrid");
        const list = $("#budgetsList");
        const empty = $("#budgetsEmpty");

        if (!grid || !list || !empty) return;

        if (!filtered.length) {
            grid.innerHTML = "";
            list.innerHTML = "";
            empty.classList.remove("hidden");
            return;
        }

        empty.classList.add("hidden");

        grid.innerHTML = filtered
            .map(renderCard)
            .join("");

        list.innerHTML = filtered
            .map(renderListRow)
            .join("");

        applyView();
    }

    function applyView() {
        const grid = $("#budgetsGrid");
        const list = $("#budgetsList");

        if (!grid || !list) return;

        grid.classList.toggle("hidden", activeView !== "grid");
        list.classList.toggle("hidden", activeView !== "list");

        document
            .querySelectorAll("[data-budget-view]")
            .forEach((button) => {
                button.classList.toggle(
                    "is-active",
                    button.dataset.budgetView === activeView
                );
            });
    }

    function openCreateBudgetModal() {
        if (!canEdit) {
            return;
        }

        const modal = $("#budgetEditModal");
        const form = $("#budgetEditForm");

        if (!modal || !form) return;

        form.reset();

        $("#budgetEditId").value = "";
        $("#budgetEditCurrency").value = "EUR";
        $("#budgetEditCurrencyLabel").textContent = "EUR";

        $("#budgetModalTitle").textContent = "Новый бюджет";
        $("#budgetModalSubtitle").textContent =
            "Создание бюджета для компании и продукта";

        $("#budgetEditCompanyId").disabled = false;
        $("#budgetEditSoftware").disabled = false;
        $("#budgetEditCurrency").disabled = false;

        modal.classList.remove("hidden");
        document.body.classList.add("overflow-hidden");

        setTimeout(() => {
            $("#budgetEditCompanyId")?.focus();
        }, 50);
    }

    function openBudgetModal(id) {
        if (!canEdit) {
            return;
        }

        const budget = budgets.find(
            (item) => Number(item.id) === Number(id)
        );

        if (!budget) return;

        $("#budgetEditId").value = budget.id;
        $("#budgetEditCompanyId").value = budget.company_id;
        $("#budgetEditSoftware").value = budget.software;
        $("#budgetEditCurrency").value = budget.currency;
        $("#budgetEditAmount").value = Number(budget.total_amount || 0);
        $("#budgetEditCompletionDate").value =
            budget.completion_date || "";

        $("#budgetEditCurrencyLabel").textContent = budget.currency;

        $("#budgetModalTitle").textContent =
            `Редактировать бюджет · ${budget.software}`;

        $("#budgetModalSubtitle").textContent =
            `${budget.company_name} · ${budget.currency}`;

        $("#budgetEditCompanyId").disabled = true;
        $("#budgetEditSoftware").disabled = true;
        $("#budgetEditCurrency").disabled = true;

        $("#budgetEditModal").classList.remove("hidden");
        document.body.classList.add("overflow-hidden");

        setTimeout(() => {
            $("#budgetEditAmount")?.focus();
        }, 50);
    }

    function closeBudgetModal() {
        $("#budgetEditModal")?.classList.add("hidden");
        document.body.classList.remove("overflow-hidden");
    }

    async function saveBudget(event) {
        event.preventDefault();

        const companyId = $("#budgetEditCompanyId").value;
        const software = $("#budgetEditSoftware").value;
        const currency = $("#budgetEditCurrency").value;
        const amount = $("#budgetEditAmount").value;
        const completionDate = $("#budgetEditCompletionDate").value;

        if (!companyId || !software || !currency) {
            return;
        }

        const budgetButton = $("#budgetEditForm button[type='submit']");
        const oldText = budgetButton.innerHTML;

        budgetButton.disabled = true;
        budgetButton.innerHTML =
            '<i class="bi bi-arrow-repeat"></i> Сохранение...';

        try {
            const csrfToken =
                document.querySelector('input[name="csrf_token"]')?.value || "";

            if (!csrfToken) {
                throw new Error(
                    "Не удалось получить CSRF-токен. Перезагрузите страницу."
                );
            }

            const budgetData = new URLSearchParams();

            budgetData.set("company_id", companyId);
            budgetData.set("software", software);
            budgetData.set("currency", currency);
            budgetData.set("total_amount", amount);

            const budgetResponse = await fetch(
                "/update_company_budget",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/x-www-form-urlencoded;charset=UTF-8",
                        "X-CSRF-Token": csrfToken,
                    },
                    body: budgetData.toString(),
                }
            );

            const budgetResult = await budgetResponse.json();

            if (!budgetResponse.ok || budgetResult.status !== "ok") {
                throw new Error(
                    budgetResult.message ||
                    "Не удалось сохранить бюджет."
                );
            }

            const dateData = new URLSearchParams();

            dateData.set("company_id", companyId);
            dateData.set("software", software);
            dateData.set("currency", currency);
            dateData.set("completion_date", completionDate);

            const dateResponse = await fetch(
                "/update_company_completion_date",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/x-www-form-urlencoded;charset=UTF-8",
                        "X-CSRF-Token": csrfToken,
                    },
                    body: dateData.toString(),
                }
            );

            const dateResult = await dateResponse.json();

            if (!dateResponse.ok || dateResult.status !== "ok") {
                throw new Error(
                    dateResult.message ||
                    "Бюджет сохранён, но дату завершения изменить не удалось."
                );
            }

            window.location.reload();
        } catch (error) {
            alert(error.message || "Ошибка сохранения.");
        } finally {
            budgetButton.disabled = false;
            budgetButton.innerHTML = oldText;
        }
    }

    function refreshBudgets() {
        window.location.reload();
    }

    document.addEventListener("DOMContentLoaded", () => {
        renderStats();
        render();

        $("#budgetSearch")?.addEventListener("input", render);
        $("#budgetCurrencyFilter")?.addEventListener("change", render);
        $("#budgetSoftwareFilter")?.addEventListener("change", render);

        document.addEventListener("change", (event) => {
            if (event.target?.id !== "budgetEditCurrency") {
                return;
            }

            const currency = event.target.value || "EUR";
            const label = $("#budgetEditCurrencyLabel");

            if (label) {
                label.textContent = currency;
            }
        });

        document
            .querySelectorAll("[data-budget-view]")
            .forEach((button) => {
                button.addEventListener("click", () => {
                    activeView = button.dataset.budgetView;
                    applyView();
                });
            });

        $("#budgetEditForm")?.addEventListener(
            "submit",
            saveBudget
        );
    });

    window.openCreateBudgetModal = openCreateBudgetModal;
    window.openBudgetModal = openBudgetModal;
    window.closeBudgetModal = closeBudgetModal;
    window.refreshBudgets = refreshBudgets;
})();
