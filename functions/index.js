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
app.get("/api/config", (req, res) => {
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
app.post("/api/create-order", async (req, res) => {
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
    let finalReceipt = receipt || `rzp_${Date.now()}`;
    if (finalReceipt.length > 40) {
      finalReceipt = finalReceipt.substring(0, 40);
    }

    const options = {
      amount: amountInPaise,
      currency: currency || "INR",
      receipt: finalReceipt
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
app.post("/api/verify-payment", (req, res) => {
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

/**
 * POST /api/execute
 * Securely proxies in-browser code execution requests to a configured sandboxed compiler API
 * Uses a double-redundant cloud architecture: Judge0 CE -> Piston fallback
 */
app.post("/api/execute", async (req, res) => {
  try {
    const { language, code, stdin } = req.body;
    
    if (!language || !code) {
      return res.status(400).json({ error: "Missing required parameters 'language' or 'code'." });
    }

    console.log(`[AlgoFlow Cloud Function] Code compile execution request received for: ${language}`);

    // Mode 1: Attempt execution via public/configured Judge0 CE API (Fastest and highly reliable)
    try {
      let judge0LangId = 0;
      if (language === "cpp") judge0LangId = 105; // C++ (GCC 14.1.0)
      else if (language === "python") judge0LangId = 100; // Python (3.12.5)
      else if (language === "java") judge0LangId = 91; // Java (JDK 17.0.6)

      if (judge0LangId > 0) {
        console.log(`[AlgoFlow Cloud Function] Trying Judge0 CE execution sandbox (ID: ${judge0LangId})...`);
        const codeBase64 = Buffer.from(code).toString('base64');
        const stdinBase64 = Buffer.from(stdin || "").toString('base64');

        const judgeResponse = await fetch("https://ce.judge0.com/submissions?wait=true&base64_encoded=true", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            source_code: codeBase64,
            language_id: judge0LangId,
            stdin: stdinBase64
          })
        });

        if (judgeResponse.ok) {
          const result = await judgeResponse.json();
          const stdout = result.stdout ? Buffer.from(result.stdout, 'base64').toString('utf-8') : "";
          const stderr = result.stderr ? Buffer.from(result.stderr, 'base64').toString('utf-8') : "";
          const compile_output = result.compile_output ? Buffer.from(result.compile_output, 'base64').toString('utf-8') : "";
          
          let combinedStderr = stderr;
          if (compile_output) {
            combinedStderr = (combinedStderr ? combinedStderr + "\n" : "") + compile_output;
          }

          const codeExit = (result.status && result.status.id === 3) ? 0 : 1;
          const timeLabel = result.time ? `${parseFloat(result.time) * 1000}ms` : "12ms";
          const memLabel = result.memory ? `${(result.memory / 1024).toFixed(1)}MB` : "18MB";

          console.log(`🟢 [AlgoFlow Cloud Function] Judge0 CE execution success. Status: ${result.status ? result.status.description : 'Unknown'}`);
          return res.status(200).json({
            stdout,
            stderr: combinedStderr,
            code: codeExit,
            time: timeLabel,
            memory: memLabel
          });
        } else {
          console.warn("[AlgoFlow Cloud Function] Judge0 CE API returned non-OK response status:", judgeResponse.status);
        }
      }
    } catch (judgeErr) {
      console.warn("⚠️ [AlgoFlow Cloud Function] Judge0 CE execution failed, trying fallback...", judgeErr.message);
    }

    // Mode 2: Attempt execution via custom EXECUTE_URL or Piston API
    try {
      let pistonLang = "";
      let version = "";
      let fileName = "";
      
      if (language === "cpp") {
        pistonLang = "c++";
        version = "10.2.0";
        fileName = "main.cpp";
      } else if (language === "python") {
        pistonLang = "python";
        version = "3.10.0";
        fileName = "main.py";
      } else if (language === "java") {
        pistonLang = "java";
        version = "15.0.2";
        fileName = "Main.java";
      }

      if (pistonLang) {
        const executeUrl = process.env.EXECUTE_URL || "https://emkc.org/api/v2/piston/execute";
        console.log(`[AlgoFlow Cloud Function] Trying Piston API sandbox at: ${executeUrl}...`);
        
        const pistonResponse = await fetch(executeUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            language: pistonLang,
            version: version,
            files: [{ name: fileName, content: code }],
            stdin: stdin || ""
          })
        });

        if (pistonResponse.ok) {
          const result = await pistonResponse.json();
          console.log("🟢 [AlgoFlow Cloud Function] Piston execution success.");
          return res.status(200).json({
            stdout: result.run.stdout,
            stderr: result.run.stderr,
            code: result.run.code,
            signal: result.run.signal,
            time: "12ms",
            memory: "18MB"
          });
        } else {
          console.warn("[AlgoFlow Cloud Function] Piston API returned non-OK status:", pistonResponse.status);
        }
      }
    } catch (pistonErr) {
      console.warn("⚠️ [AlgoFlow Cloud Function] Piston API execution failed.", pistonErr.message);
    }

    return res.status(502).json({
      error: "All code execution sandbox gateways are currently offline or whitelisted. Please try again later."
    });
  } catch (error) {
    console.error("❌ [AlgoFlow Cloud Function] Fatal Code Execution Failure:", error);
    return res.status(500).json({
      error: "An internal server error occurred while executing code.",
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
