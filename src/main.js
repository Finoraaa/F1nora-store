/**
 * Finora's Store - Main Application Controller
 */

import { marked } from 'marked';
import { detectUserOS, classifyAsset, pickBestAssetForOS } from './os-detector.js';
import { catalogManager } from './catalog.js';
import { githubApi } from './github-api.js';
import { downloadManager } from './download-manager.js';

// Application State
const state = {
  detectedOS: detectUserOS(),
  activeOSFilter: 'all', // 'all' or 'windows', 'android', 'linux', 'macos', 'ios'
  activeCategory: 'Tümü',
  searchQuery: '',
  sortBy: 'featured',
  selectedApp: null,
  activeModalTab: 'downloads',
  osOverride: localStorage.getItem('finora_override_os') || 'auto'
};

// Compute effective OS for highlighting
function getEffectiveOS() {
  if (state.osOverride && state.osOverride !== 'auto') {
    return {
      id: state.osOverride,
      name: state.osOverride.charAt(0).toUpperCase() + state.osOverride.slice(1),
      badge: `${state.osOverride.toUpperCase()} (Manuel)`,
      icon: 'laptop'
    };
  }
  return state.detectedOS;
}

// Helper: Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast-error' : ''}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'error' ? '⚠️' : '🐺'}</span>
    <span class="toast-text">${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Particle Confetti Effect
function triggerConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = ['#ffffff', '#d4d4d8', '#a1a1aa', '#71717a', '#3f3f46'];

  for (let i = 0; i < 70; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 0.5) * 14 - 3,
      size: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      decay: Math.random() * 0.02 + 0.015
    });
  }

  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let active = false;

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.25; // gravity
      p.alpha -= p.decay;

      if (p.alpha > 0) {
        active = true;
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
    });

    if (active) {
      requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  requestAnimationFrame(frame);
}

// Format relative date
function formatRelativeTime(dateString) {
  if (!dateString) return 'Bilinmiyor';
  const date = new Date(dateString);
  const diffDays = Math.round((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Bugün';
  if (diffDays === 1) return 'Dün';
  if (diffDays < 30) return `${diffDays} gün önce`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} ay önce`;
  return `${Math.floor(diffDays / 365)} yıl önce`;
}

// Format bytes
function formatBytes(bytes) {
  if (!bytes) return 'Bilinmiyor';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

// Initialize Application
async function initApp() {
  updateHeroOSBanner();
  setupEventListeners();

  await catalogManager.init();
  renderCategoryTabs();
  renderAppSkeletons();

  // Load app details in background
  catalogManager.fetchAllAppsDetails((completed, total) => {
    updateResultsCount();
    renderAppCards();
  }).then(() => {
    updateResultsCount();
    renderAppCards();
    document.getElementById('stat-apps-count').textContent = `${catalogManager.allApps.length} Uygulama`;
  });

  updateDownloadsBadge();
}

// Hero OS Banner
function updateHeroOSBanner() {
  const current = getEffectiveOS();
  const nameEl = document.getElementById('os-banner-name');
  const badgeEl = document.getElementById('os-banner-badge');
  const subEl = document.getElementById('os-banner-sub');
  const iconEl = document.getElementById('os-banner-icon');

  if (nameEl) nameEl.textContent = current.name;
  if (badgeEl) badgeEl.textContent = current.badge || current.name;
  if (iconEl) {
    iconEl.textContent = current.id === 'windows' ? '🪟' :
      current.id === 'android' ? '🤖' :
      current.id === 'linux' ? '🐧' :
      current.id === 'macos' ? '🍎' :
      current.id === 'ios' ? '📱' : '💻';
  }
}

// Render Categories
function renderCategoryTabs() {
  const container = document.getElementById('category-tabs');
  if (!container) return;
  const categories = catalogManager.getCategories();

  container.innerHTML = categories.map(cat => `
    <button class="cat-btn ${cat === state.activeCategory ? 'active' : ''}" data-category="${cat}">
      ${cat}
    </button>
  `).join('');

  container.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeCategory = btn.dataset.category;
      renderAppCards();
    });
  });
}

// Filter and Sort Apps
function getFilteredApps() {
  const currentOS = getEffectiveOS();
  let apps = catalogManager.allApps.map(a => catalogManager.getApp(a.id) || a);

  // Filter: Search Query
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    apps = apps.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.owner.toLowerCase().includes(q) ||
      (a.tagline && a.tagline.toLowerCase().includes(q)) ||
      (a.category && a.category.toLowerCase().includes(q))
    );
  }

  // Filter: Category
  if (state.activeCategory && state.activeCategory !== 'Tümü') {
    apps = apps.filter(a => a.category === state.activeCategory);
  }

  // Filter: OS
  if (state.activeOSFilter !== 'all') {
    apps = apps.filter(a => {
      // Check if catalog lists platform or if release has matching asset
      if (a.platforms && a.platforms.includes(state.activeOSFilter)) return true;
      if (a.release?.assets) {
        return a.release.assets.some(asset => classifyAsset(asset.name).os === state.activeOSFilter);
      }
      return false;
    });
  }

  // Sort
  if (state.sortBy === 'stars') {
    apps.sort((a, b) => (b.stars || 0) - (a.stars || 0));
  } else if (state.sortBy === 'updated') {
    apps.sort((a, b) => {
      const dateA = a.release?.publishedAt ? new Date(a.release.publishedAt).getTime() : 0;
      const dateB = b.release?.publishedAt ? new Date(b.release.publishedAt).getTime() : 0;
      return dateB - dateA;
    });
  } else if (state.sortBy === 'name') {
    apps.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    // Featured first
    apps.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  }

  return apps;
}

function updateResultsCount() {
  const countEl = document.getElementById('results-count');
  if (!countEl) return;
  const filtered = getFilteredApps();
  countEl.textContent = `${filtered.length} uygulama listeleniyor`;
}

// Skeleton loaders
function renderAppSkeletons() {
  const grid = document.getElementById('apps-grid');
  if (!grid) return;
  grid.innerHTML = Array(6).fill('<div class="skeleton-card"></div>').join('');
}

// Render App Cards
function renderAppCards() {
  const grid = document.getElementById('apps-grid');
  const emptyState = document.getElementById('empty-state');
  if (!grid) return;

  const apps = getFilteredApps();
  const currentOS = getEffectiveOS();

  if (apps.length === 0) {
    grid.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  grid.innerHTML = apps.map(app => {
    const release = app.release;
    const versionTag = release ? (release.tag || 'Latest') : 'v...';
    const starsCount = app.stars ? (app.stars >= 1000 ? `${(app.stars / 1000).toFixed(1)}k` : app.stars) : '—';
    
    // Check available assets
    const bestAsset = release?.assets ? pickBestAssetForOS(release.assets, currentOS.id) : null;
    const bestClassified = bestAsset ? classifyAsset(bestAsset.name) : null;

    // Platform badges
    const hasWin = (app.platforms?.includes('windows')) || release?.assets?.some(a => classifyAsset(a.name).os === 'windows');
    const hasAndroid = (app.platforms?.includes('android')) || release?.assets?.some(a => classifyAsset(a.name).os === 'android');
    const hasLinux = (app.platforms?.includes('linux')) || release?.assets?.some(a => classifyAsset(a.name).os === 'linux');
    const hasMac = (app.platforms?.includes('macos')) || release?.assets?.some(a => classifyAsset(a.name).os === 'macos');
    const hasIos = (app.platforms?.includes('ios')) || release?.assets?.some(a => classifyAsset(a.name).os === 'ios');

    const downloadBtnLabel = bestAsset 
      ? `İndir: ${bestClassified?.label || bestAsset.name}` 
      : (release ? 'Paketleri İncele' : 'Yükleniyor...');

    return `
      <div class="app-card" data-app-id="${app.id}">
        <div class="app-card-top">
          <img src="${app.icon || './logo.png'}" alt="${app.name}" class="app-card-icon" onerror="this.src='./logo.png'">
          <div class="app-card-meta">
            <div class="app-card-title-row">
              <h3 class="app-card-title">${app.name}</h3>
              <span class="app-card-stars">⭐ ${starsCount}</span>
            </div>
            <div class="app-card-author">${app.owner}/${app.repo}</div>
          </div>
        </div>

        <p class="app-card-desc">${app.tagline || app.description || 'Açık kaynak uygulama.'}</p>

        <div class="app-card-os-row">
          <div class="os-indicators">
            <span class="os-icon-tag ${hasWin ? 'active' : ''}" title="Windows">🪟 Win</span>
            <span class="os-icon-tag ${hasAndroid ? 'active' : ''}" title="Android">🤖 APK</span>
            <span class="os-icon-tag ${hasLinux ? 'active' : ''}" title="Linux (Debian / AppImage)">🐧 Linux</span>
            <span class="os-icon-tag ${hasMac ? 'active' : ''}" title="macOS">🍎 Mac</span>
            <span class="os-icon-tag ${hasIos ? 'active' : ''}" title="iOS">📱 iOS</span>
          </div>
          <span class="release-version-pill">${versionTag}</span>
        </div>

        <div class="app-card-actions">
          <button class="btn btn-primary btn-card-primary-dl" data-action="quick-download" data-app-id="${app.id}" title="${bestAsset ? bestAsset.name : 'Paketleri görüntüle'}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>${downloadBtnLabel}</span>
          </button>
          <button class="btn btn-secondary btn-card-more" data-action="open-modal" data-app-id="${app.id}" title="Tüm Sürümler & Detaylar">
            <span>Detaylar</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Attach card event listeners
  grid.querySelectorAll('.app-card').forEach(card => {
    const appId = card.dataset.appId;
    
    // Quick download click
    const dlBtn = card.querySelector('[data-action="quick-download"]');
    dlBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleCardQuickDownload(appId);
    });

    // Open detail modal click
    card.addEventListener('click', () => {
      openAppModal(appId);
    });
  });
}

// Handle Quick Download from Card
function handleCardQuickDownload(appId) {
  const app = catalogManager.getApp(appId);
  if (!app) return;

  const currentOS = getEffectiveOS();
  const release = app.release;
  if (!release || !release.assets || release.assets.length === 0) {
    openAppModal(appId);
    return;
  }

  const bestAsset = pickBestAssetForOS(release.assets, currentOS.id);
  if (!bestAsset) {
    showToast(`${app.name} için ${currentOS.name} paketi bulunamadı, tüm sürümler açılıyor.`);
    openAppModal(appId);
    return;
  }

  try {
    downloadManager.triggerDownload(app, bestAsset);
    triggerConfetti();
    updateDownloadsBadge();
    showToast(`İndirme başlatıldı: ${bestAsset.name} (${formatBytes(bestAsset.size)})`);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Open App Details Modal
function openAppModal(appId) {
  const app = catalogManager.getApp(appId);
  if (!app) return;
  state.selectedApp = app;

  const modal = document.getElementById('app-modal');
  const iconEl = document.getElementById('modal-app-icon');
  const titleEl = document.getElementById('modal-app-title');
  const descEl = document.getElementById('modal-app-desc');
  const tagEl = document.getElementById('modal-app-tag');
  const starsEl = document.getElementById('modal-app-stars');
  const authorLinkEl = document.getElementById('modal-app-author-link');
  const dateEl = document.getElementById('modal-app-date');
  const downloadsEl = document.getElementById('modal-app-downloads');
  const githubLink = document.getElementById('modal-btn-view-github');

  iconEl.src = app.icon || './logo.png';
  titleEl.textContent = app.name;
  descEl.textContent = app.tagline || app.description;
  tagEl.textContent = app.release ? app.release.tag : 'Sürüm Yok';
  starsEl.textContent = `⭐ ${app.stars || 0}`;
  authorLinkEl.textContent = `${app.owner}/${app.repo}`;
  authorLinkEl.href = `https://github.com/${app.owner}/${app.repo}`;
  githubLink.href = app.release?.htmlUrl || `https://github.com/${app.owner}/${app.repo}/releases`;

  if (app.release) {
    dateEl.textContent = formatRelativeTime(app.release.publishedAt);
    downloadsEl.textContent = `${app.release.totalDownloads?.toLocaleString() || 0} kez`;
  } else {
    dateEl.textContent = 'Bilinmiyor';
    downloadsEl.textContent = '—';
  }

  // Populate Grouped Assets
  renderModalAssets(app);

  // Populate Changelog Markdown
  const changelogBody = document.getElementById('modal-changelog-body');
  if (app.release?.body) {
    changelogBody.innerHTML = marked.parse(app.release.body);
  } else {
    changelogBody.innerHTML = '<p class="text-dim">Bu sürüm için açıklama notu girilmemiş.</p>';
  }

  // Quick download button in modal
  const currentOS = getEffectiveOS();
  const quickDlBtn = document.getElementById('modal-btn-quick-download');
  const quickDlText = document.getElementById('modal-btn-download-text');
  const bestAsset = app.release?.assets ? pickBestAssetForOS(app.release.assets, currentOS.id) : null;

  if (bestAsset) {
    quickDlText.textContent = `${currentOS.name} İçin İndir (${classifyAsset(bestAsset.name).format})`;
    quickDlBtn.onclick = () => {
      downloadManager.triggerDownload(app, bestAsset);
      triggerConfetti();
      updateDownloadsBadge();
      showToast(`İndirme başlatıldı: ${bestAsset.name}`);
    };
    quickDlBtn.style.display = 'inline-flex';
  } else {
    quickDlBtn.style.display = 'none';
  }

  // Switch to downloads tab by default
  switchModalTab('downloads');
  modal.style.display = 'flex';
}

function renderModalAssets(app) {
  const container = document.getElementById('modal-assets-grouped');
  if (!container) return;

  const assets = app.release?.assets || [];
  if (assets.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 2rem;">
        <p class="empty-desc">GitHub üzerinde derlenmiş binary/paket dosyası bulunamadı.</p>
        <a href="${app.release?.htmlUrl || `https://github.com/${app.owner}/${app.repo}/releases`}" target="_blank" class="btn btn-secondary">
          GitHub Sürümlerini Aç
        </a>
      </div>
    `;
    return;
  }

  // Group assets by OS
  const groups = {
    windows: { title: '🪟 Windows (.exe / .msi)', items: [] },
    android: { title: '🤖 Android (.apk / .aab)', items: [] },
    linux: { title: '🐧 Linux (Debian .deb / .AppImage / Arşiv)', items: [] },
    macos: { title: '🍎 macOS (.dmg / .pkg)', items: [] },
    ios: { title: '📱 iOS (.ipa)', items: [] },
    other: { title: '📦 Diğer Dosyalar ve Kaynak Kodlar', items: [] }
  };

  assets.forEach(asset => {
    const meta = classifyAsset(asset.name);
    if (meta.os === 'ignore' || meta.isInternal) return;
    if (groups[meta.os]) {
      groups[meta.os].items.push({ asset, meta });
    } else {
      groups.other.items.push({ asset, meta });
    }
  });

  const html = Object.entries(groups)
    .filter(([_, group]) => group.items.length > 0)
    .map(([osKey, group]) => `
      <div class="assets-group">
        <div class="assets-group-title">
          <span>${group.title}</span>
          <span class="badge">${group.items.length} dosya</span>
        </div>
        ${group.items.map(({ asset, meta }) => `
          <div class="asset-row">
            <div class="asset-left">
              <span class="asset-name" title="${asset.name}">${asset.name}</span>
              <div class="asset-meta">
                <span>📁 ${formatBytes(asset.size)}</span>
                <span>📥 ${asset.download_count?.toLocaleString() || 0} indirme</span>
                <span class="badge">${meta.label || meta.format}</span>
              </div>
            </div>
            <div class="asset-right">
              <button class="btn btn-secondary btn-sm" data-action="copy-asset-url" data-url="${asset.browser_download_url}" title="Doğrudan İndirme Bağlantısını Kopyala">
                🔗 Kopyala
              </button>
              <button class="btn btn-primary btn-sm" data-action="download-asset" data-asset-name="${asset.name}">
                📥 İndir
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('');

  container.innerHTML = html;

  // Attach button events
  container.querySelectorAll('[data-action="copy-asset-url"]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(btn.dataset.url);
      showToast('İndirme bağlantısı panoya kopyalandı!');
    });
  });

  container.querySelectorAll('[data-action="download-asset"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetAsset = assets.find(a => a.name === btn.dataset.assetName);
      if (targetAsset) {
        downloadManager.triggerDownload(app, targetAsset);
        triggerConfetti();
        updateDownloadsBadge();
        showToast(`İndirme başlatıldı: ${targetAsset.name}`);
      }
    });
  });
}

function switchModalTab(tabName) {
  state.activeModalTab = tabName;
  document.querySelectorAll('.modal-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });
  document.getElementById('tab-content-downloads').classList.toggle('active', tabName === 'downloads');
  document.getElementById('tab-content-changelog').classList.toggle('active', tabName === 'changelog');
}

// Downloads Badge
function updateDownloadsBadge() {
  const badge = document.getElementById('downloads-badge');
  if (!badge) return;
  const count = downloadManager.history.length;
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'block';
  } else {
    badge.style.display = 'none';
  }
}

// Render Downloads Modal
function renderDownloadsModal() {
  const container = document.getElementById('downloads-list');
  if (!container) return;

  const history = downloadManager.history;
  if (history.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 2rem;">
        <p class="empty-desc">Henüz bir dosya indirmediniz.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = history.map(item => `
    <div class="download-item">
      <div class="dl-item-left">
        <img src="${item.appIcon || './logo.png'}" class="dl-item-icon" alt="">
        <div class="dl-item-info">
          <div class="dl-item-app">${item.appName}</div>
          <div class="dl-item-file" title="${item.fileName}">${item.fileName}</div>
          <div class="dl-item-meta">${item.fileSize} • ${formatRelativeTime(item.timestamp)}</div>
        </div>
      </div>
      <a href="${item.downloadUrl}" target="_blank" download class="btn btn-secondary btn-sm">
        Tekrar İndir
      </a>
    </div>
  `).join('');
}

// Setup Event Listeners
function setupEventListeners() {
  // Brand click -> reset filters
  document.getElementById('nav-brand-btn').addEventListener('click', () => {
    state.searchQuery = '';
    state.activeCategory = 'Tümü';
    state.activeOSFilter = 'all';
    document.getElementById('global-search-input').value = '';
    document.querySelectorAll('.os-pill').forEach(p => p.classList.toggle('active', p.dataset.os === 'all'));
    renderCategoryTabs();
    renderAppCards();
    updateResultsCount();
  });

  // Global Search
  const searchInput = document.getElementById('global-search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');

  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim();
    clearSearchBtn.style.display = state.searchQuery ? 'block' : 'none';
    renderAppCards();
    updateResultsCount();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    clearSearchBtn.style.display = 'none';
    renderAppCards();
    updateResultsCount();
    searchInput.focus();
  });

  // Keyboard shortcut Ctrl+K or / to search
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && document.activeElement !== searchInput)) {
      e.preventDefault();
      searchInput.focus();
    }
    if (e.key === 'Escape') {
      closeAllModals();
    }
  });

  // OS Filter Pills
  document.querySelectorAll('.os-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.os-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.activeOSFilter = pill.dataset.os;
      renderAppCards();
      updateResultsCount();
    });
  });

  // Sort Select
  document.getElementById('sort-select').addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderAppCards();
  });

  // Refresh Catalog Button
  document.getElementById('btn-refresh-catalog').addEventListener('click', async () => {
    showToast('GitHub Releases kontrol ediliyor...');
    renderAppSkeletons();
    localStorage.clear(); // Clear cached GitHub API responses
    await catalogManager.fetchAllAppsDetails();
    renderAppCards();
    updateResultsCount();
    showToast('Tüm sürümler güncellendi!');
  });

  // Modal Tabs
  document.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchModalTab(tab.dataset.tab);
    });
  });

  // Close buttons for modals
  document.getElementById('btn-close-app-modal').addEventListener('click', closeAllModals);
  document.getElementById('btn-close-add-modal').addEventListener('click', closeAllModals);
  document.getElementById('btn-close-downloads-modal').addEventListener('click', closeAllModals);
  document.getElementById('btn-close-downloads-done').addEventListener('click', closeAllModals);
  document.getElementById('btn-close-settings-modal').addEventListener('click', closeAllModals);

  // Close modal when clicking overlay background
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeAllModals();
    });
  });

  // Open Add App Modal
  document.getElementById('btn-open-add-app').addEventListener('click', () => {
    document.getElementById('add-app-modal').style.display = 'flex';
    document.getElementById('input-repo-url').focus();
  });
  document.getElementById('btn-empty-add-app')?.addEventListener('click', () => {
    document.getElementById('add-app-modal').style.display = 'flex';
  });

  // Verify custom repo button
  document.getElementById('btn-verify-repo').addEventListener('click', async () => {
    const input = document.getElementById('input-repo-url').value;
    const parsed = githubApi.parseRepoUrl(input);
    if (!parsed) {
      showToast('Lütfen geçerli bir GitHub depo adresi yazın.', 'error');
      return;
    }

    try {
      showToast('GitHub deposu inceleniyor...');
      const [repoInfo, releaseInfo] = await Promise.all([
        githubApi.getRepoInfo(parsed.owner, parsed.repo),
        githubApi.getLatestRelease(parsed.owner, parsed.repo).catch(() => null)
      ]);

      const previewBox = document.getElementById('add-app-preview');
      const icon = document.getElementById('preview-icon');
      const name = document.getElementById('preview-name');
      const desc = document.getElementById('preview-desc');
      const tags = document.getElementById('preview-tags');

      icon.src = repoInfo.owner?.avatar_url || './logo.png';
      name.textContent = `${repoInfo.name} (${releaseInfo ? releaseInfo.tag_name : 'Releases Yok'})`;
      desc.textContent = repoInfo.description || 'Açıklama yok.';

      // Count assets by OS
      const assets = releaseInfo?.assets || [];
      const hasWin = assets.some(a => classifyAsset(a.name).os === 'windows');
      const hasAndroid = assets.some(a => classifyAsset(a.name).os === 'android');
      const hasLinux = assets.some(a => classifyAsset(a.name).os === 'linux');
      const hasMac = assets.some(a => classifyAsset(a.name).os === 'macos');

      tags.innerHTML = `
        <span class="badge">⭐ ${repoInfo.stargazers_count}</span>
        ${hasWin ? '<span class="badge badge-accent">🪟 Windows</span>' : ''}
        ${hasAndroid ? '<span class="badge badge-accent">🤖 Android</span>' : ''}
        ${hasLinux ? '<span class="badge badge-accent">🐧 Linux</span>' : ''}
        ${hasMac ? '<span class="badge badge-accent">🍎 macOS</span>' : ''}
      `;

      previewBox.style.display = 'block';
      showToast('Depo doğrulandı!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Submit Add App Form
  document.getElementById('add-app-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const repoInput = document.getElementById('input-repo-url').value;
    const category = document.getElementById('select-app-category').value;

    try {
      showToast('Uygulama mağazaya ekleniyor...');
      const enriched = await catalogManager.addAppFromRepo(repoInput, category);
      renderCategoryTabs();
      renderAppCards();
      updateResultsCount();
      closeAllModals();
      triggerConfetti();
      showToast(`"${enriched.name}" mağazanıza başarıyla eklendi!`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Open Downloads Modal
  document.getElementById('btn-open-downloads').addEventListener('click', () => {
    renderDownloadsModal();
    document.getElementById('downloads-modal').style.display = 'flex';
  });

  // Clear Downloads History
  document.getElementById('btn-clear-downloads').addEventListener('click', () => {
    downloadManager.clearHistory();
    renderDownloadsModal();
    updateDownloadsBadge();
    showToast('İndirme geçmişi temizlendi.');
  });

  // Open Settings Modal
  document.getElementById('btn-open-settings').addEventListener('click', () => {
    document.getElementById('input-gh-token').value = githubApi.getToken();
    document.getElementById('select-os-override').value = state.osOverride;
    document.getElementById('settings-modal').style.display = 'flex';
  });

  // Save Settings
  document.getElementById('btn-save-settings').addEventListener('click', () => {
    const token = document.getElementById('input-gh-token').value;
    const osOverride = document.getElementById('select-os-override').value;

    githubApi.setToken(token);
    state.osOverride = osOverride;
    if (osOverride === 'auto') {
      localStorage.removeItem('finora_override_os');
    } else {
      localStorage.setItem('finora_override_os', osOverride);
    }

    updateHeroOSBanner();
    renderAppCards();
    closeAllModals();
    showToast('Ayarlar kaydedildi.');
  });

  // Reset Store to Defaults
  document.getElementById('btn-reset-store').addEventListener('click', () => {
    if (confirm('Özel eklediğiniz tüm uygulamalar silinecektir. Onaylıyor musunuz?')) {
      catalogManager.resetCatalog();
      renderCategoryTabs();
      renderAppCards();
      updateResultsCount();
      closeAllModals();
      showToast('Mağaza varsayılana sıfırlandı.');
    }
  });
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
}

// Start app on DOMContentLoaded
window.addEventListener('DOMContentLoaded', initApp);
