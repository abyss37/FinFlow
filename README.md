# FinFlow 💼

[![Python](https://img.shields.io/badge/Python-3.11%2B-blue.svg)](https://www.python.org/)
[![Framework](https://img.shields.io/badge/Framework-Flask-green.svg)](https://flask.palletsprojects.com/)
[![Database](https://img.shields.io/badge/Database-SQLite-lightgrey.svg)](https://sqlite.org/)
[![License](https://img.shields.io/badge/License-MIT-brightgreen.svg)](LICENSE)

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



📄 Лицензия
MIT License
