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
let mode = ""; // "setup1", "setup2", "unlock"
let tempPIN = "";

// ---------- Check if a PIN is already stored ----------
const savedHash = localStorage.getItem("pinHash");

if (!savedHash) {
  mode = "setup1";
  document.getElementById("pinMessage").textContent = "Create a 4–6 digit PIN";
} else {
  mode = "unlock";
  document.getElementById("pinMessage").textContent = "Enter your PIN";
}

// ---------- Update dot indicators ----------
function updateDots() {
  const dots = [
    document.getElementById("dot1"),
    document.getElementById("dot2"),
    document.getElementById("dot3"),
    document.getElementById("dot4"),
  ];

  dots.forEach((d, i) => {
    d.classList.toggle("filled", i < inputPIN.length);
  });
}

// ---------- Handle PIN submission ----------
async function submitPIN() {
  if (inputPIN.length < 4) return;

  if (mode === "unlock") {
    const hashed = await hashPIN(inputPIN);
    if (hashed === savedHash) {
      sessionStorage.setItem("unlocked", "yes");
      window.location.href = "index.html";
    } else {
      wrongPINAnimation();
    }
  }

  if (mode === "setup1") {
    tempPIN = inputPIN;
    inputPIN = "";
    updateDots();
    mode = "setup2";
    document.getElementById("pinMessage").textContent = "Confirm your PIN";
    return;
  }

  if (mode === "setup2") {
    if (inputPIN === tempPIN) {
      const hashed = await hashPIN(inputPIN);
      localStorage.setItem("pinHash", hashed);
      sessionStorage.setItem("unlocked", "yes");
      window.location.href = "index.html";
    } else {
      wrongPINAnimation();
      mode = "setup1";
      document.getElementById("pinMessage").textContent = "Create a 4–6 digit PIN";
    }
  }
}

// ---------- Shake animation on error ----------
function wrongPINAnimation() {
  const container = document.querySelector(".pin-container");
  container.classList.add("shake");

  setTimeout(() => container.classList.remove("shake"), 600);

  inputPIN = "";
  updateDots();
}

// ---------- Keypad buttons ----------
document.querySelectorAll(".key").forEach(btn => {
  btn.addEventListener("click", () => {
    if (inputPIN.length >= 6) return;
    inputPIN += btn.textContent;
    updateDots();
    if (inputPIN.length >= 4) submitPIN();
  });
});

// Delete key
document.querySelector(".delete-key").addEventListener("click", () => {
  inputPIN = inputPIN.slice(0, -1);
  updateDots();
});
