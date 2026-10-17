/**
 * Finora's Store - Catalog & Store State Manager
 */
import { githubApi } from './github-api.js';

const STORAGE_KEY_CUSTOM_APPS = 'finora_custom_apps';
const STORAGE_KEY_ACTIVE_OS = 'finora_override_os';

export class CatalogManager {
  constructor() {
    this.defaultApps = [];
    this.customApps = this.loadCustomApps();
    this.allApps = [];
    this.enrichedApps = new Map(); // id -> full details
    this.isLoading = false;
  }

  loadCustomApps() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_CUSTOM_APPS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('Failed to parse custom apps:', e);
      return [];
    }
  }

  saveCustomApps() {
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOM_APPS, JSON.stringify(this.customApps));
    } catch (e) {
      console.error('Failed to save custom apps:', e);
    }
  }

  async init() {
    try {
      const response = await fetch('./default-catalog.json');
      this.defaultApps = await response.json();
    } catch (err) {
      console.warn('Failed to load default catalog, using fallback:', err);
      this.defaultApps = [];
    }
    this.mergeApps();
  }

  mergeApps() {
    this.allApps = [...this.defaultApps, ...this.customApps];
  }

  async addAppFromRepo(repoUrl, category = 'Custom Added') {
    const parsed = githubApi.parseRepoUrl(repoUrl);
    if (!parsed) {
      throw new Error('Geçersiz GitHub adresi! Örnek: owner/repo veya https://github.com/owner/repo');
    }

    const { owner, repo } = parsed;
    const appId = `custom-${owner}-${repo}`.toLowerCase();

    // Check if already exists
    if (this.allApps.some(a => a.owner.toLowerCase() === owner.toLowerCase() && a.repo.toLowerCase() === repo.toLowerCase())) {
      throw new Error('Bu uygulama zaten mağazanızda mevcut!');
    }

    // Fetch repository & release
    const repoInfo = await githubApi.getRepoInfo(owner, repo);
    const releaseInfo = await githubApi.getLatestRelease(owner, repo).catch(() => null);

    const newApp = {
      id: appId,
      name: repoInfo.name || repo,
      owner: owner,
      repo: repo,
      tagline: repoInfo.description || 'GitHub Açık Kaynak Uygulaması',
      category: category,
      icon: repoInfo.owner?.avatar_url || './logo.png',
      isCustom: true,
      featured: false,
      platforms: ['windows', 'linux', 'android', 'macos', 'ios']
    };

    this.customApps.unshift(newApp);
    this.saveCustomApps();
    this.mergeApps();

    // Enrich immediately
    const enriched = await githubApi.getFullAppDetails(newApp);
    this.enrichedApps.set(newApp.id, enriched);

    return enriched;
  }

  removeCustomApp(appId) {
    this.customApps = this.customApps.filter(a => a.id !== appId);
    this.saveCustomApps();
    this.enrichedApps.delete(appId);
    this.mergeApps();
  }

  resetCatalog() {
    this.customApps = [];
    localStorage.removeItem(STORAGE_KEY_CUSTOM_APPS);
    this.mergeApps();
  }

  async fetchAllAppsDetails(onProgress) {
    this.isLoading = true;
    let completed = 0;
    const total = this.allApps.length;

    const promises = this.allApps.map(async (app) => {
      try {
        const enriched = await githubApi.getFullAppDetails(app);
        this.enrichedApps.set(app.id, enriched);
      } catch (e) {
        console.warn(`Error enriching ${app.id}`, e);
      } finally {
        completed++;
        if (onProgress) onProgress(completed, total);
      }
    });

    await Promise.all(promises);
    this.isLoading = false;
    return Array.from(this.enrichedApps.values());
  }

  getApp(id) {
    return this.enrichedApps.get(id) || this.allApps.find(a => a.id === id);
  }

  getCategories() {
    const set = new Set(['Tümü']);
    this.allApps.forEach(a => {
      if (a.category) set.add(a.category);
    });
    return Array.from(set);
  }
}

export const catalogManager = new CatalogManager();
