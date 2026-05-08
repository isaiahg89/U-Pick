// UPick app JavaScript
class CollectiveChoice {
    constructor() {
        this.decisions = [];
        this.apiBase = this.resolveApiBase();

        this.init();
    }

    resolveApiBase() {
        if (typeof window === 'undefined' || !window.location) {
            return '/api/decisions';
        }

        const { protocol, hostname, port } = window.location;

        if (protocol === 'file:') {
            return 'http://localhost:3000/api/decisions';
        }

        if ((hostname === 'localhost' || hostname === '127.0.0.1') && port && port !== '3000') {
            return `http://${hostname}:3000/api/decisions`;
        }

        return '/api/decisions';
    }

    async init() {
        this.setupEventListeners();
        await this.loadDecisions();
        this.renderDecisions();
    }

    async request(url, options = {}) {
        let response;

        try {
            response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(options.headers || {})
                },
                ...options
            });
        } catch (_networkError) {
            throw new Error('Could not reach the API server. Start the backend with "npm run dev" and open http://localhost:3000.');
        }

        let payload = null;
        try {
            payload = await response.json();
        } catch (_error) {
            payload = null;
        }

        if (!response.ok) {
            const message = payload && payload.message ? payload.message : 'Request failed';
            const details = payload && payload.error ? payload.error : '';
            const combined = details ? `${message}: ${details}` : message;
            throw new Error(combined);
        }

        return payload;
    }

    normalizeDecision(decision) {
        const mode = decision.selectionMode || 'vote';
        const base = {
            ...decision,
            id: decision._id || decision.id,
            options: Array.isArray(decision.options) ? decision.options : [],
            selectionMode: mode,
            status: decision.status || 'active',
        };

        if (mode === 'vote') {
            const votesFromApi = decision.votes || {};
            const votes = votesFromApi instanceof Map ? Object.fromEntries(votesFromApi) : { ...votesFromApi };
            if (Array.isArray(decision.options)) {
                decision.options.forEach((option) => {
                    if (typeof votes[option] !== 'number') votes[option] = 0;
                });
            }
            return {
                ...base,
                participants: Array.isArray(decision.participants) ? decision.participants : [],
                votes,
                tallyTarget: Number.isFinite(decision.tallyTarget) ? decision.tallyTarget : 0,
                maxParticipants: Number.isFinite(decision.maxParticipants) ? decision.maxParticipants : 10,
            };
        }

        return {
            ...base,
            randomResult: decision.randomResult || '',
        };
    }

    async loadDecisions() {
        try {
            const decisions = await this.request(this.apiBase);
            this.decisions = Array.isArray(decisions) ? decisions.map((item) => this.normalizeDecision(item)) : [];
        } catch (error) {
            this.decisions = [];
            this.showNotification(`Could not load decisions: ${error.message}`, 'error');
        }
    }

    setupEventListeners() {
        document.querySelectorAll('.nav-link').forEach((link) => {
            link.addEventListener('click', (e) => {
                const href = e.target.getAttribute('href');

                if (href && href.startsWith('#')) {
                    e.preventDefault();
                    const targetSection = href.substring(1);
                    this.showSection(targetSection);
                    this.setActiveNavLink(e.target);
                }
            });
        });

        document.getElementById('upick').addEventListener('click', () => {
            this.showCreateDecisionModal();
        });

        document.getElementById('join-pick').addEventListener('click', () => {
            this.showJoinDecisionModal();
        });

        const joinDecisionCard = document.getElementById('join-decision-card');
        if (joinDecisionCard) {
            joinDecisionCard.addEventListener('click', (e) => {
                e.preventDefault();
                this.showJoinDecisionModal();
            });
        }

        document.getElementById('add-decision-btn').addEventListener('click', () => {
            this.showCreateDecisionModal();
        });

        document.getElementById('close-modal').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('modal')) {
                this.closeModal();
            }
        });
    }

    showSection(sectionId) {
        document.querySelectorAll('.section').forEach((section) => {
            section.classList.remove('active');
        });

        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
        }
    }

    setActiveNavLink(activeLink) {
        document.querySelectorAll('.nav-link').forEach((link) => {
            link.classList.remove('active');
        });
        activeLink.classList.add('active');
    }

    showCreateDecisionModal() {
        const modalBody = document.getElementById('modal-body');
        modalBody.innerHTML = `
            <h3>Create New Decision</h3>
            <form id="create-decision-form">
                <div class="form-group">
                    <label for="decision-title">Decision Title:</label>
                    <input type="text" id="decision-title" required placeholder="e.g., Pick our team lunch">
                </div>
                <div class="form-group">
                    <label for="selection-mode">Selection Mode:</label>
                    <select id="selection-mode" required>
                        <option value="vote" selected>Vote mode (participants vote for one option)</option>
                        <option value="random">Random mode (UPick selects one option)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="decision-options">Options (one per line):</label>
                    <textarea id="decision-options" rows="5" required placeholder="Option A&#10;Option B&#10;Option C"></textarea>
                </div>
                <div class="form-group" id="tally-group">
                    <label for="tally-target">Tallies Needed:</label>
                    <input type="number" id="tally-target" min="1" value="5">
                </div>
                <div class="form-group" id="participants-group">
                    <label for="max-participants">Maximum Participants:</label>
                    <input type="number" id="max-participants-input" min="2" max="100" value="10">
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Create Decision</button>
                    <button type="button" class="btn btn-secondary" onclick="collectiveChoice.closeModal()">Cancel</button>
                </div>
            </form>
        `;

        const selectionMode = document.getElementById('selection-mode');
        const tallyGroup = document.getElementById('tally-group');
        const participantsGroup = document.getElementById('participants-group');

        const syncModeFields = () => {
            const isRandom = selectionMode.value === 'random';
            tallyGroup.style.display = isRandom ? 'none' : 'block';
            participantsGroup.style.display = isRandom ? 'none' : 'block';
        };

        selectionMode.addEventListener('change', syncModeFields);
        syncModeFields();

        document.getElementById('create-decision-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createDecision();
        });

        this.showModal();
    }

    showJoinDecisionModal() {
        const modalBody = document.getElementById('modal-body');
        modalBody.innerHTML = `
            <h3>Join Decision</h3>
            <form id="join-decision-form">
                <div class="form-group">
                    <label for="participant-name">Your Name:</label>
                    <input type="text" id="participant-name" required placeholder="Enter your full name">
                </div>
                <div class="form-group">
                    <label for="select-decision">Select Decision:</label>
                    <select id="select-decision" required>
                        <option value="">Choose a decision...</option>
                        ${this.decisions.filter((d) => d.selectionMode === 'vote').map((decision) => `<option value="${decision.id}">${decision.title}</option>`).join('')}
                    </select>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Join Decision</button>
                    <button type="button" class="btn btn-secondary" onclick="collectiveChoice.closeModal()">Cancel</button>
                </div>
            </form>
        `;

        document.getElementById('join-decision-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.joinDecision();
        });

        this.showModal();
    }

    showVoteModal(decisionId) {
        const decision = this.decisions.find((item) => item.id === decisionId);
        if (!decision) {
            this.showNotification('Decision not found', 'error');
            return;
        }

        const modalBody = document.getElementById('modal-body');
        modalBody.innerHTML = `
            <h3>Vote: ${decision.title}</h3>
            <form id="vote-form">
                <div class="form-group">
                    <label for="voter-name">Your Name:</label>
                    <input type="text" id="voter-name" required placeholder="Enter your name">
                </div>
                <div class="form-group">
                    <label>Choose One Option:</label>
                    ${decision.options.map((option, index) => `
                        <label style="display: block; margin-bottom: 8px;">
                            <input type="radio" name="decision-option" value="${option}" ${index === 0 ? 'checked' : ''}>
                            ${option} (${decision.votes[option] || 0} tallies)
                        </label>
                    `).join('')}
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Submit Vote</button>
                    <button type="button" class="btn btn-secondary" onclick="collectiveChoice.closeModal()">Cancel</button>
                </div>
            </form>
        `;

        document.getElementById('vote-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const selected = document.querySelector('input[name="decision-option"]:checked');
            this.submitVote(decisionId, selected ? selected.value : null);
        });

        this.showModal();
    }

    showModal() {
        document.getElementById('modal').style.display = 'block';
    }

    closeModal() {
        document.getElementById('modal').style.display = 'none';
    }

    openVoteRoom(decisionId) {
        window.location.href = `vote.html?decisionId=${encodeURIComponent(decisionId)}`;
    }

    parseOptions(rawOptions) {
        const options = rawOptions
            .split('\n')
            .map((item) => item.trim())
            .filter((item) => item.length > 0);

        return [...new Set(options)];
    }

    async createDecision() {
        const title = document.getElementById('decision-title').value.trim();
        const selectionMode = document.getElementById('selection-mode').value;
        const options = this.parseOptions(document.getElementById('decision-options').value);
        const tallyTarget = parseInt(document.getElementById('tally-target').value, 10) || 1;
        const maxParticipants = parseInt(document.getElementById('max-participants-input').value, 10) || 10;

        if (!title) {
            this.showNotification('Decision title is required', 'error');
            return;
        }

        if (options.length < 2) {
            this.showNotification('Please provide at least 2 options', 'error');
            return;
        }

        const votes = {};
        options.forEach((option) => {
            votes[option] = 0;
        });

        let newDecision;
        if (selectionMode === 'vote') {
            newDecision = { title, selectionMode, tallyTarget, maxParticipants, status: 'active', options, votes };
        } else {
            newDecision = { title, selectionMode, status: 'active', options };
        }

        try {
            const created = await this.request(this.apiBase, {
                method: 'POST',
                body: JSON.stringify(newDecision)
            });

            const normalized = this.normalizeDecision(created);
            this.decisions.unshift(normalized);
            this.renderDecisions();
            this.closeModal();

            if (selectionMode === 'random') {
                const randomized = await this.request(`${this.apiBase}/${normalized.id}/random-pick`, {
                    method: 'POST'
                });

                this.replaceDecision(randomized);
                this.renderDecisions();

                const refreshed = this.decisions.find((item) => item.id === normalized.id);
                this.showNotification(`Random selection: ${refreshed.randomResult}`, 'success');
                return;
            }

            this.showNotification(`Decision "${title}" created. Opening voting room...`, 'success');
            setTimeout(() => {
                this.openVoteRoom(normalized.id);
            }, 350);
        } catch (error) {
            this.showNotification(`Could not create decision: ${error.message}`, 'error');
        }
    }

    async joinDecision() {
        const participantName = document.getElementById('participant-name').value.trim();
        const decisionId = document.getElementById('select-decision').value;

        const decision = this.decisions.find((item) => item.id === decisionId);
        if (!decision) {
            this.showNotification('Please select a valid decision', 'error');
            return;
        }

        if (decision.participants.length >= decision.maxParticipants) {
            this.showNotification('Decision has reached maximum participants', 'error');
            return;
        }

        const existingParticipant = decision.participants.find(
            (participant) => participant.name.toLowerCase() === participantName.toLowerCase()
        );

        if (existingParticipant) {
            this.showNotification('You have already joined this decision', 'error');
            return;
        }

        try {
            const updated = await this.request(`${this.apiBase}/${decisionId}/participants`, {
                method: 'POST',
                body: JSON.stringify({ name: participantName })
            });

            this.replaceDecision(updated);
            this.renderDecisions();
            this.closeModal();
            this.showNotification(`Welcome ${participantName}! Taking you to the voting room...`, 'success');
            setTimeout(() => {
                this.openVoteRoom(decisionId);
            }, 350);
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    async submitVote(decisionId, selectedOption) {
        const decision = this.decisions.find((item) => item.id === decisionId);
        const voterName = document.getElementById('voter-name').value.trim();

        if (!decision || !selectedOption) {
            this.showNotification('Please choose a valid option', 'error');
            return;
        }

        if (!voterName) {
            this.showNotification('Please enter your name to vote', 'error');
            return;
        }

        if (decision.status !== 'active') {
            this.showNotification('This decision is not active', 'error');
            return;
        }

        try {
            const updated = await this.request(`${this.apiBase}/${decisionId}/vote`, {
                method: 'POST',
                body: JSON.stringify({ voterName, option: selectedOption })
            });

            this.replaceDecision(updated);
            this.renderDecisions();
            this.closeModal();

            const refreshed = this.decisions.find((item) => item.id === decisionId);
            if (refreshed.status === 'closed') {
                this.showNotification(`Participant limit reached for "${refreshed.title}". Decision moved to history.`, 'success');
                return;
            }

            this.showNotification('Vote recorded', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    async pickRandomOption(decisionId) {
        const decision = this.decisions.find((item) => item.id === decisionId);
        if (!decision || decision.options.length === 0) {
            this.showNotification('No options available for random selection', 'error');
            return;
        }

        if (decision.status !== 'active') {
            this.showNotification('This decision is not active', 'error');
            return;
        }

        try {
            const updated = await this.request(`${this.apiBase}/${decisionId}/random-pick`, {
                method: 'POST'
            });

            this.replaceDecision(updated);
            this.renderDecisions();
            const refreshed = this.decisions.find((item) => item.id === decisionId);
            this.showNotification(`Random selection: ${refreshed.randomResult}`, 'info');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    manageDecision(decisionId) {
        const decision = this.decisions.find((item) => item.id === decisionId);
        if (!decision) {
            this.showNotification('Decision not found', 'error');
            return;
        }

        const optionsMarkup = decision.options
            .map((option) => {
                const tally = decision.votes[option] || 0;
                return `<li>${option}${decision.selectionMode === 'vote' ? ` - ${tally} tallies` : ''}</li>`;
            })
            .join('');

        const modeSummary =
            decision.selectionMode === 'vote'
                ? `Vote mode | target: ${decision.tallyTarget} tallies`
                : `Random mode${decision.randomResult ? ` | latest pick: ${decision.randomResult}` : ''}`;

        const modalBody = document.getElementById('modal-body');
        modalBody.innerHTML = `
            <h3>${decision.title}</h3>
            <p><strong>Status:</strong> ${decision.status}</p>
            <p><strong>Mode:</strong> ${modeSummary}</p>
            ${decision.selectionMode === 'vote' ? `<p><strong>Participants:</strong> ${decision.participants.length}/${decision.maxParticipants}</p>` : ''}
            <h4>Options</h4>
            <ul>${optionsMarkup}</ul>
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="collectiveChoice.closeModal()">Close</button>
            </div>
        `;

        this.showModal();
    }

    async completeDecision(decisionId) {
        const decision = this.decisions.find((item) => item.id === decisionId);
        if (!decision) {
            this.showNotification('Decision not found', 'error');
            return;
        }

        if (decision.selectionMode !== 'vote') {
            this.showNotification('Only vote decisions can be completed', 'error');
            return;
        }

        if (decision.status !== 'active') {
            this.showNotification('Decision is already completed', 'info');
            return;
        }

        try {
            const updated = await this.request(`${this.apiBase}/${decisionId}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: 'closed' })
            });

            this.replaceDecision(updated);
            this.renderDecisions();
            this.showNotification('Decision completed and moved to history', 'success');
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    replaceDecision(updatedDecision) {
        const normalized = this.normalizeDecision(updatedDecision);
        const index = this.decisions.findIndex((item) => item.id === normalized.id);

        if (index === -1) {
            this.decisions.unshift(normalized);
            return;
        }

        this.decisions[index] = normalized;
    }

    getTimeLeft(deadline) {
        const deadlineMs = new Date(deadline).getTime();
        const diff = deadlineMs - Date.now();

        if (diff <= 0) {
            return 'Closed';
        }

        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        return `${hours}h ${minutes}m`;
    }

    renderDecisions() {
        const activeContainer = document.getElementById('decisions-container');
        const historyContainer = document.getElementById('history-container');

        if (!activeContainer) {
            return;
        }

        activeContainer.innerHTML = '';
        if (historyContainer) {
            historyContainer.innerHTML = '';
        }

        this.decisions.forEach((decision) => {
            const decisionCard = document.createElement('div');
            decisionCard.className = 'decision-card';

            const isVote = decision.selectionMode === 'vote';
            const votedParticipants = isVote ? decision.participants.filter((p) => p.hasVoted).length : 0;
            const participationRate = isVote ? (votedParticipants / decision.participants.length) * 100 || 0 : 0;
            const timeLeft = decision.deadline ? this.getTimeLeft(decision.deadline) : 'No deadline';

            const optionsList = decision.options
                .map((option) => {
                    const tallyText = decision.selectionMode === 'vote' ? ` (${decision.votes[option] || 0})` : '';
                    return `<li>${option}${tallyText}</li>`;
                })
                .join('');

            const modeDetails =
                decision.selectionMode === 'vote'
                    ? `Vote mode | target: ${decision.tallyTarget} tallies`
                    : `Random mode${decision.randomResult ? ` | latest: ${decision.randomResult}` : ''}`;

            const actionButton =
                decision.selectionMode === 'vote'
                    ? `<button class="btn btn-primary btn-sm" onclick="collectiveChoice.openVoteRoom('${decision.id}')">Open Voting Room</button>`
                    : `<button class="btn btn-primary btn-sm" onclick="collectiveChoice.pickRandomOption('${decision.id}')">Random Pick</button>`;

            const completeButton =
                isVote && decision.status === 'active'
                    ? `<button class="btn btn-secondary btn-sm" onclick="collectiveChoice.completeDecision('${decision.id}')">Complete Decision</button>`
                    : '';

            decisionCard.innerHTML = `
                <h3>${decision.title}</h3>
                <div class="decision-meta">
                    <span class="decision-type">${decision.selectionMode === 'vote' ? 'Voting' : 'Random'}</span>
                    <span class="deadline">Deadline: ${timeLeft}</span>
                </div>
                <p>${modeDetails}</p>
                <ul>${optionsList}</ul>
                <div class="decision-info">
                    ${isVote ? `<span class="participant-count">${decision.participants.length}/${decision.maxParticipants} participants</span>
                    <span class="participation-rate">${Math.round(participationRate)}% voted</span>` : ''}
                    <span class="decision-status ${decision.status}">${decision.status}</span>
                </div>
                <div class="decision-actions">
                    ${actionButton}
                    <button class="btn btn-secondary btn-sm" onclick="collectiveChoice.manageDecision('${decision.id}')">View Details</button>
                    ${completeButton}
                </div>
            `;

            const isVoteDecision = decision.selectionMode === 'vote';
            const isCompleted = isVoteDecision && ['closed', 'completed', 'decided'].includes((decision.status || '').toLowerCase());

            if (isCompleted && historyContainer) {
                historyContainer.appendChild(decisionCard);
            } else {
                activeContainer.appendChild(decisionCard);
            }
        });

        if (activeContainer.innerHTML === '') {
            activeContainer.innerHTML = '<p>No active decisions right now.</p>';
        }

        if (historyContainer && historyContainer.innerHTML === '') {
            historyContainer.innerHTML = '<p>No completed decisions in history yet.</p>';
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        if (!document.querySelector('#notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 1rem 1.5rem;
                    border-radius: 5px;
                    color: white;
                    z-index: 3000;
                    animation: slideIn 0.3s ease;
                }
                .notification-success { background: #28a745; }
                .notification-error { background: #dc3545; }
                .notification-info { background: #17a2b8; }
                @keyframes slideIn {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(notification);
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.collectiveChoice = new CollectiveChoice();
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CollectiveChoice;
}