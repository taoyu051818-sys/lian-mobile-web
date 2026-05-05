<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchAuthMe, fetchProfileTab, logoutAuth } from "../api/profile";
import { GlassPanel, IdentityBadge, InlineError, LianButton, TagChip, TrustBadge, TypeChip } from "../ui";
import type { FeedItemId } from "../types/feed";
import type { ProfileListItem, ProfileTabKey, ProfileUser } from "../types/profile";
import AuthPanel from "./auth/AuthPanel.vue";

const user = ref<ProfileUser | null>(null);
const loading = ref(false);
const listLoading = ref(false);
const errorMessage = ref("");
const listError = ref("");
const activeTab = ref<ProfileTabKey>("history");
const profileItems = ref<ProfileListItem[]>([]);

const tabs: Array<{ key: ProfileTabKey; label: string; empty: string }> = [
  { key: "history", label: "浏览记录", empty: "暂无浏览记录" },
  { key: "saved", label: "收藏", empty: "暂无收藏" },
  { key: "liked", label: "赞过", empty: "暂无点赞" },
];

const displayName = computed(() => user.value?.username || "未登录同学");
const avatarText = computed(() => displayName.value.slice(0, 2) || "同");
const identityMeta = computed(() => {
  const activeAlias = user.value?.activeAliasId
    ? user.value.aliases?.find((alias) => alias.id === user.value?.activeAliasId)
    : null;
  return activeAlias?.name || user.value?.identityTags?.[0] || user.value?.institution || "校园身份";
});
const userTags = computed(() => {
  const tags = user.value?.tags || user.value?.identityTags || [];
  return tags.slice(0, 5);
});
const listEmptyText = computed(() => tabs.find((tab) => tab.key === activeTab.value)?.empty || "暂无内容");

function readHistoryIds() {
  try {
    const history = JSON.parse(localStorage.getItem("lian.readHistory") || "[]") as Array<{ tid: FeedItemId }>;
    return history.slice().reverse().map((entry) => entry.tid).slice(0, 50);
  } catch {
    return [];
  }
}

async function loadProfile() {
  loading.value = true;
  errorMessage.value = "";
  try {
    user.value = await fetchAuthMe();
    if (user.value) await loadProfileList(activeTab.value);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "个人资料暂时没加载出来，可以稍后再试。";
  } finally {
    loading.value = false;
  }
}

async function loadProfileList(tab: ProfileTabKey) {
  activeTab.value = tab;
  listLoading.value = true;
  listError.value = "";
  try {
    const response = await fetchProfileTab(tab, tab === "history" ? readHistoryIds() : []);
    profileItems.value = response.items || [];
  } catch (error) {
    listError.value = error instanceof Error ? error.message : "列表暂时没加载出来，可以稍后再试。";
    profileItems.value = [];
  } finally {
    listLoading.value = false;
  }
}

async function logout() {
  loading.value = true;
  errorMessage.value = "";
  try {
    await logoutAuth();
    user.value = null;
    profileItems.value = [];
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "退出登录没有成功，可以稍后再试。";
  } finally {
    loading.value = false;
  }
}

async function handleAuthenticated(authenticatedUser: ProfileUser | null) {
  if (authenticatedUser) {
    user.value = authenticatedUser;
  }
  await loadProfile();
}

function formatRelativeTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`;
  if (diff < 172_800_000) return "昨天";
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}天前`;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

onMounted(() => {
  void loadProfile();
});
</script>

<template>
  <section class="profile-view" aria-labelledby="profile-view-title">
    <GlassPanel class="profile-view__card">
      <header class="profile-view__header">
        <div>
          <TypeChip type="contribution">我的 LIAN</TypeChip>
          <h2 id="profile-view-title">个人中心</h2>
        </div>
        <TrustBadge :tone="user ? 'confirmed' : 'pending'">{{ user ? "已登录" : "未登录" }}</TrustBadge>
      </header>

      <InlineError v-if="errorMessage">
        {{ errorMessage }}
        <button type="button" @click="loadProfile">重新加载</button>
      </InlineError>

      <div v-if="loading" class="profile-view__state" role="status">正在加载个人资料…</div>

      <template v-else-if="user">
        <section class="profile-view__identity" aria-label="当前身份">
          <IdentityBadge :avatar-text="avatarText" :label="displayName" :meta="identityMeta" />
          <p>{{ user.email || "邀请码用户" }} · {{ user.institution || "校园用户" }}</p>
          <div v-if="userTags.length" class="profile-view__chips" aria-label="身份标签">
            <TagChip v-for="tag in userTags" :key="tag" :tag="tag" />
          </div>
        </section>

        <dl class="profile-view__metrics" aria-label="资料概览">
          <div>
            <dt>发布身份</dt>
            <dd>{{ user.aliases?.length || 1 }}</dd>
            <span>{{ user.activeAliasId ? "已启用马甲" : "真实身份" }}</span>
          </div>
          <div>
            <dt>邀请权限</dt>
            <dd>{{ user.invitePermission ? "可用" : "—" }}</dd>
            <span>生成邀请码稍后迁移</span>
          </div>
          <div>
            <dt>状态</dt>
            <dd>{{ user.status || "正常" }}</dd>
            <span>账号状态</span>
          </div>
        </dl>

        <nav class="profile-view__tabs" aria-label="个人内容分类">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            type="button"
            class="profile-view__tab"
            :class="{ 'is-active': activeTab === tab.key }"
            @click="loadProfileList(tab.key)"
          >
            {{ tab.label }}
          </button>
        </nav>

        <InlineError v-if="listError">
          {{ listError }}
          <button type="button" @click="loadProfileList(activeTab)">重新加载</button>
        </InlineError>

        <div v-if="listLoading" class="profile-view__state" role="status">正在加载列表…</div>
        <div v-else-if="!profileItems.length" class="profile-view__state">{{ listEmptyText }}</div>
        <div v-else class="profile-view__list" aria-live="polite">
          <article v-for="item in profileItems" :key="String(item.tid)" class="profile-view__item">
            <img v-if="item.cover" :src="item.cover" :alt="item.title || '内容封面'" loading="lazy" />
            <div v-else class="profile-view__thumb" aria-hidden="true">{{ (item.title || '内').slice(0, 1) }}</div>
            <div>
              <h3>{{ item.title || "未命名内容" }}</h3>
              <p>{{ formatRelativeTime(item.lastViewedAt || item.timestampISO) || "时间未知" }}</p>
            </div>
          </article>
        </div>

        <div class="profile-view__actions">
          <LianButton variant="tonal" disabled>编辑资料稍后迁移</LianButton>
          <LianButton variant="ghost" @click="logout">退出登录</LianButton>
        </div>
      </template>

      <section v-else class="profile-view__guest">
        <h3>还没有登录</h3>
        <p>登录后可以发布、回复、发送频道消息，也能查看浏览记录、收藏和赞过的内容。</p>
        <AuthPanel @authenticated="handleAuthenticated" />
      </section>
    </GlassPanel>
  </section>
</template>

<style scoped>
.profile-view,
.profile-view__card,
.profile-view__identity,
.profile-view__guest,
.profile-view__list {
  display: grid;
  gap: var(--space-4);
}

.profile-view__header,
.profile-view__chips,
.profile-view__tabs,
.profile-view__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.profile-view h2,
.profile-view h3,
.profile-view p,
.profile-view dl {
  margin: 0;
}

.profile-view__identity p,
.profile-view__guest p,
.profile-view__item p {
  color: var(--lian-muted);
  line-height: 1.6;
}

.profile-view__chips,
.profile-view__tabs,
.profile-view__actions {
  justify-content: flex-start;
}

.profile-view__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
}

.profile-view__metrics > div {
  display: grid;
  gap: 2px;
  padding: var(--space-3);
  border: 1px solid var(--lian-border);
  border-radius: var(--radius-3);
  background: rgba(255, 255, 255, 0.52);
}

.profile-view__metrics dt,
.profile-view__metrics span {
  color: var(--lian-muted);
  font-size: 12px;
}

.profile-view__metrics dd {
  margin: 0;
  font-size: 20px;
  font-weight: 900;
}

.profile-view__tab {
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.54);
  color: var(--lian-muted);
  font-weight: 850;
}

.profile-view__tab.is-active {
  background: var(--lian-ink);
  color: #fff;
}

.profile-view__state {
  display: grid;
  min-height: 112px;
  place-items: center;
  color: var(--lian-muted);
  text-align: center;
}

.profile-view__item {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-3);
  border: 1px solid rgba(31, 41, 51, 0.08);
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.48);
}

.profile-view__item img,
.profile-view__thumb {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-3);
  object-fit: cover;
}

.profile-view__thumb {
  display: grid;
  place-items: center;
  background: rgba(31, 41, 51, 0.06);
  color: var(--lian-muted);
  font-weight: 900;
}

.profile-view__item h3 {
  margin-bottom: 4px;
  font-size: 15px;
}

.inline-error button {
  min-height: 32px;
  margin-left: var(--space-2);
  border: 0;
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.72);
  color: currentColor;
  font-weight: 900;
}

@media (max-width: 640px) {
  .profile-view__metrics {
    grid-template-columns: 1fr;
  }
}
</style>
