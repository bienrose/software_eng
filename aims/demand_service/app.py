import json
import os
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

import joblib
import mysql.connector
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from sklearn.compose import ColumnTransformer
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, OrdinalEncoder
from xgboost import XGBClassifier

from nlp import infer_schema, parse_stock_command

load_dotenv(Path(__file__).parent.parent / ".env.local")
app = FastAPI(title="AIMS Demand Prediction Service")
MODEL_PATH = Path(os.getenv("DEMAND_MODEL_PATH", Path(__file__).parent / "models" / "demand_classifier.joblib"))
MINIMUM_TRAINING_ROWS = 30
FEATURE_COLUMNS = ["item_id", "category_name", "rolling_7", "rolling_30", "weekday", "month", "lead_time_days", "stock_available"]
CATEGORICAL_COLUMNS = ["item_id", "category_name"]
NUMERIC_COLUMNS = [column for column in FEATURE_COLUMNS if column not in CATEGORICAL_COLUMNS]


class TrainRequest(BaseModel):
    force: bool = False


class StockCommandRequest(BaseModel):
    text: str
    items: list[dict] = []  # [{"id": 1, "name": "USB Cable"}, ...]


class SchemaRequest(BaseModel):
    text: str


def connection():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "3306")),
        database=os.getenv("DB_NAME", "aims_db"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD", ""),
    )


def read_rows(query, params=()):
    with connection() as db:
        cursor = db.cursor(dictionary=True)
        cursor.execute(query, params)
        rows = cursor.fetchall()
        cursor.close()
    return rows


def write_prediction(item_id, demand_level, features, model_version):
    with connection() as db:
        cursor = db.cursor()
        cursor.execute(
            """
            INSERT INTO demand_predictions
              (id, inventory_item_id, prediction_mode, demand_level, prediction_for, model_name, model_version, input_features)
            VALUES (%s, %s, 'classification', %s, %s, 'XGBoost', %s, %s)
            """,
            (str(uuid4()), item_id, demand_level, date.today() + timedelta(days=1), model_version, json.dumps(features)),
        )
        db.commit()
        cursor.close()


def item_rows():
    return read_rows(
        """
        SELECT i.id AS item_id, c.name AS category_name, i.quantity_on_hand,
          COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(i.custom_attributes, '$.lead_time_days')) AS DECIMAL(10, 2)), 7) AS lead_time_days
        FROM inventory_items i
        INNER JOIN inventory_categories c ON c.id = i.category_id
        WHERE i.is_active = TRUE AND c.archived_at IS NULL
        """
    )


def transaction_rows(item_id=None):
    query = """
        SELECT inventory_item_id AS item_id, movement_type, quantity, balance_after, DATE(occurred_at) AS transaction_date
        FROM inventory_transactions
    """
    params = ()
    if item_id:
        query += " WHERE inventory_item_id = %s"
        params = (item_id,)
    query += " ORDER BY occurred_at ASC"
    return read_rows(query, params)


def make_daily_frame(items, transactions, include_target=True):
    if not items or not transactions:
        return pd.DataFrame()
    transactions_frame = pd.DataFrame(transactions)
    transactions_frame["transaction_date"] = pd.to_datetime(transactions_frame["transaction_date"])
    transactions_frame["quantity"] = transactions_frame["quantity"].astype(float)
    transactions_frame["balance_after"] = transactions_frame["balance_after"].astype(float)
    rows = []
    items_by_id = {str(item["item_id"]): item for item in items}
    for item_id, item in items_by_id.items():
        history = transactions_frame[transactions_frame["item_id"].astype(str) == item_id].copy()
        if history.empty:
            continue
        start = history["transaction_date"].min()
        end = pd.Timestamp(date.today()) if include_target else history["transaction_date"].max()
        dates = pd.DataFrame({"transaction_date": pd.date_range(start, end, freq="D")})
        demand = history[history["movement_type"] == "stock_out"].groupby("transaction_date")["quantity"].sum()
        balances = history.groupby("transaction_date")["balance_after"].last()
        dates["demand_quantity"] = dates["transaction_date"].map(demand).fillna(0).astype(float)
        dates["stock_available"] = dates["transaction_date"].map(balances).ffill().bfill().fillna(float(item["quantity_on_hand"])).astype(float)
        dates["item_id"] = item_id
        dates["category_name"] = str(item["category_name"])
        dates["lead_time_days"] = float(item["lead_time_days"] or 7)
        dates["rolling_7"] = dates["demand_quantity"].shift(1).rolling(7, min_periods=1).mean().fillna(0)
        dates["rolling_30"] = dates["demand_quantity"].shift(1).rolling(30, min_periods=1).mean().fillna(0)
        dates["weekday"] = dates["transaction_date"].dt.weekday
        dates["month"] = dates["transaction_date"].dt.month
        rows.append(dates)
    return pd.concat(rows, ignore_index=True) if rows else pd.DataFrame()


def assign_levels(frame):
    labels = pd.Series("low", index=frame.index, dtype="object")
    for item_id, group in frame.groupby("item_id"):
        positive = group.loc[group["demand_quantity"] > 0, "demand_quantity"]
        if positive.empty:
            continue
        threshold = positive.quantile(0.7)
        moderate_mask = (frame["item_id"] == item_id) & (frame["demand_quantity"] > 0) & (frame["demand_quantity"] <= threshold)
        high_mask = (frame["item_id"] == item_id) & (frame["demand_quantity"] > threshold)
        labels.loc[moderate_mask] = "moderate"
        labels.loc[high_mask] = "high"
    return labels


def load_bundle():
    if not MODEL_PATH.exists():
        raise HTTPException(status_code=409, detail={"code": "model_not_trained", "message": "No trained demand model exists. Train the model after recording enough stock-out history."})
    return joblib.load(MODEL_PATH)


def model_metrics(labels, predictions, classes):
    matrix = confusion_matrix(labels, predictions, labels=classes).tolist()
    return {
        "accuracy": round(float(accuracy_score(labels, predictions)), 4),
        "precision": round(float(precision_score(labels, predictions, average="weighted", zero_division=0)), 4),
        "recall": round(float(recall_score(labels, predictions, average="weighted", zero_division=0)), 4),
        "f1": round(float(f1_score(labels, predictions, average="weighted", zero_division=0)), 4),
        "confusionMatrix": {"labels": [label.title() for label in classes], "values": matrix},
    }


@app.get("/health")
def health():
    return {"ok": True, "modelAvailable": MODEL_PATH.exists()}


@app.post("/train")
def train(_: TrainRequest):
    frame = make_daily_frame(item_rows(), transaction_rows())
    if len(frame) < MINIMUM_TRAINING_ROWS:
        raise HTTPException(status_code=422, detail={"code": "cold_start", "message": f"At least {MINIMUM_TRAINING_ROWS} item-days of stock movement history are required before training.", "availableRows": int(len(frame)), "requiredRows": MINIMUM_TRAINING_ROWS})
    frame["demand_level"] = assign_levels(frame)
    if frame["demand_level"].nunique() < 2:
        raise HTTPException(status_code=422, detail={"code": "cold_start", "message": "Stock-out history does not yet contain enough variation to train Low, Medium, and High demand classes."})
    encoder = LabelEncoder()
    labels = encoder.fit_transform(frame["demand_level"])
    stratify = labels if min(pd.Series(labels).value_counts()) >= 2 else None
    train_features, test_features, train_labels, test_labels = train_test_split(frame[FEATURE_COLUMNS], labels, test_size=0.2, random_state=42, stratify=stratify)
    if len(set(train_labels)) != len(encoder.classes_):
        raise HTTPException(status_code=422, detail={"code": "cold_start", "message": "The training split is missing a demand class. Record more stock-out history and train again."})
    preprocessor = ColumnTransformer([
        ("categories", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1), CATEGORICAL_COLUMNS),
        ("numbers", "passthrough", NUMERIC_COLUMNS),
    ])
    classifier = XGBClassifier(
        n_estimators=180,
        max_depth=4,
        learning_rate=0.08,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=42,
    )
    pipeline = Pipeline([("features", preprocessor), ("classifier", classifier)])
    pipeline.fit(train_features, train_labels)
    predictions = pipeline.predict(test_features)
    classes = list(encoder.classes_)
    metrics = model_metrics(encoder.inverse_transform(test_labels), encoder.inverse_transform(predictions.astype(int)), classes)
    version = datetime.now(timezone.utc).strftime("xgb-%Y%m%d%H%M%S")
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"pipeline": pipeline, "labelEncoder": encoder, "version": version, "metrics": metrics, "trainedAt": datetime.now(timezone.utc).isoformat()}, MODEL_PATH)
    return {"message": "Demand model trained successfully.", "modelVersion": version, "trainingRows": int(len(frame)), "testRows": int(len(test_features)), "metrics": metrics}


def prediction_features(item_id):
    items = [item for item in item_rows() if str(item["item_id"]) == item_id]
    if not items:
        raise HTTPException(status_code=404, detail={"message": "Inventory item not found."})
    transactions = transaction_rows(item_id)
    if len(transactions) < 7:
        raise HTTPException(status_code=422, detail={"code": "cold_start", "message": "This item needs at least seven recorded movements before an item-specific demand prediction can be made.", "itemId": item_id, "availableTransactions": len(transactions), "requiredTransactions": 7})
    frame = make_daily_frame(items, transactions)
    latest = frame.iloc[-1]
    next_day = pd.Timestamp(date.today() + timedelta(days=1))
    row = {
        "item_id": str(latest["item_id"]),
        "category_name": str(latest["category_name"]),
        "rolling_7": float(latest["rolling_7"]),
        "rolling_30": float(latest["rolling_30"]),
        "weekday": float(next_day.weekday()),
        "month": float(next_day.month),
        "lead_time_days": float(latest["lead_time_days"]),
        "stock_available": float(items[0]["quantity_on_hand"]),
    }
    return pd.DataFrame([row])[FEATURE_COLUMNS]


def predict(item_id):
    bundle = load_bundle()
    features = prediction_features(item_id)
    prediction = int(bundle["pipeline"].predict(features)[0])
    level = str(bundle["labelEncoder"].inverse_transform([prediction])[0])
    feature_values = features.iloc[0].to_dict()
    write_prediction(item_id, level, feature_values, bundle["version"])
    return {"itemId": item_id, "demandLevel": level.title().replace("Moderate", "Medium"), "storedDemandLevel": level, "predictionFor": str(date.today() + timedelta(days=1)), "modelVersion": bundle["version"], "features": feature_values}


@app.get("/predict/{item_id}")
def predict_one(item_id: str):
    return predict(item_id)


@app.get("/predict-all")
def predict_all():
    results = []
    skipped = []
    for item in item_rows():
        item_id = str(item["item_id"])
        try:
            results.append(predict(item_id))
        except HTTPException as error:
            skipped.append({"itemId": item_id, "reason": error.detail})
    return {"predictions": results, "skipped": skipped}


@app.post("/nlp/stock-command")
def nlp_stock_command(req: StockCommandRequest):
    return parse_stock_command(req.text, req.items)


@app.post("/nlp/infer-schema")
def nlp_infer_schema(req: SchemaRequest):
    return infer_schema(req.text)