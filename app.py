from flask import Flask, render_template, request, jsonify, send_from_directory
from ultralytics import YOLO
import cv2
import numpy as np
import os
import uuid
import re
from html.parser import HTMLParser
from urllib.parse import quote_plus
from urllib.request import Request, urlopen

app = Flask(__name__)

MODEL_PATH = "yolo11n.pt"
model = YOLO(MODEL_PATH)

CAPTURE_DIR = os.path.join("captured_objects")
os.makedirs(CAPTURE_DIR, exist_ok=True)

# Demo product catalog. Change these according to your store.
PRODUCTS = {
    "bottle": {"name": "Water Bottle", "price": 20.0},
    "cup": {"name": "Cup", "price": 30.0},
    "banana": {"name": "Banana", "price": 10.0},
    "apple": {"name": "Apple", "price": 20.0},
    "orange": {"name": "Orange", "price": 15.0},
    "book": {"name": "Book", "price": 100.0},
    "laptop": {"name": "Laptop", "price": 50000.0},
    "cell phone": {"name": "Mobile Phone", "price": 15000.0},
    "backpack": {"name": "Backpack", "price": 800.0},
    "keyboard": {"name": "Keyboard", "price": 1200.0},
    "mouse": {"name": "Mouse", "price": 600.0},
    "remote": {"name": "Remote", "price": 500.0},
}

# Fallback prices for other common YOLO classes.
DEFAULT_PRICE = 50.0


class SearchTextParser(HTMLParser):
    """Collect visible text from a search result page."""

    def __init__(self):
        super().__init__()
        self.text = []

    def handle_data(self, data):
        if data.strip():
            self.text.append(data.strip())


def find_online_price(product_name):
    """Find an INR price from public search snippets, or return no result."""
    query = quote_plus(f"{product_name} price India")
    request = Request(
        f"https://html.duckduckgo.com/html/?q={query}",
        headers={"User-Agent": "Mozilla/5.0 SmartVisionCart/1.0"},
    )

    try:
        with urlopen(request, timeout=5) as response:
            parser = SearchTextParser()
            parser.feed(response.read().decode("utf-8", errors="ignore"))
    except Exception:
        return None

    text = " ".join(parser.text)
    price_match = re.search(
        r"(?:₹|Rs\.?|INR)\s*([0-9][0-9,]*(?:\.\d{1,2})?)",
        text,
        re.IGNORECASE,
    )
    if not price_match:
        return None

    price = float(price_match.group(1).replace(",", ""))
    if price <= 0:
        return None

    return {
        "price": price,
        "source": "DuckDuckGo product search",
        "query": f"{product_name} price India",
    }

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/detect", methods=["POST"])
def detect():
    if "image" not in request.files:
        return jsonify({"success": False, "error": "No image received"}), 400

    file = request.files["image"]
    data = np.frombuffer(file.read(), np.uint8)
    frame = cv2.imdecode(data, cv2.IMREAD_COLOR)

    if frame is None:
        return jsonify({"success": False, "error": "Invalid image"}), 400

    results = model.predict(frame, conf=0.45, verbose=False)
    result = results[0]

    if result.boxes is None or len(result.boxes) == 0:
        return jsonify({
            "success": False,
            "error": "No object detected. Place one product clearly in front of the camera."
        })

    # Select the highest-confidence detected object.
    best_idx = int(result.boxes.conf.argmax().item())
    box = result.boxes.xyxy[best_idx].cpu().numpy().astype(int)
    confidence = float(result.boxes.conf[best_idx].item())
    class_id = int(result.boxes.cls[best_idx].item())
    label = model.names[class_id]

    x1, y1, x2, y2 = box.tolist()
    h, w = frame.shape[:2]

    # Clamp coordinates.
    x1, x2 = max(0, x1), min(w, x2)
    y1, y2 = max(0, y1), min(h, y2)

    if x2 <= x1 or y2 <= y1:
        return jsonify({"success": False, "error": "Invalid detected object region"})

    # Capture ONLY the detected object.
    object_crop = frame[y1:y2, x1:x2]
    filename = f"{uuid.uuid4().hex}.jpg"
    filepath = os.path.join(CAPTURE_DIR, filename)
    cv2.imwrite(filepath, object_crop)

    product = PRODUCTS.get(label.lower(), {
        "name": label.title(),
        "price": DEFAULT_PRICE
    })
    online_price = find_online_price(product["name"])
    display_price = online_price["price"] if online_price else product["price"]

    return jsonify({
        "success": True,
        "label": label,
        "confidence": round(confidence * 100, 1),
        "name": product["name"],
        "price": display_price,
        "catalog_price": product["price"],
        "online_price": online_price,
        "image": f"/captured_objects/{filename}",
        "box": [x1, y1, x2, y2]
    })

@app.route("/captured_objects/<filename>")
def captured_object(filename):
    return send_from_directory(CAPTURE_DIR, filename)

if __name__ == "__main__":
    print("\nSmart Vision Cart running at http://127.0.0.1:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
