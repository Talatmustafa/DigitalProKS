
const loginForm = document.getElementById("loginForm");
const loginSection = document.getElementById("loginSection");
const dashboardSection = document.getElementById("dashboardSection");
const loginMessage = document.getElementById("loginMessage");
const logoutBtn = document.getElementById("logoutBtn");

const productList = document.getElementById("productList");
const orderList = document.getElementById("orderList");

const productFormContainer = document.getElementById("productFormContainer");
const productForm = document.getElementById("productForm");

let products = [];

function showDashboard() {
    loginSection.hidden = true;
    dashboardSection.hidden = false;
    loadDashboard();
}

function showLogin() {
    loginSection.hidden = false;
    dashboardSection.hidden = true;
}

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json",
            ...options.headers
        }
    });

    const data = await response.json();

    if (response.status === 401) {
        showLogin();
        throw new Error("Your session has expired. Please log in again.");
    }

    if (!response.ok) {
        throw new Error(data.error || "Request failed.");
    }

    return data;
}

async function checkAdminSession() {
    try {
        await apiRequest("/api/admin/me");
        showDashboard();
    } catch {
        showLogin();
    }
}

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const password = document.getElementById("adminPassword").value;

    loginMessage.textContent = "Checking password...";

    try {
        await apiRequest("/api/admin/login", {
            method: "POST",
            body: JSON.stringify({ password })
        });

        document.getElementById("adminPassword").value = "";
        loginMessage.textContent = "";

        showDashboard();

    } catch (error) {
        loginMessage.textContent = error.message;
    }
});

logoutBtn.addEventListener("click", async () => {
    try {
        await apiRequest("/api/admin/logout", {
            method: "POST"
        });
    } finally {
        showLogin();
    }
});

// LOAD DASHBOARD
async function loadDashboard() {
    try {
        await Promise.all([
            loadProducts(),
            loadOrders()
        ]);
    } catch (error) {
        console.error(error);
        alert(error.message);
    }
}

// LOAD PRODUCTS
async function loadProducts() {
    products = await apiRequest("/api/admin/products");

    document.getElementById("totalProducts").textContent =
        products.filter(product => product.active === 1).length;

    productList.innerHTML = "";

    products.forEach(product => {
        const card = document.createElement("div");
        card.className = "admin-product-card";

        const name = document.createElement("h3");
        name.textContent = product.name;

        const details = document.createElement("p");
        details.textContent =
            `${product.category} | €${Number(product.price).toFixed(2)} | ${
                product.active === 1 ? "Active" : "Inactive"
            }`;

        const editButton = document.createElement("button");
        editButton.textContent = "Edit";
        editButton.addEventListener("click", () => editProduct(product.id));

        const deactivateButton = document.createElement("button");
        deactivateButton.textContent = "Deactivate";
        deactivateButton.disabled = product.active !== 1;
        deactivateButton.addEventListener("click", () => deactivateProduct(product.id));

        card.append(name, details, editButton, deactivateButton);
        productList.appendChild(card);
    });
}

// LOAD ORDERS
async function loadOrders() {
    const orders = await apiRequest("/api/admin/orders");

    document.getElementById("totalOrders").textContent = orders.length;

    document.getElementById("pendingOrders").textContent =
        orders.filter(order => order.status === "pending").length;

    orderList.innerHTML = "";

    if (orders.length === 0) {
        orderList.textContent = "No orders yet.";
        return;
    }

    orders.forEach(order => {
        const row = document.createElement("div");
        row.className = "admin-order-card";

        row.textContent =
            `#${order.id} | ${order.customer_email} | ` +
            `${order.product_name || "Product unavailable"} | ` +
            `€${Number(order.amount).toFixed(2)} | ${order.status}`;

        orderList.appendChild(row);
    });
}

// OPEN ADD FORM
document.getElementById("addProductBtn").addEventListener("click", () => {
    productForm.reset();
    document.getElementById("productId").value = "";
    document.getElementById("productFormTitle").textContent = "Add Product";
    document.getElementById("productFormMessage").textContent = "";
    productFormContainer.hidden = false;
});

// EDIT PRODUCT
function editProduct(id) {
    const product = products.find(item => item.id === id);

    if (!product) return;

    document.getElementById("productId").value = product.id;
    document.getElementById("productName").value = product.name;
    document.getElementById("productDescription").value = product.description || "";
    document.getElementById("productCategory").value = product.category || "";
    document.getElementById("productPrice").value = product.price;
    document.getElementById("productFile").value = product.file_name;
    document.getElementById("productImage").value = product.image || "";
    document.getElementById("productFeatured").checked = product.featured === 1;

    document.getElementById("productFormTitle").textContent = "Edit Product";
    document.getElementById("productFormMessage").textContent = "";

    productFormContainer.hidden = false;
}

// SAVE PRODUCT
productForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const id = document.getElementById("productId").value;

    const product = {
        name: document.getElementById("productName").value.trim(),
        description: document.getElementById("productDescription").value.trim(),
        category: document.getElementById("productCategory").value.trim(),
        price: Number(document.getElementById("productPrice").value),
        file_name: document.getElementById("productFile").value.trim(),
        image: document.getElementById("productImage").value.trim(),
        featured: document.getElementById("productFeatured").checked
    };

    try {
        const url = id
            ? `/api/admin/products/${id}`
            : "/api/admin/products";

        await apiRequest(url, {
            method: id ? "PUT" : "POST",
            body: JSON.stringify(product)
        });

        productFormContainer.hidden = true;
        productForm.reset();

        await loadProducts();

        alert("Product saved successfully.");

    } catch (error) {
        document.getElementById("productFormMessage").textContent =
            error.message;
    }
});

// DEACTIVATE PRODUCT
async function deactivateProduct(id) {
    if (!confirm("Are you sure you want to deactivate this product?")) {
        return;
    }

    try {
        await apiRequest(`/api/admin/products/${id}`, {
            method: "DELETE"
        });

        await loadProducts();

        alert("Product deactivated successfully.");

    } catch (error) {
        alert(error.message);
    }
}

// CANCEL FORM
document.getElementById("cancelProductBtn").addEventListener("click", () => {
    productFormContainer.hidden = true;
    productForm.reset();
});

checkAdminSession();
