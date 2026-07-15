'use strict';

// StorageManager class - Handles all localStorage operations

class StorageManager {
	constructor() {
		this.keys = {
			BOOK: 'currentBook',
			BOOK_NAME: 'currentBookName',
			CHAPTER: 'currentChapter',
			VERSION: 'currentVersion',
			BOOKMARK: 'bookmark',
			DB_INITIALIZED: 'dbInitialized',
			// VOTD: 'votd',
		};
	}

	get(key, defaultValue = null) {
		try {
			const value = localStorage.getItem(key);
			return value !== null ? value : defaultValue;
		} catch (e) {
			console.error('StorageManager: Error getting', key, e);
			return defaultValue;
		}
	}

	getInt(key, defaultValue = 0) {
		const value = this.get(key);
		return value !== null ? parseInt(value, 10) : defaultValue;
	}

	set(key, value) {
		try {
			localStorage.setItem(key, value);
			return true;
		} catch (e) {
			console.error('StorageManager: Error setting', key, e);
			return false;
		}
	}

	remove(key) {
		try {
			localStorage.removeItem(key);
			return true;
		} catch (e) {
			console.error('StorageManager: Error removing', key, e);
			return false;
		}
	}

	loadAppSettings() {
		return {
			currentBook: this.getInt(this.keys.BOOK, APP.DEFAULT_BOOK),
			currentChapter: this.getInt(this.keys.CHAPTER, APP.DEFAULT_CHAPTER),
			currentVersion: this.get(this.keys.VERSION, APP.DEFAULT_VERSION),
			lastBookName: this.get(this.keys.BOOK_NAME, null)
		};
	}

	saveAppSettings(book, chapter, version, bookName = null) {
		this.set(this.keys.BOOK, book);
		this.set(this.keys.CHAPTER, chapter);
		this.set(this.keys.VERSION, version);

		if (bookName) {
			this.set(this.keys.BOOK_NAME, bookName);
		}
	}

	// Cache management for API book lists
	getBookCache(cacheKey) {
		try {
			const cached = this.get(cacheKey);
			return cached ? JSON.parse(cached) : null;
		} catch (e) {
			console.error('StorageManager: Error parsing book cache', e);
			return null;
		}
	}

	setBookCache(cacheKey, books) {
		try {
			this.set(cacheKey, JSON.stringify(books));
			return true;
		} catch (e) {
			console.error('StorageManager: Error caching books', e);
			return false;
		}
	}

	clearBookCache(cacheKey) {
		this.remove(cacheKey);
	}

	setVersionInitialized(versionCode, initialized) {
		const key = `db_initialized_${versionCode}`;
		this.set(key, initialized ? 'true' : 'false');
	}

	isVersionInitialized(versionCode) {
		const key = `db_initialized_${versionCode}`;
		return this.get(key) === 'true';
	}

	// Bookmark management
	getBookmark() {
		const bookmark = this.get(this.keys.BOOKMARK);
		if (!bookmark) return null;

		const parts = bookmark.split('-');
		if (parts.length === 3) {
			return {
				bookId: parseInt(parts[0]),
				chapter: parseInt(parts[1]),
				verse: parseInt(parts[2])
			};
		}
		return null;
	}

	setBookmark(bookId, chapter, verse) {
		const key = `${bookId}-${chapter}-${verse}`;
		this.set(this.keys.BOOKMARK, key);
	}

	clearBookmark() {
		this.remove(this.keys.BOOKMARK);
	}

	// Verse of the Day management
	// getVotD() {
	// 	const votd = this.get(this.keys.VOTD);
	// 	if (!votd) return null;

	// 	try {
	// 		return JSON.parse(votd);
	// 	} catch (e) {
	// 		console.error('Error parsing VotD from storage:', e);
	// 		return null;
	// 	}
	// }

	// setVotD(book, chapter, verse, text, today) {
	// 	const votd = {
	// 		book,
	// 		chapter,
	// 		verse,
	// 		text,
	// 		today
	// 	};
	// 	this.set(this.keys.VOTD, JSON.stringify(votd));
	// }

	// clearVotD() {
	// 	this.remove(this.keys.VOTD);
	// }
}