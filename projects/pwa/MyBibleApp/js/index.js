'use strict';

// App state - now much simpler
const app = {
	fontSize: 18,
	minFontSize: 12,
	maxFontSize: 32,
	splashMessage: '',
	aboutMessage: '',
	logMessages: [],
	dailyVerse: {
		book: '',
		chapter: '',
		verse: '',
		text: '',
		date: ''
	},
	state: {
		debugEnabled: false,
		rawVerses: {},
	},

	// Manager instances
	apiClient: null,
	bookmarkManager: null,
	chapterViewManager: null,
	configManager: null,
	contentRenderer: null,
	controller: null,
	dailyReadingManager: null,
	databaseManager: null,
	modalManager: null,
	notesStore: null,
	navigationManager: null,
	readingModeManager: null,
	readingPlanModalManager: null,
	readingPlanStore: null,
	searchManager: null,
	storageManager: null,
	verseActionManager: null,
	versionManager: null,
	versionSelectorManager: null,
	versionCatalogStore: null,
	versionCatalogManager: null,
};

// Initialize app
document.addEventListener(EVENT.DEVICEREADY, onDeviceReady, false);

if ('serviceWorker' in navigator && !window.cordova) {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('./service-worker.js');
	});
}

function onDeviceReady() {
	if (app.state.debugEnabled) {
		document.getElementById('menuItemShowLog').classList.remove('hidden');
		(function() {
			const original = {
				log: console.log,
				warn: console.warn,
				error: console.error
			};

			function capture(type, args) {
				app.logMessages.push({
					type,
					message: JSON.stringify(Array.from(args))  // Capture raw arguments
				});
			}

			console.log = function() {
				capture("log", arguments);
				original.log.apply(console, arguments);
				console.dir(arguments);
			};

			console.warn = function() {
				capture("warn", arguments);
				original.warn.apply(console, arguments);
				console.dir(arguments);
			};

			console.error = function() {
				capture("error", arguments);
				original.error.apply(console, arguments);
				console.dir(arguments);
			};
		})();
	}

	const _openToast = window.openToast;
	window.openToast = function (arg, options = {}) {
		let message = "";
		let duration = 4000;

		if (typeof arg === "string") {
			message = arg;
			if (options.duration) duration = options.duration;
		} else if (arg && typeof arg === "object") {
			message = arg.message || "";
			if (arg.duration) duration = arg.duration;
		}

		if (window.cordova && cordova.plugins && cordova.plugins.material && cordova.plugins.material.Snackbar) {
			cordova.plugins.material.Snackbar.show(message, duration);
		} else {
			_openToast({ message, position: "center", duration });
		}
	};

	// console.log('Cordova is ready');
	initializeApp();
}

// For testing in browser
if (!window.cordova) {
	document.addEventListener(EVENT.DOMCONTENTLOADED, initializeApp);
}

// App initialization

async function initializeApp() {
	// // DIAGNOSTIC: Check service worker status
	// console.log('=== SERVICE WORKER DIAGNOSTIC ===');
	// console.log('window.cordova exists:', !!window.cordova);
	// console.log('serviceWorker in navigator:', 'serviceWorker' in navigator);

	// if ('serviceWorker' in navigator) {
	// 	const registrations = await navigator.serviceWorker.getRegistrations();
	// 	console.log('Active service workers:', registrations.length);
	// 	registrations.forEach(reg => {
	// 		console.log('  - Scope:', reg.scope);
	// 		console.log('  - Active:', !!reg.active);
	// 	});
	// }
	// console.log('================================');

	try {
		initializeSplash();
		initializeManagers();
		applyStartupSettings();
		await loadReadingPlan();
		await initializeDatabase();
		await app.dailyReadingManager.initialize();
		setupEventListeners();
		app.chapterViewManager.updateDisplay();
	} catch (error) {
		console.error('Fatal initialization error: ', error);
		openToast('An error occurred during initialization.');
	}
}

function initializeSplash() {
	const rect = document.getElementById('chapterSelect').getBoundingClientRect();
	document.getElementById('prevChapter').style.height = rect.height + 'px';
	document.getElementById('nextChapter').style.height = rect.height + 'px';

	if (window.cordova && cordova.getAppVersion) {
		cordova.getAppVersion.getVersionNumber((version) => {
			_applySplash(version);
		});
	} else {
		fetch('./version.json')
			.then(r => r.json())
			.then(data => _applySplash(data.version ?? data))
			.catch(() => _applySplash('PWA'));
	}
}

function _applySplash(version) {
	app.splashMessage = TEXT.SPLASH_MESSAGE.replace('{{VERSION}}', version);
	app.aboutMessage = TEXT.ABOUT_MESSAGE.replace('{{VERSION}}', version);
	const infoEl = document.getElementById(UI.SPLASH_INFO);
	if (infoEl && app.splashMessage) {
		infoEl.innerHTML = app.splashMessage;
	}
	app.modalManager.show(MODAL.SPLASH);
	setTimeout(() => app.modalManager.hide(MODAL.SPLASH), APP.SPLASH_TIMEOUT);
}

function initializeManagers() {
	app.notesStore = new NotesStore();
	app.readingPlanStore = new ReadingPlanStore();
	app.modalManager = new ModalManager(MODAL);
	app.storageManager = new StorageManager();
	app.apiClient = new APIClient();
	app.databaseManager = new IndexedDBManager(APP.DB_FILE_NAME);
	app.versionManager = new VersionManager(VERSION_CONFIG, app.databaseManager, app.apiClient, app.storageManager);
	app.navigationManager = new NavigationManager(app.versionManager, app.storageManager);
	app.downloadManager = new DownloadManager(app.databaseManager, app.storageManager, app.versionManager, app.navigationManager);
	app.contentRenderer = new ContentRenderer(UI.BIBLETEXT, (bookId, chapter, verse) => app.notesStore.hasNote(bookId, chapter, verse), app.versionManager, app.navigationManager, app.modalManager);
	app.verseActionManager = new VerseActionManager(app.notesStore, app.modalManager, app.versionManager, app.navigationManager, app.contentRenderer);
	app.configManager = new ConfigManager(buildConfigDefinition(VERSION_CONFIG), app.storageManager, {
		storageKey: 'bible_app_config',
		pageId: 'configurationPage',
	});
	app.chapterViewManager = new ChapterViewManager(app.versionManager, app.navigationManager, app.contentRenderer, app.databaseManager, app.apiClient, app.configManager, app.modalManager, app.verseActionManager);
	app.searchManager = new SearchManager(app.versionManager, app.databaseManager, app.apiClient, UI.SEARCHLIST, app.navigationManager, app.modalManager, app.configManager, app.chapterViewManager, app.contentRenderer);
	app.versionSelectorManager = new VersionSelectorManager(app.versionManager, app.navigationManager, app.configManager, app.modalManager);
	app.bookmarkManager = new BookMarkManager(app.storageManager, app.modalManager, app.navigationManager, app.versionManager, app.chapterViewManager, app.configManager, app.verseActionManager, app.contentRenderer);
	app.dailyReadingManager = new DailyReadingManager(app.storageManager, app.readingPlanStore, app.navigationManager);
	app.readingModeManager = new ReadingModeManager(app.dailyReadingManager, app.navigationManager, app.versionManager, app.contentRenderer, app.modalManager, app.configManager);
	app.readingPlanModalManager = new ReadingPlanModalManager(app.dailyReadingManager, app.modalManager, app.readingPlanStore, app.readingModeManager, app.versionManager);
	app.backupManager = new BackupManager(app.storageManager, app.notesStore, app.readingPlanStore, app.dailyReadingManager, app.configManager, app.navigationManager);
	app.contactManager = new ContactManager(app.modalManager);
	app.versionCatalogStore = new VersionCatalogStore();
	app.versionCatalogManager = new VersionCatalogManager(app.versionCatalogStore, app.configManager, app.navigationManager, app.versionSelectorManager, app.modalManager);

	app.controller = new AppController(app);
	const managers = [
		app.readingModeManager,
		app.versionSelectorManager,
		app.chapterViewManager,
		app.searchManager,
		app.bookmarkManager,
		app.readingPlanModalManager,
		app.downloadManager,
		app.verseActionManager,
		app.versionCatalogManager,
	];
	managers.forEach(m => m.registerController(app.controller));

	// Seed enabled versions from VERSION_CONFIG on first run
	if (app.configManager.getEnabledVersions().length === 0) {
		const defaultEnabled = VERSION_CONFIG.map(v => v.abbreviation);
		app.configManager.setEnabledVersions(defaultEnabled);
	}
}

function applyStartupSettings() {
	app.navigationManager.loadSettings();
	app.fontSize = app.configManager.getValue('fontSize');
	app.contentRenderer.setFontSize(app.fontSize);
	document.body.style.colorScheme = app.configManager.getValue('darkMode') ? CLASS.DARK : CLASS.LIGHT;
	const el = document.getElementById(UI.MAINCONTENT);
	el.style.fontFamily = app.configManager.getValue('fontStyle') === 'serif' ? APP.FONTS_SERIF : APP.FONTS_SANSSERIF;
	app.controller.onUpdateInterlinearMenuText();
}

async function initializeDatabase() {
	if (!app.databaseManager.isAvailable()) {
		console.log('SQLite plugin not available, skipping database initialization');
		// Still need to load books even without database
		await app.chapterViewManager.loadBooksAndChapter();
		return;
	}

	// Always open the database
	await app.databaseManager.open();

	// Check if any version data exists in the database
	const hasData = await app.databaseManager.verifyDatabaseHasData();

	// Load books for default version
	await app.chapterViewManager.loadBooksAndChapter();
}

/* Stub Functions */

async function showReadingPlan() {
	await app.readingPlanModalManager.showReadingPlan();
}

function updateProgressDisplay() {
	app.readingPlanModalManager.updateProgressDisplay();
}

async function selectVersion(element) {
	await app.versionSelectorManager.selectVersion(element);
}

function navigateSearchPage(page) {
	app.searchManager.navigateSearchPage(page);
}

function openNoteFromIcon(event, iconElement) {
	app.verseActionManager.openNoteFromIcon(event, iconElement);
}

function closeModal(tag) {
	app.modalManager.hide(tag);
}

/* End Stub Functions */

function setupEventListeners() {
	app.controller.setupEventListeners();
}

async function loadReadingPlan() {
	// Check if already cached
	const cached = app.readingPlanStore.getReadingPlan();
	if (cached) {
		// console.log('Reading plan loaded from cache');
		return;
	}

	// If not cached, fetch from server
	try {
		// console.log('Fetching reading plan from server...');
		const planData = await HTTPClient.getJSON(APP.BIBLE_APP_URL + APP.READING_PLAN_FILE);
		app.readingPlanStore.setReadingPlan(planData);
		// console.log('Reading plan downloaded and cached');
	} catch (e) {
		console.error(`Failed to load reading plan: ${e.message}`);
	}
}

// Notes functions

function showAllNotes() {
	const notes = app.notesStore.getNotes();
	const noteKeys = Object.keys(notes);

	if (noteKeys.length === 0) {
		document.getElementById('allNotesMessage').classList.remove(CLASS.HIDDEN);
		document.getElementById('allNotesResult').classList.add(CLASS.HIDDEN);
	} else {
		document.getElementById('allNotesMessage').classList.add(CLASS.HIDDEN);
		document.getElementById('allNotesResult').classList.remove(CLASS.HIDDEN);

		// Convert notes to template data
		const noteItems = noteKeys.map(key => {
			const [bookId, chapter, verse] = key.split('-').map(Number);
			
			// Try to find book in current version first
			const book = app.versionManager.findBookById(bookId);
			
			// Use standard English name if book doesn't exist in current version
			const bookName = book ? book.name : getBookName(bookId);

			return {
				key: key,
				reference: `${bookName} ${chapter}:${verse}`,
				text: notes[key]
			};
		});

		// Sort by reference (book, chapter, verse)
		noteItems.sort((a, b) => {
			const [aBook, aChap, aVerse] = a.key.split('-').map(Number);
			const [bBook, bChap, bVerse] = b.key.split('-').map(Number);

			if (aBook !== bBook) return aBook - bBook;
			if (aChap !== bChap) return aChap - bChap;
			return aVerse - bVerse;
		});

		Template.render('noteItemTemplate', 'allNotesList', noteItems);
	}

	app.modalManager.show(MODAL.ALLNOTES);
}

// TESTING FUNCTIONS AREA
// REMOVE or comment out for public releases

// Show Log Modal functions
function showLog() {
	closeModal(MODAL.MENU);
	app.modalManager.show(MODAL.LOG);
	renderLogMessages();
}

function clearLogMessages() {
	app.logMessages = [];
	window.logList = [];
	renderLogMessages();
}

function renderLogMessages() {
	const logList = app.logMessages.map(p => ({
		type: p.type,
		message: p.message
	}));
	Template.render('logMessageTemplate', 'logMessageList', logList);
}

// Add this function temporarily for testing
//async function clearBookCache() {
	/* Clear cache for all versions */
	// const versionList = await getAvailableVersions();
	// for (let i = 0; i <= versionList.length; i++) {
	// 	const version = app.versionManager.getVersion(versionList[i].abbreviation);
	// 	app.versionManager.clearBookCache(version.abbreviation);
	// 	console.log(`Cleared cache for ${version.abbreviation}`);
	// }
	/* Clear cache for a specific version */
	// if (app.versionManager) {
	// 	const version = app.versionManager.getVersion('SBL');
	// 	app.versionManager.clearBookCache(version);
	// 	openToast('Book cache cleared.');
	// 	closeModal(MODAL.MENU);
	// }
// 	closeModal(MODAL.MENU);
// }

// function debugBookIds() {
// 	clearLogMessages();
// 	const books = app.versionManager.getBooks();
// 	const version = app.versionManager.getVersion(app.navigationManager.getCurrentVersion());

// 	console.log('\n=== BOOK ID DEBUG ===');
// 	console.log('Current Version:', version.abbreviation, '(' + version.source + ')');
// 	console.log('Total Books:', books.length);
// 	console.log('\nFirst 5 Books:');
// 	books.slice(0, 5).forEach(b => {
// 		console.log(`  id: ${b.id}, apiId: ${b.apiId}, name: ${b.name}, abbr: ${b.abbreviation}`);
// 	});
// 	console.log('\nSample NT Books (Matthew, Mark, Luke):');
// 	[40, 41, 42].forEach(id => {
// 		const book = books.find(b => b.id === id);
// 		if (book) {
// 			console.log(`  id: ${book.id}, apiId: ${book.apiId}, name: ${book.name}, abbr: ${book.abbreviation}`);
// 		} else {
// 			console.log(`  id: ${id} - NOT FOUND`);
// 		}
// 	});
// 	console.log('===================\n');
// 	renderLogMessages();
// }

// function showStorage() {
// 	closeModal(MODAL.MENU);
// 	renderStorageView();
//	showAboutModal('Local Storage Manager', '<div id="storageViewContainer"></div>');
// }

// function renderStorageView() {
// 	// Small delay to ensure modal content is in DOM
// 	setTimeout(() => {
// 		const container = document.getElementById('storageViewContainer');
// 		if (!container) return;

// 		let html = '';

// 		// Get all localStorage items
// 		const items = [];
// 		for (let i = 0; i < localStorage.length; i++) {
// 			const key = localStorage.key(i);
// 			const value = localStorage.getItem(key);
// 			items.push({ key, value });
// 		}

// 		// Sort items alphabetically by key
// 		items.sort((a, b) => a.key.localeCompare(b.key));

// 		if (items.length === 0) {
// 			html = '<div class="storage-empty">No items in local storage</div>';
// 		} else {
// 			// Add Delete All button
// 			html += '<button onclick="deleteAllStorage()" class="storage-delete-all-btn">Delete All Storage</button>';

// 			// Add storage container
// 			html += '<div class="storage-container">';

// 			items.forEach(item => {
// 				html += `
// 					<div class="storage-item">
// 						<div class="storage-key">${escapeHtml(item.key)}</div>
// 						<div class="storage-value">${escapeHtml((item.value.length <= 50) ? item.value : item.value.slice(0,50) + '...' )}</div>
// 						<button onclick="deleteStorageItem('${escapeHtml(item.key)}')" class="storage-delete-btn">Delete</button>
// 					</div>
// 				`;
// 			});

// 			html += '</div>';
// 		}

// 		container.innerHTML = html;
// 	}, 100);
// }

// function deleteStorageItem(key) {
// 	if (!confirm(`Delete storage item?\n\nKey: ${key}\n\nThis cannot be undone.`)) {
// 		return;
// 	}

// 	try {
// 		localStorage.removeItem(key);
// 		openToast(`Deleted: ${key}`);
// 		renderStorageView();
// 	} catch (error) {
// 		openToast(`Error deleting item: ${error.message}`);
// 	}
// }

// function deleteAllStorage() {
// 	if (!confirm('Delete ALL local storage items?\n\nThis will remove all app data including settings, bookmarks, notes, and cache.\n\nThis cannot be undone!')) {
// 		return;
// 	}

// 	// Second confirmation for safety
// 	if (!confirm('Are you absolutely sure?\n\nThis action is irreversible and will reset the entire app.')) {
// 		return;
// 	}

// 	try {
// 		localStorage.clear();
// 		openToast('All storage cleared');
// 		renderStorageView();
// 	} catch (error) {
// 		openToast(`Error clearing storage: ${error.message}`);
// 	}
// }

// function escapeHtml(text) {
// 	const div = document.createElement('div');
// 	div.textContent = text;
// 	return div.innerHTML;
// }

// END TESTING FUNCTIONS AREA

// Expose app globally for debugging and HTML onclick handlers
// This is intentional. Do not delete.
window.app = app;
