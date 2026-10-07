# Smart Vision Cart

A prototype AI self-checkout cart using:

- Python
- Flask
- OpenCV
- YOLO11 object detection
- Browser webcam
- Object-only image cropping
- Dynamic cart and quantity management
- Automatic total calculation
- Dynamic UPI QR generation

## How it works

1. Browser opens the camera.
2. User places one product in front of the camera.
3. "Capture & Add" sends the camera image to the Flask server.
4. YOLO detects the highest-confidence object.
5. The backend crops ONLY the detected object and saves it.
6. The detected product is added to the cart.
7. Cart shows product image, quantity, price and subtotal.
8. Checkout calculates the final amount.
9. A dynamic UPI QR is generated for that exact amount.

## Setup

Create a virtual environment if desired:

```bash
python -m venv venv
```

Windows:

```bash
venv\Scripts\activate
```

Install:

```bash
pip install -r requirements.txt
```

Run:

```bash
python app.py
```

Open:

```text
http://127.0.0.1:5000
```

The first run automatically downloads `yolo11n.pt`.

## Important: product prices

The standard YOLO model recognizes generic object classes. It does NOT know your shop's exact product SKU or price.

Edit the `PRODUCTS` dictionary in `app.py` to map detected classes to your products and prices.

For a real supermarket, use a custom-trained YOLO model with your actual product classes, for example:

- Cadbury Dairy Milk
- Lays Classic
- Coca-Cola 500ml
- Parle-G
- etc.

## Important: UPI

Open `static/app.js` and change:

```javascript
const MERCHANT_UPI_ID = "yourupi@bank";
```

to the merchant's real UPI ID.

The QR contains a UPI payment URI with the calculated cart amount. This is suitable for a prototype/demo. For production payment confirmation, integrate a proper payment gateway and verify payment server-side rather than trusting the QR scan alone.

## Notes

- The current implementation selects the highest-confidence object in each captured frame.
- It intentionally works best with ONE product visible at a time.
- If multiple objects are visible, the user should capture again with the intended product centered/isolated.
- For automatic multi-item shopping, add object tracking and a custom product-recognition model.
