/* =========================================================
   Grandé Hotel — Shared JavaScript
   Handles: navigation, booking storage, forms, admin, toast
   ========================================================= */

/* ---------- Storage Helpers ---------- */
const STORAGE_KEY = "hotel_bookings";
const ROOM_PRICES = { single: 120, double: 200, deluxe: 350 };

/** Get all bookings from localStorage */
function getBookings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

/** Save a new booking */
function addBooking(booking) {
  const bookings = getBookings();
  const newBooking = {
    ...booking,
    id: (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()),
    createdAt: new Date().toISOString(),
  };
  bookings.push(newBooking);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
  return newBooking;
}

/** Delete a booking by id */
function deleteBooking(id) {
  const filtered = getBookings().filter((b) => b.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

/** Calculate nights between two dates */
function calculateNights(checkIn, checkOut) {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

/* ---------- Mobile nav + active link wiring (called after navbar renders) ---------- */
function wireNavbarInteractions() {
  const toggle = document.querySelector(".menu-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => links.classList.toggle("open"));
  }
  // Highlight active link based on current page
  const path = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a").forEach((a) => {
    if (a.getAttribute("href") === path) a.classList.add("active");
  });
}

/* ---------- Toast Notification ---------- */
function showToast(title, message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<strong>${title}</strong>${message}`;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3500);
}

/* ---------- Booking Form Logic ---------- */
function initBookingForm() {
  const form = document.getElementById("booking-form");
  if (!form) return;

  // ===== NEW: Restrict booking to logged-in users =====
  // If not logged in, show the login-required notice and bail out.
  const notice = document.getElementById("login-required-notice");
  const section = document.getElementById("booking-section");
  if (!isUserLoggedIn()) {
    if (notice) notice.style.display = "block";
    if (section) section.style.display = "none";
    return; // don't wire up the form
  }
  if (notice) notice.style.display = "none";
  if (section) section.style.display = "block";

  // Set min date = today
  const today = new Date().toISOString().split("T")[0];
  form.checkIn.min = today;
  form.checkOut.min = today;

  // Live price summary
  const summary = document.getElementById("price-summary");
  function updateSummary() {
    const nights = calculateNights(form.checkIn.value, form.checkOut.value);
    const price = ROOM_PRICES[form.roomType.value];
    if (nights > 0) {
      summary.style.display = "block";
      summary.querySelector(".summary-line").textContent =
        `${nights} night${nights !== 1 ? "s" : ""} × $${price}/night`;
      summary.querySelector(".total").textContent = `Total: $${nights * price}`;
    } else {
      summary.style.display = "none";
    }
  }
  ["checkIn", "checkOut", "roomType"].forEach((name) =>
    form[name].addEventListener("change", updateSummary)
  );

  // Validation + submit
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = {
      guestName: form.guestName.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      checkIn: form.checkIn.value,
      checkOut: form.checkOut.value,
      roomType: form.roomType.value,
      guests: parseInt(form.guests.value) || 1,
    };

    // Reset errors
    form.querySelectorAll(".error").forEach((el) => (el.textContent = ""));
    let valid = true;
    const setErr = (field, msg) => {
      const el = form.querySelector(`[data-error="${field}"]`);
      if (el) el.textContent = msg;
      valid = false;
    };

    if (!data.guestName) setErr("guestName", "Name is required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) setErr("email", "Valid email required");
    if (!/^\+?[\d\s-]{7,15}$/.test(data.phone)) setErr("phone", "Valid phone required");
    if (!data.checkIn) setErr("checkIn", "Check-in date required");
    if (!data.checkOut) setErr("checkOut", "Check-out date required");
    if (data.checkIn && data.checkOut && new Date(data.checkOut) <= new Date(data.checkIn))
      setErr("checkOut", "Check-out must be after check-in");
    if (data.guests < 1 || data.guests > 6) setErr("guests", "1-6 guests allowed");

    if (!valid) return;

    const nights = calculateNights(data.checkIn, data.checkOut);
    const totalPrice = nights * ROOM_PRICES[data.roomType];
    // NEW: attach the logged-in user's email + a status so we can filter
    // bookings per-user on the "My Bookings" page.
    const currentUser = getCurrentUser();
    addBooking({
      ...data,
      totalPrice,
      userEmail: currentUser ? currentUser.email : null,
      status: "Confirmed",
    });

    // Show confirmation
    document.getElementById("booking-section").style.display = "none";
    const confirm = document.getElementById("confirmation");
    confirm.style.display = "block";
    confirm.querySelector(".c-name").textContent = data.guestName;
    confirm.querySelector(".c-room").textContent = data.roomType;
    confirm.querySelector(".c-dates").textContent =
      `${data.checkIn} → ${data.checkOut} · ${nights} night${nights !== 1 ? "s" : ""} · $${totalPrice}`;

    showToast("Booking Confirmed!", `Your ${data.roomType} room has been reserved.`);
  });

  // Reset to book another
  const resetBtn = document.getElementById("book-another");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      form.reset();
      document.getElementById("confirmation").style.display = "none";
      document.getElementById("booking-section").style.display = "block";
      summary.style.display = "none";
    });
  }
}

/* ---------- Contact Form ---------- */
function initContactForm() {
  const form = document.getElementById("contact-form");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!form.name.value.trim() || !form.email.value.trim() || !form.message.value.trim()) {
      showToast("Missing Info", "Please fill in all fields.");
      return;
    }
    showToast("Message Sent!", "We'll get back to you within 24 hours.");
    form.reset();
  });
}

/* ---------- Admin Dashboard ---------- */
function initAdmin() {
  const tableBody = document.getElementById("bookings-body");
  if (!tableBody) return;

  function render() {
    const bookings = getBookings();

    // Stats
    const totalRevenue = bookings.reduce((s, b) => s + (b.totalPrice || 0), 0);
    const totalGuests = bookings.reduce((s, b) => s + (b.guests || 0), 0);
    document.getElementById("stat-bookings").textContent = bookings.length;
    document.getElementById("stat-revenue").textContent = `$${totalRevenue.toLocaleString()}`;
    document.getElementById("stat-guests").textContent = totalGuests;
    document.getElementById("stat-avg").textContent =
      bookings.length ? `$${Math.round(totalRevenue / bookings.length)}` : "$0";

    // Table rows
    if (bookings.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" class="empty-state">No bookings yet. Reservations will appear here.</td></tr>`;
      return;
    }
    tableBody.innerHTML = bookings.map((b) => `
      <tr>
        <td><strong>${b.guestName}</strong><br><small style="color:var(--muted-foreground)">${b.email}</small></td>
        <td>${b.phone}</td>
        <td style="text-transform:capitalize">${b.roomType}</td>
        <td>${b.checkIn} → ${b.checkOut}</td>
        <td>${b.guests}</td>
        <td><strong>$${b.totalPrice}</strong></td>
        <td><button class="btn btn-sm btn-destructive" data-id="${b.id}">Delete</button></td>
      </tr>
    `).join("");

    tableBody.querySelectorAll("button[data-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (confirm("Delete this booking?")) {
          deleteBooking(btn.dataset.id);
          render();
          showToast("Deleted", "Booking removed.");
        }
      });
    });
  }
  render();
}

/* =========================================================
   ADMIN AUTHENTICATION (NEW)
   - Hardcoded credentials: admin / admin123
   - Session stored in localStorage as isAdminLoggedIn = "true"
   - Protects admin.html (guard script lives in admin.html <head>)
   ========================================================= */
const ADMIN_CREDENTIALS = { username: "admin", password: "admin123" };
const ADMIN_SESSION_KEY = "isAdminLoggedIn";

/** Returns true if admin session flag is set */
function isAdminLoggedIn() {
  return localStorage.getItem(ADMIN_SESSION_KEY) === "true";
}

/** Handle the admin login form submission (admin-login.html) */
function initAdminLogin() {
  const form = document.getElementById("admin-login-form");
  if (!form) return;

  // If already logged in, skip the login screen
  if (isAdminLoggedIn()) {
    window.location.replace("admin.html");
    return;
  }

  const errorEl = document.getElementById("admin-login-error");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    errorEl.textContent = "";

    const username = form.username.value.trim();
    const password = form.password.value;

    // Validate against hardcoded credentials
    if (
      username === ADMIN_CREDENTIALS.username &&
      password === ADMIN_CREDENTIALS.password
    ) {
      // SESSION FIX: Only ONE role can be active at a time.
      // Clear any user session before storing the admin session.
      localStorage.removeItem(CURRENT_USER_KEY);
      localStorage.setItem(ADMIN_SESSION_KEY, "true");
      showToast("Welcome, Admin", "Login successful.");
      window.location.href = "admin.html";
    } else {
      errorEl.textContent = "Invalid username or password.";
    }
  });
}

/** Wire up the logout button on admin.html */
function initAdminLogout() {
  const btn = document.getElementById("admin-logout-btn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    showToast("Logged out", "Admin session ended.");
    window.location.href = "admin-login.html";
  });
}

/* =========================================================
   USER AUTHENTICATION (NEW)
   - Register/login regular users (separate from admin)
   - User records stored in localStorage under "hotel_users"
   - Logged-in user stored under "currentUser"
   - Restricts booking form access (handled in initBookingForm)
   ========================================================= */
const USERS_KEY = "hotel_users";
const CURRENT_USER_KEY = "currentUser";

/** Get all registered users */
function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
  } catch {
    return [];
  }
}

/** Save users array back to localStorage */
function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/** Get the currently logged-in user (or null) */
function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(CURRENT_USER_KEY)) || null;
  } catch {
    return null;
  }
}

/** Check whether a user is logged in */
function isUserLoggedIn() {
  return getCurrentUser() !== null;
}

/** Handle Register form (register.html) */
function initRegisterForm() {
  const form = document.getElementById("register-form");
  if (!form) return;
  const msg = document.getElementById("register-msg");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    msg.style.color = "";
    msg.textContent = "";

    const name = form.name.value.trim();
    const email = form.email.value.trim().toLowerCase();
    const password = form.password.value;

    // Basic validation
    if (!name || !email || !password) {
      msg.textContent = "All fields are required.";
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      msg.textContent = "Please enter a valid email.";
      return;
    }
    if (password.length < 6) {
      msg.textContent = "Password must be at least 6 characters.";
      return;
    }

    // Prevent duplicate emails
    const users = getUsers();
    if (users.some((u) => u.email === email)) {
      msg.textContent = "An account with this email already exists.";
      return;
    }

    // Save new user
    users.push({ name, email, password });
    saveUsers(users);

    msg.style.color = "green";
    msg.textContent = "Account created! Redirecting to login...";
    showToast("Welcome!", "Account created successfully.");
    setTimeout(() => (window.location.href = "login.html"), 1000);
  });
}

/** Handle User Login form (login.html) */
function initUserLoginForm() {
  const form = document.getElementById("user-login-form");
  if (!form) return;

  // If already logged in, send them home
  if (isUserLoggedIn()) {
    window.location.replace("index.html");
    return;
  }

  const errorEl = document.getElementById("user-login-error");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    errorEl.textContent = "";

    const email = form.email.value.trim().toLowerCase();
    const password = form.password.value;

    // Look up user in localStorage
    const user = getUsers().find(
      (u) => u.email === email && u.password === password
    );

    if (!user) {
      errorEl.textContent = "Invalid email or password.";
      return;
    }

    // SESSION FIX: Only ONE role can be active at a time.
    // Clear admin session before storing the user session.
    localStorage.removeItem(ADMIN_SESSION_KEY);
    localStorage.setItem(
      CURRENT_USER_KEY,
      JSON.stringify({ name: user.name, email: user.email })
    );
    showToast("Welcome back!", `Hello, ${user.name}.`);
    window.location.href = "index.html";
  });
}

/* =========================================================
   DYNAMIC NAVBAR (NEW)
   - Single source of truth for navbar markup.
   - Renders different links depending on session state:
       1) Admin logged in     → Home, Admin Dashboard, Logout
       2) User  logged in     → Home, Welcome dropdown (My Bookings, Booking, Logout)
       3) No one logged in    → Home, Register, Login, Admin Login
   - Sessions are mutually exclusive (see login handlers).
   ========================================================= */
function renderNavbar() {
  const mount = document.getElementById("site-navbar");
  if (!mount) return;

  const adminIn = isAdminLoggedIn();
  const user = getCurrentUser();

  let rightSide = "";

  if (adminIn) {
    // ----- ADMIN NAVBAR -----
    rightSide = `
      <ul class="nav-links">
        <li><a href="index.html">Home</a></li>
        <li><a href="admin.html">Admin Dashboard</a></li>
      </ul>
      <button id="admin-logout-btn-nav" class="btn btn-sm btn-destructive">Logout</button>
    `;
  } else if (user) {
    // ----- USER NAVBAR (with dropdown) -----
    rightSide = `
      <ul class="nav-links">
        <li><a href="index.html">Home</a></li>
      </ul>
      <div class="user-menu">
        <button id="user-menu-toggle" class="user-menu-btn" aria-haspopup="true" aria-expanded="false">
          Welcome, ${user.name} <span class="caret">▾</span>
        </button>
        <ul id="user-menu-dropdown" class="user-menu-dropdown" hidden>
          <li><a href="booking.html">Book a Room</a></li>
          <li><a href="my-bookings.html">My Bookings</a></li>
          <li><button type="button" id="user-logout-btn-nav">Logout</button></li>
        </ul>
      </div>
    `;
  } else {
    // ----- GUEST NAVBAR -----
    rightSide = `
      <ul class="nav-links">
        <li><a href="index.html">Home</a></li>
        <li><a href="login.html">Login</a></li>
        <li><a href="admin-login.html">Admin Login</a></li>
      </ul>
    `;
  }

  mount.innerHTML = `
    <div class="container nav-inner">
      <a href="index.html" class="brand">Grande<span>.</span></a>
      <button class="menu-toggle" aria-label="Toggle menu">☰</button>
      ${rightSide}
    </div>
  `;

  wireNavbarInteractions();
  wireNavbarSessionButtons();
}

/** Attach handlers to logout buttons + the user dropdown toggle. */
function wireNavbarSessionButtons() {
  // User logout (inside dropdown)
  const userLogout = document.getElementById("user-logout-btn-nav");
  if (userLogout) {
    userLogout.addEventListener("click", () => {
      localStorage.removeItem(CURRENT_USER_KEY);
      showToast("Logged out", "You have been signed out.");
      // Redirect home so protected pages (booking/my-bookings) don't stay open
      window.location.href = "index.html";
    });
  }

  // Admin logout (in navbar — separate from the dashboard button)
  const adminLogout = document.getElementById("admin-logout-btn-nav");
  if (adminLogout) {
    adminLogout.addEventListener("click", () => {
      localStorage.removeItem(ADMIN_SESSION_KEY);
      showToast("Logged out", "Admin session ended.");
      window.location.href = "admin-login.html";
    });
  }

  // Dropdown toggle for the user menu
  const toggle = document.getElementById("user-menu-toggle");
  const dropdown = document.getElementById("user-menu-dropdown");
  if (toggle && dropdown) {
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = !dropdown.hasAttribute("hidden");
      if (open) {
        dropdown.setAttribute("hidden", "");
        toggle.setAttribute("aria-expanded", "false");
      } else {
        dropdown.removeAttribute("hidden");
        toggle.setAttribute("aria-expanded", "true");
      }
    });
    // Close when clicking outside
    document.addEventListener("click", (e) => {
      if (!dropdown.contains(e.target) && e.target !== toggle) {
        dropdown.setAttribute("hidden", "");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }
}

/* =========================================================
   MY BOOKINGS (NEW)
   - Shows only the logged-in user's bookings (filtered by userEmail).
   - Handles three states: not-logged-in, empty, populated.
   ========================================================= */
function initMyBookings() {
  const list = document.getElementById("mb-list");
  if (!list) return; // not on the my-bookings page

  const loginRequired = document.getElementById("mb-login-required");
  const emptyState = document.getElementById("mb-empty");

  // 1) Access control — must be logged in
  const user = getCurrentUser();
  if (!user) {
    loginRequired.style.display = "block";
    return;
  }

  // 2) Filter bookings to only this user's (match by email)
  const mine = getBookings().filter((b) => b.userEmail === user.email);

  // 3) Empty state
  if (mine.length === 0) {
    emptyState.style.display = "block";
    return;
  }

  // 4) Render booking cards
  list.innerHTML = mine
    .map(
      (b) => `
      <article class="booking-card">
        <div class="booking-card-head">
          <h3 style="text-transform:capitalize;margin:0">${b.roomType} Room</h3>
          <span class="badge-status">${b.status || "Confirmed"}</span>
        </div>
        <ul class="booking-card-meta">
          <li><strong>Check-in:</strong> ${b.checkIn}</li>
          <li><strong>Check-out:</strong> ${b.checkOut}</li>
          <li><strong>Guests:</strong> ${b.guests}</li>
          <li><strong>Total:</strong> $${b.totalPrice}</li>
        </ul>
      </article>`
    )
    .join("");
}

/* ---------- Init on page load ---------- */
document.addEventListener("DOMContentLoaded", () => {
  renderNavbar();        // NEW: build the navbar dynamically based on session
  initRegisterForm();    // NEW: user registration
  initUserLoginForm();   // NEW: user login
  initBookingForm();
  initContactForm();
  initAdmin();
  initAdminLogin();      // admin login form
  initAdminLogout();     // admin logout button
  initMyBookings();      // NEW: per-user bookings page
});

