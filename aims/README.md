# AIMS — Adaptive Inventory Management System

AIMS is a web application for managing inventory, recording stock movements, defining inventory-specific fields, viewing operational reports, and generating demand predictions from stock-out history.

## Stack

- **Web application:** Next.js App Router, React, TypeScript
- **UI:** CSS modules, shared workspace styles, Lucide icons
- **Primary database:** MySQL 8.0.16 or later, accessed from Next.js with `mysql2`
- **Demand prediction service:** Python, FastAPI, pandas, scikit-learn, and XGBoost

## Get started

### Requirements

- Node.js and npm
- MySQL 8.0.16 or later
- Python 3.10+ and pip (needed for demand prediction)

### Install the web application

From the repository root:

```bash
npm ci
```

Copy `.env.local.example` to `.env.local` and set the MySQL connection values. Keep `.env.local` private; it is excluded from Git.

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=aims_db
DB_USER=root
DB_PASSWORD=your_mysql_password
DEMAND_SERVICE_URL=http://127.0.0.1:8000
```

If the MySQL account has no password, use `DB_PASSWORD=`. Create the database and tables by running `database/schema.sql` in a MySQL client or SQL editor that supports `DELIMITER`. For setup details and the schema import steps, see `database/README.md`.

Start the Next.js development server:

```bash
npm run dev
```

Open <http://localhost:3000>. Restart the server after changing `.env.local`.

### Start the demand prediction service

The web app can run without this service, but prediction and model training endpoints need it.

In a second terminal, from the repository root:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r demand_service/requirements.txt
uvicorn app:app --app-dir demand_service --reload --host 127.0.0.1 --port 8000
```

On macOS or Linux, replace the environment activation command with:

```bash
source .venv/bin/activate
```

The service reads the same MySQL settings from the root `.env.local`. It saves its trained model under `demand_service/models/`, which is ignored by Git. Check service availability at <http://127.0.0.1:8000/docs>.

## Main areas

| Route | Purpose |
| --- | --- |
| `/dashboard` | Overview and shortcuts into the workspace |
| `/inventory` | List inventories, then open an inventory |
| `/inventory/[inventoryId]` | Inventory items, adaptive fields, and recent stock movements |
| `/inventory/[inventoryId]/edit/manual` | Edit an inventory using the table editor |
| `/inventory/stock-in` and `/inventory/stock-out` | Record incoming and outgoing stock |
| `/inventory_creator` | Choose manual or automatic inventory setup |
| `/inventory_creator/manual` | Build an inventory schema and enter items in a spreadsheet-style table |
| `/inventory_creator/automatic` | Automatic inventory setup interface |
| `/reports` | Inventory and movement reports with CSV/PDF export |
| `/replenishment` | Review and act on replenishment recommendations |
| `/prediction` | Train a demand model and request predictions |
| `/login`, `/register`, `/forgot-password` | Authentication screens (the authentication backend is not currently implemented) |

## Architecture and important files

- `app/` contains App Router pages, layouts, and API route handlers.
- `app/components/workspace-sidebar.tsx` provides the shared sidebar used across workspace sections.
- `app/components/admin-shell.tsx` wraps the reports and replenishment pages in the common workspace shell.
- `app/styles/` and `app/globals.css` contain shared design tokens and layout rules; page-specific styles are usually in `*.module.css` files.
- `app/api/` contains server-side HTTP endpoints. Database operations stay on the server; the browser calls these endpoints with `fetch`.
- `lib/mysql.ts` creates the shared MySQL connection pool. `lib/schema-value.ts` validates adaptive field values.
- `database/schema.sql` defines tables, constraints, indexes, and triggers. See `database/README.md` before changing or applying it.
- `demand_service/app.py` is the FastAPI model service. Next.js proxies model requests through `app/api/demand/` and `lib/demand-service.ts`.

### Data model

The relational core stores inventories as `inventory_categories` and items as `inventory_items`. Each inventory has versioned schema metadata in `inventory_schema_versions` and `inventory_schema_fields`. The schema is versioned so adaptive fields can be changed safely without mutating historical data.

Stock changes are recorded in `inventory_transactions`. Database triggers update the on-hand balance and reject stock-outs that would result in a negative balance. Transactions are append-only; changes to balances are derived from movement history rather than overwritten in place.

## API overview

| Endpoint | Methods | Purpose |
| --- | --- | --- |
| `/api/inventories` | `GET`, `POST` | List and create inventories |
| `/api/inventories/[inventoryId]` | `GET`, `PUT` | Read or update an inventory, its fields, and items |
| `/api/inventories/[inventoryId]/items` | `POST` | Add an item to an inventory |
| `/api/inventory-items/[itemId]/movements` | `POST` | Record a stock movement |
| `/api/reports` | `GET` | Read report data |
| `/api/analytics` | `GET` | Read analytics data |
| `/api/demand/train` | `POST` | Train the demand classifier |
| `/api/demand/predict/[itemId]` | `GET` | Predict demand for an item |
| `/api/demand/predict-all` | `GET` | Predict demand for eligible items |
| `/api/replenishment` | `GET` | Build replenishment recommendations |
| `/api/replenishment/[itemId]/action` | `POST` | Approve or dismiss an item recommendation |

## Developer commands

```bash
npm run dev       # Start the Next.js development server
npm run lint      # Run ESLint
npx tsc --noEmit  # Check TypeScript types
npm run build     # Create a production build
npm run start     # Serve a production build
```

For database changes, update `database/schema.sql` with rerunnable DDL where practical and document any migration or data-preservation requirements in `database/README.md`. Do not rely on `CREATE TABLE` alone for schema updates that need to preserve data.

## Notes for contributors

- Never commit `.env.local`, credentials, or generated model files.
- Keep MySQL access in server routes or server-side libraries; do not expose database credentials to client components.
- Validate adaptive field values against their active schema before persisting them.
- Preserve transaction history when editing inventory data. Use movements to adjust stock rather than silently replacing the balance.
- Shared navigation and the workspace visual system live in `app/components/workspace-sidebar.tsx`, `app/components/admin-shell.tsx`, and `app/styles/`.
