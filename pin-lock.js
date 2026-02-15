// pin-lock.js

/* ============================================================
   PIN LOCK – pin-lock.js
   ============================================================
   Supports:
   - First-time PIN setup (setup1 → setup2)
   - Normal unlock
   - Change PIN (change-current → change-new1 → change-new2)
   - Remove PIN (remove)
   ============================================================ */

// ---------- Secure SHA-256 hashing ----------
async function hashPIN(pin) {
  const enc = new TextEncoder().encode(pin);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------- DOM ----------
const messageEl = document.getElementById("pinMessage");
const containerEl = document.querySelector(".pin-container");
const dots = document.querySelectorAll(".pin-dots .dot");

// ---------- State ----------
let inputPIN = "";
let state = "";   // setup1, setup2, unlock, change-current, change-new1, change-new2, remove
let tempPIN = ""; // used during setup / change

const savedHash = localStorage.getItem("pinHash");
const params = new URLSearchParams(window.location.search);
const modeParam = params.get("mode"); // "change" | "remove" | null

// ---------- Helpers ----------
function setMessage(text) {
  if (messageEl) messageEl.textContent = text;
}

function goToIndex() {
  sessionStorage.setItem("unlocked", "yes");
  window.location.replace("index.html");
}

function updateDots() {
  dots.forEach((d, i) => {
    d.classList.toggle("filled", i < inputPIN.length);
  });
}

function clearPIN() {
  inputPIN = "";
  updateDots();
}

function shake() {
  if (!containerEl) return;
  containerEl.classList.remove("shake");
  void containerEl.offsetWidth; // force reflow to restart animation
  containerEl.classList.add("shake");
}

function wrongPIN(message = "Incorrect PIN. Try again.") {
  shake();
  setMessage(message);
  clearPIN();
}

function setState(nextState, message) {
  state = nextState;
  if (message) setMessage(message);
  clearPIN();
}

// ---------- Decide initial state ----------
(function init() {
  if (!savedHash && !modeParam) {
    setState("setup1", "Create a 4-digit PIN");
    return;
  }

  if (!savedHash && modeParam) {
    alert("No PIN is set yet. Please create a PIN first.");
    window.location.replace("index.html");
    return;
  }

  if (savedHash && modeParam === "change") {
    setState("change-current", "Enter your current PIN");
    return;
  }

  if (savedHash && modeParam === "remove") {
    setState("remove", "Enter your current PIN to remove it");
    return;
  }

  setState("unlock", "Enter your PIN");
})();

// ---------- Handle PIN submission ----------
async function submitPIN() {
  if (inputPIN.length !== 4) return;

  // Normal unlock
  if (state === "unlock") {
    const hashed = await hashPIN(inputPIN);
    if (hashed === savedHash) return goToIndex();
    return wrongPIN();
  }

  // Setup: first entry
  if (state === "setup1") {
    tempPIN = inputPIN;
    setState("setup2", "Confirm your PIN");
    return;
  }

  // Setup: confirm
  if (state === "setup2") {
    if (inputPIN !== tempPIN) {
      // reset flow
      setState("setup1", "Create a 4-digit PIN");
      return wrongPIN("PINs did not match. Try again.");
    }

    const hashed = await hashPIN(inputPIN);
    localStorage.setItem("pinHash", hashed);
    return goToIndex();
  }

  // Change: verify current PIN
  if (state === "change-current") {
    const hashed = await hashPIN(inputPIN);
    if (hashed === savedHash) {
      return setState("change-new1", "Enter a new 4-digit PIN");
    }
    return wrongPIN();
  }

  // Change: new PIN first entry
  if (state === "change-new1") {
    tempPIN = inputPIN;
    return setState("change-new2", "Confirm new PIN");
  }

  // Change: confirm new PIN
  if (state === "change-new2") {
    if (inputPIN !== tempPIN) {
      return setState("change-new1", "Enter a new 4-digit PIN");
    }

    const hashed = await hashPIN(inputPIN);
    localStorage.setItem("pinHash", hashed);
    alert("PIN changed successfully.");
    return goToIndex();
  }

  // Remove: verify then remove
  if (state === "remove") {
    const hashed = await hashPIN(inputPIN);
    if (hashed === savedHash) {
      localStorage.removeItem("pinHash");
      alert("PIN removed.");
      return goToIndex(); // unlock for this session
    }
    return wrongPIN();
  }
}

// ---------- Keypad buttons ----------
document.querySelectorAll(".key").forEach(btn => {
  btn.addEventListener("click", () => {
    if (inputPIN.length >= 4) return;
    inputPIN += btn.textContent.trim();
    updateDots();

    if (inputPIN.length === 4) submitPIN();
  });
});

// ---------- Delete key ----------
document.querySelector(".delete-key")?.addEventListener("click", () => {
  inputPIN = inputPIN.slice(0, -1);
  updateDots();
});

// ---------- Keyboard support (nice for desktop) ----------
document.addEventListener("keydown", (e) => {
  const key = e.key;

  if (key >= "0" && key <= "9") {
    if (inputPIN.length >= 4) return;
    inputPIN += key;
    updateDots();
    if (inputPIN.length === 4) submitPIN();
    return;
  }

  if (key === "Backspace") {
    inputPIN = inputPIN.slice(0, -1);
    updateDots();
  }
});
