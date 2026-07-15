'use strict';

class AppController {
	constructor(app) {
		this.app = app;
	}

	setupEventListeners() {
		const app = this.app;

		document.getElementById(UI.PREVCHAPTER).addEventListener(EVENT.CLICK, () => {
			if (app.readingModeManager.isActive) {
				app.readingModeManager.handleDailyReadingNavigate(NAVIGATE_DIRECTION.PREVIOUS);
			} else {
				app.chapterViewManager.navigateChapter(NAVIGATE_DIRECTION.PREVIOUS);
			}
		});

		document.getElementById(UI.NEXTCHAPTER).addEventListener(EVENT.CLICK, () => {
			if (app.readingModeManager.isActive) {
				app.readingModeManager.handleDailyReadingNavigate(NAVIGATE_DIRECTION.NEXT);
			} else {
				app.chapterViewManager.navigateChapter(NAVIGATE_DIRECTION.NEXT);
			}
		});

		document.getElementById(UI.CHAPTERSELECT).addEventListener(EVENT.CLICK, () => {
			if (app.readingModeManager.isActive) {
				app.readingPlanModalManager.showReadingPlan();
			} else {
				app.chapterViewManager.showChapterSelector();
			}
		});

		document.getElementById(UI.VERSIONBUTTON).addEventListener(EVENT.CLICK, () => {
			app.versionSelectorManager.showVersionSelector();
		});

		document.getElementById(UI.SEARCHBUTTON).addEventListener(EVENT.CLICK, () => {
			app.searchManager.showSearch();
		});

		document.getElementById(UI.MENUBUTTON).addEventListener(EVENT.CLICK, () => {
			app.modalManager.show(MODAL.MENU);
		});

		document.getElementById(UI.SEARCHINPUT).addEventListener(EVENT.KEYPRESS, (e) => {
			if (e.key === 'Enter' &&
				e.target.id === UI.SEARCHINPUT &&
				app.modalManager.isVisible(MODAL.SEARCH)) {
				app.searchManager.executeSearch();
			}
		});

		document.getElementById(UI.MENUMODAL).addEventListener(EVENT.CLICK, (e) => {
			if (e.target === e.currentTarget) {
				app.modalManager.hide(MODAL.MENU);
			}
		});
		document.getElementById(UI.VERSEMENUMODAL).addEventListener(EVENT.CLICK, (e) => {
			if (e.target === e.currentTarget) {
				app.modalManager.hide(MODAL.VERSEMENU);
			}
		})

		document.getElementById(UI.MENUMODAL).addEventListener(EVENT.CLICK, (e) => {
			const button = e.target.closest('[data-action]');
			if (!button) {
				return;
			}
			this.handleMenuAction(button.getAttribute('data-action'));
		});

		document.getElementById('dailyReadingBackButton').addEventListener(EVENT.CLICK, () => {
			app.readingModeManager.exitDailyReadingMode();
		});

		document.getElementById(UI.VERSEMENUMODAL).addEventListener(EVENT.CLICK, (e) => {
			const button = e.target.closest('[id]');
			if (!button) return;
			switch (button.id) {
				case 'menuGotoBookmark':
					app.bookmarkManager.gotoBookmark();
					closeModal(MODAL.VERSEMENU);
					break;
				case 'menuBookmarkSet':
					app.bookmarkManager.bookmarkSet();
					break;
				case 'menuShowNoteEditor':
					app.verseActionManager.showNoteEditor();
					break;
				case 'menuSuggestEdit':
					app.verseActionManager.showSuggestEdit();
					break;
			}
		});

		const modalCloseMap = {
			'closeChapterModal':        MODAL.CHAPTER,
			'closeVersionModal':        MODAL.VERSION,
			'closeAboutModal':          MODAL.ABOUT,
			'closeConfigModal':         MODAL.CONFIG,
			'closeDownloadModal':       MODAL.DOWNLOAD,
			'closeBackupModal':         MODAL.BACKUP,
			'closeSearchModal':         MODAL.SEARCH,
			'closeBookmarkModal':       MODAL.BOOKMARK,
			'closeNoteModal':           MODAL.NOTE,
			'closeAllNotesModal':       MODAL.ALLNOTES,
			'closeReadingPlanModal':    MODAL.READINGPLAN,
			'closeContactModal':        MODAL.CONTACT,
			'closeLogModal':            MODAL.LOG,
			'closeVersionCatalogModal': MODAL.VERSIONCATALOG,
		};
		Object.entries(modalCloseMap).forEach(([id, modal]) => {
			const el = document.getElementById(id);
			if (el) el.addEventListener(EVENT.CLICK, () => closeModal(modal));
		});

		document.getElementById('versionInterlinearButton').addEventListener(EVENT.CLICK, () => {
			app.versionSelectorManager.toggleInterlinearMode();
		});

		// Delegated listener for dynamically-rendered version items
		document.getElementById('versionList').addEventListener(EVENT.CLICK, (e) => {
			const button = e.target.closest('[data-abbreviation]');
			if (button) {
				app.versionSelectorManager.selectVersion(button);
			}
		});

		document.getElementById('gotoBookmarkButton').addEventListener(EVENT.CLICK, () => {
			app.bookmarkManager.gotoBookmark();
		});
		document.getElementById('clearBookmarkButton').addEventListener(EVENT.CLICK, () => {
			app.bookmarkManager.bookmarkClear();
		});
		document.getElementById('noteCopyButton').addEventListener(EVENT.CLICK, () => {
			app.verseActionManager.copyVerseText();
		});
		document.getElementById('noteSaveButton').addEventListener(EVENT.CLICK, () => {
			app.verseActionManager.noteSave();
		});
		document.getElementById('noteSendSuggestionButton').addEventListener(EVENT.CLICK, () => {
			app.verseActionManager.noteSendSuggestion();
		});
		document.getElementById('noteCancelButton').addEventListener(EVENT.CLICK, () => {
			app.verseActionManager.noteCancel();
		});
		document.getElementById('searchExecuteButton').addEventListener(EVENT.CLICK, () => {
			app.searchManager.executeSearch();
		});

		document.getElementById('backupExportButton').addEventListener(EVENT.CLICK, () => {
			app.backupManager.exportBackup();
		});
		document.getElementById('backupImportButton').addEventListener(EVENT.CLICK, () => {
			app.backupManager.importBackupFile();
		});
		document.getElementById('backupFileInput').addEventListener('change', (e) => {
			app.backupManager.onBackupFileSelected(e.target);
		});
		document.getElementById('contactSendButton').addEventListener(EVENT.CLICK, () => {
			app.contactManager.sendContactMessage();
		});
		document.getElementById('logClearButton').addEventListener(EVENT.CLICK, () => {
			app.clearLogMessages();
		});
		document.getElementById('readingPlanClearButton').addEventListener(EVENT.CLICK, () => {
			app.readingPlanStore.clearReadingPlan();
		});

		document.getElementById('readingPlanList').addEventListener(EVENT.CLICK, (e) => {
			const readingBtn = e.target.closest('.reading-button');
			if (readingBtn) {
				app.readingModeManager.navigateToReading(
					readingBtn.dataset.reference,
					readingBtn.dataset.day,
					readingBtn.dataset.index
				);
				return;
			}
			const checkbox = e.target.closest('.reading-checkbox');
			if (checkbox) {
				app.readingPlanModalManager.toggleReadingComplete(checkbox);
			}
		});
		document.getElementById('exitDailyReadingButton').addEventListener(EVENT.CLICK, () => {
			app.readingModeManager.exitDailyReadingMode();
		});

		document.getElementById(UI.DOWNLOAD_VERSION_LIST).addEventListener(EVENT.CLICK, (e) => {
			const item = e.target.closest('[data-code]');
			if (item) {
				app.downloadManager.handleDownloadItemClick(
					item.dataset.code,
					item.dataset.exists === 'true'
				);
			}
		});

		document.getElementById('searchList').addEventListener(EVENT.CLICK, (e) => {
			const item = e.target.closest('.search-item');
			if (item) {
				app.searchManager.handleResultClick(item);
			}
		});

		document.getElementById('noteGotoVerseButton').addEventListener(EVENT.CLICK, () => {
			app.verseActionManager.noteGotoVerse();
		});

		document.getElementById('allNotesList').addEventListener(EVENT.CLICK, (e) => {
			const item = e.target.closest('[data-key]');
			if (item) {
				app.verseActionManager.editNoteFromList(item.dataset.key);
			}
		});
	}

	handleMenuAction(action) {
		closeModal(MODAL.MENU);
		const app = this.app;
		switch (action) {
			case 'showReadingPlan':    app.readingPlanModalManager.showReadingPlan(); break;
			case 'showBookmark':       app.bookmarkManager.showBookmark(); break;
			case 'showAllNotes':       showAllNotes(); break;
			case 'showConfigure':      this.showConfigure(); break;
			case 'showDownload':       this.onShowDownload(); break;
			case 'showLog':            showLog(); break;
			case 'showBackup':         this.app.modalManager.show(MODAL.BACKUP); break;
			case 'showContact':        this.app.contactManager.showContact(); break;
			case 'showVersionCatalog': app.versionCatalogManager.show(); break;
			case 'showAbout':          this.showAboutModal(TEXT.ABOUT_TITLE, app.aboutMessage); break;
		}
	}

	showConfigure() {
		this.app.configManager.render();
		this.app.modalManager.show(MODAL.CONFIG);
	}

	showAboutModal(title, message) {
		const titleEl = document.getElementById('aboutTitle');
		const messageEl = document.getElementById('aboutMessage');

		if (titleEl) titleEl.textContent = title;
		if (messageEl) messageEl.innerHTML = message;

		this.app.modalManager.show(MODAL.ABOUT);
	}

	onUpdateDisplay() {
		this.app.chapterViewManager.updateDisplay();
	}

	async onLoadCurrentChapter() {
		await this.app.chapterViewManager.loadCurrentChapter();
	}
	async onLoadChapterContent(version) {
		await this.app.chapterViewManager.loadChapterContent(version);
	}

	onUpdateInterlinearMenuText() {
		this.app.versionSelectorManager.updateInterlinearMenuText();
	}

	onDisableInterlinear() {
		this.app.versionSelectorManager.disableInterlinear();
	}

	async onAnimateOut() {
		await animateOut();
	}

	onAnimateIn() {
		animateIn();
	}

	async onLoadReadingPlan() {
		await loadReadingPlan();
	}

	async onShowDownload() {
		closeModal(MODAL.MENU);
		this.app.modalManager.show(MODAL.DOWNLOAD);
		let bibleVersions = [];

		loading('Loading Bible versions...');

		const versions = await this.app.versionSelectorManager.getAvailableVersions();

		try {
			bibleVersions = await HTTPClient.getJSON(APP.BIBLE_APP_URL + APP.BIBLE_VERSIONS_FILE);
		} catch (error) {
			console.log(`Failed to load Bible versions: (${APP.BIBLE_APP_URL + APP.BIBLE_VERSIONS_FILE}) ${error.name}/${error.message}/${error.code} : stack(${error.stack})`);
			bibleVersions = [];
		} finally {
			closeLoading();
			if (bibleVersions.length > 0) {
				// Create a Set of versions that have LOCAL DATABASE copies
				const localVersions = new Set(
					versions
						.filter(v => v.hasLocalCopy === true)
						.map(v => v.abbreviation)
				);

				// Prepare data for template
				const templateData = bibleVersions.map(item => ({
					code: item.code,
					name: item.name,
					exists: localVersions.has(item.code),
					hidden: localVersions.has(item.code) ? '' : CLASS.HIDDEN
				}));

				document.getElementById(UI.DOWNLOAD_VERSION_HEADER).innerText = 'Select a version to download for offline reading:';
				Template.render('downloadVersionTemplate', UI.DOWNLOAD_VERSION_LIST, templateData);
			} else {
				document.getElementById(UI.DOWNLOAD_VERSION_HEADER).innerText = 'Unable to load the offline versions list.';
				document.getElementById(UI.DOWNLOAD_VERSION_LIST).classList.add(CLASS.HIDDEN);
			}
		}
	}
}