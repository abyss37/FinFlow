(() => {
    "use strict";

    const qs = (selector, root = document) =>
        root.querySelector(selector);

    const qsa = (selector, root = document) =>
        Array.from(root.querySelectorAll(selector));


    function getModal(id) {
        return qs(`#${id}`);
    }


    function setModalOpen(modal) {
        if (!modal) return;

        modal.hidden = false;
        modal.setAttribute("aria-hidden", "false");

        document.body.classList.add("ff-modal-open");

        requestAnimationFrame(() => {
            modal.classList.add("is-open");
        });
    }


    function setModalClosed(modal) {
        if (!modal) return;

        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");

        setTimeout(() => {
            modal.hidden = true;

            if (!qsa(".ff-modal:not([hidden])").length) {
                document.body.classList.remove("ff-modal-open");
            }
        }, 120);
    }


    function getCreateModal() {
        return getModal("create-our-company-modal");
    }


    function getEditModal() {
        return getModal("edit-our-company-modal");
    }

    function getCreateDetailsModal() {
        return getModal("create-our-company-details-modal");
    }


    function openCreateModal() {
        const modal = getCreateModal();
        const form = qs("#create-our-company-form");

        if (!modal) return;

        if (form) {
            form.reset();

            const status = qs("#our-company-status", form);
            const statusValue = qs("#our-company-status-value", form);

            if (status) {
                status.checked = true;
            }

            if (statusValue) {
                statusValue.value = "ACTIVE";
            }
        }

        setModalOpen(modal);

        setTimeout(() => {
            qs("#our-company-name", modal)?.focus();
        }, 140);
    }


    function closeCreateModal() {
        setModalClosed(getCreateModal());
    }


    function openEditModal() {
        const modal = getEditModal();

        if (!modal) return;

        const form = qs("#edit-our-company-form", modal);
        const status = qs("#edit-our-company-status", form);
        const statusValue = qs("#edit-our-company-status-value", form);

        if (status && statusValue) {
            statusValue.value = status.checked
                ? "ACTIVE"
                : "INACTIVE";
        }

        setModalOpen(modal);

        setTimeout(() => {
            qs("#edit-our-company-name", modal)?.focus();
        }, 140);
    }


    function closeEditModal() {
        setModalClosed(getEditModal());
    }


    function openCreateDetailsModal() {
        const modal = getCreateDetailsModal();
        const form = qs("#create-our-company-details-form");

        if (!modal) return;

        if (form) {
            form.reset();
        }

        modal._createDetailsWizardReset?.();

        setModalOpen(modal);

        setTimeout(() => {
            qs("#our-company-details-name", modal)?.focus();
        }, 140);
    }


    function initCreateDetailsWizard() {
        const modal = getCreateDetailsModal();

        if (!modal) return;

        const steps = qsa(".ff-form-step", modal);
        const indicators = qsa("[data-step-indicator]", modal);
        const prevButton = qs("#our-company-details-prev", modal);
        const nextButton = qs("#our-company-details-next", modal);
        const submitButton = qs("#our-company-details-submit", modal);

        if (!steps.length) return;

        let currentStep = 1;

        function renderStep() {
            steps.forEach((step, index) => {
                const stepNumber = index + 1;
                step.hidden = stepNumber !== currentStep;
            });

            indicators.forEach((indicator, index) => {
                const stepNumber = index + 1;

                indicator.classList.toggle(
                    "is-active",
                    stepNumber === currentStep
                );

                indicator.classList.toggle(
                    "is-complete",
                    stepNumber < currentStep
                );
            });

            if (prevButton) {
                prevButton.hidden = currentStep === 1;
            }

            if (nextButton) {
                nextButton.hidden = currentStep === steps.length;
            }

            if (submitButton) {
                submitButton.hidden = currentStep !== steps.length;
            }
        }

        function goToStep(stepNumber) {
            currentStep = Math.max(
                1,
                Math.min(stepNumber, steps.length)
            );

            renderStep();
        }

        prevButton?.addEventListener("click", () => {
            goToStep(currentStep - 1);
        });

        nextButton?.addEventListener("click", () => {
            goToStep(currentStep + 1);
        });

        indicators.forEach((indicator, index) => {
            indicator.addEventListener("click", () => {
                goToStep(index + 1);
            });
        });

        modal._createDetailsWizardReset = () => {
            goToStep(1);
        };

        renderStep();
    }


    function syncCreateStatus(event) {
        const statusValue = qs("#our-company-status-value");

        if (!statusValue) return;

        statusValue.value = event.target.checked
            ? "ACTIVE"
            : "INACTIVE";
    }


    function syncEditStatus(event) {
        const statusValue = qs("#edit-our-company-status-value");

        if (!statusValue) return;

        statusValue.value = event.target.checked
            ? "ACTIVE"
            : "INACTIVE";
    }


    function bindEvents() {

        // CREATE

        qs("#our-company-create-button")
            ?.addEventListener("click", openCreateModal);

        qs("#our-company-empty-create-button")
            ?.addEventListener("click", openCreateModal);

        qs("#our-company-status")
            ?.addEventListener("change", syncCreateStatus);


        qs("#our-company-details-create-button")
            ?.addEventListener("click", openCreateDetailsModal);

        initCreateDetailsWizard();


        // EDIT

        qs("#our-company-edit-button")
            ?.addEventListener("click", openEditModal);

        qs("#edit-our-company-status")
            ?.addEventListener("change", syncEditStatus);


        // DOCUMENT ASSETS

        qsa("[data-asset-upload]").forEach(button => {
            button.addEventListener("click", () => {
                const assetType = button.dataset.assetUpload;

                if (!assetType) return;

                const card = button.closest("[data-asset-card]");
                const input = qs(`[data-asset-input="${assetType}"]`, card);

                input?.click();
            });
        });


        qsa("[data-asset-input]").forEach(input => {
            input.addEventListener("change", async () => {
                const file = input.files?.[0];
                const assetType = input.dataset.assetInput;

                if (!file || !assetType) return;

                const grid = input.closest(".our-company-assets-grid");
                const uploadBase = grid?.dataset.assetUploadBase;

                if (!uploadBase) {
                    alert("Не удалось определить адрес загрузки.");
                    input.value = "";
                    return;
                }

                const csrfInput = qs('input[name="csrf_token"]');

                if (!csrfInput?.value) {
                    alert("Не удалось получить CSRF-токен. Перезагрузите страницу.");
                    input.value = "";
                    return;
                }

                const formData = new FormData();
                formData.append("file", file);
                formData.append("csrf_token", csrfInput.value);

                const button = qs(
                    `[data-asset-upload="${assetType}"]`,
                    input.closest("[data-asset-card]")
                );

                const originalText = button?.innerHTML;

                if (button) {
                    button.disabled = true;
                    button.innerHTML = `
                        <i class="bi bi-arrow-repeat"></i>
                        Загрузка…
                    `;
                }

                try {
                    const response = await fetch(
                        `${uploadBase}/${assetType}`,
                        {
                            method: "POST",
                            body: formData,
                            credentials: "same-origin",
                        }
                    );

                    const data = await response.json().catch(() => null);

                    if (!response.ok || !data || data.status !== "ok") {
                        throw new Error(
                            data?.message ||
                            "Не удалось загрузить файл."
                        );
                    }

                    window.location.reload();

                } catch (error) {
                    console.error(
                        "OurCompany asset upload failed:",
                        error
                    );

                    alert(
                        error.message ||
                        "Не удалось загрузить файл."
                    );

                    if (button) {
                        button.disabled = false;
                        button.innerHTML = originalText;
                    }

                    input.value = "";
                }
            });
        });


        // CLOSE BUTTONS / BACKDROPS

        qsa("[data-modal-close]").forEach(element => {
            element.addEventListener("click", () => {
                const modalId = element.dataset.modalClose;

                if (!modalId) return;

                setModalClosed(getModal(modalId));
            });
        });


        qsa(".ff-modal-backdrop").forEach(backdrop => {
            backdrop.addEventListener("click", () => {
                const modal = backdrop.closest(".ff-modal");

                if (modal) {
                    setModalClosed(modal);
                }
            });
        });


        // ESCAPE

        document.addEventListener("keydown", event => {
            if (event.key !== "Escape") return;

            qsa(".ff-modal:not([hidden])").forEach(modal => {
                setModalClosed(modal);
            });
        });
    }


    bindEvents();
})();
