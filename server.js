
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database
const db = new Database("digitalpro.db");

db.pragma("journal_mode = WAL");


function addColumnIfMissing(table, column, definition) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();

    if (!columns.some(item => item.name === column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
}

addColumnIfMissing("products", "category", "TEXT DEFAULT 'Digital'");
addColumnIfMissing("products", "image", "TEXT");
addColumnIfMissing("products", "featured", "INTEGER DEFAULT 0");

const productData = require("./data-products.json");


// Create products table
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    file_name TEXT NOT NULL,
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_email TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );
`);

// Insert initial products only if database is empty
const productCount = db.prepare(
  "SELECT COUNT(*) AS total FROM products"
).get();

if (productCount.total === 0) {
  const insert = db.prepare(`
    INSERT INTO products
    (name, description, price, file_name)
    VALUES (?, ?, ?, ?)
  `);

  insert.run(
    "Social Media Business Kit",
    "A practical guide to building your social media business.",
    9,
    "social-media-business-kit.pdf"
  );

  insert.run(
    "Instagram Design Pack",
    "20 creative Instagram design ideas and guides.",
    7,
    "instagram-design-pack-guide.pdf"
  );

  insert.run(
    "AI Prompts for Business",
    "Useful AI prompts for business owners.",
    5,
    "ai-prompts-for-business.pdf"
  );

  insert.run(
    "Complete Digital Bundle",
    "All four DigitalPro KS digital products in one bundle.",
    15,
    "complete-digital-bundle.pdf"
  );
}

const updateProductMetadata = db.prepare(`
    UPDATE products
    SET category = ?,
        image = ?,
        featured = ?
    WHERE id = ?
`);

for (const item of productData) {
    updateProductMetadata.run(
        item.category,
        item.image,
        item.featured ? 1 : 0,
        item.id
    );
}

// API: Home
app.get("/api", (req, res) => {
  res.json({
    message: "Welcome to DigitalPro KS API",
    status: "running"
  });
});


app.get("/api/products", (req, res) => {
    const products = db.prepare(`
        SELECT id, name, category, description, price,
               file_name, image, featured
        FROM products
        WHERE active = 1
        ORDER BY id DESC
    `).all();

    res.json(products.map(product => ({
        id: product.id,
        name: product.name,
        category: product.category,
        description: product.description,
        price: product.price,
        currency: "EUR",
        file: product.file_name,
        image: product.image,
        featured: Boolean(product.featured)
    })));
});


// API: Create pending order
app.post("/api/orders", (req, res) => {
  const { email, productId } = req.body;

  if (!email || !productId) {
    return res.status(400).json({
      error: "Email and product ID are required."
    });
  }

  const product = db.prepare(`
    SELECT * FROM products
    WHERE id = ? AND active = 1
  `).get(productId);

  if (!product) {
    return res.status(404).json({
      error: "Product not found."
    });
  }

  const result = db.prepare(`
    INSERT INTO orders (customer_email, product_id, amount)
    VALUES (?, ?, ?)
  `).run(email, product.id, product.price);

  res.status(201).json({
    message: "Order created. Payment is still pending.",
    orderId: result.lastInsertRowid,
    status: "pending"
  });
});


// ================================
// ADMIN AUTHENTICATION
// ================================

const loginAttempts = new Map();

const SESSION_COOKIE = "digitalpro_admin";
const SESSION_DURATION = 8 * 60 * 60 * 1000;

function createAdminToken() {
    const payload = Buffer.from(JSON.stringify({
        expiresAt: Date.now() + SESSION_DURATION
    })).toString("base64url");

    const signature = crypto
        .createHmac("sha256", process.env.ADMIN_SESSION_SECRET)
        .update(payload)
        .digest("hex");

    return `${payload}.${signature}`;
}

function requireAdmin(req, res, next) {
    const cookieHeader = req.headers.cookie || "";

    const cookie = cookieHeader
        .split(";")
        .map(item => item.trim())
        .find(item => item.startsWith(SESSION_COOKIE + "="));

    if (!cookie) {
        return res.status(401).json({
            error: "Administrator login required."
        });
    }

    try {
        const token = decodeURIComponent(
            cookie.substring(SESSION_COOKIE.length + 1)
        );

        const parts = token.split(".");

        if (parts.length !== 2) {
            throw new Error("Invalid token");
        }

        const [payload, signature] = parts;

        if (!/^[a-f0-9]{64}$/i.test(signature)) {
            throw new Error("Invalid signature");
        }

        const expectedSignature = crypto
            .createHmac("sha256", process.env.ADMIN_SESSION_SECRET)
            .update(payload)
            .digest("hex");

        if (!crypto.timingSafeEqual(
            Buffer.from(signature, "hex"),
            Buffer.from(expectedSignature, "hex")
        )) {
            throw new Error("Invalid signature");
        }

        const session = JSON.parse(
            Buffer.from(payload, "base64url").toString("utf8")
        );

        if (!session.expiresAt || session.expiresAt < Date.now()) {
            throw new Error("Session expired");
        }

        next();

    } catch {
        return res.status(401).json({
            error: "Invalid or expired admin session."
        });
    }
}

// ADMIN LOGIN
app.post("/api/admin/login", (req, res) => {
    const { password } = req.body;

    if (
        !process.env.ADMIN_PASSWORD_SALT ||
        !process.env.ADMIN_PASSWORD_HASH ||
        !process.env.ADMIN_SESSION_SECRET
    ) {
        return res.status(503).json({
            error: "Admin authentication is not configured."
        });
    }

    const ip = req.ip;
    const now = Date.now();

    let attempts = loginAttempts.get(ip);

    if (!attempts || now - attempts.startedAt > 15 * 60 * 1000) {
        attempts = {
            count: 0,
            startedAt: now
        };
    }

    if (attempts.count >= 5) {
        return res.status(429).json({
            error: "Too many attempts. Try again in 15 minutes."
        });
    }

    if (typeof password !== "string" || password.length === 0) {
        return res.status(400).json({
            error: "Password is required."
        });
    }

    const submittedHash = crypto.scryptSync(
        password,
        process.env.ADMIN_PASSWORD_SALT,
        64
    );

    const storedHash = Buffer.from(
        process.env.ADMIN_PASSWORD_HASH,
        "hex"
    );

    const valid =
        storedHash.length === 64 &&
        crypto.timingSafeEqual(submittedHash, storedHash);

    if (!valid) {
        attempts.count++;
        loginAttempts.set(ip, attempts);

        return res.status(401).json({
            error: "Incorrect administrator password."
        });
    }

    loginAttempts.delete(ip);

    const token = createAdminToken();

    const secure = process.env.NODE_ENV === "production"
        ? "; Secure"
        : "";

    res.setHeader(
        "Set-Cookie",
        `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}`
    );

    res.setHeader("Cache-Control", "no-store");

    res.json({
        message: "Admin login successful."
    });
});

// CHECK ADMIN SESSION
app.get("/api/admin/me", requireAdmin, (req, res) => {
    res.setHeader("Cache-Control", "no-store");

    res.json({
        authenticated: true,
        role: "admin"
    });
});

// ADMIN LOGOUT
app.post("/api/admin/logout", (req, res) => {
    const secure = process.env.NODE_ENV === "production"
        ? "; Secure"
        : "";

    res.setHeader(
        "Set-Cookie",
        `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`
    );

    res.json({
        message: "Logged out successfully."
    });
});


function validateProduct(data) {
    const { name, description, category, price, file_name, image, featured } = data;

    if (
        typeof name !== "string" || !name.trim() ||
        typeof description !== "string" ||
        typeof category !== "string" || !category.trim() ||
        !Number.isFinite(Number(price)) || Number(price) <= 0 ||
        typeof file_name !== "string" ||
        file_name !== path.basename(file_name) ||
        !file_name.toLowerCase().endsWith(".pdf") ||
        typeof image !== "string" ||
        typeof featured !== "boolean"
    ) {
        return false;
    }

    if (image.trim()) {
        try {
            const parsed = new URL(image);
            if (parsed.protocol !== "https:") return false;
        } catch {
            return false;
        }
    }

    return true;
}

// GET ADMIN PRODUCTS
app.get("/api/admin/products", requireAdmin, (req, res) => {
    const products = db.prepare(`
        SELECT * FROM products ORDER BY id DESC
    `).all();

    res.json(products);
});

// ADD PRODUCT
app.post("/api/admin/products", requireAdmin, (req, res) => {
    const data = req.body;

    if (!validateProduct(data)) {
        return res.status(400).json({
            error: "Invalid product information."
        });
    }

    const result = db.prepare(`
        INSERT INTO products
        (name, description, price, file_name, category, image, featured, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
        data.name.trim(),
        data.description.trim(),
        Number(data.price),
        data.file_name,
        data.category.trim(),
        data.image.trim(),
        data.featured ? 1 : 0
    );

    res.status(201).json({
        message: "Product added successfully.",
        id: result.lastInsertRowid
    });
});

// EDIT PRODUCT
app.put("/api/admin/products/:id", requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const data = req.body;

    if (!Number.isInteger(id) || id <= 0 || !validateProduct(data)) {
        return res.status(400).json({
            error: "Invalid product information."
        });
    }

    const result = db.prepare(`
        UPDATE products
        SET name = ?,
            description = ?,
            price = ?,
            file_name = ?,
            category = ?,
            image = ?,
            featured = ?
        WHERE id = ?
    `).run(
        data.name.trim(),
        data.description.trim(),
        Number(data.price),
        data.file_name,
        data.category.trim(),
        data.image.trim(),
        data.featured ? 1 : 0,
        id
    );

    if (!result.changes) {
        return res.status(404).json({
            error: "Product not found."
        });
    }

    res.json({ message: "Product updated successfully." });
});

// DEACTIVATE PRODUCT
app.delete("/api/admin/products/:id", requireAdmin, (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid product ID." });
    }

    const result = db.prepare(`
        UPDATE products SET active = 0 WHERE id = ?
    `).run(id);

    if (!result.changes) {
        return res.status(404).json({
            error: "Product not found."
        });
    }

    res.json({ message: "Product deactivated successfully." });
});

// VIEW ORDERS
app.get("/api/admin/orders", requireAdmin, (req, res) => {
    const orders = db.prepare(`
        SELECT
            orders.id,
            orders.customer_email,
            orders.amount,
            orders.status,
            orders.created_at,
            products.name AS product_name
        FROM orders
        LEFT JOIN products ON products.id = orders.product_id
        ORDER BY orders.id DESC
    `).all();

    res.json(orders);
});



// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// Start server
app.listen(PORT, () => {
  console.log(`DigitalPro KS running at http://localhost:${PORT}`);
});
