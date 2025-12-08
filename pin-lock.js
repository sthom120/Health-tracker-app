// pin-lock.js

// ---------- Secure SHA-256 hashing ----------
async function hashPIN(pin) {
  const enc = new TextEncoder().encode(pin);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------- State ----------
let inputPIN = "";
let state = "";      // "setup1", "setup2", "unlock", "change-current", "change-new1", "change-new2", "remove"
let tempPIN = "";    // used during setup / change flows

const savedHash = localStorage.getItem("pinHash");
const params = new URLSearchParams(window.location.search);
const modeParam = params.get("mode"); // "change" | "remove" | null

const messageEl = document.getElementById("pinMessage");

// ---------- Decide initial mode ----------
if (!savedHash && !modeParam) {
  // First ever setup
  state = "setup1";
  messageEl.textContent = "Create a 4–6 digit PIN";
} else if (!savedHash && modeParam) {
  // Trying to change/remove with no PIN set → send back
  alert("No PIN is set yet. Please create a PIN first.");
  window.location.href = "index.html";
} else if (savedHash && modeParam === "change") {
  state = "change-current";
  messageEl.textContent = "Enter your current PIN";
} else if (savedHash && modeParam === "remove") {
  state = "remove";
  messageEl.textContent = "Enter your current PIN to remove it";
} else {
  // Normal unlock
  state = "unlock";
  messageEl.textContent = "Enter your PIN";
}

// ---------- Update dot indicators ----------
function updateDots() {
  const dots = [
    document.getElementById("dot1"),
    document.getElementById("dot2"),
    document.getElementById("dot3"),
    document.getElementById("dot4"),
    document.getElementById("dot5"),
    document.getElementById("dot6")
  ];

  dots.forEach((d, i) => {
    d.classList.toggle("filled", i < inputPIN.length);
  });
}

// ---------- Clear PIN input ----------
function clearPIN() {
  inputPIN = "";
  updateDots();
}

// ---------- Handle PIN submission for current state ----------
async function submitPIN() {
  if (inputPIN.length < 4) return; // minimum length

  // Unlock existing PIN
  if (state === "unlock") {
    const hashed = await hashPIN(inputPIN);
    if (hashed === savedHash) {
      sessionStorage.setItem("unlocked", "yes");
      window.location.href = "index.html";
    } else {
      wrongPINAnimation();
    }
    return;
  }

  // Initial setup: first PIN entry
  if (state === "setup1") {
    tempPIN = inputPIN;
    clearPIN();
    state = "setup2";
    messageEl.textContent = "Confirm your PIN";
    return;
  }

  // Initial setup: confirm PIN
  if (state === "setup2") {
    if (inputPIN === tempPIN) {
      const hashed = await hashPIN(inputPIN);
      localStorage.setItem("pinHash", hashed);
      sessionStorage.setItem("unlocked", "yes");
      window.location.href = "index.html";
    } else {
      wrongPINAnimation();
      state = "setup1";
      messageEl.textContent = "Create a 4–6 digit PIN";
    }
    return;
  }

  // Change mode: verify current PIN
  if (state === "change-current") {
    const hashed = await hashPIN(inputPIN);
    if (hashed === savedHash) {
      clearPIN();
      state = "change-new1";
      messageEl.textContent = "Enter a new PIN";
    } else {
      wrongPINAnimation();
    }
    return;
  }

  // Change mode: new PIN first entry
  if (state === "change-new1") {
    if (inputPIN.length < 4 || inputPIN.length > 6) {
      alert("PIN must be 4–6 digits.");
      clearPIN();
      return;
    }
    tempPIN = inputPIN;
    clearPIN();
    state = "change-new2";
    messageEl.textContent = "Confirm new PIN";
    return;
  }

  // Change mode: confirm new PIN
  if (state === "change-new2") {
    if (inputPIN === tempPIN) {
      const hashed = await hashPIN(inputPIN);
      localStorage.setItem("pinHash", hashed);
      sessionStorage.setItem("unlocked", "yes");
      alert("PIN changed successfully.");
      window.location.href = "index.html";
    } else {
      wrongPINAnimation();
      state = "change-new1";
      messageEl.textContent = "Enter a new PIN";
    }
    return;
  }

  // Remove mode: verify current PIN then remove
  if (state === "remove") {
    const hashed = await hashPIN(inputPIN);
    if (hashed === savedHash) {
      localStorage.removeItem("pinHash");
      sessionStorage.setItem("unlocked", "yes"); // let user in this session
      alert("PIN removed.");
      window.location.href = "index.html";
    } else {
      wrongPINAnimation();
    }
    return;
  }
}

// ---------- Shake animation on error ----------
function wrongPINAnimation() {
  const container = document.querySelector(".pin-container");
  container.classList.add("shake");
  setTimeout(() => container.classList.remove("shake"), 500);
  clearPIN();
}

// ---------- Keypad buttons ----------
document.querySelectorAll(".key").forEach(btn => {
  btn.addEventListener("click", () => {
    if (inputPIN.length >= 6) return; // max length
    inputPIN += btn.textContent;
    updateDots();
    if (inputPIN.length >= 4) {
      // Try submit once we have at least 4 digits
      submitPIN();
    }
  });
});

// ---------- Delete key ----------
document.querySelector(".delete-key").addEventListener("click", () => {
  inputPIN = inputPIN.slice(0, -1);
  updateDots();
});
