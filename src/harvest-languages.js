(function($) {
    'use strict';

    var select, spinner, updated, manifest;

    // This changes every once in a while - try multiple selectors
    var selectors = [
        '#invoice-header .pds-column-4 .pds-flex-list',    // Modern layout - action buttons container
        '#invoice-header .pds-flex-list.pds-justify-end',  // Alternative action buttons area
        'header.pds-row .pds-column-4 .pds-flex-list',     // Generic header with action buttons
        '#invoice_header > div:nth-child(2)',               // Old layout
        '#invoice_header',                                  // Try the header itself
        '#invoice-header',                                  // Modern header ID
        '.invoice-header',                                  // Alternative class-based selector
        '[data-testid="invoice-header"]',                   // Modern React/test ID pattern
        'header.pds-screen-only .pds-flex-list',           // Any screen-only header with flex-list
        'main header',                                      // Any header in main content (fallback)
        'body > div > div > header',                        // Common React app structure
        'body > div:first-child > div > div:first-child'   // Fallback to body structure
    ];

    // Wait for page to be ready before initializing
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(init, 1500);
        });
    } else {
        // DOM is already ready, wait a bit for dynamic content to load
        setTimeout(init, 1500);
    }

    ///

    function init() {
        loadManifest().then(function() {
            console.info(manifest.name, manifest.version, 'Initializing...');

            top.loaded = loadLanguages()
                .then(function(languages) {
                    // Try immediately
                    return tryInsertUIElements(languages, 0);
                })
                .catch(function(e) {
                    console.warn(manifest.name, manifest.version, 'Could not load languages', e);
                });
        }).catch(function(e) {
            console.warn('Could not load manifest', e);
        });
    }

    function tryInsertUIElements(languages, attempt) {
        var maxAttempts = 8;
        var retryDelay = 500;

        try {
            insertUIElements(languages);
            displayReadyMessage();
            return Promise.resolve();
        } catch(e) {
            if (attempt < maxAttempts) {
                console.info(manifest.name, 'Attempt', attempt + 1, 'failed, retrying in', retryDelay, 'ms...');
                return new Promise(function(resolve, reject) {
                    setTimeout(function() {
                        tryInsertUIElements(languages, attempt + 1)
                            .then(resolve)
                            .catch(reject);
                    }, retryDelay);
                });
            } else {
                console.error(manifest.name, manifest.version, 'Could not load languages after', maxAttempts, 'attempts', e);
                throw e;
            }
        }
    }

    function displayReadyMessage() {
        console.info(manifest.name, manifest.version, 'loaded successfully');
    }
    function loadManifest() {
        return new Promise(function(resolve, reject) {
            return resolve(manifest = chrome.runtime.getManifest());
        });
    }

    function loadLanguages() {
        return new Promise(function(resolve, reject) {
            fetch(chrome.runtime.getURL('/languages.json'))
                .then(function(response) {
                    response.json()
                        .then(resolve)
                        .catch(reject);
                })
                .catch(reject);
        });
    }

    function loadLanguage(locale) {
        return new Promise(function(resolve, reject) {
            fetch(chrome.runtime.getURL('/languages/' + locale + '.json'))
                .then(function(response) {
                    response.json()
                        .then(resolve)
                        .catch(reject);
                })
                .catch(reject);
        });
    }

    function addEventListeners(select) {
        select.on('change', changeLanguage);
    }

    function appendSelect(select) {
        var target = null;

        // Try each selector until we find one that works
        for (var i = 0; i < selectors.length; i++) {
            var testTarget = $(selectors[i]);
            if (testTarget.length > 0) {
                target = testTarget.first();
                console.info(manifest.name, 'Found attachment point using selector:', selectors[i]);
                break;
            }
        }

        if (!target || target.length === 0) {
            console.error(manifest.name, 'Could not find attachment point. Tried selectors:', selectors);
            console.error(manifest.name, 'Page body HTML:', $('body').html().substring(0, 500));
            throw new Error('Cannot attach UI elements - no valid selector found');
        }

        // If we found the flex-list container, append (add to end), otherwise prepend (add to start)
        if (target.hasClass('pds-flex-list')) {
            target.append(select);
        } else {
            target.prepend(select);
        }
        console.info(manifest.name, 'Language selector attached successfully');
    }

    function getSpinner() {
        return spinner = $('<img id="harvest-language-loading" ' +
                           'src="' + chrome.runtime.getURL('/content/images/spinner.gif') + '">')
            .hide();
    }

    function insertUIElements(languages) {
        var select = getSelect(languages);
        var spinner = getSpinner();
        var wrapper = getSelectWrapper(spinner, select);

        addEventListeners(select);
        appendSelect(wrapper);
    }

    function addOption(select, value, label) {
        select.append('<option value="' + value + '">' + label + '</option>');
    }

    function getSelectWrapper(spinner, select) {
        var icon = $('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">' +
            '<circle cx="12" cy="12" r="10"/>' +
            '<line x1="2" y1="12" x2="22" y2="12"/>' +
            '<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>' +
            '</svg>');

        var wrapper = $('<span ' +
            'title="Change language" ' +
            'id="harvest-language-selector" ' +
            'class="pds-button pds-button-sm" ' +
            'style="display: inline-flex; align-items: center; padding: 0 12px;" ' +
            '></span>');

        return wrapper.append(icon).append(spinner).append(select);
    }

    function getSelect(languages) {
        select = $('<select>');
        addOption(select, '*', 'Language');

        languages.forEach(function(language) {
            addOption(select, language.locale, language.name + ' - ' + language.localeName);
        });

        return select;
    }

    function getIframe(url) {
        return $('<iframe src="' + url + '"></iframe>').hide().get()[0];
    }

    function getTranslationSettingsUrl(section) {
        return 'https://' + location.hostname + '/' + section + '/translations';
    }

    function changeValues(section, document, language) {
        _.forEach(language[section], function (value, key) {
            var field = document.getElementById(key);

            if (!field) {
                return console.warn('Could not find field for translation. ' +
                    'Is this module enabled in your Harvest settings?. ' +
                    'Field:', key, 'Translation:', value);
            }

            field.value = value;
        });

        document.querySelector("form#edit_profile").submit();
        updated = true;
    }

    function getSelectedLocale() {
        return select.val();
    }

    function attachIframe(iframe) {
        $(document.body).append(iframe);
    }

    function iframeLoaded(iframe, section, language, resolve) {
        if (!updated) {
            return changeValues(section, iframe.contentDocument, language);
        }

        // When the iframe fires this event for the second time it does because of the form submit being done
        resolve();
    }

    function changeLanguage() {
        $(spinner).show();
        select.hide();

        loadLanguage(getSelectedLocale()).then(translateInPlace);
    }

    function getTranslationIframe(url, section, language, resolve) {
        var iframe = getIframe(url);
        iframe.addEventListener('load', function () {
            iframeLoaded(iframe, section, language, resolve)
        });

        return iframe;
    }

    function translate(section, language) {
        return new Promise(function (resolve, reject) {
            var url    = getTranslationSettingsUrl(section);
            var iframe = getTranslationIframe(url, section, language, resolve);

            attachIframe(iframe); // Kicks-off url loading
        });
    }

    function translateInPlace(language) {
        // /invoices/1234567 -> invoices
        // /estimates/1234567 -> estimates
        var section = location.pathname.match(/[^/]+/)[0];

        translate(section, language)
            .then(function () {
                // We're done
                location.reload();
            })
    }

})(Zepto);
