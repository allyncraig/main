'use strict';

// App constants
const APP = Object.freeze({
	NAME: 'My Bible App',
	COPYRIGHT_YEAR: '2025',
	SPLASH_TIMEOUT: 3000,
	DEFAULT_BOOK: 1,
	DEFAULT_CHAPTER: 1,
	DEFAULT_VERSION: 'KJV',
	DEFAULT_FONTSIZE: 18,
	LOCAL_KEY_BOOK: 'currentBook',
	LOCAL_KEY_CHAPTER: 'currentChapter',
	LOCAL_KEY_VERSION: 'currentVersion',
	ICON: 'img/bible.png',
	DB_FILE_NAME: 'bibles.db',
	/* BIBLE_APP_URL: 'https://bibleapp.wasmer.app/', */
	BIBLE_APP_URL: 'https://craigappfoundry.github.io/ABTBible/',
	BIBLE_VERSIONS_FILE: 'bibles.json',
	READING_PLAN_FILE: 'reading_plan.json',
	// VOTD_URL: 'https://www.scriptura-api.com/api/daytext?version=kjv',
	// VOTD_TIMEOUT: 300,
	// VOTD_URL_LBO: 'https://labs.bible.org/api/?passage=votd',
	READING_PLAN_KEY: 'readingPlan',
	FONTS_SANSSERIF: "'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif",
	FONTS_SERIF: "Georgia, 'Times New Roman', Times, serif",
	// FormSubmit.co
	SEARCH_RESULTS_PER_PAGE: 25,
	SEARCH_MAX_PAGE_BUTTONS: 4, // Show up to 4 page number buttons
	INTERLINEAR_FALLBACK_PRIMARY: 'ESV',
	VERSION_CATALOG_FILE: 'version_catalog.json',
	VERSION_CATALOG_STALE_DAYS: 30,
	PROXY_SUBMIT_URL: 'https://bible-api.zicasoft.workers.dev/v1/submit',
});

const TEXT = Object.freeze({
	SPLASH_MESSAGE: `<span class="splash-appname">${APP.NAME}</span><br/><span class="splash-apptext">v{{VERSION}}</span><br/><span class="splash-apptext">(c) ${APP.COPYRIGHT_YEAR} by <em>ZICAsoft</em></span>`,
	ABOUT_MESSAGE: `<span class="about-appname">${APP.NAME}</span><br><span class="about-apptext">v{{VERSION}}</span><br><span class="about-apptext">(c) ${APP.COPYRIGHT_YEAR} by <em>ZICAsoft</em></span><br><img width="80" height="80" class="radius" src="${APP.ICON}">`,
	ABOUT_TITLE: 'About this App',
	VOTD_TITLE: 'Verse of the Day'
});

const EVENT = Object.freeze({
	DEVICEREADY: 'deviceready',
	DOMCONTENTLOADED: 'DOMContentLoaded',
	CLICK: 'click',
	KEYPRESS: 'keypress',
});

const CLASS = Object.freeze({
	HIDDEN: 'hidden',
	DARK: 'dark',
	LIGHT: 'light',
	SELECTED: 'selected',
	FLEX: 'flex',
	BLOCK: 'block'
});

const MODAL = Object.freeze({
	MENU: 'menu',
	ABOUT: 'about',
	CONFIG: 'config',
	VERSION: 'version',
	SEARCH: 'search',
	CHAPTER: 'chapter',
	DOWNLOAD: 'download',
	SPLASH: 'splash',
	VERSEMENU: 'verseMenu',
	BOOKMARK: 'bookmark',
	NOTE: 'note',
	ALLNOTES: 'allNotes',
	READINGPLAN: 'readingPlan',
	BACKUP: 'backup',
	DAYCOMPLETE: 'dayComplete',
	LOG: 'log',
	CONTACT: 'contact',
	VERSIONCATALOG: 'versionCatalog',
});

const UI = Object.freeze({
	PREVCHAPTER: 'prevChapter',
	NEXTCHAPTER: 'nextChapter',
	CHAPTERSELECT: 'chapterSelect',
	DECREASEFONT: 'decreaseFont',
	INCREASEFONT: 'increaseFont',
	BIBLETEXT: 'bibleText',
	VERSIONBUTTON: 'versionButton',
	SEARCHBUTTON: 'searchButton',
	MENUBUTTON: 'menuButton',
	MAINCONTENT: 'mainContent',
	MENUMODAL: 'menuModal',
	ABOUTMODAL: 'aboutModal',
	CONFIGMODAL: 'configModal',
	VERSIONMODAL: 'versionModal',
	SEARCHMODAL: 'searchModal',
	BOOKMARKMODAL: 'bookmarkModal',
	SEARCHINPUT: 'searchInput',
	SEARCHMESSAGE: 'searchMessage',
	SEARCHMESSAGETEXT: 'searchMessageText',
	SEARCHLIST: 'searchList',
	SEARCHTEMPLATE: 'searchTemplate',
	VERSEMENUMODAL: 'verseMenuModal',
	READINGPLANMODAL: 'readingPlanModal',
	SPLASH_INFO: 'splash-info',
	DOWNLOAD_VERSION_LIST: 'downloadVersionList',
	DOWNLOAD_VERSION_HEADER: 'downloadVersionHeader',
});

const HTML = Object.freeze({
	NOTE_ICON: '&nbsp;<i class="note-icon icon ion-document-text" onclick="openNoteFromIcon(event, this)"></i>',
	VERSE_OMIT: '<em>(OMIT)</em>',
	SEARCH_SPINNER: '<span class="loading-spinner"></span>',
	SEARCH_LOADING: '<div class="search-loading">Searching...</div>',
	SEARCH_SINGLE_PAGE: '<div class="search-showing">Page <strong>1</strong> of <strong>1</strong> : all results</div>',
	SEARCH_PAGE_NUMBER_BTN: '<button class="page-nav-btn page-number-btn {{currentClass}}" onclick="navigateSearchPage({{page}})" {{disabled}}>{{page}}</button>',
	SEARCH_PAGINATION: `
			<div class="search-pagination">
				<button class="page-nav-btn icon ion-ios-skipbackward" onclick="navigateSearchPage(1)" {{prevDisabled}}></button>
				<button class="page-nav-btn icon ion-arrow-left-b" onclick="navigateSearchPage({{prevPage}})" {{prevDisabled}}></button>
				{{pageButtons}}
				<button class="page-nav-btn icon ion-arrow-right-b" onclick="navigateSearchPage({{nextPage}})" {{nextDisabled}}></button>
				<button class="page-nav-btn icon ion-ios-skipforward" onclick="navigateSearchPage({{totalPages}})" {{nextDisabled}}></button>
			</div>
			<div class="search-showing">
				Page <strong>{{page}}</strong> of <strong>{{totalPages}}</strong> : <strong>{{firstRef}}</strong> to <strong>{{lastRef}}</strong>
			</div>
		`,
});

const NAVIGATE_DIRECTION = Object.freeze({
	NEXT: 'next',
	PREVIOUS: 'previous',
})