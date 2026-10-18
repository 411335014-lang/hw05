"use strict";

// 沿用先前的名稱，保留同一網站內的舊任務紀錄。
const STORAGE_KEY = "study-board-v1";
const EXP_PER_TASK = 20;
const EXP_PER_LEVEL = 100;

const $ = (selector) => document.querySelector(selector);

const form = $("#task-form");
const courseInput = $("#course");
const contentInput = $("#content");
const deadlineInput = $("#deadline");
const taskList = $("#task-list");
const princess = $("#princess");
const princessMessage = $("#princess-message");
const toast = $("#toast");

let tasks = [];
let currentFilter = "all";
let editingId = null;
let storageReady = true;
let toastTimer;
let speechTimer;
let animationTimer;
let temporarySpeech = false;

function warnStorage(text) {
  const warning = $("#storage-warning");
  warning.textContent = text;
  warning.hidden = false;
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

    if (!valid) {
      throw new Error("Invalid saved tasks");
    }

    return parsed;
  } catch {
    storageReady = false;

    warnStorage(
      "無法讀取儲存紀錄。目前變更只保留在此頁，請勿關閉或重新整理；原有資料不會被覆蓋。"
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
      "儲存失敗。目前變更只保留在此頁，請勿關閉或重新整理，並檢查瀏覽器儲存空間或設定。"
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
  }, 3500);
}

function notifyChange(text, saved) {
  showToast(saved ? text : `${text}（尚未保存，請勿關閉頁面）`);
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getStats() {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.completed).length;
  const exp = completed * EXP_PER_TASK;

  return {
    total,
    completed,
    exp,
    percent: total ? Math.round((completed / total) * 100) : 0,
    level: Math.floor(exp / EXP_PER_LEVEL) + 1,
    levelExp: exp % EXP_PER_LEVEL
  };
}

function getTitle(level) {
  if (level >= 10) return "公主認證・作業大師";
  if (level >= 8) return "咖啡廳榮譽貴賓";
  if (level >= 5) return "午後讀書常客";
  if (level >= 3) return "甜點級努力家";
  return "初次來店的小客人";
}

function getProgressMessage() {
  const stats = getStats();

  if (stats.total === 0) {
    return "歡迎光臨♡ 要先記下今天的作業嗎？";
  }

  if (stats.completed === stats.total) {
    return "作業全數完成♡ 公主為你送上甜點與掌聲！";
  }

  const hasOverdue = tasks.some(
    (task) =>
      !task.completed &&
      new Date(task.deadline).getTime() <= Date.now()
  );

  if (hasOverdue) {
    return "有一份作業等比較久了，公主陪你看看，好嗎？";
  }

  if (stats.completed === 0) {
    return "今日的讀書套餐準備好了♡ 先從一小步開始吧。";
  }

  if (stats.completed / stats.total < 0.5) {
    return "已經完成一些了♡ 公主有把你的努力記下來喔。";
  }

  return "進度過半了♡ 先喝口茶，再一起慢慢完成。";
}

function updateSpeech() {
  if (!temporarySpeech) {
    princessMessage.textContent = getProgressMessage();
  }
}

function speak(text, duration = 4500) {
  clearTimeout(speechTimer);

  temporarySpeech = true;
  princessMessage.textContent = text;

  speechTimer = setTimeout(() => {
    temporarySpeech = false;
    updateSpeech();
  }, duration);
}

function animatePrincess() {
  clearTimeout(animationTimer);
  princess.classList.remove("happy");

  // 讓連續點擊也能重新播放動畫。
  void princess.offsetWidth;

  princess.classList.add("happy");

  animationTimer = setTimeout(() => {
    princess.classList.remove("happy");
  }, 700);
}

function burstStars(x, y) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const effects = $("#effects");

  for (let i = 0; i < 12; i++) {
    const star = document.createElement("span");
    const angle = (Math.PI * 2 * i) / 12;
    const distance = 35 + Math.random() * 65;

    star.className = "sparkle";
    star.textContent = i % 3 === 0 ? "♡" : "✦";
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

    effects.append(star);
    setTimeout(() => star.remove(), 1100);
  }
}

function toLocalInputValue(value) {
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
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function getStatus(task) {
  if (task.completed) {
    return {
      text: "已完成 +20 EXP",
      className: "done"
    };
  }

  const remaining = new Date(task.deadline).getTime() - Date.now();

  if (remaining <= 0) {
    return {
      text: "已逾期",
      className: "overdue"
    };
  }

  if (remaining <= 24 * 60 * 60 * 1000) {
    return {
      text: "24 小時內到期",
      className: "soon"
    };
  }

  return {
    text: "進行中",
    className: ""
  };
}

function resetForm() {
  editingId = null;
  form.reset();

  [courseInput, contentInput, deadlineInput].forEach((input) => {
    input.setCustomValidity("");
  });

  $("#form-title").textContent = "新增作業訂單";
  $("#submit-button").textContent = "＋ 送出作業訂單";
  $("#cancel-edit").hidden = true;
}

function startEditing(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;

  resetForm();
  editingId = id;

  courseInput.value = task.course;
  contentInput.value = task.content;
  deadlineInput.value = toLocalInputValue(task.deadline);

  $("#form-title").textContent = "修改作業訂單";
  $("#submit-button").textContent = "♡ 儲存修改";
  $("#cancel-edit").hidden = false;

  form.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  courseInput.focus({ preventScroll: true });
}

function deleteTask(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;

  const extra = task.completed
    ? "\n刪除後，也會扣回這項作業的 20 EXP。"
    : "";

  if (!window.confirm(`確定刪除「${task.course}」這項作業嗎？${extra}`)) {
    return;
  }

  tasks = tasks.filter((item) => item.id !== id);

  if (editingId === id) resetForm();

  const saved = saveTasks();
  render();

  document.querySelector(".filter-button.active")?.focus({
    preventScroll: true
  });

  notifyChange("作業訂單已刪除。", saved);
}

function toggleTask(id, checkbox) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;

  const previousLevel = getStats().level;
  const rect = checkbox.getBoundingClientRect();

  task.completed = checkbox.checked;

  const saved = saveTasks();
  render();

  const nextCheckbox = Array.from(
    taskList.querySelectorAll(".task-checkbox")
  ).find((item) => item.dataset.taskId === id);

  if (nextCheckbox) {
    nextCheckbox.focus({ preventScroll: true });
  } else {
    document.querySelector(".filter-button.active")?.focus({
      preventScroll: true
    });
  }

  if (task.completed) {
    burstStars(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2
    );

    animatePrincess();

    const stats = getStats();

    if (stats.level > previousLevel) {
      notifyChange(
        `♡ 升級！Lv.${stats.level} · ${getTitle(stats.level)}`,
        saved
      );

      speak("恭喜升級♡ 公主為努力的你獻上蝴蝶結！");
    } else {
      notifyChange("♡ 完成一份作業訂單！+20 EXP", saved);
    }
  } else {
    notifyChange("已取消完成，扣回 20 EXP。", saved);
  }
}

function createActionButton(text, className, handler) {
  const button = document.createElement("button");

  button.type = "button";
  button.className = `action-button ${className}`;
  button.textContent = text;
  button.addEventListener("click", handler);

  return button;
}

function createTaskCard(task) {
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
    createActionButton("修改", "", () => startEditing(task.id)),
    createActionButton("刪除", "delete", () => deleteTask(task.id))
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
    `再 ${EXP_PER_LEVEL - stats.levelExp} EXP 升級`;

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
      if (currentFilter === "pending") return !task.completed;
      if (currentFilter === "completed") return task.completed;
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
    icon.textContent = "୨୧";
    icon.setAttribute("aria-hidden", "true");

    const title = document.createElement("p");
    const hint = document.createElement("small");

    if (tasks.length === 0) {
      title.textContent = "今天的作業菜單還是空白的";
      hint.textContent = "記下第一項作業，讓公主陪你開始♡";
    } else if (currentFilter === "pending") {
      title.textContent = "所有作業都已送餐完成♡";
      hint.textContent = "辛苦了，現在可以享用休息時光。";
    } else {
      title.textContent = "還沒有完成的作業訂單";
      hint.textContent = "完成第一件事，就能收集一點星光。";
    }

    empty.append(icon, title, hint);
    taskList.append(empty);
    return;
  }

  visible.forEach((task) => {
    taskList.append(createTaskCard(task));
  });
}

function render() {
  renderDashboard();
  renderList();
}

function setFilter(value) {
  currentFilter = value;

  document.querySelectorAll(".filter-button").forEach((button) => {
    const active = button.dataset.filter === currentFilter;

    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  render();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const course = courseInput.value.trim();
  const content = contentInput.value.trim();
  const deadline = deadlineInput.value;

  courseInput.setCustomValidity(
    course ? "" : "請輸入課程名稱。"
  );

  contentInput.setCustomValidity(
    content ? "" : "請輸入作業內容。"
  );

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
      showToast("找不到這項作業，請重新操作。");
      return;
    }

    Object.assign(task, {
      course,
      content,
      deadline
    });
  } else {
    tasks.push({
      id: createId(),
      course,
      content,
      deadline,
      completed: false
    });
  }

  const saved = saveTasks();

  resetForm();

  if (!wasEditing) {
    setFilter("all");
  } else {
    render();
  }

  notifyChange(
    wasEditing
      ? "修改好了♡ 公主幫你記住了。"
      : "已收到您的作業訂單♡",
    saved
  );
});

[courseInput, contentInput, deadlineInput].forEach((input) => {
  input.addEventListener("input", () => {
    input.setCustomValidity("");
  });
});

$("#cancel-edit").addEventListener("click", () => {
  resetForm();
  courseInput.focus();
});

document.querySelectorAll(".filter-button").forEach((button) => {
  button.addEventListener("click", () => {
    setFilter(button.dataset.filter);
  });
});

const encouragements = [
  "歡迎光臨♡ 今日推薦：先完成最小的一項作業。",
  "公主的臉頰很軟，但不可以一直摸到忘記寫作業喔。",
  "為你送上一杯勇氣紅茶♡ 慢慢來就好。",
  "今天不用完美，有前進一點就很棒了。",
  "讀書辛苦了♡ 要不要喝口水、伸個懶腰？",
  "公主把你的努力，全部收進小圍裙口袋裡了。",
  "就算只完成一題，也值得公主為你鼓掌♡",
  "女僕公主隨時待命♡ 我們一起處理下一件事。"
];

let lastEncouragement = -1;

$("#princess-button").addEventListener("click", () => {
  let next;

  do {
    next = Math.floor(Math.random() * encouragements.length);
  } while (next === lastEncouragement);

  lastEncouragement = next;

  animatePrincess();
  speak(encouragements[next]);
});

// 定時更新期限標示，不重建清單，避免打斷鍵盤操作。
function refreshTimeStatus() {
  renderDashboard();

  const taskMap = new Map(
    tasks.map((task) => [task.id, task])
  );

  taskList.querySelectorAll(".task-card").forEach((card) => {
    const checkbox = card.querySelector(".task-checkbox");
    const task = taskMap.get(checkbox.dataset.taskId);

    if (!task) return;

    const status = getStatus(task);
    const badge = card.querySelector(".badge");

    badge.className = `badge ${status.className}`;
    badge.textContent = status.text;

    card.classList.toggle(
      "overdue-card",
      status.className === "overdue"
    );
  });
}

setInterval(refreshTimeStatus, 30 * 1000);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshTimeStatus();
});

tasks = loadTasks();
render();
