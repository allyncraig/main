'use strict';

class NotesStore {
	constructor() {
		this.NOTES_KEY = 'verse_notes';
	}

	getNotes() {
		try {
			const notes = localStorage.getItem(this.NOTES_KEY);
			return notes ? JSON.parse(notes) : {};
		} catch (e) {
			console.error('NotesStore: Error getting notes', e);
			return {};
		}
	}

	getNote(bookId, chapter, verse) {
		const notes = this.getNotes();
		return notes[`${bookId}-${chapter}-${verse}`] || null;
	}

	setNote(bookId, chapter, verse, text) {
		const notes = this.getNotes();
		const key = `${bookId}-${chapter}-${verse}`;
		if (text && text.trim()) {
			notes[key] = text.trim();
		} else {
			delete notes[key];
		}
		localStorage.setItem(this.NOTES_KEY, JSON.stringify(notes));
	}

	clearNote(bookId, chapter, verse) {
		const notes = this.getNotes();
		delete notes[`${bookId}-${chapter}-${verse}`];
		localStorage.setItem(this.NOTES_KEY, JSON.stringify(notes));
	}

	hasNote(bookId, chapter, verse) {
		const notes = this.getNotes();
		return !!notes[`${bookId}-${chapter}-${verse}`];
	}

	setAllNotes(notesObject) {
		localStorage.setItem(this.NOTES_KEY, JSON.stringify(notesObject));
	}

	clearAllNotes() {
		localStorage.removeItem(this.NOTES_KEY);
	}
}