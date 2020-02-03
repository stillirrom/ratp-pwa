(function() {
    'use strict';

    var app = {
        isLoading: true,
        visibleCards: {},
        selectedTimetables: [],
        spinner: document.querySelector('.loader'),
        cardTemplate: document.querySelector('.cardTemplate'),
        container: document.querySelector('.main'),
        addDialog: document.querySelector('.dialog-container')
    };


    /*****************************************************************************
     *
     * Event listeners for UI elements
     *
     ****************************************************************************/

    document.getElementById('butRefresh').addEventListener('click', function() {
        console.log("You clicked the butRefresh.");
        app.updateSchedules();
    });

    document.getElementById('butAdd').addEventListener('click', function() {
        console.log("You clicked the butAdd true.");
        app.toggleAddDialog(true);
    });

    document.getElementById('butAddStation').addEventListener('click', function() {
        console.log("You clicked the butAddStation.");
        app.addStation();
    });

    document.getElementById('butAddCancel').addEventListener('click', function() {
        console.log("You clicked the butAdd false.");
        app.toggleAddDialog(false);
    });

    /*****************************************************************************
     *
     * Methods for dealing with the model
     *
     ****************************************************************************/

    app.init = function() {
        console.log("Starting app through init.");
        app.selectedTimetables = app.loadLocationList();
        app.saveLocationList(app.selectedTimetables);
        app.updateSchedules();
    };

    app.loadLocationList = function() {
        console.log("Starting to load locationList from indexedDB.");
        let locations = localStorage.getItem('locationList');
        var request = window.indexedDB.open('USER_DB', 1);
        var db;
        request.onsuccess = function(event) {
            console.log('[onsuccess]', request.result);
            db = event.target.result;
            // create transaction from database
            var transaction = db.transaction('userPreferences', 'readwrite');
            // add success event handleer for transaction
            // you should also add onerror, onabort event handlers
            transaction.onsuccess = function(event) {
                console.log('[Transaction] ALL DONE!');
            };
            var userPreferencesStore = transaction.objectStore('userPreferences');
            var allRecords = userPreferencesStore.getAll();
            allRecords.onsuccess = function() {
                locations = Array.from(allRecords.result);
            };
        };
        request.onerror = function(event) {
            console.log('[onerror]', request.error);
        };
        request.onupgradeneeded = function(event) {
            var db = event.target.result;
            db.createObjectStore('userPreferences', { keyPath: 'key' });
        };
        if (locations) {
            console.log("There are locations ", locations, " in localStorage.");
            try {
                locations = JSON.parse(locations);
            } catch (ex) {
                console.log("Error when parsing locations.");
                locations = {};
            }
        }
        if (!locations || Object.keys(locations).length === 0) {
            console.log("There are no locations in localStorage, loading default location.");
            const key = 'metros/1/bastille/A';
            locations = {};
            locations[key] = {
                key: 'metros/1/bastille/A',
                label: 'Bastille, Direction La Défense',
                created: '2017-07-18T17:08:42+02:00',
                schedules: [{
                        message: '0 mn'
                    },
                    {
                        message: '2 mn'
                    },
                    {
                        message: '5 mn'
                    }
                ]
            };
        }
        return locations;
    }

    app.saveLocationList = function(locations) {
        console.log("Starting to save ", locations, " into indexedDB.");
        const data = JSON.stringify(locations);
        localStorage.setItem('locationList', data);
        var request = window.indexedDB.open('USER_DB', 1);
        var db;
        request.onsuccess = function(event) {
            console.log('[onsuccess]', request.result);
            db = event.target.result;
            // create transaction from database
            var transaction = db.transaction('userPreferences', 'readwrite');
            // add success event handleer for transaction
            // you should also add onerror, onabort event handlers
            transaction.onsuccess = function(event) {
                console.log('[Transaction] ALL DONE!');
            };
            var userPreferencesStore = transaction.objectStore('userPreferences');
            Object.keys(locations)
                .forEach(function(key) {
                    var db_op_req = userPreferencesStore.put(locations[key]); // IDBRequest
                });
        };
    }

    app.updateSchedules = function() {
        Object.keys(app.selectedTimetables)
            .forEach(function(key) {
                const selectedTimetable = app.selectedTimetables[key];
                console.log("Starting to updateSchedules for selectedTimetable: ", selectedTimetable);
                app.getSchedule(selectedTimetable);
            })
    };

    app.getSchedule = function(data) {
        console.log("Starting to getSchedule for: ", data)
        var key = data.key;
        console.log("Calling getSchedule");
        app.getScheduleFromCache(key).then((response) => {
            console.log("Trying to get ScheduleFromCache")
            app.updateTimeTable(data, response);
        })
        app.getScheduleFromNetwork(key).then((response) => {
            console.log("Trying to get ScheduleFromNetwork")
            app.updateTimeTable(data, response);
        })
    };

    app.getScheduleFromNetwork = function(key) {
        var url = 'https://api-ratp.pierre-grimaud.fr/v3/schedules/' + key;
        return fetch(url)
            .then((response) => {
                console.log("fetching ", url)
                return response.json();
            }).catch(() => {
                return null;
            });
    }

    app.getScheduleFromCache = function(key) {
        if (!('caches' in window)) {
            console.log("There are no caches in the window")
            return null;
        }
        var url = 'https://api-ratp.pierre-grimaud.fr/v3/schedules/' + key;
        return caches.match(url)
            .then((response) => {
                if (response) {
                    console.log("There's a response for catches.match")
                    return response.json();
                }
                return null;
            })
            .catch((err) => {
                console.error('Error getting data from cache', err);
                return null;
            });
    }

    app.updateTimeTable = function(data, response) {
        if (!response) {
            console.log("There's no response, skip the update.");
            return;
        }
        if (data.created >= response._metadata.date) {
            return;
        }
        var result = {};
        result.key = data.key;
        result.label = data.label;
        result.created = response._metadata.date;
        result.schedules = response.result.schedules;
        app.updateTimetableCard(result);
    }

    app.updateTimetableCard = function(data) {
        console.log("Starting to updateTimetableCard for: ", data);
        var key = data.key;
        var dataLastUpdated = new Date(data.created);
        //TODO: esto qué onda? dataLastUpdated
        var schedules = data.schedules;
        var card = app.visibleCards[key];
        if (!card) {
            console.log("There's no card, creating one.")
            var label = data.label.split(', ');
            var title = label[0];
            var subtitle = label[1];
            card = app.cardTemplate.cloneNode(true);
            card.classList.remove('cardTemplate');
            card.querySelector('.label').textContent = title;
            card.querySelector('.subtitle').textContent = subtitle;
            card.removeAttribute('hidden');
            app.container.appendChild(card);
            app.visibleCards[key] = card;
        }
        card.querySelector('.card-last-updated').textContent = data.created;

        var scheduleUIs = card.querySelectorAll('.schedule');
        for (var i = 0; i < 4; i++) {
            var schedule = schedules[i];
            var scheduleUI = scheduleUIs[i];
            if (schedule && scheduleUI) {
                scheduleUI.querySelector('.message').textContent = schedule.message;
            }
        }

        if (app.isLoading) {
            app.spinner.setAttribute('hidden', true);
            app.container.removeAttribute('hidden');
            app.isLoading = false;
        }
    };

    app.addStation = function() {
        var select = document.getElementById('selectTimetableToAdd');
        var selected = select.options[select.selectedIndex];
        var key = selected.value;
        var label = selected.textContent;
        app.selectedTimetables[key] = { key: key, label: label };
        app.toggleAddDialog(false);
        app.saveLocationList(app.selectedTimetables);
        app.updateSchedules();
    }

    // Toggles the visibility of the add new station dialog.
    app.toggleAddDialog = function(visible) {
        if (visible) {
            app.addDialog.classList.add('dialog-container--visible');
        } else {
            app.addDialog.classList.remove('dialog-container--visible');
        }
    };

    // Updates a timestation card with the latest weather forecast. If the card
    // doesn't already exist, it's cloned from the template.



    /************************************************************************
     *
     * Code required to start the app
     *
     * NOTE: To simplify this codelab, we've used localStorage.
     *   localStorage is a synchronous API and has serious performance
     *   implications. It should not be used in production applications!
     *   Instead, check out IDB (https://www.npmjs.com/package/idb) or
     *   SimpleDB (https://gist.github.com/inexorabletash/c8069c042b734519680c)
     ************************************************************************/


    app.init();

})();