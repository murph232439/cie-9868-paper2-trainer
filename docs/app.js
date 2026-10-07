import { TRACKS, LANGUAGE_LIBRARY, BOSS_PROMPTS, PRACTICE_BANK } from "./data.js?v=20";

const LITERATURE_TRACK = {
  id: "literature",
  name: "文学赏析",
  short: "Paper 3",
  code: "Paper 3 · Literature",
  icon: "book-open",
  accent: "#5b6c1f",
  description: "整理 9868/32 历年文学题，训练审题、选原文证据、Explain 和结构。",
  levels: [
    {
      id: "lit1",
      title: "审题与要求",
      skill: "审题",
      icon: "scan-search",
      summary: "先判断题目要求分析人物、主题、语言还是结构。",
      steps: [
        {
          kind: "multi",
          prompt: "文学赏析题通常要求你分析哪些内容？",
          options: ["人物", "主题", "语言手法", "结构与作用", "作者生平八卦"],
          correct: [0, 1, 2, 3],
          explanation: "文学赏析要围绕文本人物、主题、语言和结构展开。",
          tip: "每个 point 都必须回到原文证据。"
        }
      ]
    },
    {
      id: "lit2",
      title: "证据选择",
      skill: "证据",
      icon: "quote",
      summary: "从选文或全文中找到最能证明 point 的句子和情节。",
      steps: [
        {
          kind: "text",
          prompt: "写出一处可以支持你观点的原文证据，并说明它出现在什么情境。",
          minChars: 20,
          sample: "例如，选文中写到……，这一细节出现在……的情境中。",
          explanation: "证据必须能直接支撑 point，不能只是你喜欢的句子。",
          tip: "引文只取半句，后面至少写两句 Explain。"
        }
      ]
    },
    {
      id: "lit3",
      title: "Explain 展开",
      skill: "Explain",
      icon: "text-search",
      summary: "解释原文的写法如何支撑你的判断。",
      steps: [
        {
          kind: "text",
          prompt: "用“这个细节说明什么、为什么能说明”写一段 Explain。",
          minChars: 35,
          sample: "这个细节说明……；因为作者用……的方式写出……，所以读者能够看到……。",
          explanation: "Explain 要解释文本和观点之间的逻辑，不是重复情节。",
          tip: "句式：这个细节说明……；因为……；因此……"
        }
      ]
    },
    {
      id: "lit4",
      title: "结构与结论",
      skill: "结构",
      icon: "blocks",
      summary: "把 point、引文、Explain 和全文主题组织成完整回答。",
      steps: [
        {
          kind: "order",
          prompt: "按文学赏析段落结构排列。",
          items: ["point", "原文证据", "Explain", "回扣题目或主题"],
          correct: [0, 1, 2, 3],
          sample: "point → 原文证据 → Explain → 回扣题目或主题。",
          explanation: "每个段落都要回扣题目和整部作品。",
          tip: "结尾不要只总结情节，要说明作者通过文本表达了什么。"
        }
      ]
    }
  ]
};

const ALL_TRACKS = [...TRACKS, LITERATURE_TRACK];

const STORAGE_KEY = "paper2_trainer_v1";
const app = document.querySelector("#app");
const topStats = document.querySelector("#topStats");
const toastNode = document.querySelector("#toast");
const projectionToggle = document.querySelector("#projectionToggle");

const defaultState = {
  xp: 0,
  streak: 0,
  lastPracticeDate: null,
  completed: {},
  completedQuestions: {},
  mistakes: [],
  history: [],
  submissions: [],
  savedLanguage: [],
  projection: false
};

let state = loadState();
let session = freshSession();
let bossTimerId = null;
let bossSeconds = 20 * 60;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw
      ? { ...structuredClone(defaultState), ...JSON.parse(raw) }
      : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderTopStats();
}

function freshSession() {
  return {
    trackId: null,
    levelId: null,
    stepIndex: 0,
    selected: null,
    selectedMulti: [],
    text: "",
    orderSeq: [],
    checked: false,
    passed: null,
    showTip: false,
    freeMode: false,
    trackView: "questions",
    practiceMode: false,
    practiceLevel: null,
    stepAnswers: [],
    bossPrompt: BOSS_PROMPTS[0],
    bossMode: "outline",
    bossFields: ["", "", "", ""],
    bossEssay: "",
    bossChecks: [false, false, false, false, false]
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getTrack(trackId) {
  return TRACKS.find((track) => track.id === trackId);
}

function getLevel(trackId, levelId) {
  return getTrack(trackId)?.levels.find((level) => level.id === levelId);
}

function completedLevels(trackId) {
  return state.completed[trackId] ?? [];
}

function completedQuestions(trackId) {
  return state.completedQuestions[trackId] ?? [];
}

function questionKey(trackId, index) {
  return `${trackId}-${index}`;
}

function isQuestionCompleted(trackId, index) {
  return completedQuestions(trackId).includes(questionKey(trackId, index));
}

function isLevelCompleted(trackId, levelId) {
  return completedLevels(trackId).includes(levelId);
}

function isLevelUnlocked(trackId, levelId) {
  const track = getTrack(trackId);
  const index = track?.levels.findIndex((level) => level.id === levelId) ?? -1;
  if (index <= 0) return true;
  return isLevelCompleted(trackId, track.levels[index - 1].id);
}

function nextLevel(track) {
  return track.levels.find((level) => !isLevelCompleted(track.id, level.id)) ?? track.levels.at(-1);
}

function totalCompleted() {
  return Object.values(state.completed).reduce((sum, list) => sum + list.length, 0);
}

function totalLevels() {
  return TRACKS.reduce((sum, track) => sum + track.levels.length, 0);
}

function totalQuestionsCompleted() {
  return Object.values(state.completedQuestions ?? {}).reduce((sum, list) => sum + list.length, 0);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function touchStreak() {
  const today = todayKey();
  if (state.lastPracticeDate === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  state.streak = state.lastPracticeDate === yesterday ? state.streak + 1 : 1;
  state.lastPracticeDate = today;
}

function toast(message) {
  toastNode.textContent = message;
  toastNode.classList.add("show");
  window.clearTimeout(toast._timer);
  toast._timer = window.setTimeout(() => toastNode.classList.remove("show"), 2200);
}

function icon(name, size = 19) {
  return `<i data-lucide="${name}" style="width:${size}px;height:${size}px"></i>`;
}

function renderTopStats() {
  topStats.innerHTML = `
    <span class="stat-pill">${icon("zap")} ${state.xp} XP</span>
    <span class="stat-pill">${icon("flame")} 连续 ${state.streak} 天</span>
    <span class="stat-pill">${icon("badge-check")} ${totalQuestionsCompleted()} 题 · ${totalCompleted()}/${totalLevels()} 关</span>
  `;
  projectionToggle.classList.toggle("active", state.projection);
  projectionToggle.innerHTML = `${icon("presentation")}<span>${state.projection ? "退出投屏" : "投屏"}</span>`;
  document.body.classList.toggle("projection", state.projection);
  refreshIcons();
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
  }
}

function navigate(route) {
  window.location.hash = route;
}

function render() {
  const route = window.location.hash || "#/home";
  const [, section = "home", first, second] = route.split("/");

  if (section === "home") renderHome();
  else if (section === "track") renderTrack(first);
  else if (section === "level") renderLevel(first, second);
  else if (section === "language") renderLanguage();
  else if (section === "progress") renderProgress();
  else if (section === "errors") renderErrors();
  else if (section === "boss") renderBoss();
  else if (section === "bank") renderBank(first);
  else if (section === "practice") renderPractice(first, second);
  else if (section === "complete") renderComplete(first);
  else renderHome();

  renderTopStats();
  refreshIcons();
  window.scrollTo({ top: 0, behavior: "auto" });
}

function renderHome() {
  const recommendation = getRecommendation();
  app.innerHTML = `
    <section class="page-header">
      <div class="page-title">
        <p class="eyebrow">Student practice</p>
        <h1>今天想练哪一种写作？</h1>
        <p>先选题型，再进入训练地图。每过一关，都会得到一条可以马上用进作文的语言建议。</p>
      </div>
      <button class="button primary" data-route="#/boss">${icon("swords")} 进入真题 Boss</button>
    </section>

    <section class="recommend-band">
      <div>
        <p class="eyebrow">今日推荐</p>
        <h2>${escapeHtml(recommendation.title)}</h2>
        <p>${escapeHtml(recommendation.reason)}</p>
      </div>
      <div class="recommend-actions">
        <button class="button warm" data-route="${recommendation.route}">${icon("play")} 开始这一关</button>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <h2>三种题型</h2>
        <p>点击你想练的路线，进度会分别保存。</p>
      </div>
      <div class="track-grid">
        ${TRACKS.map(renderTrackCard).join("")}
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <h2>学习工具</h2>
        <p>语言库和错题回炉可以在任何路线中使用。</p>
      </div>
      <div class="utility-grid">
        <button class="utility-card" data-route="#/language">
          ${icon("sparkles", 24)}
          <span><strong>语言升级库</strong><small>口语改书面语，普通句换高分句</small></span>
        </button>
        <button class="utility-card" data-route="#/progress">
          ${icon("chart-no-axes-column-increasing", 24)}
          <span><strong>我的进度</strong><small>经验值、能力雷达和完成记录</small></span>
        </button>
        <button class="utility-card" data-route="#/errors">
          ${icon("rotate-ccw", 24)}
          <span><strong>错题回炉</strong><small>重练做错的思维动作</small></span>
        </button>
        <button class="utility-card" data-route="#/boss">
          ${icon("timer", 24)}
          <span><strong>真题 Boss</strong><small>限时完成审题和提纲</small></span>
        </button>
      </div>
    </section>
  `;
}

function renderTrackCard(track) {
  const count = completedLevels(track.id).length;
  const next = nextLevel(track);
  const questionCount = PRACTICE_BANK[track.id]?.length ?? 0;
  const doneQuestions = completedQuestions(track.id).length;
  const percent = Math.round((count / track.levels.length) * 100);
  return `
    <button class="track-card" data-route="#/track/${track.id}" style="--track-color:${track.accent}">
      <span class="track-icon">${icon(track.icon, 25)}</span>
      <p class="eyebrow">${escapeHtml(track.code)}</p>
      <h2>${escapeHtml(track.name)}</h2>
      <p>${escapeHtml(track.description)}</p>
      <div class="progress-bar" aria-label="${percent}%"><span style="width:${percent}%;background:${track.accent}"></span></div>
      <div class="next">
        <span>${doneQuestions}/${questionCount} 题已练 · ${count}/${track.levels.length} 关完成</span>
        <strong>进入题库：${escapeHtml(next.title)}</strong>
      </div>
    </button>
  `;
}

function getRecommendation() {
  if (state.mistakes.length) {
    const error = state.mistakes[0];
    return {
      title: `重练：${error.levelTitle}`,
      reason: `上次在“${error.prompt.slice(0, 38)}……”这一步做错，回炉一次就能修正。`,
      route: `#/level/${error.trackId}/${error.levelId}`
    };
  }
  for (const track of TRACKS) {
    const next = nextLevel(track);
    if (!isLevelCompleted(track.id, next.id)) {
      return {
        title: `${track.name} · ${next.title}`,
        reason: `这是你当前路线的下一关，训练重点是${next.skill}。`,
        route: `#/level/${track.id}/${next.id}`
      };
    }
  }
  return {
    title: "真题 Boss",
    reason: "三条文体的关卡都已完成，可以进入限时真题训练。",
    route: "#/boss"
  };
}

function renderTrack(trackId) {
  const track = getTrack(trackId);
  if (!track) return renderHome();
  const count = completedLevels(track.id).length;
  const percent = Math.round((count / track.levels.length) * 100);
  const questions = PRACTICE_BANK[track.id] ?? [];
  const doneQuestions = completedQuestions(track.id).length;
  const questionPercent = Math.round((doneQuestions / Math.max(1, questions.length)) * 100);
  const view = session.trackView === "map" ? "map" : "questions";
  app.innerHTML = `
    <section class="page-header">
      <div class="page-title">
        <button class="inline-link" data-route="#/home">← 返回训练大厅</button>
        <h1>${escapeHtml(track.name)}</h1>
        <p>${escapeHtml(track.description)} 先选一道题，再进入审题、破题、论点和结构训练。</p>
      </div>
      <button class="button primary" data-route="${`#/level/${track.id}/${nextLevel(track).id}`}">
        ${icon("play")} 继续下一关
      </button>
    </section>

    <section class="panel">
      <div class="progress-row">
        <span>题目练习</span>
        <div class="progress-bar"><span style="width:${questionPercent}%;background:${track.accent}"></span></div>
        <strong>${doneQuestions}/${questions.length}</strong>
      </div>
      <div class="progress-row">
        <span>技能关卡</span>
        <div class="progress-bar"><span style="width:${percent}%;background:${track.accent}"></span></div>
        <strong>${count}/${track.levels.length}</strong>
      </div>
      <div class="toolbar">
        <button class="filter-chip ${view === "questions" ? "active" : ""}" data-action="set-track-view" data-view="questions">题目练习 · ${questions.length} 题</button>
        <button class="filter-chip ${view === "map" ? "active" : ""}" data-action="set-track-view" data-view="map">技能地图 · ${track.levels.length} 关</button>
      </div>
      ${
        view === "map"
          ? `<div class="map-grid">${track.levels.map((level, index) => renderLevelNode(track, level, index)).join("")}</div>`
          : `<section class="bank-grid">${questions.map((item, index) => renderQuestionCard(track.id, item, index)).join("")}</section>`
      }
    </section>
  `;
}

function renderQuestionCard(trackId, item, index) {
  const buttonLabel = trackId === "argument" ? "审题与定义" : "写作训练";
  return `
    <article class="bank-card">
      <div class="card-top">
        <span class="chip">${escapeHtml(item.source ? `真题 · ${item.source}` : item.type)}</span>
        <span class="muted">${escapeHtml(item.focus)}${isQuestionCompleted(trackId, index) ? " · 已练" : ""}</span>
      </div>
      <p>${escapeHtml(item.text)}</p>
      <div class="task-actions">
        <button class="button primary" data-action="start-practice" data-track="${trackId}" data-index="${index}">${icon("play")} ${buttonLabel}</button>
        <button class="button ghost" data-action="open-level" data-track="${trackId}" data-level="${item.level}">${icon("route")} 相关技能</button>
      </div>
    </article>
  `;
}

function renderFreePractice(track) {
  const groups = new Map();
  for (const level of track.levels) {
    if (!groups.has(level.skill)) groups.set(level.skill, []);
    groups.get(level.skill).push(level);
  }
  return `
    <p class="muted">自由训练不受关卡顺序限制，可以选择当前最想练的思维动作。</p>
    ${[...groups.entries()]
      .map(
        ([skill, levels]) => `
          <div class="section">
            <div class="section-head"><h2>${escapeHtml(skill)}</h2><p>${levels.length} 个练习</p></div>
            <div class="map-grid">${levels.map((level) => renderLevelNode(track, level, 99, true)).join("")}</div>
          </div>
        `
      )
      .join("")}
  `;
}

function renderLevelNode(track, level, index, forceUnlocked = false) {
  const completed = isLevelCompleted(track.id, level.id);
  const unlocked = forceUnlocked || isLevelUnlocked(track.id, level.id);
  const status = completed ? "已完成" : unlocked ? "可开始" : "未解锁";
  const className = completed ? "completed" : unlocked ? "current" : "locked";
  return `
    <button class="level-node ${className}" data-action="open-level" data-track="${track.id}" data-level="${level.id}" ${unlocked ? "" : "disabled"}>
      <span class="node-top">
        <span class="node-icon">${icon(level.icon)}</span>
        <span class="node-status">${status}</span>
      </span>
      <h3>${escapeHtml(level.title)}</h3>
      <p>${escapeHtml(level.summary)}</p>
      <p class="muted">训练动作：${escapeHtml(level.skill)}</p>
    </button>
  `;
}

function renderLevel(trackId, levelId) {
  const track = getTrack(trackId);
  const level = getLevel(trackId, levelId);
  if (!track || !level) return renderHome();

  if (session.trackId !== trackId || session.levelId !== levelId) {
    session = { ...freshSession(), trackId, levelId, practiceMode: false, practiceLevel: null };
  }

  renderLevelView(track, level);
}

function renderLevelView(track, level) {
  const trackId = track.id;
  const levelId = level.id;
  if (session.trackId !== trackId || session.levelId !== levelId) {
    session = { ...freshSession(), trackId, levelId, practiceMode: false, practiceLevel: null };
  }
  const step = level.steps[session.stepIndex];
  const stepCount = level.steps.length;
  const backRoute = `#/track/${trackId}`;
  const backLabel = session.practiceMode ? "← 返回题目列表" : `← 返回${track.name}`;
  app.innerHTML = `
    <section class="level-view">
      <div class="page-header">
        <div class="page-title">
          <button class="inline-link" data-route="${backRoute}">${escapeHtml(backLabel)}</button>
          <h1>${escapeHtml(level.title)}</h1>
          <p>${escapeHtml(level.summary)}</p>
        </div>
        <button class="button ghost" data-action="toggle-tip">${icon("lightbulb")} 语言提示</button>
      </div>

      <div class="level-meta">
        <span class="chip">${icon("route")} ${escapeHtml(track.name)}</span>
        <span class="chip">${icon("target")} ${escapeHtml(level.skill)}</span>
        <span class="chip">${icon("list-checks")} 第 ${session.stepIndex + 1} / ${stepCount} 步</span>
      </div>
      ${
        session.practiceMode && level.purpose
          ? `<div class="purpose-band"><strong>${icon("target")} 这道题训练什么</strong><p>${escapeHtml(level.purpose)}</p></div>`
          : ""
      }

      <div class="step-progress">
        ${level.steps.map((_, index) => `<span class="${index < session.stepIndex ? "done" : index === session.stepIndex ? "current" : ""}"></span>`).join("")}
      </div>

      <section class="task-panel">
        <p class="eyebrow">${escapeHtml(stepKindLabel(step.kind))}</p>
        ${step.context ? `<div class="question-context"><span>题目原句</span><p>${escapeHtml(step.context)}</p></div>` : ""}
        <h2>${escapeHtml(step.prompt)}</h2>
        ${renderStepInput(step)}
        ${session.showTip ? renderLanguageTip(step, track) : ""}
        ${session.checked ? renderFeedback(step) : ""}
        <div class="task-actions">
          ${
            session.checked
              ? `<button class="button primary" data-action="next-step">${icon("arrow-right")} ${session.stepIndex === stepCount - 1 ? "完成这一关" : "下一题"}</button>`
              : `<button class="button primary" data-action="check-step">${icon("check")} 检查答案</button>`
          }
          <button class="button ghost" data-action="clear-step">${icon("eraser")} 清空</button>
        </div>
      </section>
    </section>
  `;
}

function questionKeyword(item) {
  const text = item.text;
  if (text.includes("不可能")) return "不可能";
  if (text.includes("总是")) return "总是";
  if (text.includes("必须")) return "必须";
  if (text.includes("一定要")) return "一定";
  if (text.includes("利大于弊")) return "利大于弊";
  if (text.includes("弊大于利")) return "弊大于利";
  if (text.includes("更")) return "更";
  if (text.includes("更重要") || text.includes("比")) return "更";
  if (text.includes("决定")) return "决定";
  if (text.includes("应该")) return "应该";
  if (item.type.includes("双面")) return "更";
  return "题眼";
}

function keywordGuidance(keyword) {
  if (keyword === "利大于弊" || keyword === "弊大于利") {
    return {
      sample: `题眼是“${keyword}”。题目要求比较“利”和“弊”，判断哪一方影响更大。`,
      tip: "比较型题目先把两方写清楚，再说明你的判断适用于什么情况。"
    };
  }
  if (keyword === "更") {
    return {
      sample: "题眼是“更”。题目要求比较双方，不能只写其中一方。",
      tip: "先找出比较双方，再说明在什么条件下哪一方更突出。"
    };
  }
  if (keyword === "必须" || keyword === "一定") {
    return {
      sample: `题眼是“${keyword}”。题目要求判断必要条件，不能只写它有没有好处。`,
      tip: "要说明缺少这个条件时，目标是否仍然能够实现。"
    };
  }
  if (keyword === "决定") {
    return {
      sample: "题眼是“决定”。题目要求判断影响程度，还要讨论是否有其他因素。",
      tip: "不要只证明一个因素有影响，要说明它是否真的起决定作用。"
    };
  }
  if (keyword === "不可能" || keyword === "总是") {
    return {
      sample: `题眼是“${keyword}”。这是绝对判断，必须讨论例外和条件。`,
      tip: "越绝对的词，越要写“通常”“在……情况下”“并非所有”。"
    };
  }
  if (keyword === "应该") {
    return {
      sample: "题眼是“应该”。题目要求判断做法是否合理，并说明条件和后果。",
      tip: "不要只写好处，还要写适用条件和可能的代价。"
    };
  }
  return {
    sample: "先圈出题干里最强的判断词，再说明它要求你回答什么。",
    tip: "题眼决定文章的核心问题，不能只写同意或不同意。"
  };
}

function questionScope(item) {
  const text = item.text;
  const scopes = ["青少年", "中学生", "年轻人", "职场", "学校", "家庭", "国家", "社会", "城市", "乡村", "当代", "企业"];
  return scopes.find((scope) => text.includes(scope)) ?? `${item.focus}所涉及的场景`;
}

function buildKeywordChoices(keyword) {
  const pool = ["更", "必须", "一定", "决定", "不可能", "总是", "应该", "利大于弊", "弊大于利"];
  const distractors = pool.filter((item) => item !== keyword).slice(0, 3);
  const options = [keyword, ...distractors];
  const shift = keyword.length % options.length;
  const rotated = [...options.slice(shift), ...options.slice(0, shift)];
  return { options: rotated, correct: rotated.indexOf(keyword) };
}

function buildDefinitionChoices(item, keyword) {
  const scope = questionScope(item);
  return {
    options: [
      `核心对象：${item.focus}`,
      `判断标准：${keyword}`,
      `限定范围：${scope}`,
      "作者的生平经历",
      "文章的字数"
    ],
    correct: [0, 1, 2]
  };
}

function makePracticeLevel(trackId, index) {
  const item = PRACTICE_BANK[trackId]?.[index];
  if (!item) return null;
  const context = item.text;
  const shared = {
    explanation: "这一步没有唯一答案，重点是把你的判断写清楚，并保留题目中的核心概念。",
    tip: "写完后检查：有没有回应题目，能不能用一句 evidence 和两句 Explain 支撑。"
  };

  let steps = [];
  if (trackId === "argument") {
    const keyword = questionKeyword(item);
    const keywordChoices = buildKeywordChoices(keyword);
    const definitionChoices = buildDefinitionChoices(item, keyword);
    const scope = questionScope(item);
    steps = [
      {
        kind: "choice",
        context,
        prompt: "这道题的题眼是哪一个词？",
        options: keywordChoices.options,
        correct: keywordChoices.correct,
        explanation: `这道题的题眼是“${keyword}”。它决定文章必须回应的核心关系。`,
        tip: `不要只写“有影响”或“有好处”，要正面回应“${keyword}”。`
      },
      {
        kind: "multi",
        context,
        prompt: "这篇文章需要先定义哪些内容？",
        options: definitionChoices.options,
        correct: definitionChoices.correct,
        explanation: "首段要先定义核心对象、判断标准和限定范围。作者生平和文章字数不属于论证内容。",
        tip: "定义三样东西：讨论谁、判断什么、范围到哪里。"
      },
      {
        kind: "text",
        context,
        prompt: "请为核心对象、判断标准和限定范围各写一句定义。",
        minChars: 25,
        sample: `这里的“${item.focus}”不只是……，还包括……；判断标准“${keyword}”指的是……；讨论范围是“${scope}”。`,
        explanation: "定义句应该能直接放进首段，帮助读者明确文章讨论的范围。",
        tip: "可以写：这里的____不只是____，还包括____。"
      },
      {
        kind: "choice",
        prompt: "你更接近哪一种立场？",
        options: ["同意", "不同意", "有条件同意"],
        correct: 0,
        acceptAny: true,
        explanation: "三种立场都可以。关键是后面必须用两个 point 和例子支撑。",
        tip: "有条件同意最容易写出深度，因为它允许你回应题目的绝对词。"
      },
      {
        kind: "text",
        context,
        prompt: "写出你的立场和一句理由。",
        minChars: 25,
        sample: "我部分同意这个观点，因为……，但这并不意味着……",
        explanation: "完整观点 = 判断 + 原因 + 结果。",
        tip: "先亮判断，再补原因，最后说明结论的适用条件。"
      },
      {
        kind: "text",
        context,
        prompt: "写出两个分论点，用一组并列句表达。",
        minChars: 30,
        sample: "一方面，……；另一方面，……。",
        explanation: "两个 point 要围绕同一个中心论点展开，语法形式尽量相近。",
        tip: "并列句常用：既能……也能……；不仅……而且……；一方面……另一方面……"
      },
      {
        kind: "text",
        context,
        prompt: "写一个例子，并用两句 Explain 说明它如何支持你的 point。",
        minChars: 40,
        sample: "例如，……。这个例子说明……；因为……；因此……",
        explanation: "例子之后必须说明“证明什么”和“为什么能证明”。",
        tip: "不要让例子孤零零地站着。例子后面至少写两句解释。"
      },
      {
        kind: "text",
        context,
        prompt: "写出你的提纲：首段、中间段一、中间段二、结尾。",
        minChars: 50,
        sample: "首段：背景 + 有人认为 + 我的立场 + 两个 point。中间段：反方 + 驳论 + 例子 + Explain + Link。结尾：总结 + 点题 + 升华。",
        explanation: "提纲必须能看到完整的文章结构。",
        tip: "每一段都问自己：这一段的任务是什么？"
      },
      {
        kind: "text",
        context,
        prompt: "现在把提纲写成一整篇文章，目标 350–500 字。",
        minChars: 350,
        sample: "首段交代背景并亮出立场，中间两段分别用反方观点、例子和 Explain 展开，结尾总结、点题并升华。",
        explanation: "完整文章要包含首段、两到三个主体段和结尾，不能只列提纲。",
        tip: "写完先看字数，再看有没有反方、例子、Explain 和结尾回扣。"
      }
    ];
  } else if (trackId === "description") {
    steps = [
      {
        kind: "choice",
        context,
        prompt: "这道题主要描写哪一类对象？",
        options: ["人物", "景物", "物品", "场景"],
        correct: 0,
        acceptAny: true,
        explanation: "先判断对象，再决定观察顺序和感官重点。",
        tip: "写景用空间或时间顺序，写人物用外貌、语言、动作和心理。"
      },
      {
        kind: "multi",
        context,
        prompt: "你准备使用哪些感官细节？选择两到三种即可。",
        options: ["视觉", "听觉", "嗅觉", "触觉", "内心感受"],
        correct: [0, 1, 2],
        acceptAny: true,
        explanation: "描写文不需要五个感官全写，重点是把两三种写细。",
        tip: "每个细节都要和整体氛围有关。"
      },
      {
        kind: "text",
        context,
        prompt: "写一句整体描写，再写一句细节刻画。",
        minChars: 30,
        sample: "整体：远处的山影在雾里若隐若现。细节：草叶上的水珠被风一吹，滚落进泥土里。",
        explanation: "整体描写先给画面，细节刻画再让读者靠近。",
        tip: "顺序：整体到局部，远到近，静到动。"
      },
      {
        kind: "text",
        context,
        prompt: "写出你准备采用的时间顺序或空间顺序。",
        minChars: 20,
        sample: "先写天空的颜色变化，再写远处海面，最后写脚下的沙滩和浪花。",
        explanation: "顺序清楚，描写才不会跳跃。",
        tip: "写完后检查：有没有从远处突然跳到脚下，又跳回远处？"
      },
      {
        kind: "text",
        context,
        prompt: "写一个借景抒情的结尾，把景物和感受连起来。",
        minChars: 30,
        sample: "浪花一次次被推回海里，又一次次涌上来，让我明白成长也是一次次重来。",
        explanation: "结尾要把景物特征和人生感受连接起来。",
        tip: "句式：景物……像……，让我明白……"
      },
      {
        kind: "text",
        context,
        prompt: "现在把前面的观察和感受写成一篇完整描写文，目标 350–500 字。",
        minChars: 350,
        sample: "开头交代观察对象和环境，中间按时间或空间顺序展开两到三个细节层，结尾借景抒情。",
        explanation: "描写文以描写为主，叙事只作为辅助，不能写成流水账。",
        tip: "写完检查：五感是否具体、顺序是否清楚、结尾是否落到感受。"
      }
    ];
  } else if (trackId === "narrative") {
    steps = [
      {
        kind: "text",
        context,
        prompt: "写出这个故事的时间、地点、人物和起因。",
        minChars: 25,
        sample: "去年冬天的一个清晨，我在学校门口等车时，看见一位老人突然摔倒在路边。",
        explanation: "六要素齐全，故事才不会松散。",
        tip: "开头一到两句交代背景，不要铺太长。"
      },
      {
        kind: "order",
        prompt: "按记叙文结构排列。",
        items: ["起因", "经过", "冲突或高潮", "结果", "结尾点题与升华"],
        correct: [0, 1, 2, 3, 4],
        sample: "起因 → 经过 → 冲突或高潮 → 结果 → 结尾点题。",
        explanation: "事件要有清楚的时间线，冲突和转折放在高潮。",
        tip: "只保留和主题有关的动作和选择。"
      },
      {
        kind: "text",
        context,
        prompt: "写一个冲突或转折，说明人物原本想怎么做，后来为什么改变。",
        minChars: 25,
        sample: "我原本想装作没看见，但当老人扶着栏杆站不起来时，我决定上前帮忙。",
        explanation: "转折来自人物作出的关键选择。",
        tip: "句式：原本……，但是……，于是我决定……"
      },
      {
        kind: "text",
        context,
        prompt: "用动作和心理描写写出人物在关键一刻的状态。",
        minChars: 25,
        sample: "我紧紧攥着伞柄，掌心全是汗，心里既担心迟到，又觉得不能转身离开。",
        explanation: "动作和心理配合，人物才会立体。",
        tip: "不要只写“很紧张”，写手、眼睛、呼吸和脚步。"
      },
      {
        kind: "text",
        context,
        prompt: "写一个结尾，先交代结果，再点题升华。",
        minChars: 30,
        sample: "那天我没有赢得比赛，却第一次没有中途放弃。原来成长不一定是赢，而是愿意再试一次。",
        explanation: "结尾要写出人物发生了什么变化。",
        tip: "不要重复情节，写“我明白了什么”。"
      },
      {
        kind: "text",
        context,
        prompt: "现在把事件写成一篇完整记叙文，目标 350–500 字。",
        minChars: 350,
        sample: "开头交代六要素，中间推进事件并突出冲突和转折，结尾交代结果并点题升华。",
        explanation: "记叙文要围绕一个中心事件，重点写关键选择和人物变化。",
        tip: "写完检查：六要素是否齐全、高潮是否有转折、结尾是否写“我明白了什么”。"
      }
    ];
  } else {
    steps = [
      {
        kind: "text",
        context,
        prompt: "这道题要求你分析什么？请写出分析对象和核心问题。",
        minChars: 15,
        sample: "这道题要求我分析……，核心问题是……。",
        explanation: "先确定分析对象，再决定用哪一处原文证据。",
        tip: "文学赏析题通常要求分析人物、主题、语言手法或结构作用。"
      },
      {
        kind: "text",
        context,
        prompt: "选一处最能支持你观点的原文证据，并说明它出现在什么情境。",
        minChars: 20,
        sample: "选文中写到……，这一细节出现在……的情境中。",
        explanation: "证据必须直接支持你的 point，不能只是复述情节。",
        tip: "引文只取关键半句，后面至少写两句 Explain。"
      },
      {
        kind: "text",
        context,
        prompt: "写一段 Explain，解释作者怎么写、为什么这样写、产生了什么效果。",
        minChars: 35,
        sample: "这个细节说明……；因为作者用……的方式写出……，所以读者能够看到……。",
        explanation: "Explain 要连接文本、人物和主题，不能只重复原文。",
        tip: "句式：这个细节说明……；因为……；因此……"
      },
      {
        kind: "text",
        context,
        prompt: "写出你的段落结构和结论，说明如何回扣题目与整部作品。",
        minChars: 30,
        sample: "第一段写 point 和原文证据，第二段写 Explain，结尾回扣……。",
        explanation: "结尾要回到题目和作品主题，而不是只总结情节。",
        tip: "每段都要有 point、evidence、explain、link。"
      }
    ];
  }

  return {
    id: `practice-${trackId}-${index}`,
    title: `选题练习：${item.focus}`,
    skill: "综合训练",
    icon: "play",
    summary: context,
    purpose:
      trackId === "argument"
        ? `训练这篇文章需要定义哪些关键词，以及如何把定义带进首段、立场和论证。以“${context}”为例，先把核心概念解释清楚，再展开两个分论点。`
        : trackId === "description"
          ? "训练描写文的观察对象、五感细节、描写顺序和借景抒情。"
          : trackId === "narrative"
            ? "训练记叙文的六要素、事件推进、冲突转折和结尾升华。"
            : "训练文学赏析的审题、原文证据、Explain 和段落结构。",
    steps
  };
}

function renderPractice(trackId, index) {
  const track = getTrack(trackId);
  const level = makePracticeLevel(trackId, Number(index));
  if (!track || !level) return renderHome();
  const samePractice = session.practiceMode && session.trackId === track.id && session.levelId === level.id;
  if (!samePractice) {
    session = {
      ...freshSession(),
      trackId: track.id,
      levelId: level.id,
      practiceMode: true,
      practiceLevel: level,
      stepAnswers: [],
      practicePrompt: level.summary,
      practiceKey: questionKey(trackId, Number(index))
    };
  }
  renderLevelView(track, level);
}

function renderComplete(submissionId) {
  const submission = state.submissions.find((item) => item.id === submissionId);
  if (!submission) return renderHome();

  app.innerHTML = `
    <section class="complete-view">
      <canvas id="confettiCanvas" class="confetti-canvas" aria-hidden="true"></canvas>
      <div class="complete-card">
        <div class="complete-icon">${icon("party-popper", 52)}</div>
        <h1>Congratulations</h1>
        <p class="complete-lead">不错哦！现在你完成了</p>
        <p class="complete-question">“${escapeHtml(submission.question)}”</p>
        <p class="complete-lead">继续练习下一道题吧！</p>
        <div class="task-actions">
          <button class="button primary" data-route="${`#/track/${submission.trackId}`}">${icon("play")} 再练一道</button>
          <button class="button" data-route="#/progress">${icon("clipboard-list")} 查看我的提交</button>
          <button class="button ghost" data-route="#/home">${icon("home")} 回到首页</button>
        </div>
      </div>
    </section>
  `;
  window.requestAnimationFrame(startConfetti);
}

function startConfetti() {
  const canvas = document.querySelector("#confettiCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.scale(dpr, dpr);

  const colors = ["#0f766e", "#b45309", "#b43b2f", "#0e7490", "#6d28d9", "#d97706"];
  const particles = Array.from({ length: 130 }, () => ({
    x: Math.random() * width,
    y: -30 - Math.random() * height * 0.5,
    w: 7 + Math.random() * 6,
    h: 9 + Math.random() * 8,
    vx: -1.2 + Math.random() * 2.4,
    vy: 2 + Math.random() * 3.5,
    rotation: Math.random() * Math.PI,
    rotationSpeed: -0.12 + Math.random() * 0.24,
    color: colors[Math.floor(Math.random() * colors.length)]
  }));

  const startedAt = performance.now();
  function frame(now) {
    ctx.clearRect(0, 0, width, height);
    particles.forEach((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.rotation += particle.rotationSpeed;
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.fillStyle = particle.color;
      ctx.fillRect(-particle.w / 2, -particle.h / 2, particle.w, particle.h);
      ctx.restore();
    });
    if (now - startedAt < 5200) {
      window.requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, width, height);
      canvas.remove();
    }
  }
  window.requestAnimationFrame(frame);
}

function stepKindLabel(kind) {
  return {
    choice: "单项判断",
    multi: "多项判断",
    text: "写出你的答案",
    order: "排序与组装"
  }[kind] ?? "训练任务";
}

function renderStepInput(step) {
  if (step.kind === "choice") {
    return `
      <div class="option-list">
        ${step.options
          .map(
            (option, index) => `
              <button class="option-button ${session.selected === index ? "selected" : ""}" data-action="choose-option" data-index="${index}">
                <span class="option-index">${String.fromCharCode(65 + index)}</span>
                <span>${escapeHtml(option)}</span>
              </button>
            `
          )
          .join("")}
      </div>
    `;
  }
  if (step.kind === "multi") {
    return `
      <div class="option-list">
        ${step.options
          .map(
            (option, index) => `
              <button class="option-button ${session.selectedMulti.includes(index) ? "selected" : ""}" data-action="toggle-multi" data-index="${index}">
                <span class="option-index">${session.selectedMulti.includes(index) ? "✓" : "+"}</span>
                <span>${escapeHtml(option)}</span>
              </button>
            `
          )
          .join("")}
      </div>
    `;
  }
  if (step.kind === "text") {
    return `
      <textarea class="answer-area" data-action="update-text" placeholder="${escapeHtml(step.placeholder ?? "在这里写下你的答案……")}">${escapeHtml(session.text)}</textarea>
      <p class="muted">至少写 ${step.minChars} 个字。系统会检查关键词，但不会替你写答案。</p>
    `;
  }
  if (step.kind === "order") {
    const selected = session.orderSeq;
    return `
      <div class="order-area">
        <div class="order-column">
          <h3>待选句子</h3>
          ${step.items
            .map(
              (item, index) =>
                selected.includes(index)
                  ? ""
                  : `<button class="order-item" data-action="add-order" data-index="${index}">${escapeHtml(item)}</button>`
            )
            .join("")}
        </div>
        <div class="order-column">
          <h3>你的顺序</h3>
          ${
            selected.length
              ? selected
                  .map(
                    (index, position) =>
                      `<button class="order-item" data-action="remove-order" data-position="${position}">${position + 1}. ${escapeHtml(step.items[index])}</button>`
                  )
                  .join("")
              : `<p class="muted">点击左侧句子，按正确顺序加入。</p>`
          }
        </div>
      </div>
    `;
  }
  return "";
}

function renderLanguageTip(step, track) {
  const category = track.id === "argument" ? "议论文" : track.id === "description" ? "描写文" : "记叙文";
  const related = LANGUAGE_LIBRARY.filter((item) => item.category === category).slice(0, 2);
  return `
    <div class="language-tip">
      <strong>${icon("lightbulb")} 语言提示</strong>
      <p>${escapeHtml(step.tip)}</p>
      ${related.map((item) => `<p><strong>${escapeHtml(item.type)}：</strong>${escapeHtml(item.upgraded)}</p>`).join("")}
    </div>
  `;
}

function renderFeedback(step) {
  const result = session.passed;
  const title = result ? "这一步通过了" : "这一步还需要调整";
  return `
    <div class="feedback ${result ? "" : "wrong"}">
      <h3>${title}</h3>
      <p>${escapeHtml(step.explanation)}</p>
      ${
        step.sample
          ? `<p><strong>参考表达：</strong>${escapeHtml(step.sample)}</p>`
          : ""
      }
      <p><strong>语言提示：</strong>${escapeHtml(step.tip)}</p>
    </div>
  `;
}

function evaluateStep(step) {
  if (step.acceptAny) {
    if (step.kind === "choice") return session.selected !== null;
    if (step.kind === "multi") return session.selectedMulti.length > 0;
    if (step.kind === "text") return session.text.trim().length >= (step.minChars ?? 1);
    if (step.kind === "order") return session.orderSeq.length === step.items.length;
  }
  if (step.kind === "choice") {
    return session.selected === step.correct;
  }
  if (step.kind === "multi") {
    const a = [...session.selectedMulti].sort((x, y) => x - y).join(",");
    const b = [...step.correct].sort((x, y) => x - y).join(",");
    return a === b;
  }
  if (step.kind === "order") {
    return session.orderSeq.join(",") === step.correct.join(",");
  }
  if (step.kind === "text") {
    const text = session.text.trim();
    if (text.length < step.minChars) return false;
    return (step.keywords ?? []).every((keyword) => text.includes(keyword));
  }
  return false;
}

function currentLevel() {
  return session.practiceMode && session.practiceLevel
    ? session.practiceLevel
    : getLevel(session.trackId, session.levelId);
}

function stepAnswerText(step) {
  if (step.kind === "choice") {
    return step.options[session.selected] ?? "";
  }
  if (step.kind === "multi") {
    return session.selectedMulti.map((index) => step.options[index]).join("；");
  }
  if (step.kind === "order") {
    return session.orderSeq.map((index) => step.items[index]).join("，");
  }
  return session.text.trim();
}

function checkStep() {
  const track = getTrack(session.trackId);
  const level = currentLevel();
  const step = level?.steps[session.stepIndex];
  if (!track || !level || !step) return;

  session.passed = evaluateStep(step);
  session.checked = true;

  if (session.practiceMode) {
    session.stepAnswers[session.stepIndex] = {
      prompt: step.prompt,
      answer: stepAnswerText(step)
    };
  }

  if (!session.passed) {
    recordMistake(track, level, step);
  }

  render();
}

function nextStep() {
  const track = getTrack(session.trackId);
  const level = currentLevel();
  if (!track || !level) return;

  if (session.stepIndex < level.steps.length - 1) {
    session.stepIndex += 1;
    resetStepState();
    render();
    return;
  }

  completeLevel(track, level);
}

function resetStepState() {
  session.selected = null;
  session.selectedMulti = [];
  session.text = "";
  session.orderSeq = [];
  session.checked = false;
  session.passed = null;
  session.showTip = false;
}

function completeLevel(track, level) {
  if (session.practiceMode) {
    if (session.practiceKey && !completedQuestions(track.id).includes(session.practiceKey)) {
      state.completedQuestions[track.id] = [...completedQuestions(track.id), session.practiceKey];
    }
    const submission = {
      id: `${Date.now()}-${session.practiceKey ?? "practice"}`,
      trackId: track.id,
      trackName: track.name,
      question: session.practicePrompt ?? level.summary,
      levelTitle: level.title,
      date: new Date().toLocaleString("zh-CN", { hour12: false }),
      answers: (session.stepAnswers ?? []).filter(Boolean)
    };
    state.submissions.unshift(submission);
    state.submissions = state.submissions.slice(0, 30);
    state.xp += 25;
    state.history.unshift({
      date: new Date().toLocaleString("zh-CN", { hour12: false }),
      text: `完成选题练习：${session.practicePrompt?.slice(0, 30) ?? level.title}`,
      xp: 25
    });
    state.history = state.history.slice(0, 30);
    touchStreak();
    saveState();
    toast("练习完成，获得 25 XP");
    navigate(`#/complete/${submission.id}`);
    return;
  }
  const alreadyDone = isLevelCompleted(track.id, level.id);
  if (!alreadyDone) {
    state.completed[track.id] = [...completedLevels(track.id), level.id];
    state.xp += session.passed ? 20 : 10;
    state.history.unshift({
      date: new Date().toLocaleString("zh-CN", { hour12: false }),
      text: `完成 ${track.name} · ${level.title}`,
      xp: session.passed ? 20 : 10
    });
    state.history = state.history.slice(0, 30);
    touchStreak();
    saveState();
    toast(`完成 ${level.title}，获得 ${session.passed ? 20 : 10} XP`);
  } else {
    toast(`又练了一遍 ${level.title}`);
  }
  navigate(`#/track/${track.id}`);
}

function recordMistake(track, level, step) {
  const key = `${track.id}-${level.id}-${session.stepIndex}`;
  if (state.mistakes.some((item) => item.key === key)) return;
  state.mistakes.unshift({
    key,
    trackId: track.id,
    trackName: track.name,
    levelId: level.id,
    levelTitle: level.title,
    stepIndex: session.stepIndex,
    prompt: step.prompt
  });
  state.mistakes = state.mistakes.slice(0, 50);
  saveState();
}

function renderLanguage() {
  const trackCategories = ["全部", ...new Set(LANGUAGE_LIBRARY.map((item) => item.track))];
  const query = session.languageQuery ?? "";
  const track = session.languageTrack ?? "全部";
  const availableQuestionTypes = [
    "全部",
    ...new Set(
      LANGUAGE_LIBRARY.filter((item) => track === "全部" || item.track === track).map((item) => item.questionType)
    )
  ];
  const questionType = availableQuestionTypes.includes(session.languageQuestionType)
    ? session.languageQuestionType
    : "全部";
  const items = getFilteredLanguageItems(query, track, questionType);

  app.innerHTML = `
    <section class="page-header">
      <div class="page-title">
        <button class="inline-link" data-route="#/home">← 返回训练大厅</button>
        <h1>语言升级库</h1>
        <p>按文体、题型和功能分类。学生作业中的好句式会收进这里，并标注来源题目和学生作品。</p>
      </div>
    </section>
    <div class="purpose-band">
      <strong>${icon("inbox")} 收集规则</strong>
      <p>批改作业时，我会从学生原句中提取可复用的表达，补上“普通表达、升级表达、适用题型和来源”。</p>
    </div>
    <div class="toolbar">
      <input type="search" id="languageSearch" data-action="language-search" placeholder="搜索句式、关键词或类别……" value="${escapeHtml(query)}" />
      ${icon("search")}
    </div>
    <div class="filter-row">
      ${trackCategories.map((item) => `<button class="filter-chip ${item === track ? "active" : ""}" data-action="language-track" data-track="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join("")}
    </div>
    <div class="filter-row">
      ${availableQuestionTypes.map((item) => `<button class="filter-chip ${item === questionType ? "active" : ""}" data-action="language-question-type" data-question-type="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join("")}
    </div>
    <section class="language-grid" id="languageGrid">
      ${renderLanguageCardsHtml(items)}
    </section>
  `;
}

function getFilteredLanguageItems(query = "", track = "全部", questionType = "全部") {
  return LANGUAGE_LIBRARY.filter((item) => {
    const trackMatch = track === "全部" || item.track === track;
    const typeMatch = questionType === "全部" || item.questionType === questionType;
    const text = `${item.track} ${item.questionType} ${item.type} ${item.plain} ${item.upgraded} ${item.note} ${item.source ?? ""}`;
    return trackMatch && typeMatch && text.toLowerCase().includes(query.toLowerCase());
  });
}

function renderLanguageCardsHtml(items) {
  return items.map(renderLanguageCard).join("") || `<div class="empty-state">没有找到匹配的语言卡。</div>`;
}

function renderLanguageCard(item) {
  const saved = state.savedLanguage.includes(item.upgraded);
  return `
    <article class="language-card">
      <div class="card-top">
        <h3>${escapeHtml(item.type)}</h3>
        <span class="chip">${escapeHtml(item.questionType)}</span>
      </div>
      <p class="muted">${escapeHtml(item.track)} · ${escapeHtml(item.questionType)}</p>
      <p class="plain">${escapeHtml(item.plain)}</p>
      <p class="upgraded">${escapeHtml(item.upgraded)}</p>
      <p class="note">${escapeHtml(item.note)}</p>
      ${item.source ? `<p class="muted">来源：${escapeHtml(item.source)}</p>` : ""}
      <div class="task-actions">
        <button class="button ghost" data-action="save-language" data-value="${escapeHtml(item.upgraded)}">${icon(saved ? "bookmark-check" : "bookmark")} ${saved ? "已收藏" : "收藏"}</button>
      </div>
    </article>
  `;
}

function renderProgress() {
  const skills = new Map();
  for (const track of TRACKS) {
    for (const level of track.levels) {
      if (!isLevelCompleted(track.id, level.id)) continue;
      skills.set(level.skill, (skills.get(level.skill) ?? 0) + 1);
    }
  }
  const maxSkill = Math.max(1, ...skills.values());

  app.innerHTML = `
    <section class="page-header">
      <div class="page-title">
        <button class="inline-link" data-route="#/home">← 返回训练大厅</button>
        <h1>我的进度</h1>
        <p>这里记录的是个人练习进度，不做班级排名。每条路线单独计算，能力雷达合并计算。</p>
      </div>
      <button class="button danger" data-action="reset-progress">${icon("refresh-ccw")} ${session.confirmReset ? "再次点击确认清空" : "重置练习数据"}</button>
    </section>
    <section class="progress-layout">
      <div class="panel">
        <h2>路线进度</h2>
        ${TRACKS.map((track) => {
          const skillCount = completedLevels(track.id).length;
          const questionCount = completedQuestions(track.id).length;
          const totalQuestions = PRACTICE_BANK[track.id]?.length ?? 0;
          const skillPercent = Math.round((skillCount / track.levels.length) * 100);
          const questionPercent = Math.round((questionCount / Math.max(1, totalQuestions)) * 100);
          return `
            <div class="progress-row">
              <span>${escapeHtml(track.short)} · 题目</span>
              <div class="progress-bar"><span style="width:${questionPercent}%;background:${track.accent}"></span></div>
              <strong>${questionCount}/${totalQuestions}</strong>
            </div>
            <div class="progress-row">
              <span>${escapeHtml(track.short)} · 技能</span>
              <div class="progress-bar"><span style="width:${skillPercent}%;background:${track.accent}"></span></div>
              <strong>${skillCount}/${track.levels.length}</strong>
            </div>
          `;
        }).join("")}
        <h2 style="margin-top:24px">能力雷达</h2>
        ${
          skills.size
            ? [...skills.entries()]
                .map(
                  ([skill, value]) => `
                    <div class="skill-row">
                      <div class="skill-label"><span>${escapeHtml(skill)}</span><span>${value} 关</span></div>
                      <div class="progress-bar"><span style="width:${Math.round((value / maxSkill) * 100)}%"></span></div>
                    </div>
                  `
                )
                .join("")
            : `<p class="muted">完成第一关后，这里会出现你的能力雷达。</p>`
        }
      </div>
      <div class="panel">
        <h2>最近记录</h2>
        ${
          state.history.length
            ? state.history.slice(0, 10).map((item) => `<div class="mistake-item"><div><strong>${escapeHtml(item.text)}</strong><p>${escapeHtml(item.date)}</p></div><span class="chip">+${item.xp} XP</span></div>`).join("")
            : `<p class="muted">还没有完成记录。先去做第一关。</p>`
        }
      </div>
    </section>
    <section class="section">
      <div class="panel">
        <h2>我的提交</h2>
        <p class="muted">每完成一道题，你的作答都会保存在这里。可以展开查看、复制或截图发给老师批改。</p>
        ${
          state.submissions.length
            ? `<div class="submission-list">${state.submissions.map(renderSubmissionCard).join("")}</div>`
            : `<div class="empty-state">还没有提交记录。完成一道题库练习后，这里会自动保存你的作答。</div>`
        }
      </div>
    </section>
  `;
}

function renderSubmissionCard(submission) {
  const answerText = submission.answers
    .map((item, index) => `${index + 1}. ${item.prompt}\n答：${item.answer || "未填写"}`)
    .join("\n\n");
  return `
    <article class="submission-card">
      <div class="submission-head">
        <div>
          <span class="chip">${escapeHtml(submission.trackName)}</span>
          <strong>${escapeHtml(submission.question)}</strong>
          <p class="muted">${escapeHtml(submission.date)} · ${submission.answers.length} 个作答步骤</p>
        </div>
        <div class="task-actions">
          <button class="button" data-action="copy-submission" data-id="${submission.id}">${icon("copy")} 复制全部</button>
          <button class="button ghost" data-action="print-submission" data-id="${submission.id}">${icon("printer")} 打印</button>
        </div>
      </div>
      <details class="submission-details">
        <summary>展开查看我的作答</summary>
        <pre>${escapeHtml(answerText)}</pre>
      </details>
    </article>
  `;
}

function buildSubmissionText(id) {
  const submission = state.submissions.find((item) => item.id === id);
  if (!submission) return "";
  const answers = submission.answers
    .map((item, index) => `${index + 1}. ${item.prompt}\n答：${item.answer || "未填写"}`)
    .join("\n\n");
  return `训练类型：${submission.trackName}\n题目：${submission.question}\n完成时间：${submission.date}\n\n${answers}`;
}

function copySubmission(id) {
  const text = buildSubmissionText(id);
  if (!text) return;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => toast("提交内容已复制")).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
  toast("提交内容已复制");
}

function printSubmission(id) {
  const text = buildSubmissionText(id);
  if (!text) return;
  const printWindow = window.open("", "_blank", "width=760,height=900");
  if (!printWindow) {
    toast("浏览器阻止了新窗口。请复制内容后自行打印。");
    return;
  }
  printWindow.document.write(`<meta charset="utf-8"><title>我的提交</title><pre style="white-space:pre-wrap;font-family:system-ui;padding:24px;line-height:1.7">${escapeHtml(text)}</pre>`);
  printWindow.document.close();
  printWindow.print();
}

function renderErrors() {
  app.innerHTML = `
    <section class="page-header">
      <div class="page-title">
        <button class="inline-link" data-route="#/home">← 返回训练大厅</button>
        <h1>错题回炉</h1>
        <p>这里只收集你做错的思维动作。重练同一关时，系统会重新检查这一步。</p>
      </div>
      ${state.mistakes.length ? `<button class="button danger" data-action="clear-errors">${icon("trash-2")} 清空错题</button>` : ""}
    </section>
    <section class="mistake-list">
      ${
        state.mistakes.length
          ? state.mistakes
              .map(
                (item) => `
                  <article class="mistake-item">
                    <div>
                      <strong>${escapeHtml(item.trackName)} · ${escapeHtml(item.levelTitle)}</strong>
                      <p>${escapeHtml(item.prompt.replace(/\n/g, " ").slice(0, 90))}……</p>
                    </div>
                    <button class="button primary" data-action="retry-mistake" data-track="${item.trackId}" data-level="${item.levelId}">${icon("rotate-ccw")} 重练</button>
                  </article>
                `
              )
              .join("")
          : `<div class="empty-state">目前没有错题。继续做训练，系统会自动把做错的动作收进这里。</div>`
      }
    </section>
  `;
}

function renderBank(trackId = "argument") {
  const activeTrack = getTrack(trackId) ? trackId : "argument";
  session.trackView = "questions";
  renderTrack(activeTrack);
}

function renderBoss() {
  const isOutline = session.bossMode !== "full";
  const essayLength = countWritingCharacters(session.bossEssay);
  app.innerHTML = `
    <section class="page-header">
      <div class="page-title">
        <button class="inline-link" data-route="#/home">← 返回训练大厅</button>
        <h1>真题 Boss</h1>
        <p>先选练习模式。提纲模式 20 分钟，只写框架；全文模式 60 分钟，完成一篇 350–500 字的文章。</p>
      </div>
    </section>
    <section class="boss-layout">
      <div class="panel">
        <p class="eyebrow">计时器</p>
        <div class="filter-row">
          <button class="filter-chip ${isOutline ? "active" : ""}" data-action="boss-mode" data-mode="outline">提纲模式 · 20 分钟</button>
          <button class="filter-chip ${!isOutline ? "active" : ""}" data-action="boss-mode" data-mode="full">全文模式 · 60 分钟</button>
        </div>
        <div class="timer-display" id="bossTimer">${formatSeconds(bossSeconds)}</div>
        <div class="toolbar">
          <button class="button primary" data-action="boss-start">${icon("play")} 开始</button>
          <button class="button" data-action="boss-pause">${icon("pause")} 暂停</button>
          <button class="button ghost" data-action="boss-reset">${icon("rotate-ccw")} 重置</button>
        </div>
        <h2 style="margin-top:24px">选择真题</h2>
        <select id="bossPrompt" class="answer-area" style="min-height:auto">
          ${BOSS_PROMPTS.map((prompt) => `<option ${prompt === session.bossPrompt ? "selected" : ""}>${escapeHtml(prompt)}</option>`).join("")}
        </select>
        <div class="check-list">
          ${["首段有背景、有人认为和我的立场", "两个 point 写成并列句", "中间段有例子和 Explain", "结尾有总结、点题和升华", "全文目标 350–500 字"].map((text, index) => `<label><input type="checkbox" data-action="boss-check" data-index="${index}" ${session.bossChecks[index] ? "checked" : ""}/><span>${escapeHtml(text)}</span></label>`).join("")}
        </div>
      </div>
      <div class="panel">
        <p class="eyebrow">${isOutline ? "提纲区" : "全文写作区"}</p>
        ${
          isOutline
            ? `<div class="outline-fields">
                ${["首段：背景 + 有人认为 + 我的立场 + 两个 point", "中间段一：悖论 + 驳论 + Evidence + Explain + Link", "中间段二：悖论 + 驳论 + Evidence + Explain + Link", "结尾：总结 + 点题 + 升华"].map((label, index) => `<label>${escapeHtml(label)}<textarea data-action="boss-field" data-index="${index}" placeholder="写提纲，不必写完整段落……">${escapeHtml(session.bossFields[index] ?? "")}</textarea></label>`).join("")}
              </div>`
            : `<textarea class="answer-area essay-area" data-action="boss-essay" placeholder="从这里开始写全文……">${escapeHtml(session.bossEssay)}</textarea>
               <p class="muted">当前字数：<strong id="essayCount">${essayLength}</strong> / 目标 350–500 字</p>`
        }
        <div class="task-actions">
          <button class="button warm" data-action="boss-submit">${icon("send")} ${isOutline ? "提交提纲" : "提交全文"}</button>
        </div>
      </div>
    </section>
  `;
}

function countWritingCharacters(value = "") {
  return Array.from(value.replace(/\s/g, "")).length;
}

function formatSeconds(value) {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function startBossTimer() {
  if (bossTimerId) return;
  bossTimerId = window.setInterval(() => {
    bossSeconds = Math.max(0, bossSeconds - 1);
    const timer = document.querySelector("#bossTimer");
    if (timer) timer.textContent = formatSeconds(bossSeconds);
    if (bossSeconds === 0) {
      window.clearInterval(bossTimerId);
      bossTimerId = null;
      toast("时间到。先检查提纲，再决定是否继续修改。");
    }
  }, 1000);
}

function pauseBossTimer() {
  window.clearInterval(bossTimerId);
  bossTimerId = null;
}

function submitBoss() {
  const isOutline = session.bossMode !== "full";
  if (isOutline) {
    const filled = session.bossFields.filter((field) => field.trim().length > 5).length;
    if (filled < 3) {
      toast("至少把三个提纲区写出来，再提交。");
      return;
    }
  } else {
    const essayLength = countWritingCharacters(session.bossEssay);
    if (essayLength < 350) {
      toast(`全文还差 ${350 - essayLength} 字，先写到 350 字再提交。`);
      return;
    }
  }
  const xp = isOutline ? 30 : 60;
  state.xp += xp;
  state.history.unshift({
    date: new Date().toLocaleString("zh-CN", { hour12: false }),
    text: `真题 Boss ${isOutline ? "提纲" : "全文"}：${session.bossPrompt.slice(0, 28)}……`,
    xp
  });
  state.history = state.history.slice(0, 30);
  touchStreak();
  saveState();
  toast(`${isOutline ? "提纲" : "全文"}已提交，获得 ${xp} XP。`);
}

function clearErrors() {
  state.mistakes = [];
  saveState();
  render();
}

function toggleLanguage(value) {
  const saved = new Set(state.savedLanguage);
  if (saved.has(value)) saved.delete(value);
  else saved.add(value);
  state.savedLanguage = [...saved];
  saveState();
  render();
}

document.addEventListener("click", (event) => {
  const routeTarget = event.target.closest("[data-route]");
  if (routeTarget) {
    navigate(routeTarget.dataset.route);
    return;
  }

  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;

  if (action === "open-level") {
    session.trackView = "map";
    navigate(`#/level/${target.dataset.track}/${target.dataset.level}`);
  } else if (action === "set-track-view") {
    session.trackView = target.dataset.view;
    render();
  } else if (action === "bank-track") {
    session.trackView = "questions";
    navigate(`#/track/${target.dataset.track}`);
  } else if (action === "start-practice") {
    navigate(`#/practice/${target.dataset.track}/${target.dataset.index}`);
  } else if (action === "use-bank-item") {
    const item = PRACTICE_BANK[target.dataset.track]?.[Number(target.dataset.index)];
    if (item) {
      session.bossPrompt = item.text;
      navigate("#/boss");
    }
  } else if (action === "random-bank") {
    const items = PRACTICE_BANK[target.dataset.track] ?? [];
    if (items.length) {
      session.bossPrompt = items[Math.floor(Math.random() * items.length)].text;
      navigate("#/boss");
    }
  } else if (action === "choose-option") {
    if (session.checked) return;
    session.selected = Number(target.dataset.index);
    render();
  } else if (action === "toggle-multi") {
    if (session.checked) return;
    const index = Number(target.dataset.index);
    session.selectedMulti = session.selectedMulti.includes(index)
      ? session.selectedMulti.filter((item) => item !== index)
      : [...session.selectedMulti, index];
    render();
  } else if (action === "add-order") {
    if (session.checked) return;
    session.orderSeq = [...session.orderSeq, Number(target.dataset.index)];
    render();
  } else if (action === "remove-order") {
    if (session.checked) return;
    session.orderSeq = session.orderSeq.filter((_, index) => index !== Number(target.dataset.position));
    render();
  } else if (action === "toggle-tip") {
    session.showTip = !session.showTip;
    render();
  } else if (action === "check-step") {
    checkStep();
  } else if (action === "next-step") {
    nextStep();
  } else if (action === "clear-step") {
    resetStepState();
    render();
  } else if (action === "language-track") {
    session.languageTrack = target.dataset.track;
    session.languageQuestionType = "全部";
    render();
  } else if (action === "language-question-type") {
    session.languageQuestionType = target.dataset.questionType;
    render();
  } else if (action === "save-language") {
    toggleLanguage(target.dataset.value);
  } else if (action === "retry-mistake") {
    navigate(`#/level/${target.dataset.track}/${target.dataset.level}`);
  } else if (action === "clear-errors") {
    clearErrors();
  } else if (action === "copy-submission") {
    copySubmission(target.dataset.id);
  } else if (action === "print-submission") {
    printSubmission(target.dataset.id);
  } else if (action === "reset-progress") {
    if (!session.confirmReset) {
      session.confirmReset = true;
      render();
      return;
    }
    state = structuredClone(defaultState);
    saveState();
    session = freshSession();
    navigate("#/home");
    render();
  } else if (action === "boss-start") {
    startBossTimer();
  } else if (action === "boss-mode") {
    session.bossMode = target.dataset.mode;
    pauseBossTimer();
    bossSeconds = session.bossMode === "full" ? 60 * 60 : 20 * 60;
    render();
  } else if (action === "boss-pause") {
    pauseBossTimer();
  } else if (action === "boss-reset") {
    pauseBossTimer();
    bossSeconds = session.bossMode === "full" ? 60 * 60 : 20 * 60;
    const timer = document.querySelector("#bossTimer");
    if (timer) timer.textContent = formatSeconds(bossSeconds);
  } else if (action === "boss-submit") {
    submitBoss();
  }
});

document.addEventListener("input", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  if (target.dataset.action === "update-text") {
    session.text = target.value;
  } else if (target.dataset.action === "language-search") {
    session.languageQuery = target.value;
    const grid = document.querySelector("#languageGrid");
    if (grid) {
      grid.innerHTML = renderLanguageCardsHtml(
        getFilteredLanguageItems(
          session.languageQuery,
          session.languageTrack ?? "全部",
          session.languageQuestionType ?? "全部"
        )
      );
      refreshIcons();
    }
  } else if (target.dataset.action === "boss-field") {
    session.bossFields[Number(target.dataset.index)] = target.value;
  } else if (target.dataset.action === "boss-essay") {
    session.bossEssay = target.value;
    const count = document.querySelector("#essayCount");
    if (count) count.textContent = String(countWritingCharacters(session.bossEssay));
  }
});

document.addEventListener("change", (event) => {
  if (event.target.id === "bossPrompt") {
    session.bossPrompt = event.target.value;
    return;
  }
  const target = event.target.closest("[data-action]");
  if (!target) return;
  if (target.dataset.action === "boss-check") {
    session.bossChecks[Number(target.dataset.index)] = target.checked;
  }
});

projectionToggle.addEventListener("click", () => {
  state.projection = !state.projection;
  saveState();
  render();
});

window.addEventListener("hashchange", render);

render();
