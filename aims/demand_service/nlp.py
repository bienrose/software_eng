"""
Lightweight NLP for AIMS.
- parse_stock_command(): free text -> structured stock movement
- infer_schema(): free text -> suggested inventory fields
Rule-based, no training data required. Standard library only.
"""
from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Any

# ---------------------------------------------------------------- vocabulary
STOCK_IN_RE = re.compile(
    r"\b(received|receive|restocked|restock|stock in|bought|purchased|delivered|"
    r"delivery|incoming|arrived|added|add|got)\b"
)
STOCK_OUT_RE = re.compile(
    r"\b(sold|sell|removed|remove|issued|issue|dispatched|shipped|used|consumed|"
    r"stock out|damaged|expired|lost|released|withdrew|withdraw|took|sent)\b"
)
UNITS = {
    "pcs", "pc", "piece", "pieces", "unit", "units", "box", "boxes", "pack",
    "packs", "bottle", "bottles", "kg", "g", "l", "ml", "carton", "cartons",
    "bag", "bags", "set", "sets", "roll", "rolls", "pair", "pairs", "dozen",
}
NUMBER_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7,
    "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "fifteen": 15,
    "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50, "hundred": 100,
    "dozen": 12, "a dozen": 12,
}
STOP_RE = re.compile(
    r"\b(from|to|for|because|due|by|at|on|supplier|customer|order|po|since)\b"
)
DETERMINER_RE = re.compile(r"^(the|a|an|some|my|our|of)\s+")


# ---------------------------------------------------------------- helpers
def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower().strip())


def _singular(word: str) -> str:
    return word[:-1] if len(word) > 3 and word.endswith("s") else word


def _extract_quantity(t: str):
    """Returns (qty, start, end, unit) or (None, None, None, None)."""
    m = re.search(r"(?<![\w.])x?(\d+(?:,\d{3})*(?:\.\d+)?)(?![\w.])", t)
    qty, start, end = None, None, None
    if m:
        qty = float(m.group(1).replace(",", ""))
        start, end = m.start(), m.end()
    else:
        for word, val in NUMBER_WORDS.items():
            m = re.search(rf"\b{word}\b", t)
            if m:
                qty, start, end = float(val), m.start(), m.end()
                break
    if qty is None:
        return None, None, None, None

    unit = None
    nxt = re.match(r"\s+([a-z]+)", t[end:])
    if nxt and nxt.group(1) in UNITS:
        unit = nxt.group(1)
        end += nxt.end()
        if unit == "dozen":
            qty *= 12
    if qty == int(qty):
        qty = int(qty)
    return qty, start, end, unit


def _score(a: str, b: str) -> float:
    a, b = _singular(a), _singular(b)
    if a == b:
        return 1.0
    if a in b or b in a:
        return 0.9
    return SequenceMatcher(None, a, b).ratio()


def match_item(phrase: str, items: list[dict[str, Any]], limit: int = 3):
    """items: [{'id': ..., 'name': ...}]. Returns ranked matches."""
    phrase = _norm(phrase)
    if not phrase:
        return []
    ranked = sorted(
        (
            {"id": it.get("id"), "name": it.get("name"),
             "score": round(_score(phrase, _norm(str(it.get("name", "")))), 3)}
            for it in items
        ),
        key=lambda x: x["score"],
        reverse=True,
    )
    return [r for r in ranked[:limit] if r["score"] >= 0.5]


# ---------------------------------------------------------------- stock commands
def parse_stock_command(text: str, items: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    items = items or []
    t = _norm(text)
    result: dict[str, Any] = {
        "intent": None, "quantity": None, "unit": None, "item_phrase": None,
        "matched_item": None, "alternatives": [], "party": None,
        "reason": None, "confidence": 0.0, "needs_review": True,
    }

    # intent: whichever verb appears first
    m_in, m_out = STOCK_IN_RE.search(t), STOCK_OUT_RE.search(t)
    if m_in and (not m_out or m_in.start() < m_out.start()):
        result["intent"], verb = "stock_in", m_in
    elif m_out:
        result["intent"], verb = "stock_out", m_out
    else:
        verb = None

    qty, qs, qe, unit = _extract_quantity(t)
    result["quantity"], result["unit"] = qty, unit

    # item phrase: text after quantity, else text before it
    phrase = ""
    if qty is not None:
        after = t[qe:].strip()
        after = DETERMINER_RE.sub("", after)
        if after and not STOP_RE.match(after):
            phrase = STOP_RE.split(after)[0].strip()
        else:
            before = t[:qs]
            if verb:
                before = before.replace(verb.group(0), " ")
            phrase = STOP_RE.split(before)[0].strip()
    elif verb:
        phrase = STOP_RE.split(t[verb.end():])[0].strip()
    phrase = DETERMINER_RE.sub("", phrase).strip(" ,.")
    result["item_phrase"] = phrase or None

    # party / reason
    pm = re.search(r"\bfrom\s+([a-z0-9 &.\-]+?)(?=\s+(because|due|for|on|at)\b|$)", t)
    if pm and result["intent"] == "stock_in":
        result["party"] = pm.group(1).strip()
    pm = re.search(r"\bto\s+([a-z0-9 &.\-]+?)(?=\s+(because|due|for|on|at)\b|$)", t)
    if pm and result["intent"] == "stock_out":
        result["party"] = pm.group(1).strip()
    rm = re.search(r"\b(?:because|due to|since)\s+(.+)$", t)
    if rm:
        result["reason"] = rm.group(1).strip()
    elif verb and verb.group(0) in {"damaged", "expired", "lost"}:
        result["reason"] = verb.group(0)

    # match to known items
    matches = match_item(phrase, items)
    if matches:
        result["matched_item"] = matches[0]
        result["alternatives"] = matches[1:]

    # confidence
    conf = 0.0
    conf += 0.3 if result["intent"] else 0
    conf += 0.3 if qty is not None else 0
    conf += 0.4 * (matches[0]["score"] if matches else (0.2 if phrase else 0))
    result["confidence"] = round(conf, 2)
    # never auto-record: movements are append-only, so the UI must confirm
    result["needs_review"] = conf < 0.9 or not matches
    return result


# ---------------------------------------------------------------- schema inference
# Core fields every inventory already has. If the user asks for one of these
# (or a synonym), we do NOT add it again as a custom field.
CORE_FIELDS: dict[str, set[str]] = {
    "Item name": {
        "item name", "name", "item", "product", "product name", "medicine",
        "medicine name", "ingredient", "ingredient name", "material",
        "material name", "supply", "supply name", "item description",
    },
    "Item code": {
        "item code", "code", "sku", "product code", "item id", "barcode",
        "item number", "product id",
    },
    "Unit": {
        "unit", "uom", "unit of measure", "unit of measurement", "measurement unit",
    },
    "Quantity on hand": {
        "quantity on hand", "quantity", "qty", "stock", "stock on hand", "on hand",
        "stock level", "current stock", "stock quantity", "available quantity",
        "quantity available", "amount in stock", "count",
    },
}


def core_match(name: str) -> str | None:
    """Return the core field this name duplicates, or None."""
    n = _norm(name)
    candidates = {n, _singular(n)}
    for core, aliases in CORE_FIELDS.items():
        if candidates & aliases:
            return core
    return None


# Order matters: identifiers are checked first so "Batch Number" stays text
# instead of being treated as a numeric field because of the word "number".
TYPE_RULES: list[tuple[str, re.Pattern]] = [
    ("text", re.compile(
        r"\b(batch|lot|serial|model|sku|barcode|code|id|reference|ref|invoice|"
        r"po|phone|contact|mobile|zip|postal|license|licence|registration)\b")),
    ("date", re.compile(
        r"\b(date|expiry|expiration|expire|expires|received|manufactur\w*|mfg|deadline)\b")),
    ("boolean", re.compile(
        r"\b(is|has|active|fragile|perishable|available|returnable)\b")),
    ("number", re.compile(
        r"\b(price|cost|amount|quantity|qty|count|weight|height|width|length|"
        r"volume|stock|number|total|capacity|reorder|level|discount|tax)\b")),
]

DOMAIN_PRESETS: dict[str, list[str]] = {
    "pharmacy": ["Medicine Name", "Batch Number", "Expiry Date", "Unit Price", "Dosage Form"],
    "grocery": ["Product Name", "Category", "Expiry Date", "Unit Price", "Supplier"],
    "electronics": ["Product Name", "Brand", "Model", "Serial Number", "Warranty End Date", "Unit Price"],
    "clothing": ["Product Name", "Size", "Color", "Brand", "Unit Price"],
    "hardware": ["Product Name", "Category", "Brand", "Unit Price", "Location"],
    "restaurant": ["Ingredient", "Category", "Expiry Date", "Unit Cost", "Supplier"],
    "office": ["Item Name", "Category", "Brand", "Unit Price", "Location"],
}
DOMAIN_ALIASES = {
    "drugstore": "pharmacy", "medicine": "pharmacy", "clinic": "pharmacy",
    "supermarket": "grocery", "sari-sari": "grocery", "convenience": "grocery",
    "gadget": "electronics", "apparel": "clothing", "boutique": "clothing",
    "construction": "hardware", "kitchen": "restaurant", "cafe": "restaurant",
    "stationery": "office", "school": "office",
}
LIST_INTRO_RE = re.compile(
    r"\b(track|tracks|tracking|record|include|including|fields?|columns?|"
    r"with|need|needs|containing|contains)\b[:\s]+(.+)$"
)
NAME_RE = re.compile(
    r"\b(?:inventory|stock)\s+(?:for|of)\s+(?:a\s+|an\s+|my\s+|the\s+)?([a-z ]{3,30}?)"
    r"(?=\s+(?:with|that|which|where|to|and|including|track|tracking|containing)\b|[,.;:]|$)"
)


def _field_type(name: str) -> str:
    n = name.lower()
    for ftype, rx in TYPE_RULES:
        if rx.search(n):
            return ftype
    return "text"


def _clean_field(raw: str) -> str:
    raw = re.sub(r"^(the|a|an|its|their|each item'?s?)\s+", "", raw.strip(" .,;"))
    raw = re.sub(r"\s+", " ", raw)
    return raw.title()


def detect_domain(text: str) -> str | None:
    t = _norm(text)
    for key in DOMAIN_PRESETS:
        if key in t:
            return key
    for alias, key in DOMAIN_ALIASES.items():
        if alias in t:
            return key
    return None


def infer_schema(text: str) -> dict[str, Any]:
    t = _norm(text)
    domain = detect_domain(t)
    names: list[str] = []

    m = LIST_INTRO_RE.search(t)
    if m:
        parts = re.split(r",|;|\band\b|&|/", m.group(2))
        names = [_clean_field(p) for p in parts if 1 < len(p.strip()) <= 40]

    source = "user_text"
    if not names and domain:
        names, source = DOMAIN_PRESETS[domain], "domain_preset"

    seen: set[str] = set()
    fields: list[dict[str, Any]] = []
    core_matches: list[dict[str, str]] = []

    for n in names:
        key = n.lower()
        if not n or key in seen:
            continue
        seen.add(key)
        core = core_match(n)
        if core:
            # already provided by a core field: don't duplicate it
            if source == "user_text" and not any(c["core_field"] == core for c in core_matches):
                core_matches.append({"requested": n, "core_field": core})
            continue
        fields.append({"name": n, "type": _field_type(n), "required": False, "suggested": False})

    # add preset fields the user didn't mention, flagged as suggestions
    if domain and source == "user_text":
        for n in DOMAIN_PRESETS[domain]:
            key = n.lower()
            if key in seen or core_match(n):
                continue
            seen.add(key)
            fields.append({"name": n, "type": _field_type(n), "required": False, "suggested": True})

    nm = NAME_RE.search(t)
    if nm:
        inventory_name = nm.group(1).strip().title() + " Inventory"
    elif domain:
        inventory_name = f"{domain.title()} Inventory"
    else:
        inventory_name = "New Inventory"

    return {
        "inventory_name": inventory_name,
        "domain": domain,
        "fields": fields,
        "core_matches": core_matches,
        "source": source,
    }

