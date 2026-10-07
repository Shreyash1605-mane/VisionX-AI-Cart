const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const startBtn = document.getElementById("startBtn");
const captureBtn = document.getElementById("captureBtn");
const statusEl = document.getElementById("status");
const detectedEl = document.getElementById("detected");
const cartList = document.getElementById("cartList");
const itemCountEl = document.getElementById("itemCount");
const totalEl = document.getElementById("total");
const checkoutBtn = document.getElementById("checkoutBtn");
const clearBtn = document.getElementById("clearBtn");

let stream = null;
let cart = [];

async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        });
        video.srcObject = stream;
        statusEl.textContent = "Camera active";
        statusEl.style.background = "#e7f7ed";
        startBtn.textContent = "Camera Running";
    } catch (err) {
        statusEl.textContent = "Camera permission required";
        alert("Camera could not be opened. Allow camera permission in your browser.");
    }
}

startBtn.addEventListener("click", startCamera);

captureBtn.addEventListener("click", async () => {
    if (!stream) {
        await startCamera();
        if (!stream) return;
    }

    captureBtn.disabled = true;
    statusEl.textContent = "AI analyzing...";

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
        const form = new FormData();
        form.append("image", blob, "camera.jpg");

        try {
            const response = await fetch("/detect", { method: "POST", body: form });
            const data = await response.json();

            if (!data.success) {
                alert(data.error);
                statusEl.textContent = "No object detected";
                return;
            }

            // The server has already cropped and saved ONLY the detected object.
            addToCart(data);

            detectedEl.classList.remove("hidden");
            const priceSource = data.online_price
                ? `Online price (${data.online_price.source})`
                : "Catalog fallback price";
            detectedEl.innerHTML =
                `<strong>Detected:</strong> ${data.name} &nbsp; | &nbsp; ` +
                `<strong>Confidence:</strong> ${data.confidence}% &nbsp; | &nbsp; ` +
                `<strong>Price:</strong> ₹${Number(data.price).toFixed(2)} ` +
                `<small>${priceSource}</small>`;

            statusEl.textContent = "Product added to cart";
        } catch (err) {
            console.error(err);
            alert("Could not connect to the AI server.");
            statusEl.textContent = "Server error";
        } finally {
            captureBtn.disabled = false;
        }
    }, "image/jpeg", 0.90);
});

function addToCart(product) {
    const existing = cart.find(x => x.name === product.name);

    if (existing) {
        existing.qty += 1;
    } else {
        cart.push({
            id: Date.now() + Math.random(),
            name: product.name,
            price: Number(product.price),
            image: product.image,
            confidence: product.confidence,
            qty: 1
        });
    }
    renderCart();
}

function renderCart() {
    cartList.innerHTML = "";

    if (cart.length === 0) {
        cartList.innerHTML = '<div class="empty">No products added yet.</div>';
    }

    let total = 0;
    let count = 0;

    cart.forEach(item => {
        total += item.price * item.qty;
        count += item.qty;

        const row = document.createElement("div");
        row.className = "cart-item";
        row.innerHTML = `
            <img src="${item.image}">
            <div class="item-info">
                <strong>${item.name}</strong>
                <small>₹${item.price.toFixed(2)} each</small>
            </div>
            <div class="qty">
                <button onclick="changeQty('${item.id}', -1)">−</button>
                <strong>${item.qty}</strong>
                <button onclick="changeQty('${item.id}', 1)">+</button>
            </div>
            <strong>₹${(item.price * item.qty).toFixed(2)}</strong>
        `;
        cartList.appendChild(row);
    });

    itemCountEl.textContent = count;
    totalEl.textContent = total.toFixed(2);
    checkoutBtn.disabled = count === 0;
}

window.changeQty = function(id, delta) {
    const item = cart.find(x => String(x.id) === String(id));
    if (!item) return;

    item.qty += delta;
    if (item.qty <= 0) {
        cart = cart.filter(x => String(x.id) !== String(id));
    }
    renderCart();
};

clearBtn.addEventListener("click", () => {
    cart = [];
    renderCart();
    detectedEl.classList.add("hidden");
    statusEl.textContent = "Cart cleared";
});

// Replace this with the merchant's real UPI ID.
const MERCHANT_UPI_ID = "yourupi@bank";
const MERCHANT_NAME = "Smart Vision Cart";

checkoutBtn.addEventListener("click", () => {
    const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

    if (total <= 0) return;

    document.getElementById("payAmount").textContent = total.toFixed(2);

    // Dynamic UPI payment URI.
    const upiUrl =
        `upi://pay?pa=${encodeURIComponent(MERCHANT_UPI_ID)}` +
        `&pn=${encodeURIComponent(MERCHANT_NAME)}` +
        `&am=${total.toFixed(2)}` +
        `&cu=INR` +
        `&tn=${encodeURIComponent("Smart Vision Cart Purchase")}`;

    document.getElementById("upiText").textContent = upiUrl;

    const qr = document.getElementById("qrcode");
    qr.innerHTML = "";
    new QRCode(qr, {
        text: upiUrl,
        width: 230,
        height: 230,
        correctLevel: QRCode.CorrectLevel.M
    });

    document.getElementById("paymentPanel").classList.remove("hidden");
});

document.getElementById("closePayment").addEventListener("click", () => {
    document.getElementById("paymentPanel").classList.add("hidden");
});

document.getElementById("newTransaction").addEventListener("click", () => {
    document.getElementById("paymentPanel").classList.add("hidden");
    cart = [];
    renderCart();
    detectedEl.classList.add("hidden");
    statusEl.textContent = "Ready for next customer";
});

// Automatically request camera on page load.
startCamera();
