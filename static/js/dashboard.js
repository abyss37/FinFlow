function getCsrfToken() {
    const input = document.querySelector('input[name="csrf_token"]');
    return input ? input.value : "";
}

function openQuickAddInvoiceModal() {
    const modal = document.getElementById('quickAddInvoiceModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeQuickAddInvoiceModal() {
    const modal = document.getElementById('quickAddInvoiceModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function cancelInvoice(id, source) {
    const reason = prompt('Укажите причину аннулирования:');
    if (reason === null) return;
    const cleanReason = reason.trim();
    if (!cleanReason) {
        alert('Причина обязательна.');
        return;
    }

    if (!confirm('Аннулировать счет?')) return;

    try {
        const response = await fetch('/cancel_invoice/' + id, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': getCsrfToken()
            },
            body: JSON.stringify({ reason: cleanReason })
        });

        const data = await response.json();
        if (!response.ok || data.status !== 'ok') {
            throw new Error(data.message || 'Ошибка аннулирования');
        }

        window.location.reload();
    } catch (err) {
        alert(err.message);
    }
}

async function saveCompanyBudget(e, form) {
    e.preventDefault();
    try {
        const response = await fetch(form.action, {
            method: 'POST',
            body: new FormData(form)
        });

        const data = await response.json();
        if (!response.ok || data.status !== 'ok') {
            throw new Error(data.message || 'Ошибка сохранения');
        }

        window.location.reload();
    } catch (err) {
        alert(err.message);
    }
}

function switchSoftware(companyId, software) {
    const card = document.getElementById('card-' + companyId);
    if (!card) return;

    const hiddenInput = card.querySelector('.sw-hidden-input');
    if (hiddenInput) hiddenInput.value = software;

    const key = software.toLowerCase();
    const budgetInput = card.querySelector('.budget-input');
    const currencySelect = card.querySelector('.currency-select');

    if (budgetInput) budgetInput.value = Number(card.dataset[key + 'Budget'] || 0).toFixed(2);
    if (currencySelect) currencySelect.value = card.dataset[key + 'Currency'] || 'EUR';
}

document.getElementById('companyCardSearch')?.addEventListener('input', function (e) {
    const query = e.target.value.toLowerCase().trim();
    document.querySelectorAll('.company-card').forEach(card => {
        const title = (card.dataset.companyTitle || '').toLowerCase();
        card.style.display = title.includes(query) ? '' : 'none';
    });
});

document.getElementById('tableSearch')?.addEventListener('input', function (e) {
    const query = e.target.value.toLowerCase().trim();
    document.querySelectorAll('#mainInvoicesTbody tr').forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(query) ? '' : 'none';
    });
});
