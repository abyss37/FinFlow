#!/bin/bash
set -e

echo "=== Обновление приложения ==="
cd /opt/accounting-app

# Pull из удаленного репозитория (если настроен remote)
if git remote | grep -q origin; then
    git pull origin main
fi

source venv/bin/activate
pip install -r requirements.txt 2>/dev/null || true

systemctl restart accounting
echo "Приложение успешно обновлено и перезапущено!"
