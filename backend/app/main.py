from pathlib import Path
import json
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[2]
FRONT = ROOT / "frontend"
PRODUCTS = json.loads((ROOT / "backend" / "products.json").read_text(encoding="utf-8"))
MATERIALS = {"Сосна": 1.0, "Берёза": 1.15, "Лиственница": 1.3, "Дуб": 1.6, "Бук": 1.4}

app = FastAPI(title="WoodMarket API")

class Calculation(BaseModel):
    product_id: int
    length: float = Field(gt=0, le=100000)
    width: float = Field(gt=0, le=100000)
    height: float = Field(gt=0, le=100000)
    material: str

class Request(Calculation):
    name: str = Field(min_length=2, max_length=100)
    phone: str = Field(min_length=7, max_length=25)
    email: str
    comment: str = Field(default="", max_length=1000)

def get_product(product_id):
    product = next((p for p in PRODUCTS if p["id"] == product_id), None)
    if product is None:
        raise HTTPException(404, "Товар не найден")
    return product

def calculate(data):
    product = get_product(data.product_id)
    if data.material not in MATERIALS:
        raise HTTPException(422, "Неизвестный материал")
    base = product["dimensions"]
    ratio = (data.length * data.width * data.height) / (base["length"] * base["width"] * base["height"])
    if ratio > 100 or ratio < .01:
        raise HTTPException(422, "Размеры выходят за пределы демонстрационного расчёта. Отправьте заявку для индивидуального расчёта.")
    return round(product["base_price"] * ratio * MATERIALS[data.material] / 100) * 100

@app.get("/api/products")
def products(q: str = "", category: str = "", material: str = "", min_price: int = 0, max_price: int = 100000000, sort: str = ""):
    result = [p for p in PRODUCTS if q.casefold() in p["name"].casefold()
              and (not category or p["category"] == category)
              and (not material or material in p["materials"])
              and min_price <= p["base_price"] <= max_price]
    if sort in ("asc", "desc"):
        result.sort(key=lambda p: p["base_price"], reverse=sort == "desc")
    return result

@app.get("/api/products/{product_id}")
def product(product_id: int):
    return get_product(product_id)

@app.get("/api/categories")
def categories():
    return [{"id": c, "name": c} for c in dict.fromkeys(p["category"] for p in PRODUCTS)]

@app.post("/api/calculate")
def calc(data: Calculation):
    return {"estimated_price": calculate(data), "currency": "RUB", "approximate": True}

@app.post("/api/requests", status_code=201)
def create_request(data: Request):
    import re
    if len(re.sub(r"\D", "", data.phone)) < 10 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", data.email):
        raise HTTPException(422, "Укажите корректный телефон и email")
    calculate(data)  # Проверяем товар, материал и размеры; данные заявки не сохраняются.
    return {"message": "Демо: заявка успешно отправлена", "demo": True}

for folder in ("css", "js", "assets"):
    app.mount("/" + folder, StaticFiles(directory=FRONT / folder), name=folder)

@app.get("/")
def home():
    return FileResponse(FRONT / "index.html")

@app.get("/{page}.html")
def page(page: str):
    if page not in {"index", "catalog", "product", "favorites"}:
        raise HTTPException(404, "Страница не найдена")
    return FileResponse(FRONT / f"{page}.html")
