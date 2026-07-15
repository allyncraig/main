'use strict';

// APIClient - A thin wrapper around providers

class APIClient {
	getProviderForVersion(version) {
		if (!version || !version.provider) {
			throw new Error('Version missing provider name');
		}
		return ProviderFactory.getProvider(version.provider);
	}

	async fetchBookList(version) {
		const provider = this.getProviderForVersion(version);
		return provider.fetchBookList(version.parameters);
	}

	async fetchChapter(version, bookApiId, chapterNum) {
		const provider = this.getProviderForVersion(version);
		return provider.fetchChapter(version.parameters, bookApiId, chapterNum);
	}

	async fetchSearch(version, searchTerm, page = 1) {
		const provider = this.getProviderForVersion(version);
		return provider.search(version.parameters, searchTerm, page);
	}
}