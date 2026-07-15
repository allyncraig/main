'use strict';

class VersionCatalogStore {
	constructor() {
		this.CATALOG_KEY = 'versionCatalog';
		this.TIMESTAMP_KEY = 'versionCatalogTimestamp';
	}

	getCatalog() {
		try {
			const catalog = localStorage.getItem(this.CATALOG_KEY);
			return catalog ? JSON.parse(catalog) : null;
		} catch (e) {
			console.error('VersionCatalogStore: Error parsing catalog', e);
			return null;
		}
	}

	setCatalog(catalogData) {
		localStorage.setItem(this.CATALOG_KEY, JSON.stringify(catalogData));
		localStorage.setItem(this.TIMESTAMP_KEY, Date.now().toString());
	}

	clearCatalog() {
		localStorage.removeItem(this.CATALOG_KEY);
		localStorage.removeItem(this.TIMESTAMP_KEY);
	}

	isStale() {
		const timestamp = localStorage.getItem(this.TIMESTAMP_KEY);
		if (!timestamp) return true;
		const staleMsec = APP.VERSION_CATALOG_STALE_DAYS * 24 * 60 * 60 * 1000;
		return (Date.now() - parseInt(timestamp)) > staleMsec;
	}

	async fetchAndCache(url) {
		try {
			const data = await HTTPClient.getJSON(url);
			this.setCatalog(data);
			return data;
		} catch (e) {
			console.error('VersionCatalogStore: Fetch failed, using stale cache', e);
			return this.getCatalog();
		}
	}

	async getOrFetch() {
		const cached = this.getCatalog();
		if (!cached || this.isStale()) {
			return await this.fetchAndCache(APP.BIBLE_APP_URL + APP.VERSION_CATALOG_FILE);
		}
		return cached;
	}
}