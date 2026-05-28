const { onRequest } = require("firebase-functions/v2/https");
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const Razorpay = require("razorpay");

const app = express();

// Configure CORS to support requests from Firebase hosting origins dynamically
app.use(cors({ origin: true }));
app.use(express.json());

// Helper to get initialized Razorpay SDK dynamically (supporting decrypted secrets at runtime)
function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID || "rzp_test_SuoPBJ2avHN0qZ";
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "ym356xZmxzaJdR4ljE67QkoU";

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });
}

/**
 * GET /api/config
 * Exposes only the public Key ID to client widgets dynamically
 */
app.get("/config", (req, res) => {
  const keyId = process.env.RAZORPAY_KEY_ID || "rzp_test_SuoPBJ2avHN0qZ";
  if (keyId) {
    return res.status(200).json({ keyId: keyId });
  } else {
    return res.status(404).json({ error: "Razorpay Key ID not configured in cloud environment variables." });
  }
});

/**
 * POST /api/create-order
 * Generates official transaction order on Razorpay servers
 */
app.post("/create-order", async (req, res) => {
  try {
    const { amount, currency, receipt } = req.body;

    if (!amount) {
      return res.status(400).json({ error: "Missing required parameter 'amount'." });
    }

    const amountInPaise = parseInt(amount, 10);
    if (isNaN(amountInPaise) || amountInPaise < 100) {
      return res.status(400).json({ error: "Transaction amount must be at least 100 paise (₹1.00)." });
    }

    const razorpayClient = getRazorpayClient();
    const options = {
      amount: amountInPaise,
      currency: currency || "INR",
      receipt: receipt || `receipt_cloud_${Date.now()}`
    };

    console.log(`[AlgoFlow Cloud Function] Calling Razorpay Orders API for amount: ${amountInPaise} paise`);
    const order = await razorpayClient.orders.create(options);
    console.log(`[AlgoFlow Cloud Function] Razorpay Order generated:`, order.id);

    return res.status(200).json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency
    });
  } catch (error) {
    console.error("❌ [AlgoFlow Cloud Function] Order Creation Failure:", error);
    return res.status(500).json({
      error: "An internal cloud execution error occurred.",
      details: error.message || error
    });
  }
});

/**
 * POST /api/verify-payment
 * Cryptographically verifies signatures using HMAC-SHA256
 */
app.post("/verify-payment", (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        error: "Missing required validation parameters: order ID, payment ID, or signature."
      });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET || "ym356xZmxzaJdR4ljE67QkoU";
    if (!secret) {
      return res.status(500).json({ error: "Razorpay Key Secret is not configured in the cloud environment." });
    }

    const signPayload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac("sha256", secret)
      .update(signPayload)
      .digest("hex");

    if (generatedSignature === razorpay_signature) {
      console.log("🟢 [AlgoFlow Cloud Function] Transaction verified successfully!");
      return res.status(200).json({
        success: true,
        message: "Payment successfully verified."
      });
    } else {
      console.error("❌ [AlgoFlow Cloud Function] Cryptographic signature validation failure.");
      return res.status(400).json({
        success: false,
        error: "Signature mismatch. Unverified transaction rejected."
      });
    }
  } catch (error) {
    console.error("❌ [AlgoFlow Cloud Function] Signature Verification Failure:", error);
    return res.status(500).json({
      error: "An internal cloud execution error occurred.",
      details: error.message || error
    });
  }
});

// Export Express Application as a standard Cloud Function named "api"
// Mounts secure environment secrets securely using Cloud Secret Manager
exports.api = onRequest({ 
  cors: true,
  secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"]
}, app);
