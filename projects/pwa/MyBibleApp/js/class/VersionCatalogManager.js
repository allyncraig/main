'use strict';

class VersionCatalogManager extends Manager {
    constructor(versionCatalogStore, configManager, navigationManager, versionSelectorManager, modalManager) {
        super();
        this.versionCatalogStore = versionCatalogStore;
        this.configManager = configManager;
        this.navigationManager = navigationManager;
        this.versionSelectorManager = versionSelectorManager;
        this.modalManager = modalManager;
    }

    async show() {
        const catalog = await this.versionCatalogStore.getOrFetch();
        if (!catalog) {
            this.modalManager.showError('Could not load version catalog. Please try again later.');
            return;
        }
        this._render(catalog);
        this.modalManager.show(MODAL.VERSIONCATALOG);
    }

    _render(catalog) {
        const container = document.getElementById('versionCatalogList');
        if (!container) return;

        container.innerHTML = '';
        const enabledVersions = this.configManager.getEnabledVersions();

        // Group versions by language
        const languageMap = new Map();
        catalog.forEach(version => {
            const langCode = version.languageCode || 'unknown';
            const langName = version.languageName || langCode.toUpperCase();
            if (!languageMap.has(langCode)) {
                languageMap.set(langCode, { name: langName, versions: [] });
            }
            languageMap.get(langCode).versions.push(version);
        });

        // Sort languages alphabetically, English first
        const sortedLangs = [...languageMap.entries()].sort(([aCode, aData], [bCode, bData]) => {
            if (aCode === 'en') return -1;
            if (bCode === 'en') return 1;
            return aData.name.localeCompare(bData.name);
        });

        sortedLangs.forEach(([langCode, langData]) => {
            const group = this._createLanguageGroup(langData.name, langData.versions, enabledVersions);
            container.appendChild(group);
        });
    }

    _createLanguageGroup(langName, versions, enabledVersions) {
        const group = document.createElement('div');
        group.className = 'catalog-language-group';

        const header = document.createElement('button');
        header.className = 'catalog-language-header';
        header.innerHTML = `<span class="catalog-language-name">${langName}</span>`;

        const versionList = document.createElement('div');
        versionList.className = 'catalog-version-list ' + CLASS.HIDDEN;

        versions.forEach(version => {
            versionList.appendChild(this._createVersionItem(version, enabledVersions));
        });

        header.addEventListener(EVENT.CLICK, () => {
            const isHidden = versionList.classList.contains(CLASS.HIDDEN);
            versionList.classList.toggle(CLASS.HIDDEN, !isHidden);
            const chevron = header.querySelector('.catalog-chevron');
            chevron.classList.toggle('ion-chevron-down', isHidden);
            chevron.classList.toggle('ion-chevron-right', !isHidden);
        });

        group.appendChild(header);
        group.appendChild(versionList);
        return group;
    }

    _createVersionItem(version, enabledVersions) {
        const item = document.createElement('div');
        item.className = 'catalog-version-item';

        const isProtected = !!version.protected;
        const isEnabled = enabledVersions.includes(version.abbreviation);
        const inputId = `catalog-v-${version.abbreviation}`;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'catalog-version-checkbox';
        checkbox.id = inputId;
        checkbox.checked = isEnabled;
        checkbox.disabled = isProtected;
        checkbox.addEventListener('change', () => {
            this._handleCheckboxChange(version.abbreviation, checkbox.checked);
        });

        const label = document.createElement('label');
        label.htmlFor = inputId;
        label.className = 'catalog-version-label';

        const abbr = document.createElement('span');
        abbr.className = 'catalog-version-abbr';
        abbr.textContent = version.abbreviation;

        const name = document.createElement('span');
        name.className = 'catalog-version-name';
        name.textContent = version.name;

        label.appendChild(abbr);
        label.appendChild(name);

        if (isProtected) {
            const badge = document.createElement('span');
            badge.className = 'catalog-protected-badge';
            badge.textContent = 'Required';
            label.appendChild(badge);
        }

        item.appendChild(checkbox);
        item.appendChild(label);
        return item;
    }

    _handleCheckboxChange(abbreviation, isNowEnabled) {
        if (isNowEnabled) {
            this.configManager.enableVersion(abbreviation);
        } else {
            this._disableVersion(abbreviation);
        }
    }

    _disableVersion(abbreviation) {
        // Silent switch: if this was the active version, switch to ABT
        if (this.navigationManager.getCurrentVersion() === abbreviation) {
            this.navigationManager.setCurrentVersion('ABT');
            this.navigationManager.saveSettings();
            this.controller.onUpdateDisplay();
            this.controller.onLoadCurrentChapter();
        }

        // Silent switch: if this was the interlinear primary, switch to KJV
        if (this.configManager.getValue('interlinearPrimaryVersion') === abbreviation) {
            this.configManager.setValue('interlinearPrimaryVersion', 'KJV');
            if (this.configManager.getValue('interlinearMode')) {
                this.versionSelectorManager.disableInterlinear();
            }
        }

        this.configManager.disableVersion(abbreviation);
    }
}