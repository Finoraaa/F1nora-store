/**
 * Finora's Store - Download Manager & History Tracker
 */

const STORAGE_KEY_DOWNLOADS = 'finora_downloads_history';

export class DownloadManager {
  constructor() {
    this.history = this.loadHistory();
  }

  loadHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_DOWNLOADS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  saveHistory() {
    try {
      localStorage.setItem(STORAGE_KEY_DOWNLOADS, JSON.stringify(this.history.slice(0, 50)));
    } catch (e) {
      console.warn('Failed to save download history:', e);
    }
  }

  triggerDownload(app, asset) {
    if (!asset || !asset.browser_download_url) {
      throw new Error('İndirme bağlantısı bulunamadı.');
    }

    // Save to history
    const record = {
      id: Date.now().toString(),
      appName: app.name,
      appIcon: app.icon || './logo.png',
      fileName: asset.name,
      fileSize: asset.size ? (asset.size / (1024 * 1024)).toFixed(1) + ' MB' : 'Bilinmiyor',
      downloadUrl: asset.browser_download_url,
      timestamp: Date.now()
    };

    this.history.unshift(record);
    this.saveHistory();

    // Trigger browser download via invisible anchor
    const a = document.createElement('a');
    a.href = asset.browser_download_url;
    a.download = asset.name;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Dispatch event for UI celebration
    window.dispatchEvent(new CustomEvent('finora:download-started', { detail: record }));

    return record;
  }

  clearHistory() {
    this.history = [];
    localStorage.removeItem(STORAGE_KEY_DOWNLOADS);
    window.dispatchEvent(new CustomEvent('finora:history-updated'));
  }
}

export const downloadManager = new DownloadManager();
