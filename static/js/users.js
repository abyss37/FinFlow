(() => {
    "use strict";

    const state = {
        search: "",
        role: "all",
    };

    const qs = (selector, root = document) => root.querySelector(selector);
    const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

    function getModal(id) {
        return document.getElementById(id);
    }

    function openModal(id) {
        const modal = getModal(id);
        if (!modal) return;

        modal.hidden = false;
        document.body.classList.add("ff-modal-open");

        requestAnimationFrame(() => {
            modal.classList.add("is-open");
        });
    }

    function closeModal(id) {
        const modal = getModal(id);
        if (!modal) return;

        modal.classList.remove("is-open");

        setTimeout(() => {
            modal.hidden = true;

            if (!qsa(".ff-modal:not([hidden])").length) {
                document.body.classList.remove("ff-modal-open");
            }
        }, 120);
    }

    function closeAllModals() {
        qsa(".ff-modal:not([hidden])").forEach(modal => {
            closeModal(modal.id);
        });
    }


    /* -------------------------------------------------------
       CREATE USER
       ------------------------------------------------------- */

    function openCreateUserModal() {
        const form = qs("#create-user-form");

        if (form) {
            form.reset();

            const role = qs("#create-role", form);

            if (role) {
                role.value = role.querySelector("option[value='viewer']")
                    ? "viewer"
                    : role.options[0]?.value || "";
            }
        }

        openModal("create-user-modal");

        setTimeout(() => {
            qs("#create-username")?.focus();
        }, 140);
    }


    /* -------------------------------------------------------
       PASSWORD MODAL
       ------------------------------------------------------- */

    function openPasswordModal(userId, username) {
        const modal = getModal("password-modal");
        const form = qs("#password-form", modal);
        const userLabel = qs("#password-modal-user", modal);
        const passwordInput = qs("#password-input", modal);

        if (!modal || !form) return;

        const baseUrl = window.finflowUsers?.changePasswordBaseUrl;

        if (baseUrl) {
            form.action = baseUrl.replace(
                "/0/password",
                `/${userId}/password`
            );
        } else {
            form.action = `/users/${userId}/password`;
        }

        if (userLabel) {
            userLabel.textContent = username || "";
        }

        if (passwordInput) {
            passwordInput.value = "";
        }

        openModal("password-modal");

        setTimeout(() => {
            passwordInput?.focus();
        }, 140);
    }


    /* -------------------------------------------------------
       SEARCH / FILTER
       ------------------------------------------------------- */

    function updateUserRows() {
        const rows = qsa(".users-row");
        const emptyState = qs("#users-filter-empty");
        const searchClear = qs("#users-search-clear");

        let visible = 0;

        rows.forEach(row => {
            const username = row.dataset.username || "";
            const role = row.dataset.role || "";

            const matchesSearch =
                !state.search ||
                username.includes(state.search);

            const matchesRole =
                state.role === "all" ||
                role === state.role;

            const show = matchesSearch && matchesRole;

            row.hidden = !show;

            if (show) {
                visible += 1;
            }
        });

        if (emptyState) {
            emptyState.hidden = visible !== 0;
        }

        if (searchClear) {
            searchClear.hidden = !state.search;
        }
    }

    function handleSearch(event) {
        state.search = event.target.value.trim().toLowerCase();
        updateUserRows();
    }

    function handleRoleFilter(event) {
        state.role = event.target.value;
        updateUserRows();
    }

    function clearSearch() {
        const input = qs("#users-search");

        if (!input) return;

        input.value = "";
        state.search = "";

        updateUserRows();
        input.focus();
    }


    /* -------------------------------------------------------
       ROLE CHANGES
       ------------------------------------------------------- */

    function handleRoleChange(event) {
        const select = event.target;

        if (!select.matches(".user-role-select")) {
            return;
        }

        const form = select.closest("form");

        if (!form) return;

        const selectedRole = select.value;
        const currentRole = select.dataset.previousRole || "";

        if (selectedRole === currentRole) {
            return;
        }

        const confirmed = window.confirm(
            `Изменить роль пользователя на "${selectedRole}"?`
        );

        if (!confirmed) {
            if (currentRole) {
                select.value = currentRole;
            }

            return;
        }

        select.dataset.previousRole = selectedRole;
        form.submit();
    }


    /* -------------------------------------------------------
       USER ACTIONS
       ------------------------------------------------------- */

    function handleUserAction(event) {
        const button = event.target.closest("[data-user-action]");

        if (!button) return;

        const action = button.dataset.userAction;

        if (action === "password") {
            event.preventDefault();

            openPasswordModal(
                button.dataset.userId,
                button.dataset.username
            );

            return;
        }

        if (action === "deactivate") {
            const confirmed = window.confirm(
                "Деактивировать этого пользователя?"
            );

            if (!confirmed) {
                event.preventDefault();
            }
        }
    }


    /* -------------------------------------------------------
       MODAL EVENTS
       ------------------------------------------------------- */

    function handleModalClick(event) {
        const closeButton = event.target.closest("[data-modal-close]");

        if (closeButton) {
            closeModal(closeButton.dataset.modalClose);
            return;
        }

        if (event.target.classList.contains("ff-modal-backdrop")) {
            const modal = event.target.closest(".ff-modal");

            if (modal) {
                closeModal(modal.id);
            }
        }
    }

    function handleEscape(event) {
        if (event.key !== "Escape") return;

        const openModalElement = qs(".ff-modal:not([hidden])");

        if (openModalElement) {
            closeModal(openModalElement.id);
        }
    }


    /* -------------------------------------------------------
       FORM SUBMIT SAFETY
       ------------------------------------------------------- */

    function handleCreateSubmit(event) {
        const form = event.target;

        if (!form.matches("#create-user-form")) {
            return;
        }

        const username = qs("#create-username", form)?.value.trim();
        const password = qs("#create-password", form)?.value || "";

        if (!username || password.length < 8) {
            return;
        }

        const submit = qs("button[type='submit']", form);

        if (submit) {
            submit.disabled = true;
            submit.classList.add("is-loading");
        }
    }

    function handlePasswordSubmit(event) {
        const form = event.target;

        if (!form.matches("#password-form")) {
            return;
        }

        const password = qs("#password-input", form)?.value || "";

        if (password.length < 8) {
            return;
        }

        const submit = qs("button[type='submit']", form);

        if (submit) {
            submit.disabled = true;
            submit.classList.add("is-loading");
        }
    }


    /* -------------------------------------------------------
       INITIALIZATION
       ------------------------------------------------------- */

    function initRoleState() {
        qsa(".user-role-select").forEach(select => {
            select.dataset.previousRole = select.value;
        });
    }

    function init() {
        const createButton = qs("#users-create-button");

        if (createButton) {
            createButton.addEventListener("click", openCreateUserModal);
        }

        const search = qs("#users-search");

        if (search) {
            search.addEventListener("input", handleSearch);
        }

        const searchClear = qs("#users-search-clear");

        if (searchClear) {
            searchClear.addEventListener("click", clearSearch);
        }

        const roleFilter = qs("#users-role-filter");

        if (roleFilter) {
            roleFilter.addEventListener("change", handleRoleFilter);
        }

        document.addEventListener("click", handleModalClick);
        document.addEventListener("click", handleUserAction);

        document.addEventListener("change", handleRoleChange);

        document.addEventListener("keydown", handleEscape);

        document.addEventListener("submit", handleCreateSubmit);
        document.addEventListener("submit", handlePasswordSubmit);

        initRoleState();
        updateUserRows();
    }


    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }


    /* -------------------------------------------------------
       PUBLIC API
       ------------------------------------------------------- */

    window.finflowUsers = Object.assign(
        window.finflowUsers || {},
        {
            openCreateUserModal,
            openPasswordModal,
            closeModal,
            closeAllModals,
            updateUserRows,
        }
    );

})();
