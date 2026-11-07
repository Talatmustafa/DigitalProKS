
let products = [];
let cart = [];

let currentLanguage = "en";

const translations = {
    en: {
        home: "Home",
        products: "Products",
        about: "About",
        contact: "Contact",
        eyebrow: "DIGITAL PRODUCTS FOR EVERYONE",
        heroTitle: "Create. Learn.<br><span>Grow.</span>",
        heroDescription: "Discover digital tools, business guides and creative resources designed to help you grow.",
        shopNow: "Explore Products →",
        instant: "Instant Access",
        instantText: "Digital products, ready to download.",
        secure: "Secure Shopping",
        secureText: "A simple and secure shopping experience.",
        global: "Worldwide Access",
        globalText: "Resources for creators everywhere.",
        collection: "OUR COLLECTION",
        productsTitle: "Explore Our Products",
        productsDescription: "Everything you need to take your ideas further.",
        why: "WHY DIGITALPRO KS?",
        aboutTitle: "Your Ideas Deserve to Grow.",
        aboutDescription: "We create practical digital resources that help individuals, creators and businesses work smarter.",
        contactTitle: "Have a Question?",
        contactDescription: "Contact us for information about our digital products.",
        yourCart: "Your Shopping Cart",
        total: "Total:",
        emailLabel: "Your email address",
        checkout: "Continue to Checkout",
        add: "Add to Cart",
        empty: "Your cart is empty.",
        remove: "Remove"
    },
    al: {
        home: "Ballina",
        products: "Produktet",
        about: "Rreth Nesh",
        contact: "Kontakti",
        eyebrow: "PRODUKTE DIGJITALE PËR TË GJITHË",
        heroTitle: "Krijo. Mëso.<br><span>Rritu.</span>",
        heroDescription: "Zbulo mjete digjitale, udhëzues biznesi dhe materiale kreative që të ndihmojnë të zhvillohesh.",
        shopNow: "Shiko Produktet →",
        instant: "Qasje e Menjëhershme",
        instantText: "Produkte digjitale, gati për shkarkim.",
        secure: "Blerje e Sigurt",
        secureText: "Përvojë e thjeshtë dhe e sigurt blerjeje.",
        global: "Qasje Globale",
        globalText: "Materiale për krijues kudo në botë.",
        collection: "KOLEKSIONI YNË",
        productsTitle: "Eksploro Produktet",
        productsDescription: "Gjithçka që të nevojitet për t'i zhvilluar idetë e tua.",
        why: "PSE DIGITALPRO KS?",
        aboutTitle: "Idetë e Tua Meritojnë të Rriten.",
        aboutDescription: "Ne krijojmë materiale praktike digjitale për individë, krijues dhe biznese.",
        contactTitle: "Ke Pyetje?",
        contactDescription: "Na kontakto për informacione rreth produkteve tona.",
        yourCart: "Shporta Jote",
        total: "Gjithsej:",
        emailLabel: "Adresa jote e emailit",
        checkout: "Vazhdo te Pagesa",
        add: "Shto në Shportë",
        empty: "Shporta jote është bosh.",
        remove: "Largo"
    }
};

const productGrid = document.getElementById("productGrid");
const cartModal = document.getElementById("cartModal");

async function loadProducts() {
    try {
        const response = await fetch("/api/products");

        if (!response.ok) {
            throw new Error("Could not load products.");
        }

        products = await response.json();
        renderProducts();

    } catch (error) {
        productGrid.innerHTML =
            "<p>Products could not be loaded. Please try again later.</p>";

        console.error(error);
    }
}

function renderProducts() {
    productGrid.innerHTML = products.map(product => `
        <article class="product-card">
            <img
                src="${escapeHTML(product.image || "https://placehold.co/600x400?text=Digital+Product")}"
                alt="${escapeHTML(product.name)}"
            >

            <div class="product-info">
                <span class="product-category">
                    ${escapeHTML(product.category || "Digital")}
                </span>

                <h3>${escapeHTML(product.name)}</h3>

                <p>${escapeHTML(product.description || "")}</p>

                <div class="product-bottom">
                    <span class="product-price">
                        €${Number(product.price).toFixed(2)}
                    </span>

                    <button class="add-cart"
                        onclick="addToCart(${Number(product.id)})">
                        ${translations[currentLanguage].add}
                    </button>
                </div>
            </div>
        </article>
    `).join("");
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function addToCart(productId) {
    const product = products.find(item => item.id === productId);

    if (!product) return;

    const existing = cart.find(item => item.id === productId);

    if (existing) {
        existing.quantity++;
    } else {
        cart.push({ ...product, quantity: 1 });
    }

    renderCart();
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    renderCart();
}

function renderCart() {
    const cartItems = document.getElementById("cartItems");

    const count = cart.reduce(
        (sum, item) => sum + item.quantity, 0
    );

    document.getElementById("cartCount").textContent = count;

    if (cart.length === 0) {
        cartItems.innerHTML = `<p>${translations[currentLanguage].empty}</p>`;
    } else {
        cartItems.innerHTML = cart.map(item => `
            <div class="cart-item">
                <div>
                    <strong>${escapeHTML(item.name)}</strong>
                    <br>
                    €${Number(item.price).toFixed(2)} × ${item.quantity}
                </div>

                <button onclick="removeFromCart(${Number(item.id)})">
                    ${translations[currentLanguage].remove}
                </button>
            </div>
        `).join("");
    }

    const total = cart.reduce(
        (sum, item) => sum + item.price * item.quantity, 0
    );

    document.getElementById("cartTotal").textContent =
        `€${total.toFixed(2)}`;
}

function changeLanguage() {
    currentLanguage = currentLanguage === "en" ? "al" : "en";

    document.documentElement.lang = currentLanguage;

    document.querySelectorAll("[data-i18n]").forEach(element => {
        const key = element.dataset.i18n;

        if (translations[currentLanguage][key]) {
            element.innerHTML = translations[currentLanguage][key];
        }
    });

    document.getElementById("languageBtn").textContent =
        currentLanguage === "en" ? "EN / AL" : "AL / EN";

    renderProducts();
    renderCart();
}

document.getElementById("languageBtn").addEventListener(
    "click", changeLanguage
);

document.getElementById("cartBtn").addEventListener("click", () => {
    cartModal.classList.remove("hidden");
});

document.getElementById("closeCart").addEventListener("click", () => {
    cartModal.classList.add("hidden");
});

cartModal.addEventListener("click", event => {
    if (event.target === cartModal) {
        cartModal.classList.add("hidden");
    }
});

document.getElementById("checkoutForm").addEventListener(
    "submit", async event => {
        event.preventDefault();

        const email = document.getElementById("customerEmail").value;
        const message = document.getElementById("checkoutMessage");

        if (cart.length === 0) {
            message.textContent = "Your cart is empty.";
            return;
        }

        message.textContent =
            "Checkout for multiple products is not configured yet.";

        // This starter checkout only supports one product per order.
        // It creates a pending order; it does not collect payment.
        if (cart.length !== 1 || cart[0].quantity !== 1) {
            return;
        }

        try {
            const response = await fetch("/api/orders", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email,
                    productId: cart[0].id
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Order failed.");
            }

            message.textContent =
                `Order #${result.orderId} created. Payment is not active yet.`;

        } catch (error) {
            message.textContent = error.message;
        }
    }
);

renderCart();
loadProducts();
