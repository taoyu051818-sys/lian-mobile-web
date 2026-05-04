const state = {
  data: null,
  scene: "all",
  activeCategory: "",
  expanded: new Set(),
  compact: false,
};

const sceneRules = {
  all: {
    title: "先看几样学生容易点的",
    match: () => true,
  },
  solo: {
    title: "一个人吃，不想点太多",
    match: (item) => /一人|单人|意面|三明治|贝果|沙拉碗|饭/.test(item.name) && item.price <= 45,
  },
  share: {
    title: "两个人拼，别太零碎",
    match: (item) => /双人|套餐|披萨|整鸡|拼盘|蛋糕礼盒/.test(item.name),
  },
  tea: {
    title: "下午茶，甜品和咖啡优先",
    match: (item, category) => /甜品|咖啡|果茶|面包|贝果|软饮/.test(category.name),
  },
  light: {
    title: "想吃轻一点",
    match: (item, category) => /轻食|沙拉|三明治|荞麦|蔬菜/.test(`${category.name} ${item.name}`),
  },
  budget: {
    title: "预算友好，先看 25 元以内",
    match: (item) => item.price > 0 && item.price <= 25,
  },
};

function money(value) {
  if (Number(value) === 0) return "免费";
  return `¥${Number(value).toFixed(value % 1 ? 1 : 0)}`;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function categoryStats(category) {
  const prices = category.items.filter((item) => item.price > 0).map((item) => item.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const priceText = prices.length ? `${money(min)}-${money(max)}` : "配送/用餐选项";
  return `${category.items.length} 款 · ${priceText}`;
}

function representativeItems(category, limit = 3) {
  const paid = category.items.filter((item) => !item.soldOut && item.price > 0);
  return [...paid].sort((a, b) => {
    const aScore = scoreItem(a, category);
    const bScore = scoreItem(b, category);
    return bScore - aScore || a.price - b.price;
  }).slice(0, limit);
}

function scoreItem(item, category) {
  let score = 0;
  if (item.price <= 25 && item.price > 0) score += 3;
  if (/一人|单人|套餐|招牌|自选|沙拉|贝果|意面|披萨|咖啡/.test(item.name)) score += 4;
  if (/必选/.test(category.name)) score -= 8;
  if (/生日蛋糕|山姆/.test(category.name)) score -= 2;
  if (/榴莲|黑松露|开心果|巴斯克/.test(item.name)) score += 1;
  return score;
}

function sceneItems() {
  const rule = sceneRules[state.scene] || sceneRules.all;
  return state.data.categories
    .flatMap((category) => category.items.map((item) => ({ ...item, category })))
    .filter(({ price, soldOut }) => !soldOut && price > 0)
    .filter(({ category, ...item }) => rule.match(item, category))
    .sort((a, b) => scoreItem(b, b.category) - scoreItem(a, a.category) || a.price - b.price)
    .slice(0, 4);
}

function renderSummary() {
  const paid = state.data.categories.flatMap((category) => category.items).filter((item) => item.price > 0);
  const min = Math.min(...paid.map((item) => item.price));
  const max = Math.max(...paid.map((item) => item.price));
  document.querySelector("#menuSummary").textContent = `${state.data.categoryCount} 类 · ${state.data.itemCount} 个条目 · ${money(min)}-${money(max)}`;
}

function renderScenes() {
  document.querySelectorAll(".scene").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.scene === state.scene);
  });
  const rule = sceneRules[state.scene] || sceneRules.all;
  const items = sceneItems();
  document.querySelector("#recommendPanel").innerHTML = items.map((item) => `
    <article class="scene-card">
      <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" loading="lazy">
      <div>
        <h2>${escapeHtml(item.name)}</h2>
        <p>${escapeHtml(rule.title)} · ${escapeHtml(item.category.name)}</p>
        <div class="price">${money(item.price)}</div>
      </div>
    </article>
  `).join("");
}

function renderRail() {
  const rail = document.querySelector("#categoryRail");
  rail.innerHTML = state.data.categories.map((category) => `
    <button class="cat-pill ${category.name === state.activeCategory ? "is-active" : ""}" type="button" data-category="${escapeHtml(category.name)}">
      ${escapeHtml(category.name)}
    </button>
  `).join("");
}

function renderCategories() {
  const list = document.querySelector("#categoryList");
  const visibleCategories = state.activeCategory
    ? state.data.categories.filter((category) => category.name === state.activeCategory)
    : state.data.categories;
  list.innerHTML = visibleCategories.map((category) => {
    const isExpanded = state.expanded.has(category.name);
    const items = isExpanded ? category.items.filter((item) => item.price > 0) : representativeItems(category, 4);
    return `
      <section class="category-block">
        <button class="category-head" type="button" data-toggle-category="${escapeHtml(category.name)}">
          <div>
            <h2>${escapeHtml(category.name)}</h2>
            <p>${escapeHtml(categoryStats(category))}</p>
          </div>
          <strong>${isExpanded ? "收起" : "看全部"}</strong>
        </button>
        <div class="item-grid">
          ${items.map((item) => renderItem(item)).join("")}
        </div>
        ${!isExpanded && category.items.filter((item) => item.price > 0).length > items.length ? `
          <div class="expand-row">
            <button type="button" data-toggle-category="${escapeHtml(category.name)}">还有 ${category.items.filter((item) => item.price > 0).length - items.length} 个，展开完整菜单</button>
          </div>
        ` : ""}
      </section>
    `;
  }).join("");
}

function renderItem(item) {
  return `
    <article class="item-card">
      <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" loading="lazy">
      <div class="item-body">
        <h3>${escapeHtml(item.name)}</h3>
        <div class="item-meta">
          <span class="price">${money(item.price)}</span>
          ${item.soldOut ? `<span class="badge">售罄</span>` : `<span class="badge">可点</span>`}
        </div>
      </div>
    </article>
  `;
}

function render() {
  document.body.classList.toggle("is-compact", state.compact);
  renderSummary();
  renderScenes();
  renderRail();
  renderCategories();
}

document.addEventListener("click", (event) => {
  const scene = event.target.closest("[data-scene]");
  if (scene) {
    state.scene = scene.dataset.scene;
    render();
    return;
  }
  const category = event.target.closest("[data-category]");
  if (category) {
    state.activeCategory = state.activeCategory === category.dataset.category ? "" : category.dataset.category;
    render();
    return;
  }
  const toggle = event.target.closest("[data-toggle-category]");
  if (toggle) {
    const name = toggle.dataset.toggleCategory;
    if (state.expanded.has(name)) state.expanded.delete(name);
    else state.expanded.add(name);
    renderCategories();
  }
});

document.querySelector("#compactToggle").addEventListener("click", () => {
  state.compact = !state.compact;
  document.querySelector("#compactToggle").textContent = state.compact ? "图卡" : "精简";
  render();
});

async function init() {
  const response = await fetch("/menu-data.json");
  state.data = await response.json();
  state.activeCategory = "";
  render();
}

init().catch((error) => {
  document.querySelector("#categoryList").innerHTML = `<section class="category-block"><div class="category-head"><h2>${escapeHtml(error.message)}</h2></div></section>`;
});
