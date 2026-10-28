# Run the demand prediction service

This FastAPI service trains the XGBoost demand classifier and serves item predictions to the AIMS web app. Run it in a separate terminal from Next.js.

## Before starting

- Install Python 3.12 and start MySQL.
- Create `aims/.env.local` from `aims/.env.local.example` if it does not exist. Set `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` for your MySQL database. Keep `DEMAND_SERVICE_URL=http://127.0.0.1:8000`.
- Import `aims/database/schema.sql` into the database. Training needs recorded stock-out transactions.

## Windows PowerShell: existing AIMS virtual environment

The commands below use the virtual environment at `C:\Users\PLP\Documents\AIMS\software_eng\.venv`. Run them from the outer Git repository folder:

```powershell
cd C:\Users\PLP\Documents\AIMS\software_eng
.\.venv\Scripts\Activate.ps1
python -m uvicorn app:app --app-dir aims\demand_service --reload --reload-dir aims\demand_service --host 127.0.0.1 --port 8000
```

The prompt shows `(.venv)` after activation. Leave this terminal open while using demand prediction. Press `Ctrl+C` to stop the service, then run `deactivate` to leave the environment.

If activation is blocked, run the environment's Python directly:

```powershell
cd C:\Users\PLP\Documents\AIMS\software_eng
.\.venv\Scripts\python.exe -m uvicorn app:app --app-dir aims\demand_service --reload --reload-dir aims\demand_service --host 127.0.0.1 --port 8000
```

## First-time setup or missing packages

From the same outer folder, create the environment only if `.venv` does not exist. Python 3.12 is recommended for the versions pinned in `requirements.txt`.

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r aims\demand_service\requirements.txt
```

If `.venv` already exists but `uvicorn` is missing, run only the `pip install` command.

## Check and use the service

Open [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health) to confirm it responds. The API documentation is at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

In a second terminal, run the web app:

```powershell
cd C:\Users\PLP\Documents\AIMS\software_eng\aims
npm run dev
```

Run `npm ci` once from this folder first if Node.js packages are not installed.

Open [http://localhost:3000/prediction](http://localhost:3000/prediction). Select **Train model**, then **Predict all**. The service saves the trained model in `aims/demand_service/models/`. If training reports insufficient history, record more stock-out transactions before trying again.
