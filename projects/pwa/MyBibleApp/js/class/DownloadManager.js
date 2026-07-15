'use strict';

// DownloadManager - Handles downloading and installing Bible versions

class DownloadManager extends Manager {
	constructor(databaseManager, storageManager, versionManager, navigationManager) {
		super();
		this.databaseManager = databaseManager;
		this.storageManager = storageManager;
		this.versionManager = versionManager;
		this.navigationManager = navigationManager;
		this.downloadInProgress = false;
	}

	async downloadAndInstallBible(url, versionCode, progressCallback, expectedChecksum = null) {
		if (this.downloadInProgress) {
			throw new Error('Download already in progress');
		}

		this.downloadInProgress = true;

		try {
			// Step 1: Download ZIP file
			progressCallback(`Downloading ${versionCode}.zip...`, 0);

			// Detect environment
			const isPWA = !window.cordova;
			let zipBlob;

			if (isPWA) {
				// PWA: Use standard fetch
				const response = await fetch(url + versionCode + '.zip');
				if (!response.ok) {
					throw new Error(`Download failed: ${response.status}`);
				}
				zipBlob = await response.blob();
			} else {
				// Cordova: Use existing method
				zipBlob = await HTTPClient.getBlob(url + versionCode + '.zip');
			}

			// Verify size
			if (!zipBlob || zipBlob.size === 0) {
				throw new Error('Downloaded file is empty');
			}

			// Step 2: Verify checksum if provided
			if (expectedChecksum) {
				progressCallback('Verifying download...', 35);
				const checksum = await this.calculateCRC32(zipBlob);
				// console.log('Expected CRC: %s Calculated CRC: %s', expectedChecksum, checksum);

				if (checksum !== expectedChecksum.toLowerCase()) {
					throw new Error('Download corrupted: checksum mismatch');
				}
				// console.log('✓ Download verified');
			}

			progressCallback('Unzipping...', 40);

			// Step 3: Unzip in memory
			const zip = new JSZip();
			const unzipped = await zip.loadAsync(zipBlob);

			progressCallback('Reading files...', 60);

			// Step 4: Extract CSV contents
			const booksCSV = await unzipped.file(`${versionCode}_books.csv`).async('text');
			const versesCSV = await unzipped.file(`${versionCode}_verses.csv`).async('text');

			// console.log('Files extracted, importing to database...');
			progressCallback('Importing to database...', 75);

			// Step 5: Import to database
			await this.importToDatabase(versionCode, booksCSV, versesCSV, (message, percent) => {
				const progress = 75 + (percent * 0.25);
				progressCallback(message, progress);
			});

			progressCallback('Installation complete!', 100);

			this.downloadInProgress = false;
			return { success: true };

		} catch (error) {
			this.downloadInProgress = false;
			console.error('Download and install failed:', error);
			throw error;
		}
	}

	// Simple CRC32 implementation
	calculateCRC32(blob) {
		return new Promise((resolve) => {
			const reader = new FileReader();
			reader.onload = function(e) {
				const data = new Uint8Array(e.target.result);
				let crc = 0xFFFFFFFF;

				for (let i = 0; i < data.length; i++) {
					crc = crc ^ data[i];
					for (let j = 0; j < 8; j++) {
						crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
					}
				}

				const result = (crc ^ 0xFFFFFFFF) >>> 0;
				resolve(result.toString(16).padStart(8, '0'));
			};
			reader.readAsArrayBuffer(blob);
		});
	}

	async importToDatabase(versionCode, booksCSV, versesCSV, progressCallback) {
		// Open database if not already open
		if (!this.databaseManager.db) {
			await this.databaseManager.open();
		}

		// Create tables for this version
		await this.databaseManager.createTablesForVersion(versionCode);
		progressCallback('Tables created', 5);

		// Parse and import books
		const bookRows = this.databaseManager.parseCSV(booksCSV);
		await this.databaseManager.insertBooksForVersion(versionCode, bookRows.slice(1)); // Skip header
		progressCallback('Books imported', 20);

		// Parse and import verses
		const verseRows = this.databaseManager.parseCSV(versesCSV);
		await this.databaseManager.insertVersesForVersion(versionCode, verseRows.slice(1), progressCallback);

		// Mark this version as initialized
		this.storageManager.setVersionInitialized(versionCode, true);
	}

	async importVersesBatch(versionCode, rows, progressCallback) {
		return new Promise((resolve, reject) => {
			const batchSize = 100;
			let currentBatch = 0;
			const totalBatches = Math.ceil(rows.length / batchSize);

			const insertNextBatch = () => {
				const start = currentBatch * batchSize;
				const end = Math.min(start + batchSize, rows.length);

				if (start >= rows.length) {
					// console.log('All verses inserted');
					progressCallback('Verses imported', 100);
					resolve();
					return;
				}

				const percentage = Math.round((currentBatch / totalBatches) * 100);
				progressCallback(`Importing verses... ${percentage}%`, percentage);

				this.databaseManager.db.transaction(
					(tx) => {
						for (let i = start; i < end; i++) {
							const row = rows[i];
							tx.executeSql(
								`INSERT INTO ${versionCode}_verses (id, book_id, chapter, verse, text) VALUES (?, ?, ?, ?, ?);`,
								[row[0], row[1], row[2], row[3], row[4]]
							);
						}
					},
					(error) => {
						console.error('Error inserting batch:', error);
						currentBatch++;
						insertNextBatch();
					},
					() => {
						// console.log(`Batch ${currentBatch + 1} inserted`);
						currentBatch++;
						insertNextBatch();
					}
				);
			};

			insertNextBatch();
		});
	}

	async deleteVersion(abbreviation) {
		// Check if this is the current version
		const currentVersion = this.navigationManager.getCurrentVersion();
		const needsSwitch = (currentVersion === abbreviation);

		// Delete the database tables
		await this.databaseManager.deleteVersion(abbreviation);

		// If this was the current version, switch to KJV
		if (needsSwitch) {
			this.navigationManager.setCurrentVersion('KJV');
			this.navigationManager.saveSettings();

			// Reload books and chapter for KJV
			const kjvVersion = this.versionManager.getVersion('KJV');
			this.controller.onUpdateDisplay();
			if (kjvVersion) {
				await this.versionManager.loadBooksForVersion(kjvVersion);
				await this.controller.onLoadCurrentChapter();
			}
		}

		return { success: true, switchedToKJV: needsSwitch };
	}

	async loadOfflineVersion(code) {
		try {
			const versions = await app.versionSelectorManager.getAvailableVersions();
			const version = versions.find(item => item.abbreviation === code);

			// Check if it actually has a local DB copy (not just API availability)
			if (version && version.hasLocalCopy === true) {
				openToast(`The selected version (${code}) has already been downloaded.`);
				return;
			}

			loading('Preparing download...');

			await this.downloadAndInstallBible(APP.BIBLE_APP_URL, code, (message, progress) => {
				// Update loading message with progress
				const e = document.getElementById('lmsg');
				if (e) {
					e.textContent = `${message} (${Math.round(progress)}%)`;
				}
			});

			closeLoading();

			// Show success message
			openToast(`${code} Bible installed successfully!`);
			app.versionManager.invalidateResolvedSourceCache(code);

			// Reload app to show Bible in version selector
			await app.chapterViewManager.loadBooksAndChapter();

			// Refresh the download modal to show updated status
			await this.controller.onShowDownload();

		} catch (error) {
			closeLoading();
			alert(`Failed to download ${code}: ` + error.message);
		}
	}

	async handleDownloadItemClick(code, isDownloaded) {
		if (isDownloaded) {
			// Show confirmation dialog
			if (confirm(`Delete ${code} from local storage?\n\nThis will remove the offline version and cannot be undone.`)) {
				closeModal(MODAL.DOWNLOAD);
				loading(`Deleting ${code}...`);

				try {
					const result = await this.deleteVersion(code);
					closeLoading();
					app.versionManager.invalidateResolvedSourceCache(code);

					if (result.switchedToKJV) {
						openToast(`${code} deleted. Switched to KJV.`);
					} else {
						openToast(`${code} deleted successfully.`);
					}

					// Refresh the download modal to show updated status
					await this.controller.onShowDownload();
				} catch (error) {
					closeLoading();
					alert(`Failed to delete ${code}: ${error.message}`);
				}
			}
		} else {
			// Existing download logic
			await this.loadOfflineVersion(code);
		}
	}
}