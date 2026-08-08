# AlgoFlow - DSA Patterns & Interview Preparation

An interactive reference dashboard and curated library designed to help you master core Data Structures & Algorithms (DSA) patterns, spot their application in coding challenges, and prepare for system design and technical interviews.

---

## 🚀 Features

* **Interactive Reference Board**: A React SPA to:
  * Browse core DSA patterns categorized by topics (e.g., Two Pointers, Sliding Window, Fast/Slow Pointers, Binary Search on Answer, Monotonic Stacks, Heap Streams).
  * Filter patterns dynamically by category or search across names, conceptual ideas, and specific LeetCode examples.
  * Expand pattern cards to view **when to spot them** (heuristics) and **canonical examples**.
  * Keep rich, custom heuristics notes in your dashboard.

* **In-Browser Code Sandbox** (`/problem/:slug`):
  * Monaco-based editor (C++, Java, Python) that shows **only the code you're meant to write** — parsing harnesses, helper structs, and driver code are hidden and reassembled server-side before compilation. See [System Design](#-system-design--architecture) below.
  * Real compilation and execution via a Judge0-backed API, with per-language, per-problem starter code that runs cleanly out of the box.

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
├── src/                  # React SPA source
│   ├── components/
│   │   ├── Dashboard.jsx        # Pattern browser, library, auth, Razorpay checkout
│   │   └── ProblemWorkspace.jsx # Monaco sandbox: editor, run/submit, LSP wiring
│   ├── context/AppContext.jsx   # Auth/progress/theme state shared across views
│   ├── config/firebase.js       # Firebase app init (Auth + Firestore)
│   └── data/                    # Bundled patternsData.json / booksData.json
├── leetcode_data/*.json  # One file per problem: description + per-language
│                         # code_stubs, each split into {prefix, body, suffix}
├── functions/index.js    # Firebase Cloud Function: /api/execute, /api/create-order,
│                         # /api/verify-payment (what's actually deployed)
├── server.js             # Express server for local dev / VM hosting - adds a
│                         # Docker-sandboxed /api/execute + WebSocket LSP bridge
├── lsp-server.js          # Language server (pyright etc.) over WebSocket
├── generate-metadata.js   # Build step: derives problems-metadata.json from leetcode_data/
├── firebase.json / .firebaserc  # Hosting (site: "algoflow") + Functions config
├── DESIGN.md              # Visual design system (color, type, spacing)
└── books/                 # Curated technical interview & DSA library
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

## 🏗️ System Design & Architecture

### Overview

```
Browser (React SPA, Vite build)
   │
   ├── Firebase Hosting ("algoflow" site) — serves the static build
   │      rewrites /api/** ────────────────┐
   │                                        ▼
   │                          Firebase Cloud Function (functions/index.js)
   │                          Express app: /api/execute, /api/create-order,
   │                          /api/verify-payment
   │                                        │
   │                                        ├──▶ Judge0 CE (primary compiler)
   │                                        └──▶ Piston API (fallback)
   │
   └── Firebase Auth + Firestore — login, progress sync, Pro entitlement
```

Two Firebase Hosting **sites** exist under the same project (`algoflow-dsa`):
`algoflow` (the real one — bound to the Web App ID this SPA actually uses)
and `algoflow-dsa` (orphaned, no App ID attached). `firebase.json` pins
`"site": "algoflow"` explicitly so `firebase deploy --only hosting` can't
silently land on the wrong one again.

### Code execution pipeline

`/api/execute` takes `{ language, code, stdin }` and tries, in order:

1. **Judge0 CE** (`ce.judge0.com`) — free community instance, fast, but
   rate-limited and occasionally down.
2. **Piston** (`emkc.org`) — fallback. (As of Feb 2026 Piston's public API
   requires a whitelist; this path is effectively dead for unwhitelisted
   callers, kept as a no-op fallback in case that changes.)
3. **Terminal response.** If neither succeeds, the handler returns an
   explicit `502` rather than falling through with no response — see
   *Key Decisions* below for why this matters.

`server.js` (used for local dev / VM hosting, **not** what's deployed to
Cloud Functions) additionally supports a Docker-sandboxed executor
(`--network none`, memory/CPU caps, read-only) as a third option when a
`algoflow-compiler-sandbox` image is available locally.

### Problem stub data model

Each `leetcode_data/<slug>.json` holds, per language, a `code_stubs` entry
shaped as:

```json
{
  "lang_slug": "cpp",
  "prefix": "// includes, ListNode/TreeNode structs, parsing helpers...",
  "body":   "class Solution {\npublic:\n    ... // what the user sees and edits",
  "suffix": "int main() { ... }  // reads stdin, calls Solution, prints result"
}
```

`ProblemWorkspace.jsx` only ever shows `body` in Monaco. On Run/Submit it
sends `prefix + body + suffix` to `/api/execute` as one file. This keeps
the editor focused on the actual algorithm instead of ~150 lines of JSON
parsing boilerplate, while the compiled program is unchanged from the
user's point of view.

**Stateful ("design") problems** — `MinStack`, `LRUCache`, `Trie`, and
similar — don't fit the single-call model above. Their `suffix` instead
dispatches an *operation sequence*: input is `["ClassName","op1","op2"],
[[ctorArgs],[op1Args],[op2Args]]`, and the generated driver instantiates
the class once, then calls each `opN` by name in order, collecting a
`results` array (`null` for `void` calls) that's printed as JSON. The
dispatcher is generated **generically** from the class's own method
signatures (name, params, return type) rather than hand-written per
problem — see *Key Decisions*.

---

## 🛠️ Key Decisions & Trade-offs

A running log of non-obvious engineering calls made in this codebase, and why.

- **Removed the unsandboxed local `child_process.exec` compiler fallback.**
  It ran user-submitted code directly on the host with no isolation and no
  auth check — an unauthenticated RCE vector. The tradeoff: when Docker
  (or Judge0/Piston) isn't available, `/api/execute` now returns a clean
  `503`/`502` instead of silently degrading to something insecure.

- **Every code-execution failure path must send a terminal HTTP response.**
  The original handler fell through silently when both Judge0 and Piston
  failed (neither `return`s nor throws on a non-`200` response), leaving
  the request hanging forever with the frontend spinner stuck. Every
  branch now either returns a result or an explicit error status.

- **Stub data is generated, not hand-authored, and the generator had
  several distinct bugs** discovered while making every problem runnable
  out-of-the-box: empty method bodies (undefined behavior in C++, hard
  compile errors in Java, `IndentationError` in Python), a systemic Python
  bug that substituted `ListNode`/`TreeNode`'s own constructor signature
  for the real method's parameters, wrong parser functions selected for
  `char[]`/`char[][]`/`ListNode[]` params, and missing `Printer` overloads
  for some array types. All were root-caused and fixed at the generator
  level (`migrate.py`-style pass over `leetcode_data/`), not patched
  per-file, so the fix generalizes to future scraped problems too.

- **The "design" problem driver is generated from the class's own method
  signatures, not hardcoded per problem.** A hand-written dispatcher per
  problem (12 problems × 3 languages) would be more code and would drift
  out of sync with the actual class. The generic version reads whatever
  methods exist in the `Solution`/named class and only proceeds if every
  param/return type is one it knows how to (de)serialize — safe types are
  handled automatically; unsupported ones are left untouched rather than
  guessed at.

- **Explicitly out of scope, documented rather than silently left broken:**
  - `serialize-and-deserialize-binary-tree` — tested via roundtrip
    (serialize your own output, deserialize it back), not the operation-
    sequence pattern above; needs a different driver shape entirely.
  - `clone-graph`, `flatten-a-multilevel-doubly-linked-list`,
    `populating-next-right-pointers-in-each-node` — each uses a `Node`
    shape with a bespoke LeetCode-specific serialization format (graph
    adjacency list, multilevel-list-with-child markers, tree-with-next-
    pointers). Getting these subtly wrong would produce silently
    incorrect judged output, which is worse than a visible compile error,
    so they're left as a known gap pending verification against real
    LeetCode test cases.
  - A handful of problems (`alien-dictionary`, `meeting-rooms`, etc.) have
    **zero** scraped `code_stubs` — nothing to fix, they were never
    generated in the first place.

- **Upgraded `firebase-functions` 5→7 and the Cloud Functions runtime
  Node 20→24** ahead of Node 20's Google Cloud deprecation
  (EOL 2026-10-30). Verified no breaking change in that range affects this
  codebase (already using the explicit `v2/https` import, no
  `functions.config()` or v1-event usage) via the Firebase emulator before
  deploying.

---

## ⚙️ Configuration & Live Deployment

To activate live real-world Google Auth, Firestore background sync, and Razorpay payment triggers, update the following configurations:

### 1. Firebase API Configuration
Credentials live in `src/config/firebase.js` and are currently hardcoded to
the live `algoflow-dsa` project (Firebase web API keys are meant to be
public — they're scoped by Firebase Auth domain restrictions and Firestore
security rules, not secrecy). To point at a different project, replace the
`firebaseConfig` object there:
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
The frontend no longer hardcodes a Razorpay key — it fetches the public
`keyId` at runtime from `GET /api/config` (see `functions/index.js` /
`server.js`), which reads `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` from
the environment. Set these via Firebase Secret Manager for the deployed
function:
```bash
firebase functions:secrets:set RAZORPAY_KEY_ID
firebase functions:secrets:set RAZORPAY_KEY_SECRET
```
or in a local `.env` file next to `server.js` for local dev.

> [!NOTE]
> If these credentials are not set up or configured, the application automatically runs in **Offline / Sandbox Demo Mode**, enabling full mock checkout testing, local segregated data persistence, and simulated Pro unlock confirmations.

---

## 🛠️ How to Use

### 1. Running the Dashboard Locally
The dashboard is a React + Vite SPA and needs a build step.

```bash
npm install
npm run dev       # Vite dev server (hot reload), talks to /api/** via BACKEND_URL
```

By default the frontend calls the deployed compiler backend
(`VITE_BACKEND_URL`, empty = same-origin relative path). To also run the
compiler locally instead of hitting the live Cloud Function:

```bash
npm start          # node server.js — Express server with /api/execute,
                    # Razorpay endpoints, and a WebSocket LSP bridge
```

To produce a production build (what actually gets deployed to Firebase
Hosting):
```bash
npm run build       # runs generate-metadata.js, vite build, then copies
                     # leetcode_data/ and books/ into dist/
firebase deploy --only hosting   # deploys dist/ to the "algoflow" site
firebase deploy --only functions # deploys functions/index.js (the compiler API)
```

### 2. Reading Guides
You can find all PDF resources locally in the `books/` directory or unlock access in the interactive library view upon upgrading your dashboard profile.
