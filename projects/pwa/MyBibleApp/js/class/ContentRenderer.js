'use strict';

// ContentRenderer - Handles rendering Bible content to the DOM

class ContentRenderer {
	constructor(contentElementId, noteChecker, versionManager, navigationManager, modalManager) {
		this.contentElement = document.getElementById(contentElementId);
		this.noteChecker = noteChecker;
		this.versionManager = versionManager;
		this.navigationManager = navigationManager;
		this.modalManager = modalManager;
	}

	_buildVerseMap(verses, source) {
		const map = new Map();
		if (source === 'db') {
			const list = verses.rows || verses;
			const count = verses.rows ? verses.rows.length : verses.length;
			for (let i = 0; i < count; i++) {
				const verse = list.item ? list.item(i) : list[i];
				map.set(parseInt(verse.verse), verse.text);
			}
		} else {
			verses.forEach(verse => {
				const temp = document.createElement('div');
				temp.innerHTML = verse.verseText;
				map.set(parseInt(verse.verseNumber), temp.textContent || temp.innerText);
			});
		}
		return map;
	}

	getScrollContainer() {
		return document.querySelector('.content-area');
	}

	renderChapterFromDB(bookName, chapter, verses) {
		const currentBook = this.versionManager.findBookById(this.navigationManager.getCurrentBook());
		const bookId = currentBook ? currentBook.id : '';

		// Clear content area
		this.contentElement.innerHTML = '';

		// Render chapter header
		Template.render('chapterHeaderTemplate', 'bibleHeader', {
			bookName: bookName,
			chapter: chapter
		}, false);

		// Render verses
		const versesData = [];
		const versesList = verses.rows || verses;
		const verseCount = verses.rows ? verses.rows.length : verses.length;
		for (let i = 0; i < verseCount; i++) {
			const verse = versesList.item ? versesList.item(i) : versesList[i];
			versesData.push({
				bookId: bookId,
				chapter: chapter,
				verseNumber: verse.verse,
				noteIcon: this.hasNoteIcon(bookId, chapter, verse.verse),
				verseText: verse.text
			});
		}

		Template.render('verseTemplate', 'bibleText', versesData, true);
		document.getElementById('mainPlaceholder').classList.add('hidden');

		// Add RTL class if needed
		const version = this.versionManager.getVersion(this.navigationManager.getCurrentVersion());
		const bibleTextEl = document.getElementById('bibleText');
		if (this.isRTLVersion(version)) {
			bibleTextEl.classList.add('rtl-text');
		} else {
			bibleTextEl.classList.remove('rtl-text');
		}

		this.scrollToTop();
		this.attachVerseListeners();
	}

	async renderChapterFromAPI(bookName, chapter, content) {
		const currentBook = this.versionManager.findBookById(this.navigationManager.getCurrentBook());
		const bookId = currentBook ? currentBook.id : '';

		// Clear content area
		this.contentElement.innerHTML = '';

		// Render chapter header
		Template.render('chapterHeaderTemplate', 'bibleHeader', {
			bookName: bookName,
			chapter: chapter,
		}, false);

		// Parse API content and extract verses
		const versesData = this.parseAPIContent(content, bookId, chapter);

		// Render verses
		Template.render('verseTemplate', 'bibleText', versesData, true);
		document.getElementById('mainPlaceholder').classList.add('hidden');

		// Add RTL class if needed
		const version = this.versionManager.getVersion(this.navigationManager.getCurrentVersion());
		const bibleTextEl = document.getElementById('bibleText');
		if (this.isRTLVersion(version)) {
			bibleTextEl.classList.add('rtl-text');
		} else {
			bibleTextEl.classList.remove('rtl-text');
		}

		this.scrollToTop();
		this.attachVerseListeners();
	}

	parseAPIContent(content, bookId, chapter) {
		const versesData = [];
		const tempDiv = document.createElement('div');
		tempDiv.innerHTML = content;

		const verseParagraphs = tempDiv.querySelectorAll('p.verse');

		verseParagraphs.forEach(versePara => {
			const verseNumberSpan = versePara.querySelector('.verse-number');
			if (verseNumberSpan) {
				const verseNumber = verseNumberSpan.textContent.trim();

				// Get verse text (everything except the verse number span)
				const verseTextClone = versePara.cloneNode(true);
				const verseNumToRemove = verseTextClone.querySelector('.verse-number');
				if (verseNumToRemove) {
					verseNumToRemove.remove();
				}
				const verseText = verseTextClone.innerHTML.trim().replace(/^&nbsp;/, '');

				versesData.push({
					bookId: bookId,
					chapter: chapter,
					verseNumber: verseNumber,
					noteIcon: this.hasNoteIcon(bookId, chapter, verseNumber),
					verseText: verseText
				});
			}
		});

		return versesData;
	}

	attachVerseListeners() {
		const verses = this.contentElement.querySelectorAll('.verse[data-verse]');

		verses.forEach(verseEl => {
			// Mobile: long-press
			let longPressTimer;
			let touchStarted = false;
			let touchEvent = null;

			verseEl.addEventListener('touchstart', (e) => {
				touchStarted = true;
				touchEvent = e;
				longPressTimer = setTimeout(() => {
					if (touchStarted) {
						e.preventDefault();
						this.handleVerseLongPress(verseEl, touchEvent);
					}
				}, 500);
			});

			verseEl.addEventListener('touchend', () => {
				touchStarted = false;
				clearTimeout(longPressTimer);
			});

			verseEl.addEventListener('touchmove', () => {
				touchStarted = false;
				clearTimeout(longPressTimer);
			});

			// Desktop: right-click
			verseEl.addEventListener('contextmenu', (e) => {
				e.preventDefault();
				this.handleVerseLongPress(verseEl, e);
			});
		});
	}

	handleVerseLongPress(verseEl, event) {
		const bookId = verseEl.getAttribute('data-book');
		const chapter = verseEl.getAttribute('data-chapter');
		const verse = verseEl.getAttribute('data-verse');

		// Store selected verse in app state
		app.verseActionManager.setSelectedVerse(parseInt(bookId), parseInt(chapter), parseInt(verse));

		// Get click/touch position
		let clientX, clientY;
		if (event.type === 'contextmenu') {
			// Desktop right-click
			clientX = event.clientX;
			clientY = event.clientY;
		} else if (event.changedTouches && event.changedTouches.length > 0) {
			// Mobile touch
			clientX = event.changedTouches[0].clientX;
			clientY = event.changedTouches[0].clientY;
		} else {
			// Fallback - center of verse element
			const rect = verseEl.getBoundingClientRect();
			clientX = rect.left + rect.width / 2;
			clientY = rect.top + rect.height / 2;
		}

		// Show verse menu at click position
		this.modalManager.showVerseMenu(clientX, clientY);
	}

	// Not called. Commenting out.
	// formatJSONArrayContent(jsonArray, transformConfig) {
	// 	let html = '';

	// 	// Parse if it's a string
	// 	const verses = typeof jsonArray === 'string' ? JSON.parse(jsonArray) : jsonArray;

	// 	verses.forEach(verseObj => {
	// 		let verseNum = verseObj[transformConfig.verseField];
	// 		let verseText = verseObj[transformConfig.textField];

	// 		// Apply text transforms if specified
	// 		if (transformConfig.transforms) {
	// 			transformConfig.transforms.forEach(transform => {
	// 				verseText = verseText.replace(transform.find, transform.replace);
	// 			});
	// 		}

	// 		html += `<p class="verse"><span class="verse-number">${verseNum}</span>&nbsp;${verseText}</p>`;
	// 	});

	// 	return html;
	// }

	applyContentTransforms(content, transformConfig) {
		if (transformConfig.type === 'html' && transformConfig.transforms) {
			transformConfig.transforms.forEach(transform => {
				content = content.replace(transform.find, transform.replace);
			});
		}

		return content;
	}

	renderError(message) {
		Template.render('errorTemplate', 'bibleText', { message: message });
		// this.contentElement.innerHTML = `<div class="placeholder">${message}</div>`;
	}

	renderDatabaseError() {
		this.renderError('Database tables not found.<br>Please ensure the database file is properly configured.');
	}

	renderNoVersesError() {
		this.renderError('No verses found for this chapter.<br>Please check the database.');
	}

	scrollToTop() {
		const contentArea = document.querySelector('.content-area');
		if (contentArea) {
			contentArea.scrollTop = 0;
		}
	}

	scrollToVerse(verseNumber, instant = false) {
		const verseElements = document.querySelectorAll('.verse-number');
		let targetVerse = null;

		for (let i = 0; i < verseElements.length; i++) {
			const verseNum = parseInt(verseElements[i].textContent.trim());
			if (verseNum === verseNumber) {
				targetVerse = verseElements[i];
				break;
			}
		}

		if (targetVerse) {
			const verseParagraph = targetVerse.closest('.verse') || targetVerse.parentElement;

			// Add highlight class
			verseParagraph.classList.add('verse-highlight');
			setTimeout(() => {
				verseParagraph.classList.remove('verse-highlight');
			}, 2000);

			// Scroll with or without animation
			verseParagraph.scrollIntoView({ 
				behavior: instant ? 'auto' : 'smooth', 
				block: 'center' 
			});
		} else {
			this.scrollToTop();
		}
	}

	setFontSize(fontSize) {
		this.contentElement.style.fontSize = fontSize + 'px';
	}

	hasNoteIcon(bookId, chapter, verse) {
		return this.noteChecker(bookId, chapter, verse) ? HTML.NOTE_ICON : '';
	}

	updateVerseNoteIcon(bookId, chapter, verse) {
		const verseEls = document.querySelectorAll(
			`.verse[data-book="${bookId}"][data-chapter="${chapter}"][data-verse="${verse}"]`
		);
		verseEls.forEach(verseEl => {
			// Remove existing icon if present
			const existingIcon = verseEl.querySelector('.note-icon');
			if (existingIcon) existingIcon.remove();

			// Add icon if note exists
			const iconHtml = this.hasNoteIcon(bookId, chapter, verse);
			if (iconHtml) {
				const verseNumber = verseEl.querySelector('.verse-number');
				if (verseNumber) {
					verseNumber.insertAdjacentHTML('afterend', iconHtml);
				}
			}
		});
	}

	renderChapterInterlinear(chapter, versesA, versesB, sourceA, sourceB, versionAbbr) {
		const currentBook = this.versionManager.findBookById(this.navigationManager.getCurrentBook());
		const bookId = currentBook ? currentBook.id : '';

		// Clear content area
		this.contentElement.innerHTML = '';
		const displayBookName = getBookName(bookId);

		// Render interlinear header with dynamic version name
		Template.render('chapterHeaderTemplate', 'bibleHeader', {
			bookName: displayBookName,
			chapter: chapter,
			versionName: `${versionAbbr || APP.INTERLINEAR_FALLBACK_PRIMARY} / ABT`
		}, false);

		// Convert both to uniform format
		const mapVersionA = this._buildVerseMap(versesA, sourceA);
		const mapVersionB = this._buildVerseMap(versesB, sourceB);

		// Find max verse number
		const maxVerseA = mapVersionA.size > 0 ? Math.max(...mapVersionA.keys()) : 0;
		const maxVerseB = mapVersionB.size > 0 ? Math.max(...mapVersionB.keys()) : 0;
		const maxVerses = Math.max(maxVerseA, maxVerseB);

		// Build verse pairs data
		const versePairsData = [];
		for (let verseNum = 1; verseNum <= maxVerses; verseNum++) {
			// Check if verse exists in each version
			const hasVerseA = mapVersionA.has(verseNum);
			const hasVerseB = mapVersionB.has(verseNum);

			// don't show the verse if both versions omit
			if (hasVerseA || hasVerseB) {
				// Get text or placeholder
				const textVersionA = hasVerseA 
					? mapVersionA.get(verseNum) 
					: HTML.VERSE_OMIT;
				const textVersionB = hasVerseB 
					? mapVersionB.get(verseNum) 
					: HTML.VERSE_OMIT;
	
				const noteIcon = this.hasNoteIcon(bookId, chapter, verseNum);
	
				versePairsData.push({
					bookId: bookId,
					chapter: chapter,
					verseNumber: verseNum,
					noteIcon: noteIcon,
					verseTextA: textVersionA,
					verseTextB: textVersionB
				});
			}
		}

		Template.render('interlinearVerseTemplate', 'bibleText', versePairsData, true);
		document.getElementById('mainPlaceholder').classList.add('hidden');

		// Add RTL class if needed (check primary version)
		const primaryVersionAbbr = versionAbbr || APP.INTERLINEAR_FALLBACK_PRIMARY;
		const primaryVersion = this.versionManager.getVersion(primaryVersionAbbr);
		const bibleTextEl = document.getElementById('bibleText');
		if (this.isRTLVersion(primaryVersion)) {
			bibleTextEl.classList.add('rtl-text');
		} else {
			bibleTextEl.classList.remove('rtl-text');
		}

		this.scrollToTop();
		this.attachVerseListeners();
	}

	isRTLVersion(version) {
		if (!version) return false;

		// Check for explicit textDirection property (future-proofing)
		if (version.textDirection === 'rtl') return true;

		// Check for RTL language codes
		const rtlLanguages = ['he', 'ar'];
		return rtlLanguages.includes(version.languageCode);
	}
}