import API from "./api.js";

// ==========================================
// STATE MANAGEMENT
// ==========================================
let state = {
  token: localStorage.getItem("token") || null,
  user: null,
  currentView: "dashboard",
  tasks: [],
  employees: [],
  admins: [],
  notifications: [],
  selectedTask: null,
  activeCalendarMonth: new Date().getMonth(),
  activeCalendarYear: new Date().getFullYear(),
  selectedAttendanceDate: new Date().toLocaleDateString('en-CA'),
  charts: {},
};

let checkinStream = null;
let capturedSelfieBase64 = null;
let detectedLocationStr = null;
let faceDetectionInterval = null;

function stopCheckinCamera() {
  if (checkinStream) {
    checkinStream.getTracks().forEach((track) => track.stop());
    checkinStream = null;
  }
  const video = document.getElementById("attendance-video");
  if (video) video.srcObject = null;
  if (faceDetectionInterval) {
    clearInterval(faceDetectionInterval);
    faceDetectionInterval = null;
  }
}

// ==========================================
// DOM CACHE
// ==========================================
const DOM = {
  loader: document.getElementById("app-loader"),
  loginPage: document.getElementById("login-page"),
  loginForm: document.getElementById("login-form"),
  loginEmail: document.getElementById("login-email"),
  loginPassword: document.getElementById("login-password"),
  demoBadges: document.querySelectorAll(".btn-demo-badge"),

  appShell: document.getElementById("app-shell"),
  sidebar: document.getElementById("sidebar"),
  sidebarToggle: document.getElementById("sidebar-toggle-btn"),
  mobileNavToggle: document.getElementById("mobile-nav-toggle"),
  navItems: document.querySelectorAll(".nav-item"),
  logoutBtn: document.getElementById("btn-logout"),

  bcCurrent: document.getElementById("bc-current"),
  globalSearch: document.getElementById("global-search-input"),
  searchResults: document.getElementById("search-results-dropdown"),

  notifBtn: document.getElementById("notification-bell-btn"),
  notifBadge: document.getElementById("notification-badge"),
  notifPanel: document.getElementById("notification-panel"),
  notifList: document.getElementById("notifications-list"),
  markReadBtn: document.getElementById("btn-mark-all-read"),

  sidebarAvatar: document.getElementById("sidebar-avatar"),
  sidebarName: document.getElementById("sidebar-user-name"),
  sidebarRole: document.getElementById("sidebar-user-role"),
  topAvatar: document.getElementById("top-user-avatar"),

  contentArea: document.getElementById("content-area"),
  panels: {
    dashboard_main_admin: document.getElementById("view-main-admin-dashboard"),
    dashboard_admin: document.getElementById("view-admin-dashboard"),
    dashboard_employee: document.getElementById("view-employee-dashboard"),
    tasks: document.getElementById("view-tasks"),
    attendance: document.getElementById("view-attendance"),
    leaves: document.getElementById("view-leaves"),
    expenses: document.getElementById("view-expenses"),
    reports: document.getElementById("view-reports"),
    directory: document.getElementById("view-directory"),
    profile: document.getElementById("view-profile"),
  },

  // Modals
  modals: {
    createAdmin: document.getElementById("modal-create-admin"),
    createEmployee: document.getElementById("modal-create-employee"),
    assignEmployee: document.getElementById("modal-assign-employee"),
    createTask: document.getElementById("modal-create-task"),
    taskDetail: document.getElementById("modal-task-detail"),
    attendanceCheckin: document.getElementById("modal-attendance-checkin"),
    selfieViewer: document.getElementById("modal-selfie-viewer"),
  },

  // Standard triggers & actions
  qaCreateAdmin: document.getElementById("btn-qa-create-admin"),
  qaCreateEmployee: document.getElementById("btn-qa-create-employee"),
  qaAssignEmployee: document.getElementById("btn-qa-assign-employee"),
  qaGenerateReport: document.getElementById("btn-qa-generate-report"),
  adminAddEmployee: document.getElementById("btn-admin-add-employee"),
  dirCreateAdmin: document.getElementById("btn-dir-create-admin"),
  dirCreateEmployee: document.getElementById("btn-dir-create-employee"),
  createTaskBtn: document.getElementById("btn-create-task-modal"),

  // Forms & Inputs
  formCreateAdmin: document.getElementById("form-create-admin"),
  formCreateEmployee: document.getElementById("form-create-employee"),
  formAssignEmployee: document.getElementById("form-assign-employee"),
  formCreateTask: document.getElementById("form-create-task"),
  formApplyLeave: document.getElementById("apply-leave-form"),
  formComment: document.getElementById("task-comment-form"),
  formProfileInfo: document.getElementById("profile-info-form"),
  formProfileSecurity: document.getElementById("profile-security-form"),

  // Attendance Clock
  clockInDesc: document.getElementById("clock-in-time-desc"),
  btnClockIn: document.getElementById("btn-clock-in"),
  btnClockOut: document.getElementById("btn-clock-out"),
  attendanceHistoryBody: document.getElementById("attendance-history-body"),

  // Leaves
  leavesTableBody: document.getElementById("leaves-table-body"),

  // Task Board elements
  filterPriority: document.getElementById("filter-priority"),
  filterStatus: document.getElementById("filter-status"),
  filterAssignee: document.getElementById("filter-assignee"),
  filterDept: document.getElementById("filter-department"),
  btnResetFilters: document.getElementById("btn-clear-filters"),
  btnToggleKanban: document.getElementById("btn-toggle-kanban"),
  btnToggleList: document.getElementById("btn-toggle-list"),
  kanbanBoard: document.getElementById("task-kanban-board"),
  listView: document.getElementById("task-list-view"),
  taskTableBody: document.getElementById("task-table-body"),

  // Reports page actions
  btnExportAttendance: document.getElementById("btn-export-attendance"),
  btnExportTasks: document.getElementById("btn-export-tasks"),
  btnExportPerformance: document.getElementById("btn-export-performance"),
  themeToggle: document.getElementById("theme-toggle-btn"),
};

// ==========================================
// THEME MANAGEMENT (DARK / LIGHT MODE)
// ==========================================
function initTheme() {
  const savedTheme = localStorage.getItem("theme");
  const systemPrefersDark = window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches;
  const isDark = savedTheme === "dark" || (!savedTheme && systemPrefersDark);

  if (isDark) {
    document.body.classList.add("dark-mode");
  } else {
    document.body.classList.remove("dark-mode");
  }
  updateThemeToggleIcon(isDark);
}

function toggleTheme() {
  const isDark = document.body.classList.toggle("dark-mode");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  updateThemeToggleIcon(isDark);
  showToast(
    "Theme Changed",
    `Switched to ${isDark ? "Dark" : "Light"} Mode`,
    "info",
  );
}

function updateThemeToggleIcon(isDark) {
  const icon = DOM.themeToggle.querySelector("i");
  if (icon) {
    if (isDark) {
      icon.className = "fa-solid fa-sun";
    } else {
      icon.className = "fa-regular fa-moon";
    }
  }
}

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
function showToast(title, message, type = "info") {
  if (state.isBackgroundPolling && type === "error") {
    console.warn(`[Background Poll] ${title}: ${message}`);
    return;
  }
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  let iconClass = "fa-circle-info";
  if (type === "success") iconClass = "fa-circle-check";
  if (type === "error") iconClass = "fa-triangle-exclamation";

  toast.innerHTML = `
    <i class="fa-solid ${iconClass} toast-icon"></i>
    <div class="toast-content">
      <h4>${title}</h4>
      <p>${message}</p>
    </div>
  `;
  container.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 50);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

let faceApiLoaded = false;
let faceApiLoading = false;

async function initFaceApi() {
  if (faceApiLoaded || faceApiLoading) return;
  faceApiLoading = true;
  console.log("Loading face-api.js models from CDN...");
  try {
    const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    faceApiLoaded = true;
    faceApiLoading = false;
    console.log("face-api.js models loaded successfully.");
  } catch (err) {
    faceApiLoading = false;
    console.error("Failed to load face-api.js models:", err);
  }
}

// ==========================================
// AUTHENTICATION & LOGIN FLOW
// ==========================================
async function initApp() {
  AOS.init({ duration: 800, once: true });

  if (state.token) {
    try {
      const res = await API.getMe();
      state.user = res.data;
      setupRoleVisibility();
      showToast("Welcome back", `Logged in as ${state.user.name}`, "success");
      DOM.loginPage.classList.add("hidden");
      DOM.appShell.classList.remove("hidden");

      // Initialize Face-API in background
      initFaceApi();

      // Load current URL hash if any
      const hash = window.location.hash.substring(1) || "dashboard";
      navigateTo(hash);
      loadNotifications();
      startGlobalDataPoll();
    } catch (err) {
      console.error(err);
      logout();
    }
  } else {
    DOM.loginPage.classList.remove("hidden");
    DOM.appShell.classList.add("hidden");
  }
  DOM.loader.style.opacity = 0;
  setTimeout(() => DOM.loader.classList.add("hidden"), 300);
}

function logout() {
  localStorage.removeItem("token");
  state.token = null;
  state.user = null;
  state.expensesInitialized = false;
  DOM.appShell.classList.add("hidden");
  DOM.loginPage.classList.remove("hidden");
  showToast("Signed Out", "You have been successfully signed out.", "info");
}

function setupRoleVisibility() {
  // Hide all admin only components first
  document
    .querySelectorAll(".admin-only")
    .forEach((el) => el.classList.add("hidden"));
  document
    .querySelectorAll(".main-admin-only")
    .forEach((el) => el.classList.add("hidden"));

  // Show base on role
  if (state.user.role === "main_admin") {
    document
      .querySelectorAll(".admin-only")
      .forEach((el) => el.classList.remove("hidden"));
    document
      .querySelectorAll(".main-admin-only")
      .forEach((el) => el.classList.remove("hidden"));
  } else if (state.user.role === "admin") {
    document
      .querySelectorAll(".admin-only")
      .forEach((el) => el.classList.remove("hidden"));
  }



  // Setup sidebar names
  DOM.sidebarName.textContent = state.user.name;
  DOM.sidebarRole.textContent =
    state.user.role === "main_admin"
      ? "Super Admin"
      : state.user.role === "admin"
        ? `${state.user.department} Admin`
        : `${state.user.department} Employee`;

  const avatarUrl =
    state.user.profilePicture ||
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80";
  DOM.sidebarAvatar.src = avatarUrl;
  DOM.topAvatar.src = avatarUrl;
}

// ==========================================
// ROUTER & NAVIGATION
// ==========================================
function navigateTo(viewName) {
  // Clear active views
  Object.values(DOM.panels).forEach((panel) => panel.classList.add("hidden"));
  DOM.navItems.forEach((item) => item.classList.remove("active"));

  // Scoped view dashboard matching
  let resolvedPanelName = viewName;
  if (viewName === "dashboard") {
    resolvedPanelName = `dashboard_${state.user.role}`;
  }

  // Select panel
  const targetPanel = DOM.panels[resolvedPanelName];
  if (targetPanel) {
    targetPanel.classList.remove("hidden");
    state.currentView = viewName;
    window.location.hash = viewName;

    // Set active link
    const activeLink = document.querySelector(
      `.nav-item[data-view="${viewName}"]`,
    );
    if (activeLink) activeLink.classList.add("active");

    // Update breadcrumbs
    DOM.bcCurrent.textContent =
      viewName.charAt(0).toUpperCase() + viewName.slice(1);

    // Trigger animations via GSAP
    gsap.fromTo(
      targetPanel,
      { opacity: 0, y: 15 },
      { opacity: 1, y: 0, duration: 0.4 },
    );

    // Load fresh data
    loadViewData(viewName);
  }
}

// Load data specifically for the page
async function loadViewData(viewName) {
  if (viewName === "dashboard") {
    await loadDashboardData();
  } else if (viewName === "tasks") {
    await loadTasksData();
  } else if (viewName === "attendance") {
    await loadAttendanceData();
  } else if (viewName === "leaves") {
    await loadLeavesData();
  } else if (viewName === "expenses") {
    await loadExpensesData();
  } else if (viewName === "directory") {
    await loadDirectoryData();
  } else if (viewName === "profile") {
    await loadProfileData();
  }
}

// ==========================================
// DASHBOARDS & CHARTS GENERATION
// ==========================================
async function loadDashboardData() {
  try {
    // Load today's checkin status for Employee and Admin roles
    if (state.user.role !== "main_admin") {
      try {
        const clockRes = await API.getTodayAttendance();
        const btnClockIns = document.querySelectorAll(".btn-clock-in-class");
        const btnClockOuts = document.querySelectorAll(".btn-clock-out-class");
        const clockInDescs = document.querySelectorAll(".clock-in-time-desc-class");

        if (clockRes.hasCheckedIn) {
          btnClockIns.forEach(btn => btn.disabled = true);
          btnClockOuts.forEach(btn => btn.disabled = clockRes.hasCheckedOut);

          const checkInTime = new Date(
            clockRes.data.checkInTime,
          ).toLocaleTimeString();
          const checkOutText = clockRes.hasCheckedOut
            ? `Checked out at ${new Date(clockRes.data.checkOutTime).toLocaleTimeString()}`
            : "Currently working...";

          clockInDescs.forEach(desc => desc.textContent = `Checked in today at ${checkInTime}. ${checkOutText}`);
        } else {
          btnClockIns.forEach(btn => btn.disabled = false);
          btnClockOuts.forEach(btn => btn.disabled = true);
          clockInDescs.forEach(desc => desc.textContent = "Not checked in today.");
        }
      } catch (clockErr) {
        console.warn("Failed to fetch today's clock status:", clockErr);
      }
    }

    if (state.user.role === "employee") {
      // Load quick tasks
      const taskRes = await API.getTasks();
      const tasks = taskRes.data;
      document.getElementById("emp-stat-assigned").textContent = tasks.length;
      document.getElementById("emp-stat-pending").textContent = tasks.filter(
        (t) => t.status === "pending",
      ).length;
      document.getElementById("emp-stat-completed").textContent = tasks.filter(
        (t) => t.status === "completed",
      ).length;

      // Render brief timeline schedule
      const scheduleContainer = document.getElementById("emp-today-schedule");
      scheduleContainer.innerHTML = "";
      const todayTasks = tasks.slice(0, 3);
      if (todayTasks.length === 0) {
        scheduleContainer.innerHTML =
          '<p class="text-muted" style="font-size: 0.8rem;">No tasks scheduled for today.</p>';
      } else {
        todayTasks.forEach((task) => {
          const deadline = new Date(task.deadline).toLocaleDateString();
          scheduleContainer.innerHTML += `
            <div class="employee-list-item">
              <div class="emp-item-left">
                <i class="fa-solid fa-file-invoice text-blue" style="font-size: 1.15rem; margin-right: 8px;"></i>
                <div class="emp-item-info">
                  <h5>${task.title}</h5>
                  <p>Deadline: ${deadline} | Priority: <strong>${task.priority.toUpperCase()}</strong></p>
                </div>
              </div>
              <span class="badge ${task.status === "completed" ? "badge-success" : "badge-warning"}">${task.status}</span>
            </div>
          `;
        });
      }
    } else {
      // Admin / Super Admin
      const res = await API.getDashboardStats();
      const stats = res.stats;

      if (state.user.role === "main_admin") {
        // Main Admin UI bindings
        document.getElementById("ma-stat-admins").textContent =
          stats.totalAdmins;
        document.getElementById("ma-stat-employees").textContent =
          stats.totalEmployees;
        document.getElementById("ma-stat-projects").textContent =
          stats.totalProjects;
        document.getElementById("ma-stat-active-tasks").textContent =
          stats.activeTasks;
        document.getElementById("ma-stat-attendance").textContent =
          stats.attendanceToday;
        document.getElementById("ma-stat-leaves").textContent =
          stats.leaveRequests;

        // Counter animation
        if (!state.isBackgroundPolling) {
          gsap.from(".counter", {
            textContent: 0,
            duration: 1,
            ease: "power2.out",
            snap: { textContent: 1 },
          });
        }

        // Render timeline activity
        const timeline = document.getElementById("ma-activity-timeline");
        timeline.innerHTML = "";
        if (res.recentActivities.length === 0) {
          timeline.innerHTML =
            '<p class="text-muted">No recent activity logged.</p>';
        } else {
          res.recentActivities.forEach((act) => {
            const timeStr = new Date(act.createdAt).toLocaleString();
            timeline.innerHTML += `
              <div class="timeline-item">
                <div class="timeline-icon">
                  <i class="fa-solid fa-list-check text-blue"></i>
                </div>
                <div class="timeline-content">
                  <h5>Task Assigned to ${act.assignedTo?.name || "N/A"}</h5>
                  <p>"${act.title}" created by ${act.assignedBy?.name || "Admin"}</p>
                  <span>${timeStr}</span>
                </div>
              </div>
            `;
          });
        }

        // Build Charts
        if (!state.isBackgroundPolling) {
          buildMainAdminCharts(res.charts);
        }
      } else if (state.user.role === "admin") {
        // Department Admin UI bindings
        document.getElementById("admin-stat-employees").textContent =
          stats.totalEmployees;
        document.getElementById("admin-stat-tasks").textContent =
          stats.activeTasks;
        document.getElementById("admin-stat-leaves").textContent =
          stats.leaveRequests;
        document.getElementById("admin-stat-attendance").textContent =
          stats.attendanceToday;

        // Render simple team directory list
        const empListContainer = document.getElementById(
          "admin-employees-list-container",
        );
        const employeesRes = await API.getEmployees();
        const employees = employeesRes.data;
        empListContainer.innerHTML = "";
        if (employees.length === 0) {
          empListContainer.innerHTML =
            '<p class="text-muted">No employees registered yet.</p>';
        } else {
          employees.forEach((emp) => {
            const avatarUrl =
              emp.profilePicture ||
              "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80";
            empListContainer.innerHTML += `
              <div class="employee-list-item">
                <div class="emp-item-left">
                  <img src="${avatarUrl}" alt="Avatar" class="emp-item-avatar">
                  <div class="emp-item-info">
                    <h5>${emp.name}</h5>
                    <p>${emp.email} | ${emp.department}</p>
                  </div>
                </div>
                <span class="badge badge-info">Active</span>
              </div>
            `;
          });
        }

        // Render team calendar
        renderTeamCalendarSummary();
      }
    }
  } catch (err) {
    showToast("Stats Load Error", err.message, "error");
  }
}

// Draw Super Admin charts
function buildMainAdminCharts(chartData) {
  // Destroy old charts to prevent redraw memory issues
  if (state.charts.productivity) state.charts.productivity.destroy();
  if (state.charts.tasks) state.charts.tasks.destroy();

  const ctxProd = document
    .getElementById("ma-productivity-chart")
    .getContext("2d");
  state.charts.productivity = new Chart(ctxProd, {
    type: "line",
    data: {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      datasets: [
        {
          label: "Productivity Average %",
          data: chartData.productivity,
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          tension: 0.4,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { min: 0, max: 100 },
      },
    },
  });
  const ctxTasks = document.getElementById("ma-tasks-chart").getContext("2d");
  const tBreak = chartData.taskCompletion;
  state.charts.tasks = new Chart(ctxTasks, {
    type: "doughnut",
    data: {
      labels: ["Pending", "In Progress", "Review", "Completed", "Rejected"],
      datasets: [
        {
          data: [
            tBreak.pending,
            tBreak.inProgress,
            tBreak.review,
            tBreak.completed,
            tBreak.rejected,
          ],
          backgroundColor: [
            "#94a3b8",
            "#3b82f6",
            "#f59e0b",
            "#10b981",
            "#ef4444",
          ],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } } },
    },
  });
}

// Team calendar overlay for Admin page
async function renderTeamCalendarSummary() {
  const container = document.getElementById("admin-team-calendar");
  if (!container) return;

  if (!state.isBackgroundPolling) {
    container.innerHTML = `<div class="p-4"><p class="text-muted" style="font-size:0.8rem;">Loading calendar tracking data...</p></div>`;
  }

  try {
    const res = await API.getAttendanceHistory();
    const records = res.data;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    let html = `
      <div class="calendar-header-actions" style="padding: 12px; border-bottom: 1px solid var(--color-border);">
        <h4 style="font-size: 0.85rem; font-weight:700;">${monthNames[month]} ${year} - Attendance Overview</h4>
      </div>
      <div class="calendar-grid" style="padding: 8px;">
    `;

    // Day headers
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((day) => {
      html += `<div class="calendar-day-header">${day}</div>`;
    });

    // Empty cells for alignment
    for (let i = 0; i < firstDay; i++) {
      html += `<div class="calendar-day-cell inactive"><span class="day-num"></span></div>`;
    }

    // Days
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayRecords = records.filter((r) => r.date === dateStr);

      let statusColorClass = "";
      let textIndicator = "";

      if (dayRecords.length > 0) {
        const isLate = dayRecords.some((r) => r.lateEntry);
        statusColorClass = isLate ? "bg-orange" : "bg-green";
        textIndicator = `${dayRecords.length} Present`;
      }

      html += `
        <div class="calendar-day-cell" style="height: 54px; justify-content: space-between;">
          <span class="day-num">${day}</span>
          ${statusColorClass ? `<span class="day-status-indicator ${statusColorClass}"></span>` : ""}
          <span class="day-time-tag">${textIndicator}</span>
        </div>
      `;
    }

    html += `</div>`;
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="p-4"><p class="text-error">Error: ${err.message}</p></div>`;
  }
}

// ==========================================
// TASK MANAGEMENT (KANBAN & TABLES)
// ==========================================
let taskViewMode = "kanban"; // kanban or list

async function loadTasksData() {
  try {
    const filters = {
      priority: DOM.filterPriority.value,
      status: DOM.filterStatus.value,
      assignedTo: DOM.filterAssignee.value,
      department: DOM.filterDept.value,
    };

    const res = await API.getTasks(filters);
    state.tasks = res.data;

    // Populate assignee filter options if empty
    if (DOM.filterAssignee.options.length <= 1) {
      populateAssigneeDropdowns();
    }

    renderTaskViews();
  } catch (err) {
    showToast("Task Board Error", err.message, "error");
  }
}

async function populateAssigneeDropdowns() {
  try {
    let assignees = [];
    if (state.user && state.user.role === "main_admin") {
      const [resEmp, resAdmin] = await Promise.all([
        API.getEmployees(),
        API.getAdmins(),
      ]);
      assignees = [...resEmp.data, ...resAdmin.data];
    } else {
      const resEmp = await API.getEmployees();
      assignees = resEmp.data;
    }

    state.employees = assignees;

    const elements = [
      DOM.filterAssignee,
      document.getElementById("task-new-assignee"),
      document.getElementById("assign-employee-select"),
    ];

    elements.forEach((select) => {
      if (!select) return;
      
      // Preserve first option ONLY if it's a placeholder (value is empty)
      let firstOpt = null;
      if (select.options.length > 0 && select.options[0].value === "") {
        firstOpt = select.options[0];
      }
      
      select.innerHTML = "";
      if (firstOpt) select.appendChild(firstOpt);

      assignees.forEach((user) => {
        const opt = document.createElement("option");
        opt.value = user._id;
        const roleSuffix = user.role === "admin" ? " - Admin" : "";
        opt.textContent = `${user.name} (${user.department}${roleSuffix})`;
        select.appendChild(opt);
      });
    });
  } catch (err) {
    console.error(err);
  }
}

function renderTaskViews() {
  if (taskViewMode === "kanban") {
    DOM.kanbanBoard.classList.remove("hidden");
    DOM.listView.classList.add("hidden");
    renderKanbanBoard();
  } else {
    DOM.kanbanBoard.classList.add("hidden");
    DOM.listView.classList.remove("hidden");
    renderListTable();
  }
}

function renderKanbanBoard() {
  const columns = {
    pending: document.querySelector("#col-pending .kanban-cards-container"),
    in_progress: document.querySelector(
      "#col-in_progress .kanban-cards-container",
    ),
    review: document.querySelector("#col-review .kanban-cards-container"),
    completed: document.querySelector("#col-completed .kanban-cards-container"),
  };

  // Clear columns
  Object.values(columns).forEach((col) => {
    if (col) col.innerHTML = "";
  });

  state.tasks.forEach((task) => {
    // Map status variables to standard 4 columns
    let targetColKey = task.status;
    if (task.status === "rejected" || task.status === "reopened") {
      targetColKey = "pending";
    }

    const col = columns[targetColKey];
    if (!col) return;

    const deadline = new Date(task.deadline);
    const isOverdue = deadline < new Date() && task.status !== "completed";
    const avatarUrl =
      task.assignedTo?.profilePicture ||
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80";

    const card = document.createElement("div");
    card.className = "task-card";
    card.setAttribute("data-id", task._id);
    card.innerHTML = `
      <div class="task-card-header">
        <h4>${task.title}</h4>
        <span class="badge ${task.priority === "high" ? "badge-error" : task.priority === "medium" ? "badge-warning" : "badge-info"}">${task.priority}</span>
      </div>
      <p class="task-card-desc">${task.description}</p>
      
      <div class="progress-container">
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${task.progress}%"></div>
        </div>
        <span style="font-size:0.7rem; font-weight:700;">${task.progress}%</span>
      </div>

      <div class="task-card-footer">
        <div class="assignee-badge-small">
          <img src="${avatarUrl}" class="assignee-avatar-mini" alt="Avatar">
          <span class="assignee-name-mini">${task.assignedTo?.name || "Unassigned"}</span>
        </div>
        <span class="deadline-badge ${isOverdue ? "overdue" : ""}">
          <i class="fa-regular fa-clock"></i> ${deadline.toLocaleDateString()}
        </span>
      </div>
    `;

    card.addEventListener("click", () => openTaskDetailsModal(task._id));
    col.appendChild(card);
  });

  // Update count indicators
  document.querySelector("#col-pending .count-badge").textContent =
    state.tasks.filter((t) =>
      ["pending", "rejected", "reopened"].includes(t.status),
    ).length;
  document.querySelector("#col-in_progress .count-badge").textContent =
    state.tasks.filter((t) => t.status === "in_progress").length;
  document.querySelector("#col-review .count-badge").textContent =
    state.tasks.filter((t) => t.status === "review").length;
  document.querySelector("#col-completed .count-badge").textContent =
    state.tasks.filter((t) => t.status === "completed").length;
}

function renderListTable() {
  const isManager =
    state.user.role === "main_admin" || state.user.role === "admin";
  const tableHeaderRow =
    document.getElementById("task-table-header-row") ||
    document.querySelector("#task-list-view thead tr");

  if (isManager) {
    tableHeaderRow.innerHTML = `
      <th style="width: 40px;"><input type="checkbox" id="task-select-all" style="cursor:pointer;"></th>
      <th>Task Title</th>
      <th>Department</th>
      <th>Priority</th>
      <th>Deadline</th>
      <th>Assignee</th>
      <th>Status</th>
      <th>Progress</th>
      <th>Actions</th>
    `;
  } else {
    tableHeaderRow.innerHTML = `
      <th>Task Title</th>
      <th>Department</th>
      <th>Priority</th>
      <th>Deadline</th>
      <th>Assignee</th>
      <th>Status</th>
      <th>Progress</th>
      <th>Actions</th>
    `;
  }

  DOM.taskTableBody.innerHTML = "";
  if (state.tasks.length === 0) {
    DOM.taskTableBody.innerHTML = `<tr><td colspan="${isManager ? 9 : 8}" style="text-align:center;">No tasks matching your current filters.</td></tr>`;
    return;
  }

  state.tasks.forEach((task) => {
    const deadline = new Date(task.deadline).toLocaleDateString();
    const avatarUrl =
      task.assignedTo?.profilePicture ||
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80";

    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";

    let checkboxCol = "";
    let actionButtons = `<button class="btn btn-light btn-sm" onclick="event.stopPropagation(); openTaskDetailsModal('${task._id}')">View</button>`;

    if (isManager) {
      checkboxCol = `<td><input type="checkbox" class="task-row-select" data-id="${task._id}" style="cursor:pointer;" onclick="event.stopPropagation();"></td>`;
      actionButtons = `
        <div style="display:flex; gap:6px;">
          <button class="btn btn-light btn-sm" onclick="event.stopPropagation(); openTaskDetailsModal('${task._id}')">View</button>
          <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteTaskHandler('${task._id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      `;
    }

    tr.innerHTML = `
      ${checkboxCol}
      <td><strong>${task.title}</strong></td>
      <td>${task.department}</td>
      <td><span class="badge ${task.priority === "high" ? "badge-error" : task.priority === "medium" ? "badge-warning" : "badge-info"}">${task.priority}</span></td>
      <td>${deadline}</td>
      <td>
        <div class="employee-table-cell">
          <img src="${avatarUrl}" class="employee-table-avatar">
          <span>${task.assignedTo?.name || "N/A"}</span>
        </div>
      </td>
      <td><span class="badge ${task.status === "completed" ? "badge-success" : "badge-warning"}">${task.status}</span></td>
      <td>
        <div class="progress-container">
          <div class="progress-bar-bg" style="width: 80px;">
            <div class="progress-bar-fill" style="width: ${task.progress}%"></div>
          </div>
          <span>${task.progress}%</span>
        </div>
      </td>
      <td>
        ${actionButtons}
      </td>
    `;

    tr.addEventListener("click", () => openTaskDetailsModal(task._id));
    DOM.taskTableBody.appendChild(tr);
  });

  if (isManager) {
    setupBulkSelectListeners();
  }
}

function setupBulkSelectListeners() {
  const selectAllCheckbox = document.getElementById("task-select-all");
  const rowCheckboxes = document.querySelectorAll(".task-row-select");
  const bulkBar = document.getElementById("bulk-actions-bar");
  const bulkCountText = document.getElementById("bulk-selected-text");

  if (!selectAllCheckbox) return;

  const updateBulkBar = () => {
    const checkedCount = document.querySelectorAll(
      ".task-row-select:checked",
    ).length;
    if (checkedCount > 0) {
      bulkBar.classList.remove("hidden");
      bulkCountText.textContent = `${checkedCount} task(s) selected`;
    } else {
      bulkBar.classList.add("hidden");
    }
  };

  selectAllCheckbox.addEventListener("change", (e) => {
    rowCheckboxes.forEach((cb) => {
      cb.checked = e.target.checked;
    });
    updateBulkBar();
  });

  rowCheckboxes.forEach((cb) => {
    cb.addEventListener("change", () => {
      const allChecked = Array.from(rowCheckboxes).every((c) => c.checked);
      selectAllCheckbox.checked = allChecked;
      updateBulkBar();
    });
  });

  updateBulkBar();
}

window.deleteTaskHandler = async function (taskId) {
  if (!confirm("Are you sure you want to delete this task?")) return;
  try {
    const res = await API.deleteTask(taskId);
    showToast("Task Deleted", res.message, "success");
    loadTasksData();
  } catch (err) {
    showToast("Deletion failed", err.message, "error");
  }
};

// Global make openTaskDetailsModal accessible in global scope since table list buttons use inline onclick
window.openTaskDetailsModal = openTaskDetailsModal;

async function openTaskDetailsModal(taskId) {
  try {
    const res = await API.getTask(taskId);
    state.selectedTask = res.data;

    const task = state.selectedTask;

    // Bind info fields
    document.getElementById("task-detail-title").textContent = task.title;
    document.getElementById("task-detail-desc").textContent = task.description;

    const pBadge = document.getElementById("task-detail-badge-priority");
    pBadge.textContent = task.priority;
    pBadge.className = `badge ${task.priority === "high" ? "badge-error" : task.priority === "medium" ? "badge-warning" : "badge-info"}`;

    const sBadge = document.getElementById("task-detail-badge-status");
    sBadge.textContent = task.status;
    sBadge.className = `badge ${task.status === "completed" ? "badge-success" : "badge-warning"}`;

    document.getElementById("task-detail-dept").textContent = task.department;
    document.getElementById("task-detail-by").textContent =
      task.assignedBy?.name || "N/A";
    document.getElementById("task-detail-to").textContent =
      task.assignedTo?.name || "N/A";
    document.getElementById("task-detail-deadline").textContent = new Date(
      task.deadline,
    ).toLocaleDateString();

    // Status and slider bindings
    document.getElementById("task-detail-status-select").value = task.status;
    document.getElementById("task-detail-progress-slider").value =
      task.progress;
    document.getElementById("task-detail-progress-label").textContent =
      `${task.progress}%`;

    // Render Comments
    renderTaskComments(task.comments);

    // Render Attachments
    renderTaskAttachments(task.attachments);

    // Render Activity log
    renderTaskActivity(task.activityHistory);

    // Show Modal
    DOM.modals.taskDetail.classList.remove("hidden");
  } catch (err) {
    showToast("Task Load Error", err.message, "error");
  }
}

function renderTaskComments(comments) {
  const container = document.getElementById("task-comments-list");
  container.innerHTML = "";
  if (comments.length === 0) {
    container.innerHTML =
      '<p class="text-muted" style="font-size:0.75rem; text-align:center;">No comments yet. Start the conversation!</p>';
    return;
  }

  comments.forEach((c) => {
    const avatar =
      c.user?.profilePicture ||
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80";
    const time = new Date(c.timestamp).toLocaleString();
    container.innerHTML += `
      <div class="comment-item">
        <img src="${avatar}" class="comment-avatar" alt="Avatar">
        <div class="comment-content-box">
          <div class="comment-header">
            <h5>${c.user?.name || "System"}</h5>
            <span>${time}</span>
          </div>
          <p>${c.comment}</p>
        </div>
      </div>
    `;
  });

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

function renderTaskAttachments(attachments) {
  const container = document.getElementById("task-detail-attachments-list");
  container.innerHTML = "";
  if (!attachments || attachments.length === 0) {
    container.innerHTML =
      '<p class="text-muted" style="font-size:0.75rem;">No files uploaded.</p>';
    return;
  }

  attachments.forEach((file) => {
    container.innerHTML += `
      <div class="attachment-item">
        <div class="attachment-info">
          <i class="fa-solid fa-file-lines text-blue"></i>
          <a href="${file.url}" target="_blank" download>${file.name}</a>
        </div>
        <span style="font-size:0.65rem; color:var(--color-text-tertiary);">${file.type || "File"}</span>
      </div>
    `;
  });
}

function renderTaskActivity(history) {
  const container = document.getElementById("task-detail-activity-history");
  container.innerHTML = "";
  if (!history || history.length === 0) {
    container.innerHTML =
      '<p class="text-muted" style="font-size:0.65rem;">No activity log recorded.</p>';
    return;
  }

  history
    .slice()
    .reverse()
    .forEach((log) => {
      const time = new Date(log.timestamp).toLocaleString();
      container.innerHTML += `
      <div class="activity-log-item">
        <p><strong>${log.user?.name || "System"}</strong>: ${log.action}</p>
        <span>${time}</span>
      </div>
    `;
    });
}

// ==========================================
// ATTENDANCE CALENDAR & HISTORIES
// ==========================================
async function loadAttendanceData() {
  try {
    const isManager =
      state.user.role === "main_admin" || state.user.role === "admin";
    const select = document.getElementById("attendance-user-select");

    // Populate select element if it's empty
    if (isManager && select && select.options.length <= 1) {
      if (state.employees.length === 0) {
        await populateAssigneeDropdowns();
      }

      // Clear all options except default
      if (state.user.role === "main_admin") {
        select.innerHTML = '<option value="">All Employees & Admins</option>';
      } else {
        select.innerHTML = '<option value="">All Employees</option>';
      }

      state.employees.forEach((user) => {
        if (state.user.role === "admin" && user.role === "admin") {
          return;
        }
        const opt = document.createElement("option");
        opt.value = user._id;
        const roleSuffix = user.role === "admin" ? " - Admin" : "";
        opt.textContent = `${user.name} (${user.department}${roleSuffix})`;
        select.appendChild(opt);
      });
    }

    const selectedUserId = select ? select.value : "";
    const res = await API.getAttendanceHistory({
      employeeId: selectedUserId,
      year: state.activeCalendarYear,
      month: state.activeCalendarMonth + 1,
    });

    // Sync Date Filter input value
    const dateInput = document.getElementById("attendance-date-filter");
    if (dateInput) {
      dateInput.value = state.selectedAttendanceDate || "";
    }

    // Bind calendar labels
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    document.getElementById("calendar-month-year-label").textContent =
      `${monthNames[state.activeCalendarMonth]} ${state.activeCalendarYear}`;

    const nameInput = document.getElementById("attendance-name-filter");
    const searchName = nameInput ? nameInput.value.trim().toLowerCase() : "";

    let calendarHistory = res.data;
    if (searchName) {
      calendarHistory = calendarHistory.filter((rec) => {
        const empName = rec.employeeId?.name || "";
        const empRole = rec.employeeId?.role || "";
        return empName.toLowerCase().includes(searchName) || empRole.toLowerCase().includes(searchName);
      });
    }

    renderAttendanceCalendar(calendarHistory, selectedUserId);

    let filteredHistory = calendarHistory;
    if (state.selectedAttendanceDate) {
      filteredHistory = calendarHistory.filter((rec) => rec.date === state.selectedAttendanceDate);
    }
    renderAttendanceLogList(filteredHistory, selectedUserId);
  } catch (err) {
    showToast("Attendance Loading Error", err.message, "error");
  }
}

function renderAttendanceCalendar(history, selectedUserId) {
  const grid = document.getElementById("attendance-calendar-grid");
  const legend = document.querySelector(".attendance-legend");

  // Otherwise show calendar
  grid.style.display = "grid";
  if (legend) legend.style.display = "flex";
  const placeholder = document.getElementById("calendar-placeholder-msg");
  if (placeholder) placeholder.style.display = "none";

  grid.innerHTML = "";

  // Set headers
  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((day) => {
    const head = document.createElement("div");
    head.className = "calendar-day-header";
    head.textContent = day;
    grid.appendChild(head);
  });

  const firstDayIndex = new Date(
    state.activeCalendarYear,
    state.activeCalendarMonth,
    1,
  ).getDay();
  const totalDays = new Date(
    state.activeCalendarYear,
    state.activeCalendarMonth + 1,
    0,
  ).getDate();

  // Pad previous month days
  for (let i = 0; i < firstDayIndex; i++) {
    const pad = document.createElement("div");
    pad.className = "calendar-day-cell inactive";
    grid.appendChild(pad);
  }

  // Current month days
  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${state.activeCalendarYear}-${String(state.activeCalendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const cell = document.createElement("div");
    cell.className = "calendar-day-cell";
    cell.style.cursor = "pointer";

    if (state.selectedAttendanceDate === dateStr) {
      cell.style.border = "2px solid var(--color-primary)";
      cell.style.background = "rgba(59, 130, 246, 0.08)";
    }

    cell.addEventListener("click", () => {
      state.selectedAttendanceDate = dateStr;
      const dateInput = document.getElementById("attendance-date-filter");
      if (dateInput) dateInput.value = dateStr;
      loadAttendanceData();
    });

    let indicatorHtml = "";
    let timeHtml = "";

    if (selectedUserId) {
      const record = history.find((h) => h.date === dateStr);
      if (record) {
        let color = "bg-green";
        if (record.status === "absent") {
          color = "bg-red";
          timeHtml = `<span class="day-time-tag">ABSENT</span>`;
        } else if (record.status === "leave") {
          color = "bg-blue";
          timeHtml = `<span class="day-time-tag">LEAVE</span>`;
        } else if (record.status === "late" || record.lateEntry) {
          color = "bg-orange";
          const inTime = new Date(record.checkInTime).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          timeHtml = `<span class="day-time-tag">${inTime}</span>`;
        } else {
          color = "bg-green";
          const inTime = new Date(record.checkInTime).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          timeHtml = `<span class="day-time-tag">${inTime}</span>`;
        }
        indicatorHtml = `<span class="day-status-indicator ${color}"></span>`;
      }
    } else {
      const dayRecords = history.filter((h) => h.date === dateStr);
      if (dayRecords.length > 0) {
        const presentCount = dayRecords.filter(r => r.status === 'present' || r.status === 'late').length;
        const lateCount = dayRecords.filter(r => r.status === 'late' || r.lateEntry).length;
        const leaveCount = dayRecords.filter(r => r.status === 'leave').length;
        const absentCount = dayRecords.filter(r => r.status === 'absent').length;

        let color = "bg-green";
        if (presentCount > 0) {
          color = lateCount > 0 ? "bg-orange" : "bg-green";
          timeHtml = `<span class="day-time-tag">${presentCount} Present</span>`;
        } else if (leaveCount > 0) {
          color = "bg-blue";
          timeHtml = `<span class="day-time-tag">${leaveCount} Leave</span>`;
        } else if (absentCount > 0) {
          color = "bg-red";
          timeHtml = `<span class="day-time-tag">${absentCount} Absent</span>`;
        }
        indicatorHtml = `<span class="day-status-indicator ${color}"></span>`;
      }
    }

    cell.innerHTML = `
      <span class="day-num">${day}</span>
      ${indicatorHtml}
      ${timeHtml}
    `;
    grid.appendChild(cell);
  }
}

function renderAttendanceLogList(history, selectedUserId) {
  const headerRow = document.getElementById("attendance-table-header");
  const showUserInfo =
    (state.user.role === "main_admin" || state.user.role === "admin") &&
    !selectedUserId;

  if (showUserInfo) {
    headerRow.innerHTML = `
      <th>Employee/Admin</th>
      <th>Role</th>
      <th>Date</th>
      <th>Status</th>
      <th>Check In</th>
      <th>Check Out</th>
      <th>Hours Worked</th>
      <th>Late Entry</th>
      <th>Location</th>
      <th>Selfie</th>
    `;
  } else {
    headerRow.innerHTML = `
      <th>Date</th>
      <th>Status</th>
      <th>Check In</th>
      <th>Check Out</th>
      <th>Hours Worked</th>
      <th>Late Entry</th>
      <th>Location</th>
      <th>Selfie</th>
    `;
  }

  DOM.attendanceHistoryBody.innerHTML = "";
  if (history.length === 0) {
    DOM.attendanceHistoryBody.innerHTML = `<tr><td colspan="${showUserInfo ? 10 : 8}" style="text-align:center;">No records found for this period.</td></tr>`;
    return;
  }

  // Define global view selfie handler
  window.viewSelfie = function (src) {
    const modal = document.getElementById("modal-selfie-viewer");
    const img = document.getElementById("selfie-viewer-img");
    if (modal && img) {
      img.src = src;
      modal.classList.remove("hidden");
    }
  };

  history.forEach((rec) => {
    const hasTime = rec.checkInTime && rec.status !== "absent" && rec.status !== "leave";
    const checkIn = hasTime ? new Date(rec.checkInTime).toLocaleTimeString() : "—";
    const checkOut = hasTime && rec.checkOutTime
      ? new Date(rec.checkOutTime).toLocaleTimeString()
      : "—";
    const hours = rec.workingHours ? `${rec.workingHours} hrs` : "—";

    let badgeClass = "badge-success";
    if (rec.status === "late") badgeClass = "badge-warning";
    else if (rec.status === "absent") badgeClass = "badge-error";
    else if (rec.status === "leave") badgeClass = "badge-info";

    const tr = document.createElement("tr");

    const locationHtml = rec.location
      ? `<a href="https://www.google.com/maps?q=${encodeURIComponent(rec.location)}" target="_blank" class="badge badge-info" style="display:inline-flex; align-items:center; gap:4px; text-decoration:none;" onclick="event.stopPropagation();"><i class="fa-solid fa-location-dot"></i> Maps</a>`
      : "—";

    const selfieHtml = rec.selfie
      ? `<img src="${rec.selfie}" style="width: 38px; height: 38px; border-radius: 4px; object-fit: cover; cursor: pointer; border: 1px solid var(--color-border);" onclick="viewSelfie('${rec.selfie}')" title="Click to view full photo" />`
      : "—";

    if (showUserInfo) {
      const empName = rec.employeeId?.name || "N/A";
      const empRole = rec.employeeId?.role === "admin" ? "Admin" : "Employee";
      const avatarUrl =
        rec.employeeId?.profilePicture ||
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80";
      tr.innerHTML = `
        <td>
          <div class="employee-table-cell">
            <img src="${avatarUrl}" class="employee-table-avatar">
            <span>${empName}</span>
          </div>
        </td>
        <td><span class="badge badge-info">${empRole}</span></td>
        <td><strong>${rec.date}</strong></td>
        <td><span class="badge ${badgeClass}">${rec.status.toUpperCase()}</span></td>
        <td>${checkIn}</td>
        <td>${checkOut}</td>
        <td>${hours}</td>
        <td>${rec.lateEntry ? "YES" : "NO"}</td>
        <td>${locationHtml}</td>
        <td>${selfieHtml}</td>
      `;
    } else {
      tr.innerHTML = `
        <td><strong>${rec.date}</strong></td>
        <td><span class="badge ${badgeClass}">${rec.status.toUpperCase()}</span></td>
        <td>${checkIn}</td>
        <td>${checkOut}</td>
        <td>${hours}</td>
        <td>${rec.lateEntry ? "YES" : "NO"}</td>
        <td>${locationHtml}</td>
        <td>${selfieHtml}</td>
      `;
    }
    DOM.attendanceHistoryBody.appendChild(tr);
  });
}

// ==========================================
// LEAVE PORTAL
// ==========================================
async function loadLeavesData() {
  try {
    const res = await API.getLeaveHistory();
    state.leaves = res.data;
    renderLeavesTable(state.leaves);
  } catch (err) {
    showToast("Leaves Loading Error", err.message, "error");
  }
}
function renderLeavesTable(leaves) {
  DOM.leavesTableBody.innerHTML = "";

  const btnBulkDeleteLeaves = document.getElementById("btn-bulk-delete-leaves");
  if (btnBulkDeleteLeaves) {
    btnBulkDeleteLeaves.style.display = "none";
  }
  const selectAllLeaves = document.getElementById("leave-select-all");
  if (selectAllLeaves) {
    selectAllLeaves.checked = false;
  }
  updateLeaveBulkButton();

  // Client-side date and name filtering
  const filterStart = document.getElementById("leave-filter-start")?.value;
  const filterEnd = document.getElementById("leave-filter-end")?.value;
  const filterName = document.getElementById("leave-filter-name")?.value?.trim()?.toLowerCase();

  let filteredLeaves = leaves;

  if (filterStart) {
    filteredLeaves = filteredLeaves.filter(leave => {
      const leaveStartStr = leave.startDate ? leave.startDate.substring(0, 10) : "";
      return leaveStartStr >= filterStart;
    });
  }

  if (filterEnd) {
    filteredLeaves = filteredLeaves.filter(leave => {
      const leaveEndStr = leave.endDate ? leave.endDate.substring(0, 10) : "";
      return leaveEndStr <= filterEnd;
    });
  }

  if (filterName) {
    filteredLeaves = filteredLeaves.filter(leave => {
      const empName = leave.employeeId?.name || "";
      return empName.toLowerCase().includes(filterName);
    });
  }

  if (filteredLeaves.length === 0) {
    DOM.leavesTableBody.innerHTML =
      '<tr><td colspan="9" style="text-align:center;">No leave applications on file.</td></tr>';
    return;
  }

  filteredLeaves.forEach((leave) => {
    const startPart = leave.startDate ? leave.startDate.substring(0, 10) : "";
    const startParts = startPart.split('-');
    const startDate = startParts.length === 3 ? `${startParts[2]}/${startParts[1]}/${startParts[0]}` : startPart;

    const endPart = leave.endDate ? leave.endDate.substring(0, 10) : "";
    const endParts = endPart.split('-');
    const endDate = endParts.length === 3 ? `${endParts[2]}/${endParts[1]}/${endParts[0]}` : endPart;

    const isPending = leave.status === "pending";

    let actionsHtml = "—";
    let approveRejectButtons = "";
    if ((state.user.role === "admin" || state.user.role === "main_admin") && isPending) {
      approveRejectButtons = `
        <button class="btn btn-success btn-sm" onclick="event.stopPropagation(); processLeave('${leave._id}', 'approved')" title="Approve"><i class="fa-solid fa-check"></i></button>
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); processLeave('${leave._id}', 'rejected')" title="Reject"><i class="fa-solid fa-xmark"></i></button>
      `;
    }
    actionsHtml = `
      <div style="display:flex; gap:6px; align-items: center;">
        ${approveRejectButtons}
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); window.deleteLeaveHandler('${leave._id}')" title="Delete Leave"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;

    const checkboxHtml = `<td><input type="checkbox" class="leave-row-select" data-id="${leave._id}"></td>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      ${checkboxHtml}
      <td>
        <div class="employee-table-cell">
          <img src="${leave.employeeId?.profilePicture || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80"}" class="employee-table-avatar">
          <span>${leave.employeeId?.name || "N/A"}</span>
        </div>
      </td>
      <td>${leave.employeeId?.department || "N/A"}</td>
      <td><strong>${leave.leaveType}</strong></td>
      <td>${startDate}</td>
      <td>${endDate}</td>
      <td>${leave.reason}</td>
      <td><span class="badge ${leave.status === "approved" ? "badge-success" : leave.status === "rejected" ? "badge-error" : "badge-warning"}">${leave.status}</span></td>
      <td>${actionsHtml}</td>
    `;
    DOM.leavesTableBody.appendChild(tr);
  });

  // Ensure table action column visibility refreshes based on role
  setupRoleVisibility();
}

window.processLeave = async function (id, actionStatus) {
  const remark = prompt(`Provide remarks for leave ${actionStatus}:`);
  try {
    const res = await API.approveRejectLeave(id, actionStatus, remark);
    showToast("Leave Updated", res.message, "success");
    loadLeavesData();
  } catch (err) {
    showToast("Leave update failed", err.message, "error");
  }
};



// ==========================================
async function loadDirectoryData() {
  if (state.user.role !== "main_admin") return;

  // Reset bulk delete UI state
  const btnBulkDeleteAdmins = document.getElementById("btn-bulk-delete-admins");
  if (btnBulkDeleteAdmins) btnBulkDeleteAdmins.style.display = "none";
  const selectAllAdmins = document.getElementById("admin-select-all");
  if (selectAllAdmins) selectAllAdmins.checked = false;

  const btnBulkDeleteEmployees = document.getElementById("btn-bulk-delete-employees");
  if (btnBulkDeleteEmployees) btnBulkDeleteEmployees.style.display = "none";
  const selectAllEmployees = document.getElementById("employee-select-all");
  if (selectAllEmployees) selectAllEmployees.checked = false;

  try {
    const resAdmins = await API.getAdmins();
    const resEmployees = await API.getEmployees();

    // Bind admins table
    const adTable = document.getElementById("dir-admins-table-body");
    adTable.innerHTML = "";
    resAdmins.data.forEach((admin) => {
      adTable.innerHTML += `
        <tr>
          <td><input type="checkbox" class="admin-row-select" data-id="${admin._id}"></td>
          <td><strong>${admin.name}</strong></td>
          <td>${admin.email}</td>
          <td>${admin.department}</td>
          <td>
            <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteUserHandler('${admin._id}')" title="Delete Admin"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      `;
    });

    // Bind employees table
    const empTable = document.getElementById("dir-employees-table-body");
    empTable.innerHTML = "";
    resEmployees.data.forEach((emp) => {
      empTable.innerHTML += `
        <tr>
          <td><input type="checkbox" class="employee-row-select" data-id="${emp._id}"></td>
          <td><strong>${emp.name}</strong></td>
          <td>${emp.email}</td>
          <td>${emp.department}</td>
          <td>${emp.adminId ? emp.adminId.name : '<span class="text-error">Unassigned</span>'}</td>
          <td>
            <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteUserHandler('${emp._id}')" title="Delete Employee"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      `;
    });
  } catch (err) {
    showToast("Directory Loading Error", err.message, "error");
  }
}

window.deleteUserHandler = async function (userId) {
  if (!confirm("Are you sure you want to delete this account and all related data (tasks, leaves, attendances)?")) return;
  try {
    const res = await API.deleteUser(userId);
    showToast("User Deleted", res.message, "success");
    loadDirectoryData();
    if (typeof loadTasksData === "function") loadTasksData();
    if (typeof loadAttendanceData === "function") loadAttendanceData();
    if (typeof loadLeavesData === "function") loadLeavesData();
  } catch (err) {
    showToast("Deletion failed", err.message, "error");
  }
};

// ==========================================
// MY PROFILE PAGE
// ==========================================
function loadProfileData() {
  document.getElementById("profile-picture-large").src =
    state.user.profilePicture ||
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80";
  document.getElementById("profile-details-name").textContent = state.user.name;
  document.getElementById("profile-details-email").textContent =
    state.user.email;
  document.getElementById("profile-details-role").textContent = state.user.role
    .toUpperCase()
    .replace("_", " ");

  DOM.formProfileInfo.querySelector("#profile-name-input").value =
    state.user.name;
  DOM.formProfileInfo.querySelector("#profile-email-input").value =
    state.user.email;

  const deptSelect = DOM.formProfileInfo.querySelector("#profile-dept-input");
  if (deptSelect) {
    const userDept = state.user.department || "";
    let optionExists = false;
    for (let i = 0; i < deptSelect.options.length; i++) {
      if (deptSelect.options[i].value === userDept) {
        optionExists = true;
        break;
      }
    }
    if (!optionExists && userDept) {
      const newOpt = document.createElement("option");
      newOpt.value = userDept;
      newOpt.textContent = userDept;
      deptSelect.appendChild(newOpt);
    }
    deptSelect.value = userDept;
  }
}

// ==========================================
// GLOBAL NOTIFICATIONS
// ==========================================
function updateSidebarDots() {
  const dots = {
    tasks: document.getElementById("dot-tasks"),
    leaves: document.getElementById("dot-leaves"),
    directory: document.getElementById("dot-directory"),
    dashboard: document.getElementById("dot-dashboard"),
    attendance: document.getElementById("dot-attendance"),
  };

  Object.values(dots).forEach((dot) => {
    if (dot) dot.classList.add("hidden");
  });

  const unreadNotifs = state.notifications.filter((n) => !n.isRead);

  unreadNotifs.forEach((n) => {
    const title = (n.title || "").toLowerCase();
    const msg = (n.message || "").toLowerCase();
    const type = (n.type || "").toLowerCase();

    if (
      type.includes("task") ||
      title.includes("task") ||
      msg.includes("task")
    ) {
      if (dots.tasks) dots.tasks.classList.remove("hidden");
    }
    if (
      type.includes("leave") ||
      title.includes("leave") ||
      msg.includes("leave")
    ) {
      if (dots.leaves) dots.leaves.classList.remove("hidden");
    }
    if (
      title.includes("employee") ||
      msg.includes("employee") ||
      title.includes("admin") ||
      msg.includes("admin") ||
      msg.includes("assign")
    ) {
      if (dots.directory) dots.directory.classList.remove("hidden");
    }
    if (
      type.includes("attendance") ||
      title.includes("attendance") ||
      msg.includes("attendance") ||
      title.includes("clock") ||
      msg.includes("clock")
    ) {
      if (dots.attendance) dots.attendance.classList.remove("hidden");
    }
    // Always show on Dashboard if there is any unread notification
    if (dots.dashboard) dots.dashboard.classList.remove("hidden");
  });
}

async function loadNotifications() {
  try {
    const res = await API.getNotifications();
    state.notifications = res.data;

    const unreadCount = state.notifications.filter((n) => !n.isRead).length;
    DOM.notifBadge.textContent = unreadCount;
    DOM.notifBadge.classList.toggle("hidden", unreadCount === 0);

    updateSidebarDots();

    DOM.notifList.innerHTML = "";
    if (state.notifications.length === 0) {
      DOM.notifList.innerHTML = `
        <div class="empty-state">
          <i class="fa-regular fa-bell-slash"></i>
          <p>No new notifications</p>
        </div>
      `;
      return;
    }

    state.notifications.forEach((n) => {
      const timeStr = new Date(n.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      DOM.notifList.innerHTML += `
        <div class="notification-item ${n.isRead ? "" : "unread"}" data-id="${n._id}">
          <h4>${n.title}</h4>
          <p>${n.message}</p>
          <div class="time-ago">${timeStr}</div>
        </div>
      `;
    });

    // Bind click events to notification items
    document.querySelectorAll(".notification-item").forEach((el) => {
      el.addEventListener("click", async () => {
        const notifId = el.getAttribute("data-id");
        try {
          await API.markNotificationRead(notifId);
          loadNotifications();
        } catch (err) {
          console.error(err);
        }
      });
    });
  } catch (err) {
    console.error("Notifications loading failed:", err);
  }
}

let globalDataPollInterval = null;
function startGlobalDataPoll() {
  if (globalDataPollInterval) clearInterval(globalDataPollInterval);
  // Poll every 10 seconds to auto-refresh notifications and whichever view the user is looking at
  globalDataPollInterval = setInterval(async () => {
    if (state.token) {
      // Avoid refreshing if a modal is open or the user is typing/has active focus on input fields to prevent cursor jump/flicker
      const activeModal = document.querySelector(".modal-backdrop:not(.hidden)");
      const isTyping = document.activeElement && 
        (document.activeElement.tagName === "INPUT" || 
         document.activeElement.tagName === "TEXTAREA" || 
         document.activeElement.tagName === "SELECT");

      if (!activeModal && !isTyping) {
        state.isBackgroundPolling = true;
        try {
          await loadNotifications();
          if (state.currentView) {
            await loadViewData(state.currentView);
          }
        } catch (err) {
          console.warn("Background auto-refresh skipped/failed:", err.message);
        } finally {
          state.isBackgroundPolling = false;
        }
      }
    }
  }, 10000);
}

// ==========================================
// EVENT BINDINGS & INTERACTIONS
// ==========================================
function bindEvents() {
  // Theme toggle
  DOM.themeToggle.addEventListener("click", toggleTheme);

  // Navigation
  DOM.navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const view = item.getAttribute("data-view");
      navigateTo(view);

      // Close mobile navigation drawer if open
      DOM.sidebar.classList.remove("show-mobile");
    });
  });

  DOM.mobileNavToggle.addEventListener("click", () => {
    DOM.sidebar.classList.toggle("show-mobile");
  });

  DOM.sidebarToggle.addEventListener("click", () => {
    DOM.sidebar.classList.toggle("collapsed");
  });

  DOM.logoutBtn.addEventListener("click", logout);

  // Login demo badge presets
  DOM.demoBadges.forEach((badge) => {
    badge.addEventListener("click", () => {
      DOM.loginEmail.value = badge.getAttribute("data-email");
      DOM.loginPassword.value = "Password123";
      gsap.fromTo(
        DOM.loginPage.querySelector(".login-container"),
        { scale: 0.98 },
        { scale: 1, duration: 0.3 },
      );
    });
  });

  // Submit Login
  DOM.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById("btn-login-submit");
    const loader = btnSubmit.querySelector(".btn-loader");
    const txt = btnSubmit.querySelector(".btn-text");

    loader.classList.remove("hidden");
    txt.classList.add("hidden");
    btnSubmit.disabled = true;

    try {
      const res = await API.login(
        DOM.loginEmail.value,
        DOM.loginPassword.value,
      );
      localStorage.setItem("token", res.token);
      state.token = res.token;
      state.user = res.user;

      setupRoleVisibility();
      DOM.loginPage.classList.add("hidden");
      DOM.appShell.classList.remove("hidden");
      
      // Initialize Face-API in background
      initFaceApi();

      navigateTo("dashboard");
      loadNotifications();
      startGlobalDataPoll();
    } catch (err) {
      showToast("Login Failed", err.message, "error");
    } finally {
      loader.classList.add("hidden");
      txt.classList.remove("hidden");
      btnSubmit.disabled = false;
    }
  });

  // Modal open/close listeners
  document.querySelectorAll(".btn-close-modal").forEach((btn) => {
    btn.addEventListener("click", () => {
      Object.values(DOM.modals).forEach((m) => {
        if (m) m.classList.add("hidden");
      });
      if (typeof stopCheckinCamera === "function") {
        stopCheckinCamera();
      }
    });
  });

  // Modal background click close
  Object.values(DOM.modals).forEach((modal) => {
    if (!modal) return;
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.add("hidden");
        if (modal.id === "modal-attendance-checkin" && typeof stopCheckinCamera === "function") {
          stopCheckinCamera();
        }
      }
    });
  });

  // Quick Actions binding
  if (DOM.qaCreateAdmin)
    DOM.qaCreateAdmin.addEventListener("click", () =>
      DOM.modals.createAdmin.classList.remove("hidden"),
    );
  if (DOM.qaCreateEmployee)
    DOM.qaCreateEmployee.addEventListener("click", () =>
      DOM.modals.createEmployee.classList.remove("hidden"),
    );
  if (DOM.qaAssignEmployee)
    DOM.qaAssignEmployee.addEventListener("click", () => {
      populateAssigneeDropdowns();
      DOM.modals.assignEmployee.classList.remove("hidden");
    });
  if (DOM.qaGenerateReport)
    DOM.qaGenerateReport.addEventListener("click", () => navigateTo("reports"));
  if (DOM.adminAddEmployee)
    DOM.adminAddEmployee.addEventListener("click", () =>
      DOM.modals.createEmployee.classList.remove("hidden"),
    );
  if (DOM.dirCreateAdmin)
    DOM.dirCreateAdmin.addEventListener("click", () =>
      DOM.modals.createAdmin.classList.remove("hidden"),
    );
  if (DOM.dirCreateEmployee)
    DOM.dirCreateEmployee.addEventListener("click", () =>
      DOM.modals.createEmployee.classList.remove("hidden"),
    );
  if (DOM.createTaskBtn)
    DOM.createTaskBtn.addEventListener("click", () => {
      populateAssigneeDropdowns();
      DOM.modals.createTask.classList.remove("hidden");
    });

  // Forms Submissions
  DOM.formCreateAdmin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById("admin-new-name").value,
      email: document.getElementById("admin-new-email").value,
      password: document.getElementById("admin-new-password").value,
      department: document.getElementById("admin-new-dept").value,
    };
    try {
      const res = await API.createAdmin(data);
      showToast("Admin Account Created", res.message, "success");
      DOM.modals.createAdmin.classList.add("hidden");
      DOM.formCreateAdmin.reset();
      loadDirectoryData();
    } catch (err) {
      showToast("Account creation failed", err.message, "error");
    }
  });

  DOM.formCreateEmployee.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById("employee-new-name").value,
      email: document.getElementById("employee-new-email").value,
      password: document.getElementById("employee-new-password").value,
      department: document.getElementById("employee-new-dept").value,
      adminId:
        document.getElementById("employee-new-admin-select")?.value || null,
    };
    try {
      const res = await API.createEmployee(data);
      showToast("Employee Account Created", res.message, "success");
      DOM.modals.createEmployee.classList.add("hidden");
      DOM.formCreateEmployee.reset();
      loadDirectoryData();
    } catch (err) {
      showToast("Account creation failed", err.message, "error");
    }
  });

  DOM.formAssignEmployee.addEventListener("submit", async (e) => {
    e.preventDefault();
    const empId = document.getElementById("assign-employee-select").value;
    const adminId = document.getElementById("assign-admin-select").value;
    try {
      const res = await API.assignEmployee(empId, adminId);
      showToast("Employee Reassigned", res.message, "success");
      DOM.modals.assignEmployee.classList.add("hidden");
      loadDirectoryData();
    } catch (err) {
      showToast("Reassignment failed", err.message, "error");
    }
  });

  DOM.formCreateTask.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(DOM.formCreateTask);

    // Explicit manual mappings for file-less fields to ensure proper form binding
    const filesInput = document.getElementById("task-new-files");
    const attachments = filesInput.files;

    const taskPayload = new FormData();
    taskPayload.append(
      "title",
      document.getElementById("task-new-title").value,
    );
    taskPayload.append(
      "description",
      document.getElementById("task-new-desc").value,
    );
    taskPayload.append(
      "priority",
      document.getElementById("task-new-priority").value,
    );
    taskPayload.append(
      "department",
      document.getElementById("task-new-dept").value,
    );
    taskPayload.append(
      "deadline",
      document.getElementById("task-new-deadline").value,
    );
    taskPayload.append(
      "assignedTo",
      document.getElementById("task-new-assignee").value,
    );

    for (let i = 0; i < attachments.length; i++) {
      taskPayload.append("attachments", attachments[i]);
    }

    try {
      await API.createTask(taskPayload);
      showToast(
        "Task Created",
        "Project board task successfully assigned.",
        "success",
      );
      DOM.modals.createTask.classList.add("hidden");
      DOM.formCreateTask.reset();
      loadTasksData();
    } catch (err) {
      showToast("Task Creation Failed", err.message, "error");
    }
  });

  // Task Details update status
  document
    .getElementById("btn-task-detail-save-status")
    .addEventListener("click", async () => {
      if (!state.selectedTask) return;

      const payload = new FormData();
      payload.append(
        "status",
        document.getElementById("task-detail-status-select").value,
      );
      payload.append(
        "progress",
        document.getElementById("task-detail-progress-slider").value,
      );

      try {
        const res = await API.updateTask(state.selectedTask._id, payload);
        showToast("Task Updated", res.message, "success");
        DOM.modals.taskDetail.classList.add("hidden");
        loadTasksData();
      } catch (err) {
        showToast("Update failed", err.message, "error");
      }
    });

  // Task deletion
  document
    .getElementById("btn-task-detail-delete")
    .addEventListener("click", async () => {
      if (!state.selectedTask) return;
      if (!confirm("Are you sure you want to delete this task?")) return;

      try {
        const res = await API.deleteTask(state.selectedTask._id);
        showToast("Task Deleted", res.message, "success");
        DOM.modals.taskDetail.classList.add("hidden");
        loadTasksData();
      } catch (err) {
        showToast("Deletion failed", err.message, "error");
      }
    });

  // Add Comment Form
  DOM.formComment.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!state.selectedTask) return;

    const input = document.getElementById("task-comment-input");
    const commentText = input.value;

    try {
      const res = await API.addComment(state.selectedTask._id, commentText);
      showToast("Comment Posted", "Comment added to discussion.", "success");
      input.value = "";
      renderTaskComments(res.data);
    } catch (err) {
      showToast("Comment posting failed", err.message, "error");
    }
  });

  // Task Detail upload file upload inline
  document
    .getElementById("task-detail-file-input")
    .addEventListener("change", async (e) => {
      if (!state.selectedTask) return;
      const files = e.target.files;
      if (files.length === 0) return;

      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("attachments", files[i]);
      }

      try {
        const res = await API.updateTask(state.selectedTask._id, formData);
        showToast("Files Uploaded", "Attachments added to task.", "success");
        renderTaskAttachments(res.data.attachments);
      } catch (err) {
        showToast("Upload failed", err.message, "error");
      }
    });

  async function openCheckinModal() {
    DOM.modals.attendanceCheckin.classList.remove("hidden");

    // Reset state
    capturedSelfieBase64 = null;
    detectedLocationStr = null;

    const video = document.getElementById("attendance-video");
    const preview = document.getElementById("attendance-photo-preview");
    const loader = document.getElementById("camera-loading-placeholder");
    const btnCapture = document.getElementById("btn-capture-selfie");
    const btnRetake = document.getElementById("btn-retake-selfie");
    const btnConfirm = document.getElementById("btn-confirm-checkin");
    const gpsIcon = document.getElementById("gps-status-icon");
    const gpsText = document.getElementById("gps-status-text");
    const faceStatusIcon = document.getElementById("face-status-icon");
    const faceStatusText = document.getElementById("face-status-text");
    const testModeSelect = document.getElementById("biometric-test-mode");

    preview.classList.add("hidden");
    video.classList.remove("hidden");
    loader.classList.remove("hidden");
    btnCapture.classList.add("hidden"); // Automatically scanned
    btnRetake.classList.add("hidden");
    btnConfirm.disabled = true;

    gpsIcon.className = "fa-solid fa-spinner fa-spin text-blue";
    gpsText.textContent = "Detecting GPS location...";
    
    faceStatusIcon.className = "fa-solid fa-spinner fa-spin text-blue";
    faceStatusText.textContent = "Loading registered face biometric data...";

    let isCameraSimulated = false;

    // Helper to check conditions and enable/disable check-in
    function checkEnableConfirm() {
      if (capturedSelfieBase64 && detectedLocationStr) {
        btnConfirm.disabled = false;
      } else {
        btnConfirm.disabled = true;
      }
    }

    // Helper to generate a simulated selfie with canvas
    function generateSimulatedSelfie(isMatch) {
      const canvas = document.getElementById("attendance-canvas");
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = isMatch ? "#10b981" : "#ef4444";
      ctx.beginPath();
      ctx.arc(320, 200, 85, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 26px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(isMatch ? "FACE VERIFICATION SUCCESS" : "FACE VERIFICATION FAILURE", 320, 320);
      ctx.font = "18px sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`Employee: ${state.user.name}`, 320, 355);
      ctx.font = "14px monospace";
      ctx.fillText(`GPS: ${detectedLocationStr || "Scanning..."}`, 320, 385);
      return canvas.toDataURL("image/jpeg", 0.7);
    }

    // Helper to capture a frame from the live video stream
    function captureSelfieFrame() {
      if (!checkinStream) return;
      const canvas = document.getElementById("attendance-canvas");
      const ctx = canvas.getContext("2d");

      // Mirror the context so selfie is orientation-correct
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      capturedSelfieBase64 = canvas.toDataURL("image/jpeg", 0.7);
      preview.src = capturedSelfieBase64;
    }

    // Pre-load and compute the descriptor of the registered face (profilePicture)
    let registeredFaceDescriptor = null;
    const profilePictureUrl = state.user.profilePicture || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80";
    
    // Asynchronously cache registered profile descriptor
    (async () => {
      try {
        if (!faceApiLoaded) {
          await initFaceApi();
        }
        if (faceApiLoaded) {
          const profileImg = await faceapi.fetchImage(profilePictureUrl);
          const profileDetection = await faceapi.detectSingleFace(profileImg).withFaceLandmarks().withFaceDescriptor();
          if (profileDetection) {
            registeredFaceDescriptor = profileDetection.descriptor;
            console.log("Registered face descriptor cached successfully.");
          } else {
            console.warn("No face found in registered profile picture.");
          }
        }
      } catch (err) {
        console.error("Error computing registered face descriptor:", err);
      }
    })();

    // 1. Get GPS Location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          detectedLocationStr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          gpsIcon.className = "fa-solid fa-circle-check text-green";
          gpsText.textContent = `GPS Location Captured: ${detectedLocationStr}`;
          checkEnableConfirm();
        },
        (error) => {
          console.warn("GPS failed, using simulated location:", error);
          detectedLocationStr = "13.082700, 80.270700"; // Chennai office simulated coordinates
          gpsIcon.className = "fa-solid fa-circle-check text-green";
          gpsText.textContent = `GPS Location Captured (Simulated): ${detectedLocationStr}`;
          checkEnableConfirm();
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      detectedLocationStr = "13.082700, 80.270700";
      gpsIcon.className = "fa-solid fa-circle-check text-green";
      gpsText.textContent = `GPS Location Captured (Simulated): ${detectedLocationStr}`;
      checkEnableConfirm();
    }

    // 2. Start Camera and Face Detection Loop
    try {
      checkinStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      video.srcObject = checkinStream;
      video.onloadedmetadata = () => {
        loader.classList.add("hidden");
      };
    } catch (err) {
      console.warn("Camera failed, fallback to simulated camera:", err);
      isCameraSimulated = true;
      loader.classList.add("hidden");
      video.classList.add("hidden");
      preview.classList.remove("hidden");
    }

    // 3. Periodic Face Scanner and Verification Loop
    faceDetectionInterval = setInterval(async () => {
      const testMode = testModeSelect ? testModeSelect.value : "auto";

      if (testMode === "force_match") {
        faceStatusIcon.className = "fa-solid fa-circle-check text-green";
        faceStatusText.textContent = `Face Verified (Forced Match): ${state.user.name} (98% match)`;
        
        if (isCameraSimulated) {
          capturedSelfieBase64 = generateSimulatedSelfie(true);
          preview.src = capturedSelfieBase64;
        } else {
          captureSelfieFrame();
        }
        checkEnableConfirm();
        return;
      } else if (testMode === "force_mismatch") {
        faceStatusIcon.className = "fa-solid fa-circle-xmark text-error";
        faceStatusText.textContent = "Face Verification Failed (Forced Mismatch): Identity mismatch (14% match). Attendance Rejected.";
        
        if (isCameraSimulated) {
          capturedSelfieBase64 = generateSimulatedSelfie(false);
          preview.src = capturedSelfieBase64;
          preview.classList.remove("hidden");
        } else {
          capturedSelfieBase64 = null;
        }
        btnConfirm.disabled = true;
        return;
      }

      // Automatic Real Face-API detection
      if (isCameraSimulated) {
        // Fallback simulated camera automatically matches since we cannot run real camera
        faceStatusIcon.className = "fa-solid fa-circle-check text-green";
        faceStatusText.textContent = `Face Verified (Simulated Match): ${state.user.name}`;
        capturedSelfieBase64 = generateSimulatedSelfie(true);
        preview.src = capturedSelfieBase64;
        checkEnableConfirm();
        return;
      }

      if (!faceApiLoaded) {
        faceStatusIcon.className = "fa-solid fa-spinner fa-spin text-blue";
        faceStatusText.textContent = "Loading Face AI models from CDN... please wait.";
        return;
      }

      try {
        const detection = await faceapi.detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection) {
          if (registeredFaceDescriptor) {
            const distance = faceapi.euclideanDistance(detection.descriptor, registeredFaceDescriptor);
            const matchScore = Math.max(0, Math.min(100, Math.round((1 - distance) * 100)));
            
            if (distance < 0.6) {
              faceStatusIcon.className = "fa-solid fa-circle-check text-green";
              faceStatusText.textContent = `Face Verified: Match ${matchScore}% (${state.user.name}).`;
              captureSelfieFrame();
              checkEnableConfirm();
            } else {
              faceStatusIcon.className = "fa-solid fa-circle-xmark text-error";
              faceStatusText.textContent = `Face Mismatch: Identity could not be verified (${matchScore}% match). Attendance Rejected.`;
              capturedSelfieBase64 = null;
              btnConfirm.disabled = true;
            }
          } else {
            // Profile photo face descriptor wasn't computed successfully, auto-verify upon finding any face
            faceStatusIcon.className = "fa-solid fa-circle-check text-green";
            faceStatusText.textContent = `Face Detected: Verified (Profile Photo Match Bypass).`;
            captureSelfieFrame();
            checkEnableConfirm();
          }
        } else {
          faceStatusIcon.className = "fa-solid fa-user-shield text-warning";
          faceStatusText.textContent = "Scanning... Please look directly at the camera.";
          capturedSelfieBase64 = null;
          btnConfirm.disabled = true;
        }
      } catch (e) {
        console.warn("Face detection error:", e);
      }
    }, 800);
  }

  // Attendance Check-in click triggers camera modal for all roles
  document.addEventListener("click", (e) => {
    if (e.target.closest(".btn-clock-in-class")) {
      openCheckinModal();
    }
  });

  // Confirm Check-in click handler
  document.getElementById("btn-confirm-checkin").addEventListener("click", async () => {
    if (!capturedSelfieBase64 || !detectedLocationStr) return;

    const btnConfirm = document.getElementById("btn-confirm-checkin");
    btnConfirm.disabled = true;
    btnConfirm.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Submitting...`;

      try {
        const res = await API.checkIn({
          selfie: capturedSelfieBase64,
          location: detectedLocationStr,
        });
        showToast("Checked In", res.message, "success");
        DOM.modals.attendanceCheckin.classList.add("hidden");
        stopCheckinCamera();
        loadDashboardData();
        if (typeof loadAttendanceData === "function") {
          loadAttendanceData();
        }
      } catch (err) {
        showToast("Clock in failed", err.message, "error");
      } finally {
        btnConfirm.disabled = false;
        btnConfirm.innerHTML = `<i class="fa-solid fa-circle-check"></i> Confirm Check In`;
      }
    });

  // Clock Out click handler for all roles
  document.addEventListener("click", async (e) => {
    if (e.target.closest(".btn-clock-out-class")) {
      try {
        const res = await API.checkOut();
        showToast("Checked Out", res.message, "success");
        loadDashboardData();
        if (typeof loadAttendanceData === "function") {
          loadAttendanceData();
        }
      } catch (err) {
        showToast("Clock out failed", err.message, "error");
      }
    }
  });

  // Leave Form submit
  DOM.formApplyLeave.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {
      leaveType: document.getElementById("leave-type-select").value,
      startDate: document.getElementById("leave-start-date").value,
      endDate: document.getElementById("leave-end-date").value,
      reason: document.getElementById("leave-reason").value,
    };
    try {
      const res = await API.applyLeave(data);
      showToast("Leave Submitted", res.message, "success");
      DOM.formApplyLeave.reset();
      loadLeavesData();
    } catch (err) {
      showToast("Application failed", err.message, "error");
    }
  });


  // Profile forms
  DOM.formProfileInfo.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("profile-name-input").value;
    const dept = document.getElementById("profile-dept-input").value;
    try {
      const res = await API.updateProfile(name, dept);
      state.user = res.data;
      showToast("Profile Updated", res.message, "success");
      setupRoleVisibility();
      loadProfileData();
    } catch (err) {
      showToast("Update failed", err.message, "error");
    }
  });

  DOM.formProfileSecurity.addEventListener("submit", async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById(
      "profile-curr-password",
    ).value;
    const newPassword = document.getElementById("profile-new-password").value;
    try {
      const res = await API.updatePassword(currentPassword, newPassword);
      showToast("Password Updated", res.message, "success");
      DOM.formProfileSecurity.reset();
    } catch (err) {
      showToast("Password update failed", err.message, "error");
    }
  });

  // Avatar Upload image picker
  document
    .getElementById("avatar-file-input")
    .addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append("avatar", file);

      try {
        const res = await API.uploadAvatar(formData);
        state.user.profilePicture = res.url;
        showToast("Avatar Updated", res.message, "success");
        setupRoleVisibility();
        loadProfileData();
      } catch (err) {
        showToast("Avatar upload failed", err.message, "error");
      }
    });

  // Task detail Progress slider tracking
  document
    .getElementById("task-detail-progress-slider")
    .addEventListener("input", (e) => {
      document.getElementById("task-detail-progress-label").textContent =
        `${e.target.value}%`;
    });

  // Task Board Toggles
  DOM.btnToggleKanban.addEventListener("click", () => {
    taskViewMode = "kanban";
    DOM.btnToggleKanban.classList.add("active");
    DOM.btnToggleList.classList.remove("active");
    renderTaskViews();
  });

  DOM.btnToggleList.addEventListener("click", () => {
    taskViewMode = "list";
    DOM.btnToggleList.classList.add("active");
    DOM.btnToggleKanban.classList.remove("active");
    renderTaskViews();
  });

  // Filters change listeners
  [DOM.filterPriority, DOM.filterStatus, DOM.filterAssignee].forEach((el) => {
    el.addEventListener("change", loadTasksData);
  });
  DOM.filterDept.addEventListener("keyup", (e) => {
    // debounce standard keyboard inputs
    clearTimeout(state.deptDebounce);
    state.deptDebounce = setTimeout(loadTasksData, 300);
  });
  DOM.btnResetFilters.addEventListener("click", () => {
    DOM.filterPriority.value = "";
    DOM.filterStatus.value = "";
    DOM.filterAssignee.value = "";
    DOM.filterDept.value = "";
    loadTasksData();
  });

  // Bulk tasks deletion
  const btnBulkDelete = document.getElementById("btn-bulk-delete");
  if (btnBulkDelete) {
    btnBulkDelete.addEventListener("click", async () => {
      const checkedBoxes = document.querySelectorAll(
        ".task-row-select:checked",
      );
      const selectedIds = Array.from(checkedBoxes).map((cb) =>
        cb.getAttribute("data-id"),
      );

      if (selectedIds.length === 0) return;
      if (
        !confirm(
          `Are you sure you want to delete the ${selectedIds.length} selected task(s)?`,
        )
      )
        return;

      try {
        const res = await API.bulkDeleteTasks(selectedIds);
        showToast("Tasks Deleted", res.message, "success");
        loadTasksData();
      } catch (err) {
        showToast("Bulk deletion failed", err.message, "error");
      }
    });
  }

  // Bulk leaves deletion
  const btnBulkDeleteLeaves = document.getElementById("btn-bulk-delete-leaves");
  if (btnBulkDeleteLeaves) {
    btnBulkDeleteLeaves.addEventListener("click", () => {
      if (typeof window.bulkDeleteLeavesHandler === "function") {
        window.bulkDeleteLeavesHandler();
      }
    });
  }

  const leaveSelectAll = document.getElementById("leave-select-all");
  if (leaveSelectAll) {
    leaveSelectAll.addEventListener("change", (e) => {
      document.querySelectorAll(".leave-row-select").forEach(cb => cb.checked = e.target.checked);
      if (typeof updateLeaveBulkButton === "function") {
        updateLeaveBulkButton();
      }
    });
  }
  if (DOM.leavesTableBody) {
    DOM.leavesTableBody.addEventListener("change", (e) => {
      if (e.target.classList.contains("leave-row-select")) {
        const rowCheckboxes = document.querySelectorAll(".leave-row-select");
        const allChecked = Array.from(rowCheckboxes).every((c) => c.checked);
        const selectAllCheckbox = document.getElementById("leave-select-all");
        if (selectAllCheckbox) selectAllCheckbox.checked = allChecked;
        if (typeof updateLeaveBulkButton === "function") {
          updateLeaveBulkButton();
        }
      }
    });
  }

  // Bulk admins deletion
  const btnBulkDeleteAdmins = document.getElementById("btn-bulk-delete-admins");
  if (btnBulkDeleteAdmins) {
    btnBulkDeleteAdmins.addEventListener("click", async () => {
      const checkedBoxes = document.querySelectorAll(".admin-row-select:checked");
      const selectedIds = Array.from(checkedBoxes).map(cb => cb.getAttribute("data-id"));
      if (selectedIds.length === 0) return;
      if (!confirm(`Are you sure you want to delete the ${selectedIds.length} selected admin account(s) and all their managed data?`)) return;

      try {
        const res = await API.bulkDeleteUsers(selectedIds);
        showToast("Admins Deleted", res.message, "success");
        loadDirectoryData();
        if (typeof loadTasksData === "function") loadTasksData();
        if (typeof loadAttendanceData === "function") loadAttendanceData();
        if (typeof loadLeavesData === "function") loadLeavesData();
      } catch (err) {
        showToast("Bulk deletion failed", err.message, "error");
      }
    });
  }

  const adminSelectAll = document.getElementById("admin-select-all");
  if (adminSelectAll) {
    adminSelectAll.addEventListener("change", (e) => {
      document.querySelectorAll(".admin-row-select").forEach(cb => cb.checked = e.target.checked);
      const btn = document.getElementById("btn-bulk-delete-admins");
      if (btn) btn.style.display = e.target.checked ? "inline-block" : "none";
    });
  }
  const adTable = document.getElementById("dir-admins-table-body");
  if (adTable) {
    adTable.addEventListener("change", (e) => {
      if (e.target.classList.contains("admin-row-select")) {
        const checkedCount = document.querySelectorAll(".admin-row-select:checked").length;
        const btn = document.getElementById("btn-bulk-delete-admins");
        if (btn) btn.style.display = checkedCount > 0 ? "inline-block" : "none";
      }
    });
  }

  // Bulk employees deletion
  const btnBulkDeleteEmployees = document.getElementById("btn-bulk-delete-employees");
  if (btnBulkDeleteEmployees) {
    btnBulkDeleteEmployees.addEventListener("click", async () => {
      const checkedBoxes = document.querySelectorAll(".employee-row-select:checked");
      const selectedIds = Array.from(checkedBoxes).map(cb => cb.getAttribute("data-id"));
      if (selectedIds.length === 0) return;
      if (!confirm(`Are you sure you want to delete the ${selectedIds.length} selected employee account(s) and all their related data?`)) return;

      try {
        const res = await API.bulkDeleteUsers(selectedIds);
        showToast("Employees Deleted", res.message, "success");
        loadDirectoryData();
        if (typeof loadTasksData === "function") loadTasksData();
        if (typeof loadAttendanceData === "function") loadAttendanceData();
        if (typeof loadLeavesData === "function") loadLeavesData();
      } catch (err) {
        showToast("Bulk deletion failed", err.message, "error");
      }
    });
  }

  const employeeSelectAll = document.getElementById("employee-select-all");
  if (employeeSelectAll) {
    employeeSelectAll.addEventListener("change", (e) => {
      document.querySelectorAll(".employee-row-select").forEach(cb => cb.checked = e.target.checked);
      const btn = document.getElementById("btn-bulk-delete-employees");
      if (btn) btn.style.display = e.target.checked ? "inline-block" : "none";
    });
  }
  const empTable = document.getElementById("dir-employees-table-body");
  if (empTable) {
    empTable.addEventListener("change", (e) => {
      if (e.target.classList.contains("employee-row-select")) {
        const checkedCount = document.querySelectorAll(".employee-row-select:checked").length;
        const btn = document.getElementById("btn-bulk-delete-employees");
        if (btn) btn.style.display = checkedCount > 0 ? "inline-block" : "none";
      }
    });
  }

  // Attendance filter change listener
  const attendanceSelect = document.getElementById("attendance-user-select");
  if (attendanceSelect) {
    attendanceSelect.addEventListener("change", () => {
      loadAttendanceData();
    });
  }

  // Attendance date filter listener
  const attendanceDateFilter = document.getElementById("attendance-date-filter");
  if (attendanceDateFilter) {
    attendanceDateFilter.addEventListener("change", (e) => {
      state.selectedAttendanceDate = e.target.value;
      loadAttendanceData();
    });
  }

  const btnClearAttendanceDate = document.getElementById("btn-clear-attendance-date");
  if (btnClearAttendanceDate) {
    btnClearAttendanceDate.addEventListener("click", () => {
      state.selectedAttendanceDate = null;
      if (attendanceDateFilter) attendanceDateFilter.value = "";
      loadAttendanceData();
    });
  }

  // Attendance name filter listener
  const attendanceNameFilter = document.getElementById("attendance-name-filter");
  if (attendanceNameFilter) {
    attendanceNameFilter.addEventListener("input", () => {
      loadAttendanceData();
    });
  }

  // Calendar prev/next buttons
  document.getElementById("btn-calendar-prev").addEventListener("click", () => {
    state.activeCalendarMonth--;
    if (state.activeCalendarMonth < 0) {
      state.activeCalendarMonth = 11;
      state.activeCalendarYear--;
    }
    loadAttendanceData();
  });
  document.getElementById("btn-calendar-next").addEventListener("click", () => {
    state.activeCalendarMonth++;
    if (state.activeCalendarMonth > 11) {
      state.activeCalendarMonth = 0;
      state.activeCalendarYear++;
    }
    loadAttendanceData();
  });

  // Reports downloads
  DOM.btnExportAttendance.addEventListener("click", async () => {
    const params = {
      startDate: document.getElementById("report-att-start").value,
      endDate: document.getElementById("report-att-end").value,
    };
    try {
      await API.downloadReport("attendance", params);
      showToast(
        "Report Downloaded",
        "Attendance CSV file compiled successfully.",
        "success",
      );
    } catch (err) {
      showToast("Export failed", err.message, "error");
    }
  });

  DOM.btnExportTasks.addEventListener("click", async () => {
    const params = {
      priority: document.getElementById("report-task-priority").value,
      status: document.getElementById("report-task-status").value,
    };
    try {
      await API.downloadReport("tasks", params);
      showToast(
        "Report Downloaded",
        "Tasks CSV file compiled successfully.",
        "success",
      );
    } catch (err) {
      showToast("Export failed", err.message, "error");
    }
  });

  DOM.btnExportPerformance.addEventListener("click", async () => {
    try {
      await API.downloadReport("performance");
      showToast(
        "Report Downloaded",
        "Performance CSV file compiled successfully.",
        "success",
      );
    } catch (err) {
      showToast("Export failed", err.message, "error");
    }
  });

  // Top Nav Notification Panel toggle
  DOM.notifBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    DOM.notifPanel.classList.toggle("hidden");
  });

  DOM.notifPanel.addEventListener("click", (e) => {
    e.stopPropagation(); // prevent closure click handlers
  });

  document.addEventListener("click", () => {
    DOM.notifPanel.classList.add("hidden");
    DOM.searchResults.classList.add("hidden");
  });

  DOM.markReadBtn.addEventListener("click", async () => {
    try {
      await API.markAllNotificationsRead();
      loadNotifications();
    } catch (err) {
      console.error(err);
    }
  });

  // Global search autocomplete
  DOM.globalSearch.addEventListener("input", async (e) => {
    const query = e.target.value.trim();
    if (!query) {
      DOM.searchResults.classList.add("hidden");
      return;
    }

    try {
      const res = await API.getTasks({ search: query });
      const foundTasks = res.data;

      DOM.searchResults.innerHTML = "";
      if (foundTasks.length === 0) {
        DOM.searchResults.innerHTML =
          '<div class="p-2 text-muted" style="font-size:0.75rem; text-align:center;">No matching tasks found</div>';
      } else {
        foundTasks.forEach((task) => {
          DOM.searchResults.innerHTML += `
            <div class="search-result-item" onclick="openTaskDetailsModal('${task._id}')">
              <span class="item-title">${task.title}</span>
              <span class="item-desc">${task.status} | Dept: ${task.department}</span>
            </div>
          `;
        });
      }
      DOM.searchResults.classList.remove("hidden");
    } catch (err) {
      console.error(err);
    }
  });

  // Populate admin selects inside Create Employee and Assign Employee modals
  async function populateAdminSelects() {
    if (state.user.role !== "main_admin") return;
    try {
      const res = await API.getAdmins();
      state.admins = res.data;

      const elements = [
        document.getElementById("employee-new-admin-select"),
        document.getElementById("assign-admin-select"),
      ];
      elements.forEach((select) => {
        if (!select) return;
        select.innerHTML = "";
        state.admins.forEach((admin) => {
          const opt = document.createElement("option");
          opt.value = admin._id;
          opt.textContent = `${admin.name} (${admin.department})`;
          select.appendChild(opt);
        });
      });
    } catch (err) {
      console.error(err);
    }
  }

  // Bind main admin modals populators
  DOM.qaCreateEmployee?.addEventListener("click", populateAdminSelects);
  DOM.qaAssignEmployee?.addEventListener("click", populateAdminSelects);

  // Expense Tracker Event Bindings
  const addExpenseForm = document.getElementById("add-expense-form");
  if (addExpenseForm) {
    addExpenseForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = document.getElementById("expense-title").value.trim();
      const amount = document.getElementById("expense-amount").value.trim();
      const category = document.getElementById("expense-category").value;
      const date = document.getElementById("expense-date").value;
      const day = document.getElementById("expense-day").value;
      const description = document.getElementById("expense-desc").value.trim();

      try {
        await API.addExpense({ title, amount, category, date, day, description });
        showToast("Expense Recorded", "Your business expenditure was logged.", "success");
        addExpenseForm.reset();

        // Update filters to show the recorded date so user sees it
        const filterStart = document.getElementById("expense-filter-start");
        const filterEnd = document.getElementById("expense-filter-end");
        if (filterStart && filterEnd) {
          filterStart.value = date;
          filterEnd.value = date;
        }

        loadExpensesData();
      } catch (err) {
        showToast("Expense logging failed", err.message, "error");
      }
    });
  }

  const expenseDateInput = document.getElementById("expense-date");
  if (expenseDateInput) {
    expenseDateInput.addEventListener("change", (e) => {
      if (!e.target.value) {
        document.getElementById("expense-day").value = "";
        return;
      }
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const parts = e.target.value.split('-');
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      document.getElementById("expense-day").value = days[d.getDay()];

      // Sync filter inputs to match the form's date and update the table log
      const filterStart = document.getElementById("expense-filter-start");
      const filterEnd = document.getElementById("expense-filter-end");
      if (filterStart && filterEnd) {
        filterStart.value = e.target.value;
        filterEnd.value = e.target.value;
        renderExpensesTable(state.expenses || []);
      }
    });
  }

  // Expenses Bulk Delete Trigger
  const btnBulkDeleteExpenses = document.getElementById("btn-bulk-delete-expenses");
  if (btnBulkDeleteExpenses) {
    btnBulkDeleteExpenses.addEventListener("click", () => {
      if (typeof window.bulkDeleteExpensesHandler === "function") {
        window.bulkDeleteExpensesHandler();
      }
    });
  }

  // Expense Checkboxes Select All & Delegation
  const expenseSelectAll = document.getElementById("expense-select-all");
  if (expenseSelectAll) {
    expenseSelectAll.addEventListener("change", (e) => {
      document.querySelectorAll(".expense-row-select").forEach(cb => cb.checked = e.target.checked);
      updateExpenseBulkButton();
    });
  }
  const expTableBody = document.getElementById("expenses-table-body");
  if (expTableBody) {
    expTableBody.addEventListener("change", (e) => {
      if (e.target.classList.contains("expense-row-select")) {
        const rowCheckboxes = document.querySelectorAll(".expense-row-select");
        const allChecked = Array.from(rowCheckboxes).every((c) => c.checked);
        const selectAllCheckbox = document.getElementById("expense-select-all");
        if (selectAllCheckbox) selectAllCheckbox.checked = allChecked;
        updateExpenseBulkButton();
      }
    });
  }

  // Expense Date & Name Filters Event Listeners
  const expenseFilterStart = document.getElementById("expense-filter-start");
  const expenseFilterEnd = document.getElementById("expense-filter-end");
  const expenseFilterName = document.getElementById("expense-filter-name");
  if (expenseFilterStart) {
    expenseFilterStart.addEventListener("change", () => {
      renderExpensesTable(state.expenses || []);
    });
  }
  if (expenseFilterEnd) {
    expenseFilterEnd.addEventListener("change", () => {
      renderExpensesTable(state.expenses || []);
    });
  }
  if (expenseFilterName) {
    expenseFilterName.addEventListener("input", () => {
      renderExpensesTable(state.expenses || []);
    });
  }

  const btnClearExpenseFilters = document.getElementById("btn-clear-expense-filters");
  if (btnClearExpenseFilters) {
    btnClearExpenseFilters.addEventListener("click", () => {
      if (expenseFilterStart) expenseFilterStart.value = "";
      if (expenseFilterEnd) expenseFilterEnd.value = "";
      if (expenseFilterName) expenseFilterName.value = "";
      renderExpensesTable(state.expenses || []);
    });
  }

  // Leave Request Filters Event Listeners
  const leaveFilterStart = document.getElementById("leave-filter-start");
  const leaveFilterEnd = document.getElementById("leave-filter-end");
  const leaveFilterName = document.getElementById("leave-filter-name");
  if (leaveFilterStart) {
    leaveFilterStart.addEventListener("change", () => {
      renderLeavesTable(state.leaves || []);
    });
  }
  if (leaveFilterEnd) {
    leaveFilterEnd.addEventListener("change", () => {
      renderLeavesTable(state.leaves || []);
    });
  }
  if (leaveFilterName) {
    leaveFilterName.addEventListener("input", () => {
      renderLeavesTable(state.leaves || []);
    });
  }

  const btnClearLeaveFilters = document.getElementById("btn-clear-leave-filters");
  if (btnClearLeaveFilters) {
    btnClearLeaveFilters.addEventListener("click", () => {
      if (leaveFilterStart) leaveFilterStart.value = "";
      if (leaveFilterEnd) leaveFilterEnd.value = "";
      if (leaveFilterName) leaveFilterName.value = "";
      renderLeavesTable(state.leaves || []);
    });
  }
}

// ==========================================
// EXPENSE TRACKER FUNCTIONS
// ==========================================
async function loadExpensesData() {
  try {
    const res = await API.getExpenses();
    state.expenses = res.data;

    // Default filters to today's date on first initialization
    const filterStart = document.getElementById("expense-filter-start");
    const filterEnd = document.getElementById("expense-filter-end");
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    if (filterStart && filterEnd && !filterStart.value && !filterEnd.value && !state.expensesInitialized) {
      filterStart.value = todayStr;
      filterEnd.value = todayStr;
      state.expensesInitialized = true;
    }

    // Default Add Expense form date field to today if empty
    const expenseFormDate = document.getElementById("expense-date");
    if (expenseFormDate && !expenseFormDate.value) {
      expenseFormDate.value = todayStr;
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const expenseFormDay = document.getElementById("expense-day");
      if (expenseFormDay) {
        expenseFormDay.value = days[today.getDay()];
      }
    }

    renderExpensesTable(state.expenses);
  } catch (err) {
    showToast("Expenses Loading Error", err.message, "error");
  }
}

function renderExpensesTable(expenses) {
  const tableBody = document.getElementById("expenses-table-body");
  if (!tableBody) return;
  tableBody.innerHTML = "";

  const btnBulkDeleteExpenses = document.getElementById("btn-bulk-delete-expenses");
  if (btnBulkDeleteExpenses) {
    btnBulkDeleteExpenses.style.display = "none";
  }
  const selectAllExpenses = document.getElementById("expense-select-all");
  if (selectAllExpenses) {
    selectAllExpenses.checked = false;
  }

  // Handle headers / columns based on role
  const isEmployee = state.user.role === "employee";
  const adminHeaders = document.querySelectorAll(".admin-only");
  adminHeaders.forEach(el => {
    el.style.display = isEmployee ? "none" : "";
  });

  // Client-side date range & employee name filtering
  const startDateStr = document.getElementById("expense-filter-start")?.value;
  const endDateStr = document.getElementById("expense-filter-end")?.value;
  const searchName = document.getElementById("expense-filter-name")?.value?.trim()?.toLowerCase();

  let filteredExpenses = expenses;

  if (startDateStr) {
    filteredExpenses = filteredExpenses.filter(exp => {
      const expDateStr = exp.date ? exp.date.substring(0, 10) : "";
      return expDateStr >= startDateStr;
    });
  }

  if (endDateStr) {
    filteredExpenses = filteredExpenses.filter(exp => {
      const expDateStr = exp.date ? exp.date.substring(0, 10) : "";
      return expDateStr <= endDateStr;
    });
  }

  if (searchName) {
    filteredExpenses = filteredExpenses.filter(exp => {
      const empName = exp.userId?.name || "";
      return empName.toLowerCase().includes(searchName);
    });
  }

  // Calculate & Display Total Sum
  let totalSum = 0;
  filteredExpenses.forEach(exp => {
    totalSum += Number(exp.amount) || 0;
  });

  const totalValEl = document.getElementById("expense-total-val");
  if (totalValEl) {
    totalValEl.textContent = `₹${totalSum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  if (filteredExpenses.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="${isEmployee ? 7 : 8}" style="text-align:center;">No expenses recorded yet.</td></tr>`;
    return;
  }

  filteredExpenses.forEach((expense) => {
    const datePart = expense.date ? expense.date.substring(0, 10) : "";
    const parts = datePart.split('-');
    const expDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : datePart;
    
    let employeeCol = "";
    if (!isEmployee) {
      employeeCol = `
        <td>
          <div class="employee-table-cell">
            <img src="${expense.userId?.profilePicture || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80"}" class="employee-table-avatar">
            <span>${expense.userId?.name || "N/A"}</span>
          </div>
        </td>
      `;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="checkbox" class="expense-row-select" data-id="${expense._id}"></td>
      ${employeeCol}
      <td><strong>${expense.title}</strong></td>
      <td><strong>₹${Number(expense.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
      <td><span class="badge badge-info">${expense.category}</span></td>
      <td>${expDate} (${expense.day})</td>
      <td>${expense.description || "—"}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); window.deleteExpenseHandler('${expense._id}')" title="Delete Expense"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  const selectAllCheckbox = document.getElementById("expense-select-all");
  if (selectAllCheckbox) selectAllCheckbox.checked = false;
  updateExpenseBulkButton();
}

window.updateExpenseBulkButton = function () {
  const bulkBtn = document.getElementById("btn-bulk-delete-expenses");
  if (!bulkBtn) return;
  const checkedCount = document.querySelectorAll(".expense-row-select:checked").length;
  if (checkedCount > 0) {
    bulkBtn.style.display = "inline-block";
    bulkBtn.innerHTML = `<i class="fa-solid fa-trash-can"></i> Delete Selected (${checkedCount})`;
  } else {
    bulkBtn.style.display = "none";
  }
};

window.updateLeaveBulkButton = function () {
  const bulkBtn = document.getElementById("btn-bulk-delete-leaves");
  if (!bulkBtn) return;
  const checkedCount = document.querySelectorAll(".leave-row-select:checked").length;
  if (checkedCount > 0) {
    bulkBtn.style.display = "inline-block";
    bulkBtn.innerHTML = `<i class="fa-solid fa-trash-can"></i> Delete Selected (${checkedCount})`;
  } else {
    bulkBtn.style.display = "none";
  }
};

window.deleteExpenseHandler = async function (expenseId) {
  if (!confirm("Are you sure you want to delete this expense?")) return;
  try {
    const res = await API.deleteExpense(expenseId);
    showToast("Expense Deleted", res.message, "success");
    loadExpensesData();
  } catch (err) {
    showToast("Deletion failed", err.message, "error");
  }
};

window.bulkDeleteExpensesHandler = async function () {
  const checkedBoxes = document.querySelectorAll(".expense-row-select:checked");
  if (checkedBoxes.length === 0) return;
  if (!confirm(`Are you sure you want to delete the ${checkedBoxes.length} selected expenses?`)) return;

  const ids = Array.from(checkedBoxes).map(cb => cb.getAttribute("data-id"));
  try {
    const res = await API.bulkDeleteExpenses(ids);
    showToast("Expenses Deleted", res.message, "success");
    loadExpensesData();
  } catch (err) {
    showToast("Bulk deletion failed", err.message, "error");
  }
};

window.deleteLeaveHandler = async function (leaveId) {
  if (!confirm("Are you sure you want to delete this leave request?")) return;
  try {
    const res = await API.deleteLeave(leaveId);
    showToast("Leave Deleted", res.message, "success");
    loadLeavesData();
  } catch (err) {
    showToast("Deletion failed", err.message, "error");
  }
};

window.bulkDeleteLeavesHandler = async function () {
  const checkedBoxes = document.querySelectorAll(".leave-row-select:checked");
  if (checkedBoxes.length === 0) return;
  if (!confirm(`Are you sure you want to delete the ${checkedBoxes.length} selected leave requests?`)) return;

  const ids = Array.from(checkedBoxes).map(cb => cb.getAttribute("data-id"));
  try {
    const res = await API.bulkDeleteLeaves(ids);
    showToast("Leaves Deleted", res.message, "success");
    loadLeavesData();
  } catch (err) {
    showToast("Bulk deletion failed", err.message, "error");
  }
};

// ==========================================
// APP START
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  // Initialize theme from storage
  initTheme();
  bindEvents();
  initApp();
});
