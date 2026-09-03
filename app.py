import os
import json
from flask import Flask, render_template, request, redirect, url_for, jsonify
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:////opt/accounting-app/accounting.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

def parse_contract_details(raw_details):
    if not raw_details:
        return '—'
    try:
        data = json.loads(raw_details)
        if isinstance(data, dict):
            items = data.get('items', [])
            items_str = '; '.join(items) if isinstance(items, list) else ''
            return data.get('description') or items_str or (f"PO № {data.get('po_number')}" if data.get('po_number') else '—')
    except Exception:
        pass
    return raw_details

app.jinja_env.filters['parse_details'] = parse_contract_details


class Company(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), unique=True, nullable=False)
    invoices = db.relationship('Invoice', backref='company', lazy=True, cascade="all, delete-orphan")
    budgets = db.relationship('CompanyBudget', backref='company', lazy=True, cascade="all, delete-orphan")

class CompanyBudget(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'), nullable=False)
    software = db.Column(db.String(50), nullable=False)
    total_amount = db.Column(db.Float, default=0.0)
    completion_date = db.Column(db.String(50), nullable=True)

class Invoice(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'), nullable=False)
    invoice_number = db.Column(db.String(100), nullable=True)
    invoice_date = db.Column(db.String(50), nullable=True)
    completion_date = db.Column(db.String(50), nullable=True)
    software = db.Column(db.String(50), nullable=False)
    amount_eur = db.Column(db.Float, nullable=False)
    contract_details = db.Column(db.Text, nullable=True)

with app.app_context():
    db.create_all()

@app.route('/')
def index():
    companies = Company.query.order_by(Company.name).all()
    invoices = Invoice.query.order_by(Invoice.id.desc()).all()

    company_cards = []
    for c in companies:
        alpha_budget_obj = CompanyBudget.query.filter_by(company_id=c.id, software='ALPHA').first()
        beta_budget_obj = CompanyBudget.query.filter_by(company_id=c.id, software='BETA').first()

        alpha_spent = sum(inv.amount_eur for inv in c.invoices if inv.software == 'ALPHA')
        beta_spent = sum(inv.amount_eur for inv in c.invoices if inv.software == 'BETA')

        has_alpha = any(inv.software == 'ALPHA' for inv in c.invoices) or (alpha_budget_obj and alpha_budget_obj.total_amount > 0)
        has_beta = any(inv.software == 'BETA' for inv in c.invoices) or (beta_budget_obj and beta_budget_obj.total_amount > 0)

        if not has_alpha and not has_beta:
            has_alpha = True

        default_sw = 'ALPHA' if has_alpha else 'BETA'

        company_cards.append({
            'id': c.id,
            'name': c.name,
            'has_alpha': has_alpha,
            'has_beta': has_beta,
            'default_sw': default_sw,
            'alpha_budget': alpha_budget_obj.total_amount if alpha_budget_obj else 0.0,
            'alpha_spent': alpha_spent,
            'alpha_date': alpha_budget_obj.completion_date if (alpha_budget_obj and alpha_budget_obj.completion_date) else '',
            'beta_budget': beta_budget_obj.total_amount if beta_budget_obj else 0.0,
            'beta_spent': beta_spent,
            'beta_date': beta_budget_obj.completion_date if (beta_budget_obj and beta_budget_obj.completion_date) else ''
        })

    return render_template('index.html', companies=companies, invoices=invoices, company_cards=company_cards)

@app.route('/generator')
def generator():
    companies = Company.query.order_by(Company.name).all()
    invoices = Invoice.query.order_by(Invoice.id.desc()).all()
    invoices_list = []
    for inv in invoices:
        invoices_list.append({
            'id': inv.id,
            'company_name': inv.company.name if inv.company else '',
            'invoice_number': inv.invoice_number or '—',
            'invoice_date': inv.invoice_date or '',
            'completion_date': inv.completion_date or '',
            'software': inv.software,
            'amount_eur': inv.amount_eur,
            'contract_details': inv.contract_details or ''
        })
    return render_template('generator.html', companies=companies, archived_invoices=invoices_list)

@app.route('/add_invoice', methods=['POST'])
def add_invoice():
    company_name = request.form.get('company_name', '').strip()
    invoice_number = request.form.get('invoice_number', '').strip()
    invoice_date = request.form.get('invoice_date', '').strip()
    completion_date = request.form.get('completion_date', '').strip()
    software = request.form.get('software', 'ALPHA').strip()
    amount_eur = float(request.form.get('amount_eur', 0.0))

    if company_name:
        company = Company.query.filter_by(name=company_name).first()
        if not company:
            company = Company(name=company_name)
            db.session.add(company)
            db.session.commit()

        new_inv = Invoice(
            company_id=company.id,
            invoice_number=invoice_number,
            invoice_date=invoice_date,
            completion_date=completion_date,
            software=software,
            amount_eur=amount_eur
        )
        db.session.add(new_inv)
        db.session.commit()

    return redirect(url_for('index'))

@app.route('/save_generated_invoice', methods=['POST'])
def save_generated_invoice():
    data = request.json or {}
    company_name = data.get('company_name', '').strip()
    invoice_number = data.get('invoice_number', '').strip()
    invoice_date = data.get('invoice_date', '').strip()
    completion_date = data.get('completion_date', '').strip()
    software = data.get('software', 'ALPHA').strip()
    amount_eur = float(data.get('amount_eur', 0.0))
    contract_details = data.get('contract_details', '').strip()

    if not company_name or amount_eur <= 0:
        return jsonify({'status': 'error', 'message': 'Company name and total amount are required'}), 400

    company = Company.query.filter_by(name=company_name).first()
    if not company:
        company = Company(name=company_name)
        db.session.add(company)
        db.session.commit()

    new_inv = Invoice(
        company_id=company.id,
        invoice_number=invoice_number,
        invoice_date=invoice_date,
        completion_date=completion_date,
        software=software,
        amount_eur=amount_eur,
        contract_details=contract_details
    )
    db.session.add(new_inv)
    db.session.commit()

    return jsonify({'status': 'ok', 'invoice_id': new_inv.id})

@app.route('/update_generated_invoice/<int:invoice_id>', methods=['POST'])
def update_generated_invoice(invoice_id):
    inv = Invoice.query.get_or_404(invoice_id)
    data = request.json or {}
    company_name = data.get('company_name', '').strip()
    
    if company_name:
        company = Company.query.filter_by(name=company_name).first()
        if not company:
            company = Company(name=company_name)
            db.session.add(company)
            db.session.commit()
        inv.company_id = company.id

    inv.invoice_number = data.get('invoice_number', '').strip()
    inv.invoice_date = data.get('invoice_date', '').strip()
    inv.completion_date = data.get('completion_date', '').strip()
    inv.software = data.get('software', 'ALPHA').strip()
    inv.amount_eur = float(data.get('amount_eur', 0.0))
    inv.contract_details = data.get('contract_details', '').strip()

    db.session.commit()
    return jsonify({'status': 'ok', 'invoice_id': inv.id})

@app.route('/update_company_budget', methods=['POST'])
def update_company_budget():
    company_id = int(request.form.get('company_id'))
    software = request.form.get('software')
    total_amount = float(request.form.get('total_amount', 0.0))

    budget = CompanyBudget.query.filter_by(company_id=company_id, software=software).first()
    if not budget:
        budget = CompanyBudget(company_id=company_id, software=software, total_amount=total_amount)
        db.session.add(budget)
    else:
        budget.total_amount = total_amount

    db.session.commit()
    return jsonify({'status': 'ok', 'total_amount': total_amount})

@app.route('/update_company_completion_date', methods=['POST'])
def update_company_completion_date():
    company_id = int(request.form.get('company_id'))
    software = request.form.get('software')
    completion_date = request.form.get('completion_date', '').strip()

    budget = CompanyBudget.query.filter_by(company_id=company_id, software=software).first()
    if not budget:
        budget = CompanyBudget(company_id=company_id, software=software, total_amount=0.0, completion_date=completion_date)
        db.session.add(budget)
    else:
        budget.completion_date = completion_date

    db.session.commit()
    return jsonify({'status': 'ok', 'completion_date': completion_date})

@app.route('/delete_invoice/<int:invoice_id>', methods=['POST'])
def delete_invoice(invoice_id):
    inv = Invoice.query.get_or_404(invoice_id)
    company_id = inv.company_id
    db.session.delete(inv)
    db.session.commit()

    alpha_spent = sum(i.amount_eur for i in Invoice.query.filter_by(company_id=company_id, software='ALPHA').all())
    beta_spent = sum(i.amount_eur for i in Invoice.query.filter_by(company_id=company_id, software='BETA').all())

    return jsonify({
        'status': 'ok',
        'company_id': company_id,
        'alpha_spent': alpha_spent,
        'beta_spent': beta_spent
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
