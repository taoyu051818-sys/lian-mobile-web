const state = {
  data: null,
  active: "全部",
  expanded: new Set(),
  noticeOpen: false,
};

const categoryAliases = [
  ["全部", () => true],
  ["披萨", (name) => /披萨/.test(name)],
  ["轻食", (name) => /轻食/.test(name)],
  ["小食", (name) => /小食/.test(name)],
  ["意面", (name) => /意面|三明治/.test(name)],
  ["面包贝果", (name) => /面包|贝果/.test(name)],
  ["甜品", (name) => /甜品|蛋糕/.test(name)],
  ["咖啡饮品", (name) => /咖啡|气泡|果茶|软饮/.test(name)],
  ["零食", (name) => /山姆|零食/.test(name)],
];

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(value) {
  if (Number(value) === 0) return "说明";
  return `¥${Number(value).toFixed(value % 1 ? 1 : 0)}`;
}

function paidItems(category) {
  return category.items.filter((item) => item.price > 0 && !item.soldOut);
}

function stats(category) {
  const items = paidItems(category);
  if (!items.length) return `${category.items.length} 条说明`;
  const prices = items.map((item) => item.price);
  return `${items.length} 款 · ${money(Math.min(...prices))}-${money(Math.max(...prices))}`;
}

function isInstructionCategory(category) {
  return category.name === "必选品";
}

function renderSummary() {
  const paid = state.data.categories.flatMap(paidItems);
  document.querySelector("#menuSummary").textContent = `${state.data.categories.length - 1} 个可点品类 · ${paid.length} 个商品 · ${money(Math.min(...paid.map(i => i.price)))}-${money(Math.max(...paid.map(i => i.price)))}`;
}

function renderNotice() {
  const category = state.data.categories.find(isInstructionCategory);
  const items = category?.items || [];
  const visible = state.noticeOpen ? items : items.slice(0, 3);
  document.querySelector("#orderNotice").innerHTML = `
    <button class="notice-head" type="button" data-toggle-notice>
      <div>
        <h2>下单说明</h2>
        <p>${items.length} 条配送、堂食和自提信息</p>
      </div>
      <strong>${state.noticeOpen ? "收起" : "展开"}</strong>
    </button>
    <div class="notice-body">
      ${visible.map((item) => renderNoticeRow(item)).join("")}
    </div>
  `;
}

function renderNoticeRow(item) {
  const time = item.name.match(/(\d{1,2}:\d{2}[-~—至]\d{1,2}:\d{2}|\d{1,2}:\d{2})/);
  const label = item.name.replace(/[（(].*?[）)]/g, "").replace(time?.[0] || "", "").trim();
  return `
    <div class="notice-row">
      <span>${escapeHtml(label || item.name)}</span>
      <span>${escapeHtml(time?.[0] || (item.name.includes("随时") ? "随时配送" : "查看说明"))}</span>
    </div>
  `;
}

function renderTabs() {
  document.querySelector("#categoryTabs").innerHTML = categoryAliases.map(([name]) => `
    <button class="tab-pill ${state.active === name ? "is-active" : ""}" type="button" data-tab="${escapeHtml(name)}">${escapeHtml(name)}</button>
  `).join("");
}

function selectedCategories() {
  const matcher = categoryAliases.find(([name]) => name === state.active)?.[1] || (() => true);
  return state.data.categories
    .filter((category) => !isInstructionCategory(category))
    .filter((category) => matcher(category.name));
}

function makeGroups(category) {
  const items = paidItems(category);
  if (/超值套餐/.test(category.name)) {
    return items.map((item) => ({
      title: item.name,
      desc: comboDescription(item.name),
      price: money(item.price),
      count: 1,
      imageUrl: item.imageUrl,
    }));
  }
  if (/披萨/.test(category.name)) {
    return [
      group("一人食", items.filter((item) => /一人/.test(item.name))),
      group("58 元披萨", items.filter((item) => item.price === 58)),
      group("66-68 元披萨", items.filter((item) => item.price >= 66 && item.price <= 68)),
      group("方形披萨", items.filter((item) => /方形|底特律/.test(item.name))),
    ].filter((item) => item.count);
  }
  if (/面包|贝果/.test(category.name)) {
    return [
      group("贝果", items.filter((item) => /贝果/.test(item.name))),
      group("面包", items.filter((item) => /法棍|牛角包|欧包|肉桂/.test(item.name))),
      group("碱水", items.filter((item) => /碱水/.test(item.name))),
    ].filter((item) => item.count);
  }
  if (/咖啡|气泡|果茶|软饮/.test(category.name)) {
    return [
      group("咖啡", items.filter((item) => /美式|拿铁|咖啡|抹茶/.test(item.name))),
      group("气泡和果茶", items.filter((item) => /气泡|果茶|茶|话梅|青柠/.test(item.name))),
      group("软饮", items.filter((item) => /可乐|果汁|屈臣氏|沙士|shot/.test(item.name))),
    ].filter((item) => item.count);
  }
  return representativeItems(category, 4).map((item) => ({
    title: item.name,
    desc: category.name,
    price: money(item.price),
    count: 1,
    imageUrl: item.imageUrl,
  }));
}

function group(title, items) {
  const names = items.map((item) => item.name).slice(0, 5).join("、");
  const prices = items.map((item) => item.price);
  const cover = items.find((item) => item.imageUrl)?.imageUrl || "";
  return {
    title,
    desc: names || "暂无商品",
    price: prices.length ? `${items.length} 款 · ${money(Math.min(...prices))}-${money(Math.max(...prices))}` : "",
    count: items.length,
    imageUrl: cover,
  };
}

function comboDescription(name) {
  if (/双人/.test(name)) return "1 份披萨 + 1 份意大利面 + 1 份沙拉 + 2 份饮料";
  if (/炸炸/.test(name)) return "沙拉 + 炸炸小食 + 饮料";
  if (/意面沙拉/.test(name)) return "意面 + 沙拉 + 饮料";
  if (/披萨套餐/.test(name)) return "披萨 + 饮料";
  return "套餐组合";
}

function representativeItems(category, limit) {
  return paidItems(category)
    .sort((a, b) => score(b, category) - score(a, category) || a.price - b.price)
    .slice(0, limit);
}

function score(item, category) {
  let value = 0;
  if (item.price <= 25) value += 3;
  if (/一人|单人|套餐|招牌|自选|沙拉|贝果|意面|披萨|咖啡/.test(item.name)) value += 4;
  if (/生日蛋糕|山姆/.test(category.name)) value -= 2;
  return value;
}

function renderCategories() {
  const categories = selectedCategories();
  if (!categories.length) {
    document.querySelector("#categoryList").innerHTML = `<div class="empty">这个品类下暂时没有商品</div>`;
    return;
  }
  document.querySelector("#categoryList").innerHTML = categories.map((category) => {
    const isExpanded = state.expanded.has(category.name);
    return `
      <section class="category-block">
        <button class="category-head" type="button" data-toggle-category="${escapeHtml(category.name)}">
          <div>
            <h2>${escapeHtml(category.name)}</h2>
            <p>${escapeHtml(stats(category))}</p>
          </div>
          <strong>${isExpanded ? "收起" : "展开"}</strong>
        </button>
        ${isExpanded ? renderItems(category) : renderGroups(category)}
      </section>
    `;
  }).join("");
}

function renderGroups(category) {
  return `
    <div class="summary-groups">
      ${makeGroups(category).map((item) => `
        <article class="group-card">
          ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}" loading="lazy">` : ""}
          <div>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.desc)}</p>
            <div class="price-line">${escapeHtml(item.price)}</div>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderItems(category) {
  return `
    <div class="item-list">
      ${paidItems(category).map((item) => `
        <article class="item-row">
          <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" loading="lazy">
          <div>
            <h3>${escapeHtml(item.name)}</h3>
            <p>${escapeHtml(category.name)}</p>
          </div>
          <div class="price">${money(item.price)}</div>
        </article>
      `).join("")}
    </div>
  `;
}

function render() {
  renderSummary();
  renderNotice();
  renderTabs();
  renderCategories();
}

document.addEventListener("click", (event) => {
  const notice = event.target.closest("[data-toggle-notice]");
  if (notice) {
    state.noticeOpen = !state.noticeOpen;
    renderNotice();
    return;
  }
  const tab = event.target.closest("[data-tab]");
  if (tab) {
    state.active = tab.dataset.tab;
    state.expanded.clear();
    renderTabs();
    renderCategories();
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

document.querySelector("#backButton").addEventListener("click", () => {
  if (history.length > 1) {
    history.back();
    return;
  }
  location.href = "/";
});

async function init() {
  const response = await fetch("/menu-data.json");
  state.data = await response.json();
  render();
}

init().catch((error) => {
  document.querySelector("#categoryList").innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
});
