# AlgoFlow - DSA Patterns & Interview Preparation

An interactive reference dashboard and curated library designed to help you master core Data Structures & Algorithms (DSA) patterns, spot their application in coding challenges, and prepare for system design and technical interviews.

---

## 🚀 Features

* **Interactive Reference Board (`index.html`)**: A lightweight, responsive, single-page web app to:
  * Browse core DSA patterns categorized by topics (e.g., Two Pointers, Sliding Window, Fast/Slow Pointers, Binary Search on Answer, Monotonic Stacks, Heap Streams).
  * Filter patterns dynamically by category or search across names, conceptual ideas, and specific LeetCode examples.
  * Expand pattern cards to view **when to spot them** (heuristics) and **canonical examples**.
  * Keep rich, custom heuristics notes in your dashboard.

* **Google Authentication & Cloud Sync**:
  * Real-time sync with Google Auth or mock login triggers for immediate, multi-user sandbox testing.
  * Auto-upload of checked progress and textnotes to Cloud Firestore with built-in debouncing.
  * Intelligent progress merging: offline local progress is automatically integrated into cloud accounts during first-time sign-ins.

* **Razorpay Pro & Dual-Engine Checkout**:
  * Integrated **Razorpay Checkout SDK** to support real-time ₹299 lifetime premium membership upgrades.
  * Interactive **Sandbox Checkout Simulator** for offline test environments when live keys are absent.
  * Persistent user-scoped Pro checks with zero-cross-talk data partitioning across account sign-outs.

* **Sleek Study Library Access Controls**:
  * Premium textbooks are protected by visual matte blurs (`filter: blur(4px)`) and glowing crown locked badges.
  * Locked states dissolve dynamically into active **Open** and **Download** links immediately upon upgrading to Pro.
  * Mapped with high-fidelity, handpicked authoritative DSA and System Design references.

---

## 📂 Repository Structure

```text
├── index.html       # Single-page interactive DSA reference dashboard
├── README.md        # Project documentation
└── books/           # Curated technical interview & DSA library
```

---

## 📚 Curated Library Contents

The `books/` directory contains highly comprehensive guides covering algorithmic problem-solving, system design, and large-scale data systems architecture:

1. **[Coding Interview Patterns](file:///Users/utkarsh/.gemini/antigravity-ide/scratch/dsa-patterns/books/Alex%20Xu%20%26%20Shaun%20Gunawardane%20-%20Coding%20Interview%20Patterns.pdf)**  
   *By Alex Xu & Shaun Gunawardane (2024)* — Explores core algorithmic patterns with visual guides and step-by-step breakdowns.
2. **[Coding Interview Patterns (Bonus)](file:///Users/utkarsh/.gemini/antigravity-ide/scratch/dsa-patterns/books/Alex%20Xu%20%26%20Shaun%20Gunawardane%20-%20Coding%20Interview%20Patterns%20(Bonus).pdf)**  
   *By Alex Xu & Shaun Gunawardane* — Extra patterns and advanced heuristics from ByteByteGo.
3. **[AlgoTutor - LeetCode Patterns](file:///Users/utkarsh/.gemini/antigravity-ide/scratch/dsa-patterns/books/AlgoTutor%20-%20LeetCode%20Patterns.pdf)**  
   *A structured syllabus mapped directly to core patterns and high-frequency LeetCode questions.*
4. **[GAMAM Technical Interview Guide](file:///Users/utkarsh/.gemini/antigravity-ide/scratch/dsa-patterns/books/GAMAM%20Technical%20Interview%20Guide.pdf)**  
   *High-frequency interview questions, cheatsheets, and preparation roadmaps for top-tier tech companies.*
5. **[System Design Interview (Volume 2)](file:///Users/utkarsh/.gemini/antigravity-ide/scratch/dsa-patterns/books/Alex%20Xu%20%26%20Sahn%20Lam%20-%20System%20Design%20Interview%20(Volume%202).pdf)**  
   *By Alex Xu & Sahn Lam (2022)* — Real-world system design questions with end-to-end architectural designs.
6. **[Designing Data-Intensive Applications](file:///Users/utkarsh/.gemini/antigravity-ide/scratch/dsa-patterns/books/Martin%20Kleppmann%20-%20Designing%20Data-Intensive%20Applications.pdf)**  
   *By Martin Kleppmann* — The definitive textbook on data systems, consistency models, storage engines, and distributed systems architecture.

---

## ⚙️ Configuration & Live Deployment

To activate live real-world Google Auth, Firestore background sync, and Razorpay payment triggers, update the following configurations near the bottom of `index.html`:

### 1. Firebase API Configuration
Replace placeholder credentials in the `firebaseConfig` object:
```javascript
const firebaseConfig = {
  apiKey: "YOUR_REAL_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 2. Razorpay API Key ID
Replace `"YOUR_RAZORPAY_KEY_ID"` inside the `razorpayConfig` block:
```javascript
const razorpayConfig = {
  keyId: "rzp_live_YOUR_LIVE_KEY_ID" // Paste your live Razorpay Key ID here
};
```

> [!NOTE]
> If these credentials are not set up or configured, the application automatically runs in **Offline / Sandbox Demo Mode**, enabling full mock checkout testing, local segregated data persistence, and simulated Pro unlock confirmations.

---

## 🛠️ How to Use

### 1. Servicing the Dashboard Locally
Since the dashboard is built purely with vanilla HTML, CSS, and JavaScript, you can open and run it locally without installing complex build pipelines.

* **Option A: Direct Open**  
  Simply double-click the `index.html` file to open it in your preferred web browser.

* **Option B: Run a Local Server**  
  To serve the application locally (highly recommended to enable proper cross-origin PDF embedding), run one of the following commands in the project directory:

  ```bash
  # Using Python 3
  python3 -m http.server 8000
  
  # Or using Node.js / npx
  npx -y http-server -p 8000
  ```
  Then, navigate to `http://localhost:8000` in your web browser.

### 2. Reading Guides
You can find all PDF resources locally in the `books/` directory or unlock access in the interactive library view upon upgrading your dashboard profile.
