'use strict';

class VerseActionManager extends Manager {
	constructor(notesStore, modalManager, versionManager, navigationManager, contentRenderer) {
		super();
		this.notesStore = notesStore;
		this.modalManager = modalManager;
		this.versionManager = versionManager;
		this.navigationManager = navigationManager;
		this.contentRenderer = contentRenderer;
		// Internal state
		this.selectedVerse = null;
		this.selectedVerseText = '';
		this.noteDialogMode = 'note'; // 'note' | 'suggestion'
		this.rawVerses = {};
	}

	showNoteEditor(fromList = false) {
		if (!this.selectedVerse) return;
		if (!fromList) {
			closeModal(MODAL.VERSEMENU);
		}

		this.noteDialogMode = 'note';

		const { bookId, chapter, verse } = this.selectedVerse;
		
		// Try to find book in current version first
		const currentBook = this.versionManager.findBookById(bookId);

		// Use standard English name if book doesn't exist in current version
		const bookName = currentBook ? currentBook.name : getBookName(bookId);
		
		const reference = `${bookName} ${chapter}:${verse}`;

		// Get verse text from DOM if available (and not from list)
		let verseText = '';
		if (!fromList) {
			const verseEl = document.querySelector(
				`.verse[data-book="${bookId}"][data-chapter="${chapter}"][data-verse="${verse}"]`
			);

			if (verseEl) {
				const verseClone = verseEl.cloneNode(true);
				// Remove verse number
				const verseNumber = verseClone.querySelector('.verse-number');
				if (verseNumber) verseNumber.remove();
				// Remove note icon
				const noteIcon = verseClone.querySelector('.note-icon');
				if (noteIcon) noteIcon.remove();

				verseText = verseClone.textContent.trim().replace(/^\s+/, '');
			}
		}

		// Store verse text in app state
		this.selectedVerseText = verseText;

		// Update UI for note mode
		document.getElementById('noteTitle').textContent = 'Verse Notes';
		document.getElementById('noteLabel').textContent = 'Commentary for';
		document.getElementById('noteReference').textContent = reference;
		const saveBtn = document.getElementById('noteSaveButton');
		saveBtn.innerText = 'Save Note';
		saveBtn.classList.remove('ion-paper-airplane');
		saveBtn.classList.add('ion-edit');
		const cancelBtn = document.getElementById('noteCancelButton');
		cancelBtn.innerText = 'Clear Note';
		cancelBtn.classList.remove('ion-close');
		cancelBtn.classList.add('ion-trash-a');
		document.getElementById('noteSendSuggestionButton').classList.remove('hidden');

		// Show/hide Copy button based on whether verse is in current view
		const copyBtn = document.getElementById('noteCopyButton');
		if (copyBtn) {
			if (fromList || !verseText) {
				copyBtn.classList.add('hidden');
			} else {
				copyBtn.classList.remove('hidden');
			}
		}

		const existingNote = this.notesStore.getNote(bookId, chapter, verse);
		const textarea = document.getElementById('noteText');

		if (existingNote) {
			textarea.value = existingNote;
			textarea.placeholder = '';
		} else {
			textarea.value = '';
			textarea.placeholder = 'Enter your notes here...';
		}

		// Show/hide "Go to Verse" button based on whether we're editing from list
		const gotoVerseBtn = document.getElementById('noteGotoVerseButton');
		if (gotoVerseBtn) {
			if (fromList) {
				gotoVerseBtn.classList.remove('hidden');
			} else {
				gotoVerseBtn.classList.add('hidden');
			}
		}

		this.modalManager.show(MODAL.NOTE);
	}

	showSuggestEdit() {
		if (!this.selectedVerse) return;
		closeModal(MODAL.VERSEMENU);

		this.noteDialogMode = 'suggestion';

		const { bookId, chapter, verse } = this.selectedVerse;
		const currentBook = this.versionManager.findBookById(bookId);
		const reference = `${currentBook.name} ${chapter}:${verse}`;

		// Get verse text from DOM
		let verseText = '';
		const verseEl = document.querySelector(
			`.verse[data-book="${bookId}"][data-chapter="${chapter}"][data-verse="${verse}"]`
		);

		if (verseEl) {
			const verseClone = verseEl.cloneNode(true);
			// Remove verse number
			const verseNumber = verseClone.querySelector('.verse-number');
			if (verseNumber) verseNumber.remove();
			// Remove note icon
			const noteIcon = verseClone.querySelector('.note-icon');
			if (noteIcon) noteIcon.remove();

			verseText = verseClone.textContent.trim().replace(/^\s+/, '');
		}

		// Store verse text in app state
		this.selectedVerseText = verseText;

		// Update UI for suggestion mode
		document.getElementById('noteTitle').textContent = 'Suggest Verse Edit';
		document.getElementById('noteLabel').textContent = 'Suggestion for';
		document.getElementById('noteReference').textContent = reference;
		const saveBtn = document.getElementById('noteSaveButton');
		saveBtn.innerText = 'Send Suggestion';
		saveBtn.classList.remove('ion-edit');
		saveBtn.classList.add('ion-paper-airplane');
		const cancelBtn = document.getElementById('noteCancelButton');
		cancelBtn.innerText = 'Cancel';
		cancelBtn.classList.remove('ion-trash-a');
		cancelBtn.classList.add('ion-close');
		document.getElementById('noteCopyButton').classList.remove('hidden');
		document.getElementById('noteSendSuggestionButton').classList.add('hidden');

		const textarea = document.getElementById('noteText');
		textarea.value = '';
		textarea.placeholder = 'Enter your suggested edit here...';

		this.modalManager.show(MODAL.NOTE);
	}

	openNoteFromIcon(event, iconElement) {
		event.stopPropagation(); // Prevent verse long-press

		const verseEl = iconElement.closest('.verse');
		const bookId = parseInt(verseEl.getAttribute('data-book'));
		const chapter = parseInt(verseEl.getAttribute('data-chapter'));
		const verse = parseInt(verseEl.getAttribute('data-verse'));

		this.selectedVerse = { bookId, chapter, verse };
		this.showNoteEditor();
	}

	async noteSave() {
		if (!this.selectedVerse) return;

		const { bookId, chapter, verse } = this.selectedVerse;
		const text = document.getElementById('noteText').value;

		if (this.noteDialogMode === 'suggestion') {
			// Handle suggestion submission
			await this.sendSuggestion(bookId, chapter, verse, text);
			this.noteDialogMode = 'note';  // Reset mode after suggestion
		} else {
			// Handle note saving
			if (!text || !text.trim()) {
				this.notesStore.clearNote(bookId, chapter, verse);
				closeModal(MODAL.NOTE);
			} else {
				this.notesStore.setNote(bookId, chapter, verse, text);
				closeModal(MODAL.NOTE);
			}

			// Check if we're editing from the All Notes list
			const isFromAllNotesList = this.modalManager.isVisible(MODAL.ALLNOTES);

			if (isFromAllNotesList) {
				// Check if this note is from the currently viewed chapter
				const currentBookId = this.navigationManager.getCurrentBook();
				const currentChapter = this.navigationManager.getCurrentChapter();
				const isCurrentChapter = (bookId === currentBookId && chapter === currentChapter);

				if (isCurrentChapter) {
					this.contentRenderer.updateVerseNoteIcon(bookId, chapter, verse);
				}

				// Refresh the All Notes list
				showAllNotes();
			} else {
				// Normal note editing from chapter view - update icon in place
				this.contentRenderer.updateVerseNoteIcon(bookId, chapter, verse);
			}
		}
	}

	async noteCancel() {
		if (!this.selectedVerse) return;

		if (this.noteDialogMode === 'suggestion') {
			// Just close for suggestions
			closeModal(MODAL.NOTE);
			return;
		}

		// For notes - confirm deletion
		const { bookId, chapter, verse } = this.selectedVerse;

		if (!confirm('Delete this note? This cannot be undone.')) {
			return;
		}

		this.notesStore.clearNote(bookId, chapter, verse);
		document.getElementById('noteText').value = '';
		closeModal(MODAL.NOTE);
		openToast('Note deleted');

		// Check if we're editing from the All Notes list
		const isFromAllNotesList = this.modalManager.isVisible(MODAL.ALLNOTES);

		if (isFromAllNotesList) {
			// Check if this note is from the currently viewed chapter
			const currentBookId = this.navigationManager.getCurrentBook();
			const currentChapter = this.navigationManager.getCurrentChapter();
			const isCurrentChapter = (bookId === currentBookId && chapter === currentChapter);

			if (isCurrentChapter) {
				this.contentRenderer.updateVerseNoteIcon(bookId, chapter, verse);
			}

			// Refresh the All Notes list
			showAllNotes();
		} else {
			// Normal note deletion from chapter view - update icon in place
			this.contentRenderer.updateVerseNoteIcon(bookId, chapter, verse);
		}
	}

	async noteSendSuggestion() {
		if (!this.selectedVerse) return;

		const { bookId, chapter, verse } = this.selectedVerse;
		const text = document.getElementById('noteText').value;

		if (!text || !text.trim()) {
			openToast('Please enter a suggestion');
			return;
		}

		await this.sendSuggestion(bookId, chapter, verse, text, true);
	}

	copyVerseText() {
		const { bookId, chapter, verse } = this.selectedVerse;
		
		// For suggestion mode, use raw text with markup (if available)
		if (this.noteDialogMode === 'suggestion') {
			// Check if we have raw verses stored
			if (this.rawVerses && this.rawVerses[verse]) {
				document.getElementById('noteText').value = this.rawVerses[verse];
				return;
			}
			
			// Fallback: use display text if raw not available
			openToast('Raw text not available, using display text');
		}
		
		// For note mode, use display text (markup already removed)
		if (!this.selectedVerseText || this.selectedVerseText.trim() === '') {
			openToast('Verse text not available');
			return;
		}

		document.getElementById('noteText').value = this.selectedVerseText;
	}

	async sendSuggestion(bookId, chapter, verse, suggestionText, keepOpen = false) {
		if (!suggestionText || !suggestionText.trim()) {
			openToast('Please enter a suggestion');
			return;
		}

		// Get current verse text
		const verseEl = document.querySelector(
			`.verse[data-book="${bookId}"][data-chapter="${chapter}"][data-verse="${verse}"]`
		);

		let currentVerseText = 'Could not retrieve current text';
		if (verseEl) {
			const verseClone = verseEl.cloneNode(true);
			const verseNumber = verseClone.querySelector('.verse-number');
			if (verseNumber) verseNumber.remove();
			const noteIcon = verseClone.querySelector('.note-icon');
			if (noteIcon) noteIcon.remove();
			currentVerseText = verseClone.textContent.trim().replace(/^\s+/, '');
		}

		loading('Sending suggestion...');

		try {
			// Submit to BOTH services in parallel
			await submitToProxy('suggestion', {
				bookid: bookId,
				chapter: chapter,
				verse: verse,
				current: currentVerseText,
				suggestion: suggestionText.trim()
			});

			closeLoading();
			if (!keepOpen) {
				closeModal(MODAL.NOTE);
				document.getElementById('noteText').value = '';
			}
			openToast('Suggestion sent successfully! Thank you.');
		} catch (error) {
			closeLoading();
			console.error('Suggestion submission failed:', error);
			openToast(error.message);
		}
	}

	setSelectedVerse(bookId, chapter, verse) {
		this.selectedVerse = { bookId, chapter, verse };
	}

	setRawVerses(rawVerses) {
		this.rawVerses = rawVerses;
	}

	setRawVerse(verse, text) {
		this.rawVerses[verse] = text;
	}

	editNoteFromList(key) {
		const [bookId, chapter, verse] = key.split('-').map(Number);

		this.selectedVerse = { bookId, chapter, verse };
		this.showNoteEditor(true);
	}

	async noteGotoVerse() {
		if (!this.selectedVerse) return;

		const { bookId, chapter, verse } = this.selectedVerse;

		// Check if book exists in current version
		const currentBook = this.findBookById(bookId);
		
		// Disable interlinear mode when navigating
		if (app.configManager.getValue('interlinearMode')) {
			this.controller.onDisableInterlinear();
		}

		if (!currentBook) {
			// Book doesn't exist in current version - switch to ABT
			const standardBookName = getBookName(bookId);
			
			if (!confirm(
				`${standardBookName} is not available in ${this.navigationManager.getCurrentVersion()}.\n\n` +
				`Switch to ABT to view this verse?`
			)) {
				return;
			}

			// Switch to ABT
			const abtVersion = this.versionManager.getVersion('ABT');
			if (!abtVersion) {
				openToast('ABT version not available');
				return;
			}

			loading('Switching to ABT...');

			try {
				// Load books for ABT to ensure we have the correct book structure
				await this.versionManager.loadBooksForVersion(abtVersion);

				// Set the version
				this.navigationManager.setCurrentVersion('ABT');
				this.navigationManager.saveSettings();
				
				closeLoading();
			} catch (error) {
				closeLoading();
				openToast('Error switching to ABT: ' + error.message);
				return;
			}
		}

		// Close both modals
		closeModal(MODAL.NOTE);
		closeModal(MODAL.ALLNOTES);

		this.navigationManager.navigateToChapter(bookId, chapter);
		app.chapterViewManager.updateDisplay();
		await this.controller.onLoadCurrentChapter();
	}
}