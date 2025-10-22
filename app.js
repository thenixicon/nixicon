// Global state
const App = {
    user: null,
    token: localStorage.getItem('token'),
    socket: null,
    currentProject: null
};

// API helper
const API = {
    baseURL: '/api',
    
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(App.token && { 'Authorization': `Bearer ${App.token}` })
            },
            ...options
        };
        
        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }
        
        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Request failed');
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },
    
    // Auth methods
    async login(email, password) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: { email, password }
        });
        App.user = data.data.user;
        App.token = data.data.token;
        localStorage.setItem('token', App.token);
        return data;
    },
    
    async register(name, email, password) {
        const data = await this.request('/auth/register', {
            method: 'POST',
            body: { name, email, password }
        });
        App.user = data.data.user;
        App.token = data.data.token;
        localStorage.setItem('token', App.token);
        return data;
    },
    
    async getCurrentUser() {
        if (!App.token) return null;
        try {
            const data = await this.request('/auth/me');
            App.user = data.data.user;
            return data.data.user;
        } catch (error) {
            localStorage.removeItem('token');
            App.token = null;
            return null;
        }
    },
    
    // Project methods
    async getProjects() {
        return await this.request('/projects');
    },
    
    async createProject(projectData) {
        return await this.request('/projects', {
            method: 'POST',
            body: projectData
        });
    },
    
    async getProject(id) {
        return await this.request(`/projects/${id}`);
    },
    
    async updateProject(id, data) {
        return await this.request(`/projects/${id}`, {
            method: 'PUT',
            body: data
        });
    },
    
    async deleteProject(id) {
        return await this.request(`/projects/${id}`, {
            method: 'DELETE'
        });
    },
    
    // AI generation
    async generateFeatures(projectId, prompt) {
        return await this.request(`/projects/${projectId}/ai-generate`, {
            method: 'POST',
            body: { prompt }
        });
    },
    
    // Chat methods
    async getMessages(projectId) {
        return await this.request(`/chat/projects/${projectId}/messages`);
    },
    
    async sendMessage(projectId, content, attachments = []) {
        return await this.request(`/chat/projects/${projectId}/messages`, {
            method: 'POST',
            body: { content, attachments }
        });
    },
    
    // Payment methods
    async createPaymentIntent(amount, projectId) {
        return await this.request('/payments/create-payment-intent', {
            method: 'POST',
            body: { amount, projectId }
        });
    },
    
    async confirmPayment(paymentIntentId, projectId) {
        return await this.request('/payments/confirm-payment', {
            method: 'POST',
            body: { paymentIntentId, projectId }
        });
    }
};

// UI Components
const UI = {
    // Show/hide modals
    showModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    },
    
    hideModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    },
    
    // Show notifications
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#007bff'};
            color: white;
            border-radius: 4px;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    },
    
    // Update header based on auth state
    updateHeader() {
        const headerActions = document.querySelector('.header-actions');
        if (!headerActions) return;
        
        if (App.user) {
            headerActions.innerHTML = `
                <div class="user-menu">
                    <span>Welcome, ${App.user.name}</span>
                    <div class="dropdown">
                        <button class="dropdown-toggle">▼</button>
                        <div class="dropdown-menu">
                            <a href="#" onclick="UI.showModal('dashboard-modal')">Dashboard</a>
                            <a href="#" onclick="Auth.logout()">Logout</a>
                        </div>
                    </div>
                </div>
            `;
        } else {
            headerActions.innerHTML = `
                <a class="link" href="#" onclick="UI.showModal('login-modal')">Sign in</a>
                <a class="btn btn-outline" href="#" onclick="UI.showModal('register-modal')">Become a Creator</a>
                <a class="btn btn-primary" href="#" onclick="UI.showModal('builder-modal')">Start Building</a>
            `;
        }
    },
    
    // Load projects into dashboard
    async loadProjects() {
        try {
            const response = await API.getProjects();
            const projects = response.data.projects;
            
            const projectsContainer = document.getElementById('projects-container');
            if (!projectsContainer) return;
            
            if (projects.length === 0) {
                projectsContainer.innerHTML = `
                    <div class="empty-state">
                        <h3>No projects yet</h3>
                        <p>Create your first project to get started</p>
                        <button class="btn btn-primary" onclick="UI.showModal('builder-modal')">Create Project</button>
                    </div>
                `;
                return;
            }
            
            projectsContainer.innerHTML = projects.map(project => `
                <div class="project-card" data-project-id="${project._id}">
                    <h3>${project.title}</h3>
                    <p>${project.description}</p>
                    <div class="project-meta">
                        <span class="status status-${project.status}">${project.status}</span>
                        <span class="category">${project.category}</span>
                    </div>
                    <div class="project-actions">
                        <button class="btn btn-sm" onclick="ProjectManager.openProject('${project._id}')">View</button>
                        <button class="btn btn-sm btn-outline" onclick="ProjectManager.editProject('${project._id}')">Edit</button>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading projects:', error);
            UI.showNotification('Failed to load projects', 'error');
        }
    }
};

// Authentication
const Auth = {
    async login(email, password) {
        try {
            await API.login(email, password);
            UI.updateHeader();
            UI.hideModal('login-modal');
            UI.showNotification('Login successful!', 'success');
            
            // Load dashboard if it exists
            if (document.getElementById('dashboard-modal')) {
                UI.loadProjects();
            }
        } catch (error) {
            UI.showNotification(error.message, 'error');
        }
    },
    
    async register(name, email, password) {
        try {
            await API.register(name, email, password);
            UI.updateHeader();
            UI.hideModal('register-modal');
            UI.showNotification('Registration successful!', 'success');
            
            // Load dashboard if it exists
            if (document.getElementById('dashboard-modal')) {
                UI.loadProjects();
            }
        } catch (error) {
            UI.showNotification(error.message, 'error');
        }
    },
    
    logout() {
        App.user = null;
        App.token = null;
        localStorage.removeItem('token');
        UI.updateHeader();
        UI.showNotification('Logged out successfully', 'success');
    }
};

// Project Management
const ProjectManager = {
    async createProject(projectData) {
        try {
            const response = await API.createProject(projectData);
            UI.hideModal('builder-modal');
            UI.showNotification('Project created successfully!', 'success');
            
            // Reload projects if dashboard is open
            if (document.getElementById('projects-container')) {
                UI.loadProjects();
            }
        } catch (error) {
            UI.showNotification(error.message, 'error');
        }
    },
    
    async openProject(projectId) {
        try {
            const response = await API.getProject(projectId);
            App.currentProject = response.data.project;
            UI.showModal('project-modal');
            this.loadProjectDetails();
        } catch (error) {
            UI.showNotification(error.message, 'error');
        }
    },
    
    loadProjectDetails() {
        if (!App.currentProject) return;
        
        const modal = document.getElementById('project-modal');
        if (!modal) return;
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${App.currentProject.title}</h2>
                    <button class="close-btn" onclick="UI.hideModal('project-modal')">×</button>
                </div>
                <div class="modal-body">
                    <p>${App.currentProject.description}</p>
                    <div class="project-status">
                        <span class="status status-${App.currentProject.status}">${App.currentProject.status}</span>
                    </div>
                    <div class="project-features">
                        <h3>Features</h3>
                        ${App.currentProject.features ? App.currentProject.features.map(feature => `
                            <div class="feature-item">
                                <h4>${feature.name}</h4>
                                <p>${feature.description}</p>
                                <span class="complexity">${feature.complexity}</span>
                            </div>
                        `).join('') : '<p>No features defined yet</p>'}
                    </div>
                </div>
            </div>
        `;
    },
    
    async generateFeatures(prompt) {
        if (!App.currentProject) return;
        
        try {
            const response = await API.generateFeatures(App.currentProject._id, prompt);
            UI.showNotification('Features generated successfully!', 'success');
            this.loadProjectDetails();
        } catch (error) {
            UI.showNotification(error.message, 'error');
        }
    }
};

// Mobile drawer toggle
const navToggle = document.querySelector('.nav-toggle');
const mobileMenu = document.getElementById('mobile-menu');
const overlay = document.getElementById('overlay');
const drawerClose = document.querySelector('.drawer-close');
function setMobileOpen(isOpen){
    if(!mobileMenu || !overlay) return;
    mobileMenu.style.display = isOpen ? 'block' : 'none';
    overlay.style.display = isOpen ? 'block' : 'none';
    document.body.classList.toggle('mobile-open', isOpen);
    if(navToggle) navToggle.setAttribute('aria-expanded', String(isOpen));
}
if (navToggle && mobileMenu) {
    navToggle.addEventListener('click', () => setMobileOpen(mobileMenu.style.display !== 'block'));
}
if (overlay) overlay.addEventListener('click', () => setMobileOpen(false));
if (drawerClose) drawerClose.addEventListener('click', () => setMobileOpen(false));

// Count up animations for stats
function animateCount(el){
    const target = Number(el.getAttribute('data-count')) || 0;
    const duration = 1200;
    const start = performance.now();
    function step(ts){
        const p = Math.min(1, (ts - start)/duration);
        const val = Math.floor(p * target);
        el.textContent = target >= 100 ? `${val}+` : `${val}%`;
        if(p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// Cookie Management
const CookieManager = {
    // Cookie categories
    categories: {
        necessary: true, // Always true, cannot be disabled
        analytics: false,
        marketing: false,
        functional: false
    },
    
    // Initialize cookie banner
    init() {
        // Check if user has already made a choice
        const cookieConsent = localStorage.getItem('cookieConsent');
        if (!cookieConsent) {
            this.showBanner();
        } else {
            const consent = JSON.parse(cookieConsent);
            this.categories = { ...this.categories, ...consent };
            this.applyCookieSettings();
        }
        
        this.setupEventListeners();
    },
    
    // Show cookie banner
    showBanner() {
        const banner = document.getElementById('cookie-banner');
        if (banner) {
            banner.style.display = 'block';
            setTimeout(() => banner.classList.add('show'), 100);
        }
    },
    
    // Hide cookie banner
    hideBanner() {
        const banner = document.getElementById('cookie-banner');
        if (banner) {
            banner.classList.remove('show');
            setTimeout(() => banner.style.display = 'none', 300);
        }
    },
    
    // Setup event listeners
    setupEventListeners() {
        // Accept all cookies
        const acceptAllBtn = document.getElementById('cookie-accept-all');
        if (acceptAllBtn) {
            acceptAllBtn.addEventListener('click', () => {
                this.acceptAll();
            });
        }
        
        // Accept necessary only
        const acceptNecessaryBtn = document.getElementById('cookie-accept-necessary');
        if (acceptNecessaryBtn) {
            acceptNecessaryBtn.addEventListener('click', () => {
                this.acceptNecessary();
            });
        }
        
        // Open settings
        const settingsBtn = document.getElementById('cookie-settings');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                UI.showModal('cookie-settings-modal');
            });
        }
        
        // Save preferences
        const savePrefsBtn = document.getElementById('save-cookie-preferences');
        if (savePrefsBtn) {
            savePrefsBtn.addEventListener('click', () => {
                this.savePreferences();
            });
        }
        
        // Accept all from settings
        const acceptAllSettingsBtn = document.getElementById('accept-all-cookies');
        if (acceptAllSettingsBtn) {
            acceptAllSettingsBtn.addEventListener('click', () => {
                this.acceptAll();
            });
        }
    },
    
    // Accept all cookies
    acceptAll() {
        this.categories = {
            necessary: true,
            analytics: true,
            marketing: true,
            functional: true
        };
        this.saveConsent();
        this.hideBanner();
        UI.hideModal('cookie-settings-modal');
        UI.showNotification('Cookie preferences saved!', 'success');
    },
    
    // Accept necessary cookies only
    acceptNecessary() {
        this.categories = {
            necessary: true,
            analytics: false,
            marketing: false,
            functional: false
        };
        this.saveConsent();
        this.hideBanner();
        UI.showNotification('Cookie preferences saved!', 'success');
    },
    
    // Save preferences from settings modal
    savePreferences() {
        const analytics = document.getElementById('analytics-cookies').checked;
        const marketing = document.getElementById('marketing-cookies').checked;
        const functional = document.getElementById('functional-cookies').checked;
        
        this.categories = {
            necessary: true,
            analytics,
            marketing,
            functional
        };
        
        this.saveConsent();
        this.hideBanner();
        UI.hideModal('cookie-settings-modal');
        UI.showNotification('Cookie preferences saved!', 'success');
    },
    
    // Save consent to localStorage
    saveConsent() {
        localStorage.setItem('cookieConsent', JSON.stringify(this.categories));
        this.applyCookieSettings();
    },
    
    // Apply cookie settings
    applyCookieSettings() {
        // Analytics cookies
        if (this.categories.analytics) {
            this.enableAnalytics();
        } else {
            this.disableAnalytics();
        }
        
        // Marketing cookies
        if (this.categories.marketing) {
            this.enableMarketing();
        } else {
            this.disableMarketing();
        }
        
        // Functional cookies
        if (this.categories.functional) {
            this.enableFunctional();
        } else {
            this.disableFunctional();
        }
    },
    
    // Enable analytics tracking
    enableAnalytics() {
        // Google Analytics or other analytics
        console.log('Analytics cookies enabled');
        // Add your analytics code here
    },
    
    // Disable analytics tracking
    disableAnalytics() {
        console.log('Analytics cookies disabled');
        // Disable analytics code here
    },
    
    // Enable marketing tracking
    enableMarketing() {
        console.log('Marketing cookies enabled');
        // Add marketing tracking code here
    },
    
    // Disable marketing tracking
    disableMarketing() {
        console.log('Marketing cookies disabled');
        // Disable marketing code here
    },
    
    // Enable functional cookies
    enableFunctional() {
        console.log('Functional cookies enabled');
        // Enable enhanced functionality
    },
    
    // Disable functional cookies
    disableFunctional() {
        console.log('Functional cookies disabled');
        // Disable enhanced functionality
    },
    
    // Get current consent
    getConsent() {
        return this.categories;
    },
    
    // Reset consent (for testing)
    resetConsent() {
        localStorage.removeItem('cookieConsent');
        this.categories = {
            necessary: true,
            analytics: false,
            marketing: false,
            functional: false
        };
        this.showBanner();
    }
};

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize cookie management
    CookieManager.init();
    
    // Animate stats
    document.querySelectorAll('.stat .num').forEach(animateCount);
    
    // Check for existing auth
    if (App.token) {
        await API.getCurrentUser();
    }
    
    // Update header
    UI.updateHeader();
    
    // Add modal event listeners
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            UI.hideModal(e.target.id);
        }
    });
    
    // Add form handlers
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            await Auth.login(formData.get('email'), formData.get('password'));
        });
    }
    
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            await Auth.register(formData.get('name'), formData.get('email'), formData.get('password'));
        });
    }
    
    const builderForm = document.getElementById('builder-form');
    if (builderForm) {
        builderForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const projectData = {
                title: formData.get('title'),
                description: formData.get('description'),
                category: formData.get('category')
            };
            await ProjectManager.createProject(projectData);
        });
    }
});


