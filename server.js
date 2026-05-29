const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const Razorpay = require("razorpay");

// Load Environment Variables
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 8000;

// Initialize Razorpay SDK using credentials from environment
let razorpay = null;
try {
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    console.log("⚡ [AlgoFlow Server] Razorpay SDK initialized successfully with active credentials.");
  } else {
    console.warn("⚠️ [AlgoFlow Server] Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET in environment. Payments will run in simulation mode.");
  }
} catch (e) {
  console.error("❌ [AlgoFlow Server] Failed to initialize Razorpay SDK:", e);
}

// Middleware
app.use(cors());
app.use(express.json());

// Log incoming API requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Serve static dashboard files and PDF catalog
app.use(express.static(__dirname));

/**
 * GET /api/config
 * Exposes only the public Razorpay Key ID so the frontend can register checkout modals dynamically
 */
app.get("/api/config", (req, res) => {
  if (process.env.RAZORPAY_KEY_ID) {
    res.status(200).json({ keyId: process.env.RAZORPAY_KEY_ID });
  } else {
    res.status(404).json({ error: "Razorpay Key ID not configured on the server." });
  }
});

/**
 * POST /api/create-order
 * Contacts Razorpay API securely using credentials to generate a secure transaction order
 */
app.post("/api/create-order", async (req, res) => {
  try {
    const { amount, currency, receipt } = req.body;

    // Validate request parameters
    if (!amount) {
      return res.status(400).json({ error: "Missing required parameter 'amount' in request body." });
    }

    const amountInPaise = parseInt(amount, 10);
    if (isNaN(amountInPaise) || amountInPaise < 100) {
      return res.status(400).json({ error: "Transaction amount must be a valid number and at least 100 paise (₹1.00)." });
    }

    if (!razorpay) {
      return res.status(401).json({ error: "Razorpay API credentials are not initialized or authorized on this server." });
    }

    let finalReceipt = receipt || `rzp_${Date.now()}`;
    if (finalReceipt.length > 40) {
      finalReceipt = finalReceipt.substring(0, 40);
    }

    const options = {
      amount: amountInPaise,
      currency: currency || "INR",
      receipt: finalReceipt
    };

    console.log(`[AlgoFlow Server] Sending Order request to Razorpay:`, options);

    // Call Razorpay API to generate order
    const order = await razorpay.orders.create(options);
    
    console.log(`[AlgoFlow Server] Order created successfully on Razorpay:`, order.id);

    return res.status(200).json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency
    });
  } catch (error) {
    console.error("❌ [AlgoFlow Server] Razorpay Order Creation Error:", error);
    
    // Return standard structured 500 error
    return res.status(500).json({
      error: "An internal server error occurred while creating Razorpay order.",
      details: error.message || error
    });
  }
});

/**
 * POST /api/verify-payment
 * Cryptographically verifies signature of transaction payloads using HMAC-SHA256 signature matching
 */
app.post("/api/verify-payment", (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Validate request parameters
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        error: "Missing required verification parameters. Must provide 'razorpay_order_id', 'razorpay_payment_id', and 'razorpay_signature'."
      });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return res.status(500).json({ error: "Razorpay Key Secret is not configured on the server." });
    }

    // Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
    const signPayload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac("sha256", secret)
      .update(signPayload)
      .digest("hex");

    console.log("[AlgoFlow Server] Cryptographic Signature comparison:");
    console.log(` -> Received:  ${razorpay_signature}`);
    console.log(` -> Generated: ${generatedSignature}`);

    if (generatedSignature === razorpay_signature) {
      console.log("🟢 [AlgoFlow Server] Signature matched! Payment transaction verified.");
      return res.status(200).json({
        success: true,
        message: "Razorpay Standard Web Checkout signature matched and verified successfully."
      });
    } else {
      console.error("❌ [AlgoFlow Server] Signature mismatch. Unverified transaction rejected.");
      return res.status(400).json({
        success: false,
        error: "Signature mismatch. Cryptographic transaction authentication failed."
      });
    }
  } catch (error) {
    console.error("❌ [AlgoFlow Server] Payment Signature Verification Error:", error);
    return res.status(500).json({
      error: "An internal server error occurred while verifying the payment signature.",
      details: error.message || error
    });
  }
});

// Fallback: serve index.html for all other routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Start Express Listener
app.listen(PORT, () => {
  console.log(`\n🚀 ===============================================================`);
  console.log(`⚡ [AlgoFlow Full-Stack Server] is active!`);
  console.log(`👉 Serving Dashboard at: http://localhost:${PORT}`);
  console.log(`👉 API Endpoint Config:  http://localhost:${PORT}/api/config`);
  console.log(`===================================================================\n`);
});
