"use strict";

// 沿用舊版儲存名稱，保留先前建立的任務。
const STORAGE_KEY = "study-board-v1";
const EXP_PER_TASK = 20;
const EXP_PER_LEVEL = 100;

const $ = (selector) => document.querySelector(selector);

const form = $("#task-form");
const courseInput = $("#course");
const contentInput = $("#content");
const deadlineInput = $("#deadline");
const taskList = $("#task-list");
const cat = $("#cat");
const catMessage = $("#cat-message");
const toast = $("#toast");

let tasks = [];
let filter = "all";
let editingId = null;
let storageReady = true;
let toastTimer;
let speechTimer;
let catTimer;
let temporarySpeech = false;

function warnStorage(text) {
  const warning = $("#storage-warning");
  warning.hidden = false;
  warning.textContent = text;
}

function loadTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved === null) return [];

    const parsed = JSON.parse(saved);
    const ids = new Set();

    const valid =
      Array.isArray(parsed) &&
      parsed.every((task) => {
        if (
          !task ||
          typeof task.id !== "string" ||
          !task.id ||
          ids.has(task.id) ||
          typeof task.course !== "string" ||
          !task.course.trim() ||
          typeof task.content !== "string" ||
          !task.content.trim() ||
          typeof task.deadline !== "string" ||
          !Number.isFinite(new Date(task.deadline).getTime()) ||
          typeof task.completed !== "boolean"
        ) {
          return false;
        }

        ids.add(task.id);
        return true;
      });

    if (!valid) throw new Error("Invalid task data");

    return parsed;
  } catch {
    storageReady = false;
    warnStorage(
      "無法讀取儲存紀錄。目前變更只會保留在此頁，請勿關閉或重新整理；原有儲存資料不會被覆蓋。"
    );
    return [];
  }
}

function saveTasks() {
  if (!storageReady) return false;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    $("#storage-warning").hidden = true;
    return true;
  } catch {
    warnStorage(
      "儲存失敗。目前變更只保留在此頁，請勿關閉或重新整理，並檢查瀏覽器的儲存設定與空間。"
    );
    return false;
  }
}

function showToast(text) {
  clearTimeout(toastTimer);
  toast.textContent = text;
  toast.classList.add("visible");

  toastTimer = setTimeout(() => {
    toast.classList.remove("visible");
  }, 3200);
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getStats() {
  const completed = tasks.filter((task) => task.completed).length;
  const total = tasks.length;
  const exp = completed * EXP_PER_TASK;

  return {
    total,
    completed,
    percent: total ? Math.round((completed / total) * 100) : 0,
    exp,
    level: Math.floor(exp / EXP_PER_LEVEL) + 1,
    levelExp: exp % EXP_PER_LEVEL
  };
}

function getTitle(level) {
  if (level >= 10) return "Deadline 馴獸師";
  if (level >= 8) return "黑貓認證學霸";
  if (level >= 5) return "讀書漸入佳境";
  if (level >= 3) return "作業練習生";
  return "開學迷路人";
}

function getProgressMessage() {
  const stats = getStats();

  if (stats.total === 0) {
    return "今天很和平，要先記下作業嗎？";
  }

  if (stats.completed === stats.total) {
    return "清空了！可以理直氣壯去躺了。";
  }

  const hasOverdue = tasks.some(
    (task) =>
      !task.completed &&
      new Date(task.deadline).getTime() <= Date.now()
  );

  if (hasOverdue) {
    return "有作業遲到了，我們先看看那一件。";
  }

  if (stats.completed === 0) {
    return "先挑一件，我陪你。";
  }

  if (stats.completed / stats.total < 0.5) {
    return "有在前進喔，慢慢來。";
  }

  return "已經過半了，剩下的逐個解決。";
}

function updateSpeech() {
  if (!temporarySpeech) {
    catMessage.textContent = getProgressMessage();
  }
}

function speak(text, duration = 4000) {
  clearTimeout(speechTimer);
  temporarySpeech = true;
  catMessage.textContent = text;

  speechTimer = setTimeout(() => {
    temporarySpeech = false;
    updateSpeech();
  }, duration);
}

function animateCat() {
  clearTimeout(catTimer);
  cat.classList.remove("happy");

  // 重新開始同一個動畫。
  void cat.offsetWidth;
  cat.classList.add("happy");

  catTimer = setTimeout(() => {
    cat.classList.remove("happy");
  }, 700);
}

function burstStars(x, y) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const layer = $("#effects");

  for (let i = 0; i < 12; i++) {
    const star = document.createElement("span");
    const angle = (Math.PI * 2 * i) / 12;
    const distance = 35 + Math.random() * 65;

    star.className = "sparkle";
    star.textContent = i % 2 === 0 ? "✦" : "✧";
    star.style.left = `${x}px`;
    star.style.top = `${y}px`;
    star.style.fontSize = `${12 + Math.random() * 14}px`;
    star.style.setProperty(
      "--dx",
      `${Math.cos(angle) * distance}px`
    );
    star.style.setProperty(
      "--dy",
      `${Math.sin(angle) * distance - 35}px`
    );

    layer.append(star);
    setTimeout(() => star.remove(), 1100);
  }
}

function localDateValue(value) {
  const date = new Date(value);
  const pad = (number) => String(number).padStart(2, "0");

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())}T${pad(date.getHours())}:` +
    `${pad(date.getMinutes())}`
  );
}

function formatDeadline(value) {
  return new Date(value).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function getStatus(task) {
  if (task.completed) {
    return { text: "已完成 +20 EXP", className: "done" };
  }

  const remaining = new Date(task.deadline).getTime() - Date.now();

  if (remaining <= 0) {
    return { text: "已逾期", className: "overdue" };
  }

  if (remaining <= 24 * 60 * 60 * 1000) {
    return { text: "24 小時內到期", className: "soon" };
  }

  return { text: "進行中", className: "" };
}

function resetForm() {
  editingId = null;
  form.reset();

  [courseInput, contentInput, deadlineInput].forEach((input) => {
    input.setCustomValidity("");
  });

  $("#form-title").textContent = "新增任務";
  $("#submit-button").textContent = "＋ 收進任務板";
  $("#cancel-edit").hidden = true;
}

function startEditing(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;

  resetForm();
  editingId = id;

  courseInput.value = task.course;
  contentInput.value = task.content;
  deadlineInput.value = localDateValue(task.deadline);

  $("#form-title").textContent = "修改任務";
  $("#submit-button").textContent = "儲存修改";
  $("#cancel-edit").hidden = false;

  form.scrollIntoView({ behavior: "smooth", block: "center" });
  courseInput.focus({ preventScroll: true });
}

function deleteTask(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;

  const explanation = task.completed
    ? "\n刪除後，也會扣回這項任務的 20 EXP。"
    : "";

  if (!window.confirm(`確定刪除「${task.course}」這項任務嗎？${explanation}`)) {
    return;
  }

  tasks = tasks.filter((item) => item.id !== id);

  if (editingId === id) resetForm();

  saveTasks();
  render();
  showToast("任務已刪除。");
}

function toggleTask(id, checkbox) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;

  const previousLevel = getStats().level;
  const rect = checkbox.getBoundingClientRect();

  task.completed = checkbox.checked;

  saveTasks();

  // 切換篩選或排序後，讓鍵盤焦點仍有合理的位置。
  const keepTaskVisible =
    filter === "all" ||
    (filter === "completed" && task.completed) ||
    (filter === "pending" && !task.completed);

  render();

  if (keepTaskVisible) {
    const nextCheckbox = Array.from(
      taskList.querySelectorAll(".task-checkbox")
    ).find((item) => item.dataset.taskId === id);

    nextCheckbox?.focus({ preventScroll: true });
  } else {
    document.querySelector(".filter-button.active")?.focus({
      preventScroll: true
    });
  }

  if (task.completed) {
    burstStars(rect.left + rect.width / 2, rect.top + rect.height / 2);
    animateCat();

    const stats = getStats();

    if (stats.level > previousLevel) {
      showToast(`✦ 升級！Lv.${stats.level} · ${getTitle(stats.level)}`);
      speak("升級了！這是你一件一件完成的證明。");
    } else {
      showToast("✦ 又少一件事了！+20 EXP");
    }
  } else {
    showToast("已取消完成，扣回 20 EXP。");
  }
}

function actionButton(label, className, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `action-button ${className}`;
  button.textContent = label;
  button.addEventListener("click", handler);
  return button;
}

function createCard(task) {
  const status = getStatus(task);
  const card = document.createElement("article");

  card.className = [
    "task-card",
    task.completed ? "completed" : "",
    status.className === "overdue" ? "overdue-card" : ""
  ].filter(Boolean).join(" ");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "task-checkbox";
  checkbox.dataset.taskId = task.id;
  checkbox.checked = task.completed;
  checkbox.setAttribute(
    "aria-label",
    `${task.completed ? "取消完成" : "標記完成"}：${task.course}，${task.content}`
  );

  checkbox.addEventListener("change", () => {
    toggleTask(task.id, checkbox);
  });

  const body = document.createElement("div");
  body.className = "task-body";

  const top = document.createElement("div");
  top.className = "task-top";

  const course = document.createElement("h3");
  course.className = "task-course";
  course.textContent = task.course;

  const badge = document.createElement("span");
  badge.className = `badge ${status.className}`;
  badge.textContent = status.text;

  const content = document.createElement("p");
  content.className = "task-content";
  content.textContent = task.content;

  const deadline = document.createElement("time");
  deadline.className = "task-deadline";
  deadline.dateTime = new Date(task.deadline).toISOString();
  deadline.textContent = `期限：${formatDeadline(task.deadline)}`;

  const actions = document.createElement("div");
  actions.className = "task-actions";

  actions.append(
    actionButton("修改", "", () => startEditing(task.id)),
    actionButton("刪除", "delete", () => deleteTask(task.id))
  );

  top.append(course, badge);
  body.append(top, content, deadline);
  card.append(checkbox, body, actions);

  return card;
}

function renderDashboard() {
  const stats = getStats();

  $("#today").textContent = new Date().toLocaleDateString("zh-TW", {
    month: "long",
    day: "numeric",
    weekday: "long"
  });

  $("#progress-percent").textContent = `${stats.percent}%`;
  $("#progress-text").textContent =
    `已完成 ${stats.completed} / ${stats.total} 項任務`;

  $("#task-progress").value = stats.percent;
  $("#task-progress").textContent = `${stats.percent}%`;

  $("#level-label").textContent = `Lv.${stats.level}`;
  $("#level-title").textContent = getTitle(stats.level);

  $("#exp-text").textContent =
    `${stats.levelExp} / ${EXP_PER_LEVEL} EXP · ` +
    `距離升級還差 ${EXP_PER_LEVEL - stats.levelExp} EXP`;

  $("#exp-progress").value = stats.levelExp;
  $("#exp-progress").textContent = `${stats.levelExp} EXP`;
  $("#exp-progress").setAttribute(
    "aria-label",
    `等級 ${stats.level}，升級經驗值 ${stats.levelExp} / ${EXP_PER_LEVEL}`
  );

  $("#task-count").textContent = `${stats.total} 項`;
  updateSpeech();
}

function renderList() {
  taskList.replaceChildren();

  const visible = tasks
    .filter((task) => {
      if (filter === "pending") return !task.completed;
      if (filter === "completed") return task.completed;
      return true;
    })
    .sort((a, b) => {
      if (a.completed !== b.completed) {
        return Number(a.completed) - Number(b.completed);
      }

      return new Date(a.deadline) - new Date(b.deadline);
    });

  if (visible.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";

    const icon = document.createElement("span");
    icon.className = "empty-icon";
    icon.textContent = "☾";
    icon.setAttribute("aria-hidden", "true");

    const title = document.createElement("p");
    const hint = document.createElement("small");

    if (tasks.length === 0) {
      title.textContent = "任務板還很安靜";
      hint.textContent = "記下第一項作業，讓小墨陪你開始。";
    } else if (filter === "pending") {
      title.textContent = "目前沒有未完成任務";
      hint.textContent = "今天的你，值得一點休息。";
    } else {
      title.textContent = "這裡還沒有已完成任務";
      hint.textContent = "完成第一件事，就能收到一點星光。";
    }

    empty.append(icon, title, hint);
    taskList.append(empty);
    return;
  }

  visible.forEach((task) => taskList.append(createCard(task)));
}

function render() {
  renderDashboard();
  renderList();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const course = courseInput.value.trim();
  const content = contentInput.value.trim();
  const deadline = deadlineInput.value;

  courseInput.setCustomValidity(course ? "" : "請輸入課程名稱。");
  contentInput.setCustomValidity(content ? "" : "請輸入作業內容。");
  deadlineInput.setCustomValidity(
    Number.isFinite(new Date(deadline).getTime())
      ? ""
      : "請輸入有效的繳交日期與時間。"
  );

  if (!form.reportValidity()) return;

  const wasEditing = editingId !== null;

  if (wasEditing) {
    const task = tasks.find((item) => item.id === editingId);

    if (!task) {
      resetForm();
      showToast("找不到這項任務，請重新操作。");
      return;
    }

    Object.assign(task, { course, content, deadline });
  } else {
    tasks.push({
      id: createId(),
      course,
      content,
      deadline,
      completed: false
    });
  }

  saveTasks();
  resetForm();

  // 新增後切回全部，確保能看見剛建立的任務。
  if (!wasEditing) setFilter("all");
  else render();

  showToast(wasEditing ? "修改好了，小墨幫你記住了。" : "收到新任務，一起慢慢解決。");
});

[courseInput, contentInput, deadlineInput].forEach((input) => {
  input.addEventListener("input", () => {
    input.setCustomValidity("");
  });
});

$("#cancel-edit").addEventListener("click", resetForm);

function setFilter(value) {
  filter = value;

  document.querySelectorAll(".filter-button").forEach((button) => {
    const active = button.dataset.filter === filter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  render();
}

document.querySelectorAll(".filter-button").forEach((button) => {
  button.addEventListener("click", () => {
    setFilter(button.dataset.filter);
  });
});

const encouragements = [
  "先寫一題也算有寫。",
  "你負責努力，我負責在旁邊可愛。",
  "不必一次完成全部，先做下一小步。",
  "喝口水，肩膀放鬆一下。",
  "卡住的話，先把題目看懂也算進度。",
  "今天的努力，我有看到喔。",
  "摸貓可以，但等一下要回去寫作業喔。"
];

let lastEncouragement = -1;

$("#cat-button").addEventListener("click", () => {
  let next;

  do {
    next = Math.floor(Math.random() * encouragements.length);
  } while (next === lastEncouragement);

  lastEncouragement = next;
  animateCat();
  speak(encouragements[next]);
});

// 更新期限標籤，不重建清單，避免打斷鍵盤操作。
function refreshTimeStatus() {
  renderDashboard();

  const byId = new Map(tasks.map((task) => [task.id, task]));

  taskList.querySelectorAll(".task-card").forEach((card) => {
    const checkbox = card.querySelector(".task-checkbox");
    const task = byId.get(checkbox.dataset.taskId);
    if (!task) return;

    const status = getStatus(task);
    const badge = card.querySelector(".badge");

    badge.className = `badge ${status.className}`;
    badge.textContent = status.text;
    card.classList.toggle("overdue-card", status.className === "overdue");
  });
}

setInterval(refreshTimeStatus, 30 * 1000);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshTimeStatus();
});

tasks = loadTasks();
render();
