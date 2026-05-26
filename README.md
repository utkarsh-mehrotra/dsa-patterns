# DSA Patterns & Interview Preparation

An interactive reference dashboard and curated library designed to help you master core Data Structures & Algorithms (DSA) patterns, spot their application in coding challenges, and prepare for system design and technical interviews.

## 🚀 Features

* **Interactive Reference Board (`index.html`)**: A lightweight, responsive, and single-page web app to:
  * Browse core DSA patterns categorized by topics (e.g., Two Pointers, Sliding Window, Fast/Slow Pointers, Binary Search on Answer, Monotonic Stacks, Heap Streams).
  * Filter patterns dynamically by category or search across names, conceptual ideas, and specific LeetCode examples.
  * Expand pattern cards to view **when to spot them** (heuristics) and **canonical examples**.
* **Offline Library (`books/`)**: A handpicked collection of authoritative interview preparation guides and reference textbooks.

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

1. **Coding Interview Patterns: Nail Your Next Coding Interview (ByteByteGo, 2024)**  
   *By Alex Xu & Shaun Gunawardane* — Explores core algorithmic patterns with visual guides and step-by-step breakdowns.
2. **Coding Interview Patterns (Bonus)**  
   *By Alex Xu & Shaun Gunawardane* — Extra patterns and advanced heuristics from ByteByteGo.
3. **AlgoTutor LeetCode Patterns Guide**  
   *A structured syllabus mapped directly to core patterns and high-frequency LeetCode questions.*
4. **GAMAM Technical Interview Guide**  
   *High-frequency interview questions, cheatsheets, and preparation roadmaps for top-tier tech companies.*
5. **System Design Interview – An Insider's Guide: Volume 2 (2022)**  
   *By Alex Xu & Sahn Lam* — Real-world system design questions with end-to-end architectural designs.
6. **Designing Data-Intensive Applications**  
   *By Martin Kleppmann* — The definitive textbook on data systems, consistency models, storage engines, and distributed systems architecture.

---

## 🛠️ How to Use

### 1. Interactive Dashboard
Since the dashboard is built purely with vanilla HTML, CSS, and JavaScript, you can open and run it locally without installing any external dependencies.

* **Option A: Direct Open**  
  Simply double-click the [index.html](file:///Users/utkarsh/.gemini/antigravity-ide/scratch/dsa-patterns/index.html) file to open it in your preferred web browser.

* **Option B: Run a Local Server**  
  To serve the application locally (useful if you want to access it over your local network), run one of the following commands in the project directory:

  ```bash
  # Using Python 3
  python3 -m http-server 8000
  
  # Or using Node.js / npx
  npx -y http-server -p 8000
  ```
  Then, navigate to `http://localhost:8000` in your web browser.

### 2. Reading Guides
You can find all PDF resources locally in the [books/](file:///Users/utkarsh/.gemini/antigravity-ide/scratch/dsa-patterns/books) directory. They can be opened in any standard PDF reader.
