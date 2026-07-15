'use strict';

class BookMarkManager extends Manager {
	constructor(storageManager, modalManager, navigationManager, versionManager, chapterViewManager, configManager, verseActionManager, contentRenderer) {
		super();
		this.storageManager = storageManager;
		this.modalManager = modalManager;
		this.navigationManager = navigationManager;
		this.versionManager = versionManager;
		this.chapterViewManager = chapterViewManager;
		this.configManager = configManager;
		this.verseActionManager = verseActionManager;
		this.contentRenderer = contentRenderer;
	}

	showBookmark() {
		closeModal(MODAL.MENU);
		this.modalManager.show(MODAL.BOOKMARK);
		this._setBookmarkModalContent();
	}

	bookmarkClear() {
		this.storageManager.clearBookmark();
		this._setBookmarkModalContent();
	}

	bookmarkSet() {
		closeModal(MODAL.VERSEMENU);
		const { bookId, chapter, verse } = this.verseActionManager.selectedVerse;
		this.storageManager.setBookmark(bookId, chapter, verse);
		this._setBookmarkModalContent();
		openToast('Bookmark Set');
	}

	async gotoBookmark() {
		closeModal(MODAL.BOOKMARK)
		closeModal(MODAL.MENU);
		const bookmark = this.storageManager.getBookmark();
		if (!bookmark) {
			openToast('No bookmark set.');
			return;
		}

		// Disable interlinear mode when navigating from bookmark
		if (this.configManager.getValue('interlinearMode')) {
			this.controller.onDisableInterlinear();
		}

		// Navigate to the bookmarked position
		this.navigationManager.navigateToChapter(bookmark.bookId, bookmark.chapter);
		this.controller.onUpdateDisplay();
		await this.controller.onLoadCurrentChapter();

		requestAnimationFrame(() => {
			this.contentRenderer.scrollToVerse(bookmark.verse, false);
		});
	}

	_setBookmarkModalContent() {
		const bookmark = this.storageManager.getBookmark();
		document.getElementById('bookmarkSavedVerse').innerText = (bookmark === null) ? 'None' : this._formatReference(bookmark);
	}

	_formatReference(obj) {
		return `${this.versionManager.findBookById(obj.bookId).name} ${obj.chapter}:${obj.verse}`;	
	}
}