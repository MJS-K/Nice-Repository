const DEFAULT_USER = "我自己";
const DEFAULT_TASKS = [
  { id: "run", name: "跑步", icon: "🏃" },
  { id: "water", name: "喝水", icon: "💧" },
  { id: "notes", name: "做笔记", icon: "📝" },
  { id: "study", name: "学习", icon: "📚" },
];

const STORAGE_KEY = "mjs_checkin";

// --- State ---
let state = loadState();
let currentDate = new Date();

function getDefaultState() {
  return {
    users: [DEFAULT_USER],
    tasks: JSON.parse(JSON.stringify(DEFAULT_TASKS)),
    checks: {}, // "YYYY-MM-DD:user:taskId" -> true
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.users && parsed.tasks && parsed.checks) {
        return parsed;
      }
    }
  } catch (e) { /* fall through */ }
  return getDefaultState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(d) {
  const today = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const wd = weekdays[d.getDay()];
  let prefix = "";
  if (formatDate(d) === formatDate(today)) {
    prefix = "今天 ";
  } else {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (formatDate(d) === formatDate(yesterday)) {
      prefix = "昨天 ";
    }
  }
  return `${prefix}${y}年${m}月${day}日 星期${wd}`;
}

function isToday(d) {
  const today = new Date();
  return formatDate(d) === formatDate(today);
}

function getCheckKey(taskId) {
  const user = document.getElementById("username").value;
  return `${formatDate(currentDate)}:${user}:${taskId}`;
}

function isChecked(taskId) {
  return !!state.checks[getCheckKey(taskId)];
}

function toggleCheck(taskId) {
  const key = getCheckKey(taskId);
  if (state.checks[key]) {
    delete state.checks[key];
  } else {
    state.checks[key] = true;
  }
  saveState();
  render();
}

function deleteTask(taskId) {
  state.tasks = state.tasks.filter((t) => t.id !== taskId);
  // Also clean up related checks
  for (const key of Object.keys(state.checks)) {
    if (key.endsWith(`:${taskId}`)) {
      delete state.checks[key];
    }
  }
  saveState();
  render();
}

function addTask(name, icon) {
  const id = "task_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
  state.tasks.push({ id, name, icon });
  saveState();
  render();
}

function addUser(name) {
  if (state.users.includes(name)) return;
  state.users.push(name);
  saveState();
  render();
}

function getWeekRange() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday start
  const monday = new Date(today);
  monday.setDate(today.getDate() - diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { monday, sunday };
}

function calcStats() {
  const { monday, sunday } = getWeekRange();
  const currentUser = document.getElementById("username").value;
  const stats = state.tasks.map((task) => {
    let checkedCount = 0;
    let totalDays = 0;
    const d = new Date(monday);
    while (d <= sunday) {
      // Only count past days (including today), not future days
      if (d <= new Date()) {
        totalDays++;
        const key = `${formatDate(d)}:${currentUser}:${task.id}`;
        if (state.checks[key]) checkedCount++;
      }
      d.setDate(d.getDate() + 1);
    }
    const rate = totalDays > 0 ? Math.round((checkedCount / totalDays) * 100) : 0;
    return { ...task, checkedCount, totalDays, rate };
  });
  return stats;
}

// --- Rendering ---
function render() {
  renderDate();
  renderTasks();
  renderStats();
  renderUsers();
}

function renderDate() {
  document.getElementById("displayDate").textContent = formatDisplayDate(currentDate);
  document.getElementById("todayBtn").style.display = isToday(currentDate) ? "none" : "inline-block";
}

function renderTasks() {
  const container = document.getElementById("taskList");
  container.innerHTML = "";
  state.tasks.forEach((task) => {
    const checked = isChecked(task.id);
    const item = document.createElement("div");
    item.className = "task-item";
    item.innerHTML = `
      <div class="task-left">
        <span class="task-icon">${task.icon}</span>
        <span class="task-name">${task.name}</span>
      </div>
      <div style="display:flex;align-items:center;gap:4px;">
        <div class="task-checkbox ${checked ? "checked" : ""}" data-task-id="${task.id}">
          ${checked ? "✓" : ""}
        </div>
        <button class="task-delete" data-task-id="${task.id}" title="删除任务">&times;</button>
      </div>
    `;
    container.appendChild(item);

    // Checkbox click
    item.querySelector(".task-checkbox").addEventListener("click", () => {
      toggleCheck(task.id);
    });

    // Delete click
    item.querySelector(".task-delete").addEventListener("click", (e) => {
      e.stopPropagation();
      const dialog = document.getElementById("confirmDialog");
      document.getElementById("confirmTitle").textContent = `删除 "${task.name}"？`;
      document.getElementById("confirmMessage").textContent = "该操作不可撤销，所有相关打卡记录也将一并删除。";
      dialog.showModal();
      dialog.addEventListener(
        "close",
        () => {
          if (dialog.returnValue === "ok") {
            deleteTask(task.id);
          }
        },
        { once: true }
      );
    });
  });
}

function renderStats() {
  const container = document.getElementById("statsGrid");
  const stats = calcStats();
  container.innerHTML = "";
  stats.forEach((s) => {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `
      <span class="stat-icon">${s.icon}</span>
      <div class="stat-info">
        <span class="stat-name">${s.name}</span>
        <span class="stat-rate">${s.rate}%</span>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderUsers() {
  const sel = document.getElementById("username");
  const currentVal = sel.value;
  sel.innerHTML = "";
  state.users.forEach((u) => {
    const opt = document.createElement("option");
    opt.value = u;
    opt.textContent = u;
    sel.appendChild(opt);
  });
  sel.value = state.users.includes(currentVal) ? currentVal : state.users[0];
}

// --- Date Navigation ---
function goPrevDay() {
  currentDate.setDate(currentDate.getDate() - 1);
  render();
}

function goNextDay() {
  currentDate.setDate(currentDate.getDate() + 1);
  render();
}

function goToday() {
  currentDate = new Date();
  render();
}

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
  render();

  // Date nav
  document.getElementById("prevDay").addEventListener("click", goPrevDay);
  document.getElementById("nextDay").addEventListener("click", goNextDay);
  document.getElementById("todayBtn").addEventListener("click", goToday);

  // User switch
  document.getElementById("username").addEventListener("change", render);

  // Add user
  document.getElementById("addUserBtn").addEventListener("click", () => {
    const dialog = document.getElementById("addUserDialog");
    const input = document.getElementById("newUserName");
    input.value = "";
    dialog.showModal();
    dialog.addEventListener(
      "close",
      () => {
        if (dialog.returnValue === "ok" && input.value.trim()) {
          addUser(input.value.trim());
        }
      },
      { once: true }
    );
  });

  // Add task
  document.getElementById("addTaskBtn").addEventListener("click", () => {
    const dialog = document.getElementById("addTaskDialog");
    const input = document.getElementById("newTaskName");
    const iconSel = document.getElementById("newTaskIcon");
    input.value = "";
    iconSel.value = "🏃";
    dialog.showModal();
    dialog.addEventListener(
      "close",
      () => {
        if (dialog.returnValue === "ok" && input.value.trim()) {
          addTask(input.value.trim(), iconSel.value);
        }
      },
      { once: true }
    );
  });
});
