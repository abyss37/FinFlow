# FinFlow 💼

[![Python](https://img.shields.io/badge/Python-3.11%2B-blue.svg)](https://www.python.org/)
[![Framework](https://img.shields.io/badge/Framework-Flask-green.svg)](https://flask.palletsprojects.com/)
[![Database](https://img.shields.io/badge/Database-SQLite-lightgrey.svg)](https://sqlite.org/)
[![License](https://img.shields.io/badge/License-MIT-brightgreen.svg)](https://github.com/abyss37/FinFlow/blob/main/LICENSE)

**FinFlow** — это система для централизованного учета контрактов, инвойсов и мониторинга бюджетов компаний в разрезе разных продуктов (например, ПО "ALPHA", ПО "BETA").

## ✨ Основные возможности

- **Мониторинг бюджетов и остатков:** Сводка лимитов и остатков по продуктам и компаниям в реальном времени.
- **Генератор инвойсов и актов:** Автоматическая сборка готовых документов с наложением векторной печати и подписи (Base64 / PNG).
- **Склейка дубликатов:** Встроенные утилиты нормализации и объединения дублирующихся карточек контрагентов.
- **Экспорт аналитики:** Возможность сохранения карточек отчетов и сводок в PNG.
- **Чистая архитектура:** Отсутствие внешних тяжёлых зависимостей, быстрая работа на базе SQLite + SQLAlchemy.

## 🛠 Технологический стек

- **Backend:** Python 3.13, Flask, Flask-SQLAlchemy, Gunicorn
- **Frontend:** HTML5, CSS3 / Tailwind CSS, JavaScript (Vanilla)
- **Image Processing:** Pillow (генерация динамических печатей и штампов)
- **Database:** SQLite3
- **Infrastructure:** Nginx (Reverse Proxy), systemd, OpenRC

## 🚀 Быстрый старт

### Требования
- Python 3.10+
- Git

### Установка

1. **Клонируйте репозиторий:**
   ```bash
   git clone git@github.com:abyss37/FinFlow.git
   cd FinFlow
   ```

2. **Создайте и активируйте виртуальное окружение:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Установите зависимости:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Инициализируйте базу данных и сгенерируйте тестовые данные:**
   ```bash
   python3 -c 'from app import app, db; app.app_context().push(); db.create_all()'
   python3 make_demo_stamp.py
   ```

5. **Запустите приложение:**
   ```bash
   python3 app.py
   ```
   Приложение будет доступно по адресу: `http://localhost:5000`

## 🐧 Развертывание в Production (Gunicorn + Nginx)

1. **Настройка systemd службы (`/etc/systemd/system/accounting-app.service`):**
   ```ini
   [Unit]
   Description=FinFlow Accounting App
   After=network.target

   [Service]
   User=root
   WorkingDirectory=/opt/accounting-app
   ExecStart=/opt/accounting-app/venv/bin/gunicorn --workers 3 --bind 127.0.0.1:5000 app:app
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

2. **Быстрое обновление через деплой-скрипт:**
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

## 📁 Структура проекта

```text
FinFlow/
├── app.py                  # Главное Flask-приложение и ORM-модели
├── make_demo_stamp.py      # Генератор синтетической печати и подписи
├── deploy.sh               # Скрипт автоматического обновления из Git
├── static/                 # CSS, JS, изображения и штампы
├── templates/              # HTML-шаблоны (dashboard, generator)
├── requirements.txt        # Зависимости Python
└── README.md
```

## 📄 Лицензия

[MIT License](https://github.com/abyss37/FinFlow/blob/main/LICENSE)
