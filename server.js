const express = require("express");
const mongoose = require("mongoose");

const mongoURI = "mongodb://localhost:27017/productstore";

// Connect to MongoDB using Mongoose
mongoose
  .connect(mongoURI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Define the Product schema and model
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  inStock: { type: Boolean, required: true },
});

const Product = mongoose.model("Product", productSchema);

// Custom error classes
class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
    this.status = 404;
  }
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
    this.status = 400;
  }
}

const app = express();

app.use(express.json()); // Parses incoming JSON

// Logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// API Key middleware
const checkApiKey = (req, res, next) => {
  const apikey = req.headers["myproduct-api-key"];
  if (apikey !== "myproduct-secret-key") {
    return res.status(403).json({ message: "Forbidden - Invalid API KEY" });
  }
  next();
};

// Request body validation
const validateProduct = (req, res, next) => {
  const { name, description, price, category, inStock } = req.body;

  if (
    typeof name !== "string" || name.trim() === "" ||
    typeof description !== "string" || description.trim() === "" ||
    typeof category !== "string" || category.trim() === "" ||
    typeof price !== "number" ||
    typeof inStock !== "boolean"
  ) {
    return next(new ValidationError("Invalid product data"));
  }

  next(); // continue to route handler
};

const PORT = 3000;

// Base route
app.get("/", (req, res) => {
  res.send("Hello World! 🥳");
});

// GET all products (with pagination and filtering)
app.get("/api/products", async (req, res, next) => {
  try {
    let { page = 1, limit = 10, category, inStock } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    const query = {};

    if (category) query.category = category;
    if (inStock !== undefined) query.inStock = inStock === "true";

    const products = await Product.find(query)
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Product.countDocuments(query);

    res.json({ page, limit, total, data: products });
  } catch (err) {
    next(err);
  }
});

// GET one product by ID
app.get("/api/products/:id", async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return next(new NotFoundError("Product not found"));
    res.json(product);
  } catch (err) {
    next(err);
  }
});

// POST new product
app.post("/api/products", checkApiKey, validateProduct, async (req, res, next) => {
  try {
    const newProduct = new Product(req.body);
    const savedProduct = await newProduct.save();
    res.status(201).json(savedProduct);
  } catch (err) {
    next(err);
  }
});

// PUT (update) a product
app.put("/api/products/:id", checkApiKey, validateProduct, async (req, res, next) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedProduct) return next(new NotFoundError("Product not found"));
    res.json(updatedProduct);
  } catch (err) {
    next(err);
  }
});

// DELETE a product
app.delete("/api/products/:id", checkApiKey, async (req, res, next) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) return next(new NotFoundError("Product not found"));
    res.json({ message: "Product deleted", product: deletedProduct });
  } catch (err) {
    next(err);
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.status) {
    res.status(err.status).json({ error: err.name, message: err.message });
  } else {
    res.status(500).json({
      error: "InternalServerError",
      message: "Something went wrong!",
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  });