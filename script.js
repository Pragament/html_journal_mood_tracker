    (function() {
        // ---------- constants & helpers ----------
        const STORAGE_KEY = 'secure_journal_data_v2';
        const LOCATION_TAG_PREFIX = 'loc:';
        const TIME_TAG_PREFIX = 'time:';
        const INACTIVE_LIMIT = 15 * 60 * 1000; // 15 minutes
        let lastActivity = Date.now();
        let autoLogoutTimer = null;
        let currentPinHash = null;
        let currentPinRaw = null;
        let journalEntries = [];
        let locationAutoTags = ['home', 'office', 'busstop', 'gym', 'cafe', 'park'];
        let commonTags = ['work', 'family', 'anxiety', 'win', 'challenge', 'procrastination', 'gratitude', 'therapy', 'trigger'];
        let pinHint = '';

        // Emotion wheel data (hierarchical)
        const emotionCategories = {
            happy: {
                color: '#FFF8E7',
                emotions: ['joyful', 'content', 'optimistic', 'playful', 'proud'],
                subEmotions: {
                    joyful: ['ecstatic', 'elated', 'gleeful', 'cheerful'],
                    content: ['peaceful', 'satisfied', 'grateful', 'comfortable'],
                    optimistic: ['hopeful', 'encouraged', 'excited', 'eager'],
                    playful: ['silly', 'whimsical', 'lighthearted', 'mischievous'],
                    proud: ['accomplished', 'confident', 'worthy', 'respected']
                }
            },
            sad: {
                color: '#E7F0FF',
                emotions: ['grief', 'disappointed', 'lonely', 'hopeless', 'vulnerable'],
                subEmotions: {
                    grief: ['sorrow', 'heartbroken', 'loss', 'anguish'],
                    disappointed: ['let down', 'dismayed', 'dissatisfied', 'unfulfilled'],
                    lonely: ['isolated', 'abandoned', 'left out', 'rejected'],
                    hopeless: ['despair', 'pessimistic', 'defeated', 'empty'],
                    vulnerable: ['fragile', 'insecure', 'sensitive', 'exposed']
                }
            },
            angry: {
                color: '#FFE7E7',
                emotions: ['frustrated', 'irritated', 'furious', 'resentful', 'jealous'],
                subEmotions: {
                    frustrated: ['stuck', 'annoyed', 'thwarted', 'impatient'],
                    irritated: ['aggravated', 'grumpy', 'exasperated', 'cranky'],
                    furious: ['enraged', 'livid', 'outraged', 'explosive'],
                    resentful: ['bitter', 'spiteful', 'indignant', 'sour'],
                    jealous: ['envious', 'possessive', 'insecure', 'covetous']
                }
            },
            anxious: {
                color: '#F0E7FF',
                emotions: ['worried', 'overwhelmed', 'scared', 'stressed', 'insecure'],
                subEmotions: {
                    worried: ['apprehensive', 'dread', 'concerned', 'nervous'],
                    overwhelmed: ['flooded', 'burdened', 'swamped', 'stretched'],
                    scared: ['terrified', 'fearful', 'panicked', 'horrified'],
                    stressed: ['pressured', 'tense', 'burned out', 'frazzled'],
                    insecure: ['inadequate', 'doubtful', 'unsure', 'self-critical']
                }
            },
            calm: {
                color: '#E7FFF0',
                emotions: ['peaceful', 'relaxed', 'centered', 'balanced', 'mindful'],
                subEmotions: {
                    peaceful: ['serene', 'tranquil', 'quiet', 'still'],
                    relaxed: ['at ease', 'comfortable', 'loose', 'rested'],
                    centered: ['grounded', 'focused', 'present', 'stable'],
                    balanced: ['harmonious', 'steady', 'even', 'composed'],
                    mindful: ['aware', 'conscious', 'attentive', 'observant']
                }
            }
        };
        
        const emotionHelpText = {
            happy: 'Feeling good, rewarded, or emotionally uplifted.',
            sad: 'Feeling down, heavy, or emotionally low.',
            angry: 'Feeling blocked, wronged, or ready to push back.',
            anxious: 'Feeling unsafe, uncertain, or mentally over-alert.',
            calm: 'Feeling settled, steady, and regulated.',
            joyful: 'A bright, high-energy form of happiness.',
            content: 'A quiet, settled sense of enoughness.',
            optimistic: 'Hopeful expectation that things can improve.',
            playful: 'Light, curious, and open to fun.',
            proud: 'Good feeling tied to effort, values, or achievement.',
            grief: 'Pain linked to loss or missing someone/something.',
            disappointed: 'Sadness when hopes or plans do not happen.',
            lonely: 'Sadness connected to disconnection or lack of closeness.',
            hopeless: 'A belief that things may not improve.',
            vulnerable: 'Emotionally exposed and easier to hurt.',
            frustrated: 'Blocked from what you want or need.',
            irritated: 'Low-to-mid level anger and annoyance.',
            furious: 'Intense anger with strong urge to react.',
            resentful: 'Lingering anger tied to unfairness or hurt.',
            jealous: 'Threat/fear around losing attention, status, or connection.',
            worried: 'Future-focused concern about possible problems.',
            overwhelmed: 'Too many demands; capacity feels exceeded.',
            scared: 'Immediate fear response to danger or threat.',
            stressed: 'Pressure and tension from demands or load.',
            insecure: 'Self-doubt about worth, belonging, or adequacy.',
            peaceful: 'Deep inner quiet and low emotional noise.',
            relaxed: 'Body and mind released from tension.',
            centered: 'Grounded and connected to your core values.',
            balanced: 'Steady between needs, emotions, and responsibilities.',
            mindful: 'Present, observant, and non-reactive awareness.'
        };

        const emotionProfile = {
            happy: { energy: 4, pleasant: 5, certainty: 3 },
            sad: { energy: 2, pleasant: 1, certainty: 2 },
            angry: { energy: 4, pleasant: 1, certainty: 4 },
            anxious: { energy: 4, pleasant: 1, certainty: 1 },
            calm: { energy: 1, pleasant: 4, certainty: 4 },
            joyful: { energy: 5, pleasant: 5, certainty: 3 },
            content: { energy: 2, pleasant: 4, certainty: 4 },
            optimistic: { energy: 3, pleasant: 4, certainty: 3 },
            playful: { energy: 4, pleasant: 4, certainty: 2 },
            proud: { energy: 3, pleasant: 4, certainty: 5 },
            grief: { energy: 1, pleasant: 1, certainty: 4 },
            disappointed: { energy: 2, pleasant: 1, certainty: 4 },
            lonely: { energy: 2, pleasant: 1, certainty: 3 },
            hopeless: { energy: 1, pleasant: 1, certainty: 5 },
            vulnerable: { energy: 2, pleasant: 2, certainty: 2 },
            frustrated: { energy: 4, pleasant: 1, certainty: 3 },
            irritated: { energy: 3, pleasant: 2, certainty: 3 },
            furious: { energy: 5, pleasant: 1, certainty: 5 },
            resentful: { energy: 3, pleasant: 1, certainty: 4 },
            jealous: { energy: 4, pleasant: 1, certainty: 2 },
            worried: { energy: 3, pleasant: 2, certainty: 2 },
            overwhelmed: { energy: 5, pleasant: 1, certainty: 1 },
            scared: { energy: 5, pleasant: 1, certainty: 2 },
            stressed: { energy: 4, pleasant: 1, certainty: 2 },
            insecure: { energy: 3, pleasant: 2, certainty: 1 },
            peaceful: { energy: 1, pleasant: 5, certainty: 4 },
            relaxed: { energy: 1, pleasant: 4, certainty: 3 },
            centered: { energy: 2, pleasant: 4, certainty: 5 },
            balanced: { energy: 2, pleasant: 4, certainty: 4 },
            mindful: { energy: 2, pleasant: 4, certainty: 4 }
        };

        function toTitleCase(text) {
            return (text || '').replace(/\b\w/g, c => c.toUpperCase());
        }

        function describeDifference(emotion, other) {
            const a = emotionProfile[emotion];
            const b = emotionProfile[other];
            if (!a || !b) {
                return `${toTitleCase(emotion)} is a different shade than ${other}; choose the one that best matches your body sensations right now.`;
            }
            let diffBits = [];
            if (Math.abs(a.energy - b.energy) >= 2) diffBits.push(a.energy > b.energy ? 'more energized' : 'lower-energy');
            if (Math.abs(a.pleasant - b.pleasant) >= 2) diffBits.push(a.pleasant > b.pleasant ? 'more pleasant' : 'more unpleasant');
            if (Math.abs(a.certainty - b.certainty) >= 2) diffBits.push(a.certainty > b.certainty ? 'more certain' : 'more uncertain');
            if (diffBits.length === 0) diffBits.push('subtly different in tone');
            return `${toTitleCase(emotion)} is ${diffBits.slice(0, 2).join(' and ')} than ${other}.`;
        }

        function showEmotionHelp(emotion, level, peers, contextParent) {
            const panel = document.getElementById('emotionHelpPanel');
            if (!panel) return;
            const baseDescription = emotionHelpText[emotion] ||
                (contextParent ? `${toTitleCase(emotion)} is a more specific form of ${contextParent}.` : `${toTitleCase(emotion)} is this mood label.`);
            const comparisons = (peers || []).slice(0, 3).map(p => `<li>${describeDifference(emotion, p)}</li>`).join('');
            panel.innerHTML = `
                <div class="emotion-help-header">Help: ${toTitleCase(emotion)} <span class="small-note">(${level})</span></div>
                <div class="emotion-help-body">${baseDescription}</div>
                ${comparisons ? `<div class="small-note">How this differs from similar choices:</div><ul class="emotion-help-list">${comparisons}</ul>` : ''}
            `;
        }

        // Crypto functions
        function encrypt(text, pin) {
            if (!text) return '';
            let hash = simpleHash(pin);
            let result = '';
            for (let i = 0; i < text.length; i++) {
                let code = text.charCodeAt(i) ^ hash.charCodeAt(i % hash.length);
                result += String.fromCharCode(code);
            }
            return btoa(result);
        }
        
        function decrypt(encoded, pin) {
            if (!encoded) return '';
            try {
                let text = atob(encoded);
                let hash = simpleHash(pin);
                let result = '';
                for (let i = 0; i < text.length; i++) {
                    result += String.fromCharCode(text.charCodeAt(i) ^ hash.charCodeAt(i % hash.length));
                }
                return result;
            } catch { return ''; }
        }
        
        function simpleHash(s) {
            let hash = 0;
            for (let i=0; i<s.length; i++) hash = (hash << 5) - hash + s.charCodeAt(i);
            return Math.abs(hash).toString(16).repeat(5);
        }

        // Activity tracking
        function resetActivity() { lastActivity = Date.now(); }
        function startInactivityCheck() {
            if (autoLogoutTimer) clearInterval(autoLogoutTimer);
            autoLogoutTimer = setInterval(() => {
                if (currentPinHash && Date.now() - lastActivity > INACTIVE_LIMIT) {
                    logout();
                    renderApp();
                }
            }, 60000);
        }

        // Login / logout / PIN management
        function login(pin) {
            let storedHash = localStorage.getItem('journal_pin_hash');
            if (!storedHash) return false;
            let hash = simpleHash(pin);
            if (hash === storedHash) {
                currentPinHash = hash;
                currentPinRaw = pin;
                loadPinHint();
                loadDataFromStorage();
                resetActivity();
                startInactivityCheck();
                return true;
            }
            return false;
        }

        function setNewPin(pin, hint) {
            let hash = simpleHash(pin);
            localStorage.setItem('journal_pin_hash', hash);
            if (hint) {
                localStorage.setItem('journal_pin_hint', hint);
            } else {
                localStorage.removeItem('journal_pin_hint');
            }
            currentPinHash = hash;
            currentPinRaw = pin;
            pinHint = hint || '';
            loadDataFromStorage();
            resetActivity();
            startInactivityCheck();
        }

        function loadPinHint() {
            let storedHint = localStorage.getItem('journal_pin_hint');
            pinHint = storedHint || '';
        }

        function logout() {
            currentPinHash = null;
            currentPinRaw = null;
            journalEntries = [];
            pinHint = '';
            if (autoLogoutTimer) clearInterval(autoLogoutTimer);
            autoLogoutTimer = null;
        }

        function changePin(oldPin, newPin, newHint) {
            if (!currentPinRaw || simpleHash(oldPin) !== currentPinHash) return false;
            // Re-encrypt all data with new pin
            let rawData = JSON.stringify(journalEntries);
            let encrypted = encrypt(rawData, newPin);
            localStorage.setItem(STORAGE_KEY, encrypted);
            
            let newHash = simpleHash(newPin);
            localStorage.setItem('journal_pin_hash', newHash);
            if (newHint) {
                localStorage.setItem('journal_pin_hint', newHint);
            } else {
                localStorage.removeItem('journal_pin_hint');
            }
            
            currentPinHash = newHash;
            currentPinRaw = newPin;
            pinHint = newHint || '';
            return true;
        }

        // Data load/save
        function loadDataFromStorage() {
            if (!currentPinRaw) return;
            let encrypted = localStorage.getItem(STORAGE_KEY);
            if (!encrypted) { journalEntries = []; return; }
            try {
                let dec = decrypt(encrypted, currentPinRaw);
                journalEntries = JSON.parse(dec) || [];
            } catch { journalEntries = []; }
        }
        
        function saveDataToStorage() {
            if (!currentPinRaw) return;
            let raw = JSON.stringify(journalEntries);
            let encrypted = encrypt(raw, currentPinRaw);
            localStorage.setItem(STORAGE_KEY, encrypted);
        }

        // Location helpers
        function getCurrentLocation(callback) {
            if (!navigator.geolocation) { callback(null); return; }
            navigator.geolocation.getCurrentPosition(
                (pos) => callback({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => callback(null)
            );
        }

        // Tag autocomplete
        function suggestTags(input, existing, type = 'common') {
            let all = (type === 'location') ? locationAutoTags : commonTags;
            if (!input) return [];
            return all.filter(t => t.toLowerCase().startsWith(input.toLowerCase()) && !existing.includes(t));
        }

        // Render app
        function renderApp() {
            const headerDiv = document.getElementById('authHeader');
            const mainDiv = document.getElementById('mainArea');
            
            if (!currentPinHash) {
                let pinExists = localStorage.getItem('journal_pin_hash');
                headerDiv.innerHTML = `<div class="pin-area"><span>🔒 Locked</span></div>`;
                
                if (!pinExists) {
                    mainDiv.innerHTML = `
                        <div style="max-width:500px; margin:20px auto;">
                            <h3>🔐 Set up PIN</h3>
                            <p class="small-note">This PIN protects your entries (cannot be recovered).</p>
                            <input type="password" id="newPin" placeholder="New PIN" style="margin-bottom:12px;" />
                            <input type="password" id="confirmPin" placeholder="Confirm PIN" style="margin-bottom:12px;" />
                            <input type="text" id="pinHint" placeholder="PIN hint (optional)" style="margin-bottom:16px;" />
                            <div class="actions">
                                <button class="btn btn-primary" id="setPinBtn">Set PIN & Start</button>
                                <button class="btn btn-outline" id="showHintSetup">Show hint example</button>
                            </div>
                            <div id="hintMessage" class="small-note"></div>
                        </div>
                    `;
                    
                    document.getElementById('setPinBtn')?.addEventListener('click', () => {
                        let p1 = document.getElementById('newPin').value;
                        let p2 = document.getElementById('confirmPin').value;
                        let hint = document.getElementById('pinHint').value;
                        if (!p1 || p1 !== p2) { alert('PINs must match'); return; }
                        setNewPin(p1, hint);
                        renderApp();
                    });
                    
                    document.getElementById('showHintSetup')?.addEventListener('click', ()=>{
                        document.getElementById('hintMessage').innerHTML = '💡 Example: "My favorite number" or "Street I grew up on"';
                    });
                } else {
                    let hint = '';
                    try { 
                        hint = localStorage.getItem('journal_pin_hint') ? '🔑 Hint is available' : '';
                    } catch { }
                    
                    mainDiv.innerHTML = `
                        <div style="max-width:400px; margin:20px auto;">
                            <h3>🔐 Enter PIN</h3>
                            <input type="password" id="pinInput" placeholder="Your PIN" style="margin-bottom:16px;" />
                            <div class="row">
                                <button class="btn btn-primary" id="unlockBtn">Unlock</button>
                                <button class="btn btn-outline" id="hintBtn">Show Hint</button>
                            </div>
                            <div id="hintBox" class="small-note" style="margin-top:16px;"></div>
                            <div class="small-note">${hint}</div>
                        </div>
                    `;
                    
                    document.getElementById('unlockBtn')?.addEventListener('click', ()=>{
                        let pin = document.getElementById('pinInput').value;
                        if (login(pin)) {
                            renderApp();
                        } else {
                            document.getElementById('hintBox').innerHTML = '❌ Wrong PIN';
                        }
                    });
                    
                    document.getElementById('hintBtn')?.addEventListener('click', ()=>{
                        let storedHint = localStorage.getItem('journal_pin_hint');
                        if (storedHint) {
                            document.getElementById('hintBox').innerHTML = `💡 Hint: ${storedHint}`;
                        } else {
                            document.getElementById('hintBox').innerHTML = 'ℹ️ No hint set';
                        }
                    });
                }
                return;
            }

            // Logged in - show main interface
            headerDiv.innerHTML = `
                <div class="pin-area">
                    <span class="pin-badge">✅ ${pinHint ? '🔑 Hint set' : 'PIN active'}</span>
                    <button class="btn btn-outline" id="changePinBtn">Change PIN</button>
                    <button class="btn btn-outline" id="viewHintBtn">View Hint</button>
                    <button class="btn btn-outline danger-btn" id="logoutBtn">Logout</button>
                </div>
            `;
            
            document.getElementById('changePinBtn')?.addEventListener('click', showChangePinModal);
            document.getElementById('viewHintBtn')?.addEventListener('click', ()=>{
                alert(pinHint ? `Your hint: ${pinHint}` : 'No hint set');
            });
            document.getElementById('logoutBtn')?.addEventListener('click', ()=>{ logout(); renderApp(); });

            // Main content with mood wheel
            let html = `
                <div class="session-bar">
                    <span>📋 ${journalEntries.length} entries</span>
                    <span class="spacer"></span>
                    <button class="btn btn-outline" id="backupBtn">⬇️ Backup</button>
                    <button class="btn btn-outline" id="restoreBtn">⬆️ Restore</button>
                    <button class="btn btn-outline" id="exportBtn">📤 Export</button>
                    <button class="btn btn-primary" id="newEntryBtn">+ Full entry</button>
                </div>

                <!-- Quick Mood Entry (Mood Wheel) -->
                <div class="mood-wheel-container">
                    <h3 style="margin-top:0;">🎯 Quick Mood Entry</h3>
                    <p class="small-note">Select primary emotion, then dive deeper</p>
                    
                    <!-- Primary emotion categories -->
                    <div class="mood-categories" id="moodCategories">
                        ${Object.keys(emotionCategories).map(cat => 
                            `<div class="mood-cat" data-category="${cat}" style="background: ${emotionCategories[cat].color}">
                                <span>${cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                                <button type="button" class="emotion-help-btn" data-help-emotion="${cat}" data-help-level="primary" data-help-peers="${Object.keys(emotionCategories).filter(k => k !== cat).join('|')}" aria-label="Help for ${cat}">?</button>
                            </div>`
                        ).join('')}
                    </div>

                    <!-- Secondary emotions (will be populated) -->
                    <div id="secondaryEmotions" class="emotion-wheel" style="display: none;"></div>
                    
                    <!-- Tertiary emotions (sub-emotions) -->
                    <div id="tertiaryEmotions" class="emotion-hierarchy" style="display: none;"></div>

                    <!-- Selected emotions display -->
                    <div id="selectedMoods" class="selected-emotions">
                        Selected: <span id="selectedMoodsList">None</span>
                    </div>
                    <div id="emotionHelpPanel" class="emotion-help-panel">
                        Tap <strong>?</strong> on any emotion for a quick definition and differences from similar options.
                    </div>

                    <div class="quick-actions">
                        <button class="btn btn-primary" id="quickSaveMood">📝 Save Quick Entry</button>
                        <button class="btn btn-outline" id="clearMoodSelection">Clear</button>
                        <button class="btn btn-outline" id="addLocationToMood">📍 Add Current Location</button>
                    </div>
                    <div class="small-note">Quick entry auto-fills emotions and timestamp. You can edit details later.</div>
                </div>

                <!-- Search / filters -->
                <div class="search-section">
                    <div class="row" style="margin-bottom:12px;">
                        <input type="text" id="searchText" placeholder="🔍 keyword ..." style="flex:2;" />
                        <input type="date" id="fromDate" style="flex:1;" />
                        <input type="date" id="toDate" style="flex:1;" />
                    </div>
                    <div class="row">
                        <input type="text" id="filterTags" placeholder="filter by tag (comma)" style="flex:2;" />
                        <button class="btn btn-primary" id="applyFilter">Apply filters</button>
                        <button class="btn btn-outline" id="clearFilter">Clear</button>
                    </div>
                </div>

                <!-- Entry editor (hidden by default) -->
                <div class="card" id="entryEditor" style="display:none;"></div>

                <!-- Entries list -->
                <h3>📖 Recent entries</h3>
                <div class="entry-list" id="entryList"></div>

                <div id="importArea"></div>
            `;
            
            mainDiv.innerHTML = html;
            
            // Attach event listeners
            document.getElementById('backupBtn')?.addEventListener('click', backupSettings);
            document.getElementById('restoreBtn')?.addEventListener('click', ()=>{ showImportModal(); });
            document.getElementById('exportBtn')?.addEventListener('click', showExportModal);
            document.getElementById('newEntryBtn')?.addEventListener('click', ()=>{ showEntryEditor(null); });
            document.getElementById('applyFilter')?.addEventListener('click', filterAndRenderEntries);
            document.getElementById('clearFilter')?.addEventListener('click', ()=>{
                document.getElementById('searchText').value = '';
                document.getElementById('fromDate').value = '';
                document.getElementById('toDate').value = '';
                document.getElementById('filterTags').value = '';
                filterAndRenderEntries();
            });

            // Mood wheel state
            let selectedPrimary = null;
            let selectedSecondary = null;
            let selectedTertiary = [];

            // Mood category click handlers
            document.querySelectorAll('.mood-cat').forEach(cat => {
                cat.addEventListener('click', (e) => {
                    if (e.target.closest('.emotion-help-btn')) return;
                    document.querySelectorAll('.mood-cat').forEach(c => c.classList.remove('selected'));
                    cat.classList.add('selected');
                    selectedPrimary = cat.dataset.category;
                    selectedSecondary = null;
                    selectedTertiary = [];
                    
                    // Show secondary emotions
                    let secondaryDiv = document.getElementById('secondaryEmotions');
                    let siblingSecondaries = emotionCategories[selectedPrimary].emotions;
                    secondaryDiv.style.display = 'grid';
                    secondaryDiv.innerHTML = siblingSecondaries.map(em => 
                        `<div class="emotion-item" data-secondary="${em}">
                            <span>${em}</span>
                            <button type="button" class="emotion-help-btn" data-help-emotion="${em}" data-help-level="secondary" data-help-parent="${selectedPrimary}" data-help-peers="${siblingSecondaries.filter(x => x !== em).join('|')}" aria-label="Help for ${em}">?</button>
                        </div>`
                    ).join('');
                    
                    document.getElementById('tertiaryEmotions').style.display = 'none';
                    updateSelectedMoodsDisplay();
                    
                    // Add click handlers for secondary emotions
                    document.querySelectorAll('[data-secondary]').forEach(el => {
                        el.addEventListener('click', (e) => {
                            if (e.target.closest('.emotion-help-btn')) return;
                            e.stopPropagation();
                            document.querySelectorAll('[data-secondary]').forEach(s => s.classList.remove('selected'));
                            el.classList.add('selected');
                            selectedSecondary = el.dataset.secondary;
                            
                            // Show tertiary emotions
                            let tertiaryDiv = document.getElementById('tertiaryEmotions');
                            tertiaryDiv.style.display = 'block';
                            let subs = emotionCategories[selectedPrimary].subEmotions[selectedSecondary] || [];
                            tertiaryDiv.innerHTML = '<h4>Deeper feelings:</h4>' + 
                                subs.map(sub => 
                                    `<div class="emotion-item secondary-level" data-tertiary="${sub}">
                                        <span>${sub}</span>
                                        <button type="button" class="emotion-help-btn" data-help-emotion="${sub}" data-help-level="tertiary" data-help-parent="${selectedSecondary}" data-help-peers="${subs.filter(x => x !== sub).join('|')}" aria-label="Help for ${sub}">?</button>
                                    </div>`
                                ).join('');
                            
                            // Add click handlers for tertiary
                            document.querySelectorAll('[data-tertiary]').forEach(t => {
                                t.addEventListener('click', (e) => {
                                    if (e.target.closest('.emotion-help-btn')) return;
                                    e.stopPropagation();
                                    let tert = t.dataset.tertiary;
                                    if (selectedTertiary.includes(tert)) {
                                        selectedTertiary = selectedTertiary.filter(x => x !== tert);
                                        t.classList.remove('selected');
                                    } else {
                                        selectedTertiary.push(tert);
                                        t.classList.add('selected');
                                    }
                                    updateSelectedMoodsDisplay();
                                });
                            });
                            attachEmotionHelpHandlers();
                            updateSelectedMoodsDisplay();
                        });
                    });
                    attachEmotionHelpHandlers();
                });
            });

            function attachEmotionHelpHandlers() {
                document.querySelectorAll('.emotion-help-btn').forEach(btn => {
                    if (btn.dataset.bound === '1') return;
                    btn.dataset.bound = '1';
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        let emotion = btn.dataset.helpEmotion;
                        let level = btn.dataset.helpLevel || 'emotion';
                        let contextParent = btn.dataset.helpParent || '';
                        let peers = (btn.dataset.helpPeers || '').split('|').filter(Boolean);
                        showEmotionHelp(emotion, level, peers, contextParent);
                    });
                });
            }
            attachEmotionHelpHandlers();

            function updateSelectedMoodsDisplay() {
                let list = [];
                if (selectedPrimary) list.push(selectedPrimary);
                if (selectedSecondary) list.push('→ ' + selectedSecondary);
                if (selectedTertiary.length) list.push('→→ ' + selectedTertiary.join(', '));
                document.getElementById('selectedMoodsList').innerText = list.length ? list.join(' ') : 'None';
            }

            document.getElementById('clearMoodSelection')?.addEventListener('click', () => {
                document.querySelectorAll('.mood-cat').forEach(c => c.classList.remove('selected'));
                document.getElementById('secondaryEmotions').style.display = 'none';
                document.getElementById('tertiaryEmotions').style.display = 'none';
                selectedPrimary = selectedSecondary = null;
                selectedTertiary = [];
                updateSelectedMoodsDisplay();
            });

            // Quick save mood entry
            document.getElementById('quickSaveMood')?.addEventListener('click', () => {
                if (!selectedPrimary) {
                    alert('Please select at least a primary emotion');
                    return;
                }

                // Build emotion text
                let emotionText = selectedPrimary;
                if (selectedSecondary) emotionText += ` (${selectedSecondary}`;
                if (selectedTertiary.length) emotionText += `: ${selectedTertiary.join(', ')}`;
                if (selectedSecondary) emotionText += ')';

                // Create quick entry
                let newEntry = {
                    id: Date.now() + '-' + Math.random().toString(36),
                    date: new Date().toISOString().slice(0,16),
                    emotion: emotionText,
                    trigger: '',
                    behavior: '',
                    wins: '',
                    challenge: '',
                    therapyPrep: 'Quick mood entry',
                    locationTags: [],
                    timeTags: [],
                    otherTags: ['quick-entry'],
                    lat: null,
                    lng: null,
                    locationName: ''
                };

                // Add time tag
                let hour = new Date().getHours();
                let timeTag = hour < 12 ? 'time:morning' : (hour < 18 ? 'time:afternoon' : 'time:evening');
                newEntry.timeTags.push(timeTag);

                journalEntries.push(newEntry);
                saveDataToStorage();
                filterAndRenderEntries();
                
                // Clear selection
                document.getElementById('clearMoodSelection').click();
                alert('Quick entry saved! You can edit it in the list below.');
            });

            // Add location to mood entry
            document.getElementById('addLocationToMood')?.addEventListener('click', () => {
                getCurrentLocation((pos) => {
                    if (pos) {
                        alert(`Location captured (${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)})`);
                        // Store in temporary state for next quick save
                        window.tempQuickLat = pos.lat;
                        window.tempQuickLng = pos.lng;
                    } else {
                        alert('Could not get location');
                    }
                });
            });

            // Initial entries display
            filterAndRenderEntries();

            // Activity tracking
            document.body.addEventListener('click', resetActivity, true);
        }

        // Entry editor function (kept from previous version)
        function showEntryEditor(entryToEdit) {
            const editorDiv = document.getElementById('entryEditor');
            if (!editorDiv) return;
            
            const isNew = !entryToEdit;
            const entry = entryToEdit ? { ...entryToEdit } : {
                id: Date.now() + '-' + Math.random().toString(36),
                date: new Date().toISOString().slice(0,16),
                emotion: '', trigger: '', behavior: '', wins: '', challenge: '', therapyPrep: '',
                locationTags: [], timeTags: [], otherTags: [], lat: null, lng: null,
                locationName: ''
            };

            if (isNew) {
                getCurrentLocation((pos) => {
                    if (pos) {
                        entry.lat = pos.lat;
                        entry.lng = pos.lng;
                        let locTag = LOCATION_TAG_PREFIX + 'lat_' + pos.lat.toFixed(2);
                        if (!entry.locationTags.includes(locTag)) entry.locationTags.push(locTag);
                    }
                });
                let hour = new Date().getHours();
                let timeTag = hour < 12 ? 'time:morning' : (hour < 18 ? 'time:afternoon' : 'time:evening');
                if (!entry.timeTags.includes(timeTag)) entry.timeTags.push(timeTag);
            }

            function renderEditor() {
                editorDiv.style.display = 'block';
                editorDiv.innerHTML = `
                    <h3>${isNew ? '✏️ New entry' : '📝 Edit entry'}</h3>
                    <div class="field-group">
                        <label>Date & time</label>
                        <input type="datetime-local" id="entryDate" value="${entry.date}" />
                    </div>
                    <div class="field-group"><label>Emotion & trigger</label><textarea id="emotionField" rows="2">${entry.emotion || ''}</textarea></div>
                    <div class="field-group"><label>Behavior & patterns</label><textarea id="behaviorField" rows="2">${entry.behavior || ''}</textarea></div>
                    <div class="field-group"><label>Wins & challenges</label><textarea id="winsField" rows="2">${entry.wins || ''}</textarea></div>
                    <div class="field-group"><label>Therapy prep / notes</label><textarea id="prepField" rows="2">${entry.therapyPrep || ''}</textarea></div>
                    
                    <div class="row">
                        <div style="flex:1"><label>📍 Location tags</label><input id="locTagsInput" placeholder="add location tag" value="" /></div>
                        <div style="flex:1"><label>⏰ Time tags</label><input id="timeTagsInput" placeholder="add time tag" value="" /></div>
                        <div style="flex:1"><label>🏷️ Other tags</label><input id="otherTagsInput" placeholder="add tag" value="" /></div>
                    </div>
                    <div class="tag-container" id="locTagContainer">${entry.locationTags.map(t => `<span class="tag">${t} <button data-loctag="${t}">✕</button></span>`).join('')}</div>
                    <div class="tag-container" id="timeTagContainer">${entry.timeTags.map(t => `<span class="tag">${t} <button data-timetag="${t}">✕</button></span>`).join('')}</div>
                    <div class="tag-container" id="otherTagContainer">${entry.otherTags.map(t => `<span class="tag">${t} <button data-othertag="${t}">✕</button></span>`).join('')}</div>
                    
                    <div class="actions">
                        <button class="btn btn-primary" id="saveEntryBtn">💾 Save entry</button>
                        <button class="btn btn-outline" id="duplicateEntryBtn" ${isNew ? 'disabled' : ''}>📋 Duplicate as new</button>
                        <button class="btn btn-outline" id="clearLocationBtn">🗑️ Clear location</button>
                        <button class="btn btn-outline" id="cancelEditBtn">Cancel</button>
                    </div>
                `;

                // Tag removal handlers
                document.querySelectorAll('[data-loctag]').forEach(b => b.addEventListener('click', (e) => {
                    let tg = e.target.getAttribute('data-loctag');
                    entry.locationTags = entry.locationTags.filter(t => t !== tg);
                    renderEditor();
                }));
                document.querySelectorAll('[data-timetag]').forEach(b => b.addEventListener('click', (e) => {
                    let tg = e.target.getAttribute('data-timetag');
                    entry.timeTags = entry.timeTags.filter(t => t !== tg);
                    renderEditor();
                }));
                document.querySelectorAll('[data-othertag]').forEach(b => b.addEventListener('click', (e) => {
                    let tg = e.target.getAttribute('data-othertag');
                    entry.otherTags = entry.otherTags.filter(t => t !== tg);
                    renderEditor();
                }));

                // Tag input handlers
                document.getElementById('locTagsInput')?.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && e.target.value) {
                        let val = e.target.value.trim();
                        if (val && !entry.locationTags.includes(val)) entry.locationTags.push(val);
                        renderEditor();
                        e.preventDefault();
                    }
                });
                document.getElementById('timeTagsInput')?.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && e.target.value) {
                        let val = e.target.value.trim();
                        if (val && !entry.timeTags.includes(val)) entry.timeTags.push(val);
                        renderEditor();
                        e.preventDefault();
                    }
                });
                document.getElementById('otherTagsInput')?.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && e.target.value) {
                        let val = e.target.value.trim();
                        if (val && !entry.otherTags.includes(val)) entry.otherTags.push(val);
                        renderEditor();
                        e.preventDefault();
                    }
                });

                document.getElementById('clearLocationBtn')?.addEventListener('click', ()=>{
                    entry.lat = null; entry.lng = null; 
                    entry.locationTags = entry.locationTags.filter(t => !t.startsWith(LOCATION_TAG_PREFIX));
                    renderEditor();
                });
                
                document.getElementById('cancelEditBtn')?.addEventListener('click', ()=>{
                    editorDiv.style.display = 'none';
                });
                
                document.getElementById('saveEntryBtn')?.addEventListener('click', ()=>{
                    entry.date = document.getElementById('entryDate').value;
                    entry.emotion = document.getElementById('emotionField').value;
                    entry.behavior = document.getElementById('behaviorField').value;
                    entry.wins = document.getElementById('winsField').value;
                    entry.therapyPrep = document.getElementById('prepField').value;
                    
                    if (isNew) journalEntries.push(entry);
                    else {
                        let idx = journalEntries.findIndex(e => e.id === entry.id);
                        if (idx>=0) journalEntries[idx] = entry;
                    }
                    saveDataToStorage();
                    editorDiv.style.display = 'none';
                    filterAndRenderEntries();
                });
                
                document.getElementById('duplicateEntryBtn')?.addEventListener('click', ()=>{
                    let newEntry = { ...entry, id: Date.now() + '-' + Math.random(), date: new Date().toISOString().slice(0,16) };
                    journalEntries.push(newEntry);
                    saveDataToStorage();
                    showEntryEditor(newEntry);
                });
            }
            renderEditor();
        }

        // Filter and render entries
        function filterAndRenderEntries() {
            let listDiv = document.getElementById('entryList');
            if (!listDiv) return;
            
            let search = document.getElementById('searchText')?.value.toLowerCase() || '';
            let from = document.getElementById('fromDate')?.value;
            let to = document.getElementById('toDate')?.value;
            let tagFilter = document.getElementById('filterTags')?.value.split(',').map(s=>s.trim()).filter(Boolean) || [];

            let filtered = journalEntries.filter(e => {
                if (from && e.date.slice(0,10) < from) return false;
                if (to && e.date.slice(0,10) > to) return false;
                if (search) {
                    let txt = (e.emotion + ' ' + e.behavior + ' ' + e.wins + ' ' + e.therapyPrep).toLowerCase();
                    if (!txt.includes(search)) return false;
                }
                if (tagFilter.length) {
                    let allTags = [...(e.locationTags||[]), ...(e.timeTags||[]), ...(e.otherTags||[])];
                    if (!tagFilter.some(t => allTags.includes(t))) return false;
                }
                return true;
            }).sort((a,b)=> (b.date.localeCompare(a.date)));

            if (filtered.length === 0) { 
                listDiv.innerHTML = '<div style="padding:20px; text-align:center;">✨ No entries</div>'; 
                return; 
            }
            
            listDiv.innerHTML = filtered.map(e => `
                <div class="entry-item" data-id="${e.id}">
                    <div style="display:flex; gap:12px; align-items:center;">
                        <strong>${e.date}</strong> 
                        <span>😶 ${e.emotion?.substring(0,40)}...</span>
                    </div>
                    <div class="tag-container">
                        ${e.locationTags?.map(t=>`<span class="tag">📍${t}</span>`).join('')}
                        ${e.timeTags?.map(t=>`<span class="tag">⏰${t}</span>`).join('')}
                        ${e.otherTags?.map(t=>`<span class="tag">🏷️${t}</span>`).join('')}
                    </div>
                </div>
            `).join('');
            
            listDiv.querySelectorAll('.entry-item').forEach(el => {
                el.addEventListener('click', ()=>{
                    let id = el.getAttribute('data-id');
                    let entry = journalEntries.find(e => e.id === id);
                    if (entry) showEntryEditor(entry);
                });
            });
        }

        // Backup / restore / export functions
        function backupSettings() {
            let data = {
                entries: journalEntries,
                locationAutoTags, 
                commonTags,
                pinHint: pinHint
            };
            let blob = new Blob([JSON.stringify(data)], {type: 'application/json'});
            let url = URL.createObjectURL(blob);
            let a = document.createElement('a');
            a.href = url; a.download = 'therapy_backup.json'; a.click();
        }

        function showImportModal() {
            let html = `
                <div class="modal-overlay" id="importOverlay">
                    <div class="modal">
                        <h3>Restore backup</h3>
                        <input type="file" id="restoreFile" accept=".json" />
                        <div class="actions">
                            <button class="btn btn-primary" id="doRestore">Restore</button>
                            <button class="btn btn-outline" id="closeImport">Cancel</button>
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('importArea').innerHTML = html;
            
            document.getElementById('doRestore')?.addEventListener('click', ()=>{
                let file = document.getElementById('restoreFile').files[0];
                if (!file) return;
                let reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        let data = JSON.parse(e.target.result);
                        if (data.entries) journalEntries = data.entries;
                        if (data.locationAutoTags) locationAutoTags = data.locationAutoTags;
                        if (data.commonTags) commonTags = data.commonTags;
                        if (typeof data.pinHint === 'string') {
                            pinHint = data.pinHint;
                            if (pinHint) {
                                localStorage.setItem('journal_pin_hint', pinHint);
                            } else {
                                localStorage.removeItem('journal_pin_hint');
                            }
                        }
                        saveDataToStorage();
                        document.getElementById('importOverlay').remove();
                        filterAndRenderEntries();
                        alert('Restore complete');
                    } catch (er) { alert('Invalid backup'); }
                };
                reader.readAsText(file);
            });
            
            document.getElementById('closeImport')?.addEventListener('click', ()=> 
                document.getElementById('importOverlay').remove()
            );
        }

        function showExportModal() {
            let from = prompt('Export from date (YYYY-MM-DD) or leave empty:', '');
            let to = prompt('Export to date (YYYY-MM-DD):', '');
            
            let filtered = journalEntries.filter(e => {
                if (from && e.date.slice(0,10) < from) return false;
                if (to && e.date.slice(0,10) > to) return false;
                return true;
            });
            
            let format = confirm('OK for JSON, Cancel for CSV') ? 'json' : 'csv';
            
            if (format === 'json') {
                let blob = new Blob([JSON.stringify(filtered)], {type:'application/json'});
                let url = URL.createObjectURL(blob);
                let a = document.createElement('a'); 
                a.href = url; a.download = 'export.json'; a.click();
            } else {
                let headers = ['id','date','emotion','behavior','wins','therapyPrep','locationTags','timeTags','otherTags','lat','lng'];
                let csvRows = [headers.join(',')];
                
                filtered.forEach(e => {
                    let row = headers.map(h => {
                        let val = e[h] || '';
                        if (Array.isArray(val)) val = val.join(';');
                        return JSON.stringify(val);
                    }).join(',');
                    csvRows.push(row);
                });
                
                let blob = new Blob([csvRows.join('\n')], {type:'text/csv'});
                let url = URL.createObjectURL(blob);
                let a = document.createElement('a'); 
                a.href = url; a.download = 'export.csv'; a.click();
            }
        }

        function showChangePinModal() {
            let html = `
                <div class="modal-overlay" id="pinModal">
                    <div class="modal">
                        <h3>Change PIN</h3>
                        <input type="password" id="oldPin" placeholder="Current PIN" /><br><br>
                        <input type="password" id="newPin1" placeholder="New PIN" /><br><br>
                        <input type="password" id="newPin2" placeholder="Confirm new" /><br><br>
                        <input type="text" id="newPinHint" placeholder="New hint (optional)" /><br><br>
                        <div class="actions">
                            <button class="btn btn-primary" id="submitPinChange">Update</button>
                            <button class="btn btn-outline" id="cancelPinChange">Cancel</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.getElementById('importArea').innerHTML = html;
            
            document.getElementById('submitPinChange')?.addEventListener('click', ()=>{
                let old = document.getElementById('oldPin').value;
                let new1 = document.getElementById('newPin1').value;
                let new2 = document.getElementById('newPin2').value;
                let newHint = document.getElementById('newPinHint').value;
                
                if (!old || !new1 || new1 !== new2) { 
                    alert('Please fill all fields correctly'); 
                    return; 
                }
                
                if (changePin(old, new1, newHint)) {
                    alert('PIN changed successfully');
                    document.getElementById('pinModal').remove();
                    renderApp();
                } else {
                    alert('Wrong current PIN');
                }
            });
            
            document.getElementById('cancelPinChange')?.addEventListener('click', ()=> 
                document.getElementById('pinModal').remove()
            );
        }

        // Initialize
        renderApp();
    })();
