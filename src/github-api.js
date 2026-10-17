/**
 * Finora's Store - GitHub Releases & Repository API Engine
 */

const CACHE_PREFIX = 'finora_cache_';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export class GitHubAPI {
  constructor() {
    this.token = localStorage.getItem('finora_gh_token') || '';
  }

  setToken(token) {
    this.token = token.trim();
    if (this.token) {
      localStorage.setItem('finora_gh_token', this.token);
    } else {
      localStorage.removeItem('finora_gh_token');
    }
  }

  getToken() {
    return this.token;
  }

  getHeaders() {
    const headers = {
      'Accept': 'application/vnd.github.v3+json'
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async fetchWithCache(url) {
    const cacheKey = CACHE_PREFIX + url;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
          return parsed.data;
        }
      }
    } catch (e) {
      console.warn('Cache read error', e);
    }

    const response = await fetch(url, { headers: this.getHeaders() });
    
    // Check rate limit headers
    const remaining = response.headers.get('x-ratelimit-remaining');
    if (remaining !== null) {
      window.dispatchEvent(new CustomEvent('finora:ratelimit', { detail: { remaining, limit: response.headers.get('x-ratelimit-limit') } }));
    }

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('GitHub API rate limit exceeded. You can add a GitHub Token in Settings for 5,000 requests/hr.');
      }
      if (response.status === 404) {
        throw new Error('Repository or release not found on GitHub.');
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data }));
    } catch (e) {
      console.warn('Cache write error', e);
    }
    return data;
  }

  async getRepoInfo(owner, repo) {
    return await this.fetchWithCache(`https://api.github.com/repos/${owner}/${repo}`);
  }

  async getLatestRelease(owner, repo) {
    try {
      return await this.fetchWithCache(`https://api.github.com/repos/${owner}/${repo}/releases/latest`);
    } catch (err) {
      // Fallback: If "latest" 404s (e.g. only pre-releases exist), fetch first release from list
      const releases = await this.fetchWithCache(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=1`);
      if (releases && releases.length > 0) {
        return releases[0];
      }
      throw err;
    }
  }

  async getFullAppDetails(app) {
    try {
      const [repoData, releaseData] = await Promise.all([
        this.getRepoInfo(app.owner, app.repo).catch(() => null),
        this.getLatestRelease(app.owner, app.repo).catch(() => null)
      ]);

      const stars = repoData?.stargazers_count || 0;
      const description = app.tagline || repoData?.description || 'Open source application';
      const icon = app.icon || repoData?.owner?.avatar_url || './logo.png';
      
      let totalDownloads = 0;
      if (releaseData?.assets) {
        totalDownloads = releaseData.assets.reduce((sum, a) => sum + (a.download_count || 0), 0);
      }

      return {
        ...app,
        stars,
        description,
        icon,
        repoUrl: `https://github.com/${app.owner}/${app.repo}`,
        release: releaseData ? {
          tag: releaseData.tag_name || releaseData.name || 'v1.0.0',
          name: releaseData.name || releaseData.tag_name,
          publishedAt: releaseData.published_at,
          body: releaseData.body || 'No release notes provided.',
          htmlUrl: releaseData.html_url,
          assets: releaseData.assets || [],
          totalDownloads
        } : null
      };
    } catch (error) {
      console.error(`Failed to load details for ${app.owner}/${app.repo}:`, error);
      return {
        ...app,
        stars: 0,
        description: app.tagline || 'Open-source software',
        icon: app.icon || './logo.png',
        release: null,
        error: error.message
      };
    }
  }

  parseRepoUrl(input) {
    let clean = input.trim().replace(/\/$/, '');
    // Handle https://github.com/owner/repo or github.com/owner/repo or owner/repo
    const match = clean.match(/(?:github\.com\/)?([^/]+)\/([^/]+)/);
    if (match) {
      return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
    }
    return null;
  }
}

export const githubApi = new GitHubAPI();
