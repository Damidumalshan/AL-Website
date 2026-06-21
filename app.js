/* ============================================================
   A/L EXAMINATION EXCELLENCE PLATFORM — app.js
   Global JavaScript Core
   ============================================================
   TABLE OF CONTENTS
   ---------------------------------------------------------
   1.  Global State Variables
   2.  Master Answer Key Database
   3.  Supabase Configuration & SDK Boot
   4.  App Boot Sequence
   5.  Theme / Light-Dark Mode
   6.  Login Overlay Helpers
   7.  Auth UI Helpers (view switching, loading states, errors)
   8.  Auth Actions (login, signup, forgot password, logout)
   9.  Session Entry & User Data Loading
   10. Per-User Data: Stats & Mistake Bank (Supabase sync)
   11. Exam Progress Cache (Supabase sync)
   12. Dashboard Renderer
   13. Mistake Bank Portal Launcher
   14. Audio & Haptic Utilities
   15. Lightbox Image Viewer
   16. Particle Canvas (Login Background)
   ============================================================ */


/* ============================================================
   1. GLOBAL STATE VARIABLES
   ============================================================ */

let currentSubject          = '';
let currentYear             = '';
let examTimerInterval       = null;
let secondsElapsed          = 0;
let totalExamDurationSeconds = 150 * 60;   // 2.5-hour exam window
let isShuffleMode           = false;
let activeQuestionsArray    = [];
let currentLightboxScale    = 1.0;
let isExamPaused            = false;


/* ============================================================
   2. MASTER ANSWER KEY DATABASE
   ============================================================ */

const ANSWER_KEYS = {
    physics: {
        "2023": [1,2,3,4,5, 1,2,3,4,5, 1,2,3,4,5, 1,2,3,4,5, 1,2,3,4,5, 1,2,3,4,5, 1,2,3,4,5, 1,2,3,4,5, 1,2,3,4,5, 1,2,3,4,5],
        "2022": [5,4,3,2,1, 5,4,3,2,1, 5,4,3,2,1, 5,4,3,2,1, 5,4,3,2,1, 5,4,3,2,1, 5,4,3,2,1, 5,4,3,2,1, 5,4,3,2,1, 5,4,3,2,1],
        "2021": [2,3,4,5,1, 2,3,4,5,1, 2,3,4,5,1, 2,3,4,5,1, 2,3,4,5,1, 2,3,4,5,1, 2,3,4,5,1, 2,3,4,5,1, 2,3,4,5,1, 2,3,4,5,1],
        "2020": [3,3,3,3,3, 3,3,3,3,3, 3,3,3,3,3, 3,3,3,3,3, 3,3,3,3,3, 3,3,3,3,3, 3,3,3,3,3, 3,3,3,3,3, 3,3,3,3,3, 3,3,3,3,3],
        "2019": [1,1,1,1,1, 2,2,2,2,2, 3,3,3,3,3, 4,4,4,4,4, 5,5,5,5,5, 1,1,1,1,1, 2,2,2,2,2, 3,3,3,3,3, 4,4,4,4,4, 5,5,5,5,5]
    },
    chemistry: {
        "2023": [2,2,2,2,2, 2,2,2,2,2, 2,2,2,2,2, 2,2,2,2,2, 2,2,2,2,2, 2,2,2,2,2, 2,2,2,2,2, 2,2,2,2,2, 2,2,2,2,2, 2,2,2,2,2],
        "2022": [3,4,1,2,5, 3,4,1,2,5, 3,4,1,2,5, 3,4,1,2,5, 3,4,1,2,5, 3,4,1,2,5, 3,4,1,2,5, 3,4,1,2,5, 3,4,1,2,5, 3,4,1,2,5]
    },
    biology: {
        "2023": [4,4,4,4,4, 4,4,4,4,4, 4,4,4,4,4, 4,4,4,4,4, 4,4,4,4,4, 4,4,4,4,4, 4,4,4,4,4, 4,4,4,4,4, 4,4,4,4,4, 4,4,4,4,4]
    }
};


/* ============================================================
   3. SUPABASE CONFIGURATION & SDK BOOT
   ============================================================ */

const SUPABASE_URL  = "https://vclgscobwivsnunfntip.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjbGdzY29id2l2c251bmZudGlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0MjcwNjAsImV4cCI6MjA1NDAwMzA2MH0.U8kIq9A_Eby-87h1X1O_F7ZisYmXG_OymIscf8T-jS4";

let supabase = null;
try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
} catch (err) {
    console.error("Critical Failure: Supabase Client SDK could not initialize.", err);
}


/* ============================================================
   4. APP BOOT SEQUENCE
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    bootApp();
});

async function bootApp() {
    initCosmicTheme();
    
    // Check if we are on a protected page (any page that isn't the login index.html)
    const isLoginPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/');
    
    if (!supabase) return;

    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
        console.error("Session verification fault:", error.message);
    }

    if (session && session.user) {
        // User is logged in
        if (isLoginPage) {
            // Redirect from login page to dashboard
            window.location.href = "dashboard.html";
        } else {
            // Initialize logged-in user features on protected pages
            document.getElementById('user-name-display').innerText = session.user.email;
            await loadSystemUserData(session.user.id);
        }
    } else {
        // User is NOT logged in
        if (!isLoginPage) {
            // Kick unauthenticated user out to login screen
            window.location.href = "index.html";
        } else {
            // Setup canvas animation only on the login screen
            startParticleCanvas();
        }
    }
}


/* ============================================================
   5. THEME / LIGHT-DARK MODE
   ============================================================ */

function initCosmicTheme() {
    const savedConfig = localStorage.getItem('lightModeConfig');
    if (savedConfig === 'true') {
        document.body.classList.add('light-mode');
    } else {
        document.body.classList.remove('light-mode');
    }
}

function toggleCosmicLightScheme() {
    document.body.classList.toggle('light-mode');
    localStorage.setItem('lightModeConfig', document.body.classList.contains('light-mode'));
    playSynthBeep(440, 0.05);
}


/* ============================================================
   6. LOGIN OVERLAY HELPERS
   ============================================================ */

function switchAuthView(viewName) {
    // Hide all panels
    document.getElementById('view-login').style.display = 'none';
    document.getElementById('view-signup').style.display = 'none';
    document.getElementById('view-forgot').style.display = 'none';

    // Show selected panel
    if (viewName === 'login')  document.getElementById('view-login').style.display = 'block';
    if (viewName === 'signup') document.getElementById('view-signup').style.display = 'block';
    if (viewName === 'forgot') document.getElementById('view-forgot').style.display = 'block';
}


/* ============================================================
   7. AUTH UI HELPERS
   ============================================================ */

function setAuthLoadingState(btnId, isLoading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (isLoading) {
        btn.disabled = true;
        btn.setAttribute('data-old-text', btn.innerText);
        btn.innerText = "Processing Transaction...";
    } else {
        btn.disabled = false;
        if (btn.hasAttribute('data-old-text')) {
            btn.innerText = btn.getAttribute('data-old-text');
        }
    }
}

function displayAuthNotification(msg, isError = true) {
    const banner = document.getElementById('auth-error-banner');
    if (!banner) return;
    banner.innerText = msg;
    banner.className = isError ? "auth-error active" : "auth-error active success";
    setTimeout(() => { banner.classList.remove('active'); }, 5000);
}


/* ============================================================
   8. AUTH ACTIONS
   ============================================================ */

async function doLogin(e) {
    if(e) e.preventDefault();
    if (!supabase) return;

    const email = document.getElementById('login-email').value.trim();
    const pass  = document.getElementById('login-pass').value;

    if (!email || !pass) {
        displayAuthNotification("Credentials missing standard layout.");
        return;
    }

    setAuthLoadingState('btn-login-submit', true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });

    if (error) {
        displayAuthNotification(error.message);
        setAuthLoadingState('btn-login-submit', false);
    } else {
        window.location.href = "dashboard.html";
    }
}

async function doSignup(e) {
    if(e) e.preventDefault();
    if (!supabase) return;

    const email = document.getElementById('signup-email').value.trim();
    const pass  = document.getElementById('signup-pass').value;

    if (!email || !pass) {
        displayAuthNotification("Signup parameters must be completely filled.");
        return;
    }

    setAuthLoadingState('btn-signup-submit', true);

    const { data, error } = await supabase.auth.signUp({ email, password: pass });

    if (error) {
        displayAuthNotification(error.message);
        setAuthLoadingState('btn-signup-submit', false);
    } else {
        displayAuthNotification("Account created! Check mail infrastructure for verification.", false);
        setAuthLoadingState('btn-signup-submit', false);
        switchAuthView('login');
    }
}

async function doForgotPassword(e) {
    if(e) e.preventDefault();
    if (!supabase) return;

    const email = document.getElementById('forgot-email').value.trim();
    if (!email) {
        displayAuthNotification("Destination email vector missing.");
        return;
    }

    setAuthLoadingState('btn-forgot-submit', true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/index.html?view=reset'
    });

    if (error) {
        displayAuthNotification(error.message);
    } else {
        displayAuthNotification("Recovery link successfully broadcasted to inbox.", false);
    }
    setAuthLoadingState('btn-forgot-submit', false);
}

async function doLogout() {
    if (!supabase) return;
    playSynthBeep(300, 0.1);
    await supabase.auth.signOut();
    window.location.href = "index.html";
}


/* ============================================================
   9. SESSION ENTRY & USER DATA LOADING
   ============================================================ */

async function loadSystemUserData(userId) {
    // Shared bridge to run sync methods across dashboards and matrices
    if (typeof syncUserDashboardMetrics === 'function') {
        await syncUserDashboardMetrics(userId);
    }
    if (typeof loadMatrixEvaluationData === 'function') {
        await loadMatrixEvaluationData(userId);
    }
}


/* ============================================================
   10. PER-USER DATA: STATS & MISTAKE BANK (Supabase sync)
   ============================================================ */

async function pushMetricRecordToSupabase(userId, subject, year, score, total, accuracy, duration) {
    if (!supabase) return;
    try {
        const { error } = await supabase.from('user_stats').insert([{
            user_id: userId,
            subject,
            year,
            score,
            total,
            accuracy,
            duration,
            completed_at: new Date().toISOString()
        }]);
        if (error) console.error("Database compilation fault during push:", error);
    } catch (e) {
        console.error("Metric dispatch failure:", e);
    }
}

async function appendToSupabaseMistakeBank(userId, subject, year, qNum, userAns, correctAns, imgUrl) {
    if (!supabase) return;
    try {
        const { error } = await supabase.from('mistake_bank').insert([{
            user_id: userId,
            subject,
            year,
            question_number: qNum,
            user_answer: userAns,
            correct_answer: correctAns,
            image_url: imgUrl,
            logged_at: new Date().toISOString()
        }]);
        if (error) console.error("Mistake catalog sync failure:", error);
    } catch (e) {
        console.error("Mistake dispatch block exception:", e);
    }
}


/* ============================================================
   11. EXAM PROGRESS CACHE (Supabase sync)
   ============================================================ */

async function fetchSavedSessionCache(userId, subject, year) {
    if (!supabase) return null;
    const { data, error } = await supabase
        .from('exam_progress')
        .select('state_cache')
        .eq('user_id', userId)
        .eq('subject', subject)
        .eq('year', year)
        .maybeSingle();
    return (data && data.state_cache) ? data.state_cache : null;
}

async function updateSavedSessionCache(userId, subject, year, stateObj) {
    if (!supabase) return;
    await supabase.from('exam_progress').upsert({
        user_id: userId,
        subject,
        year,
        state_cache: stateObj,
        updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,subject,year' });
}

async function dropSavedSessionCache(userId, subject, year) {
    if (!supabase) return;
    await supabase.from('exam_progress')
        .delete()
        .eq('user_id', userId)
        .eq('subject', subject)
        .eq('year', year);
}


/* ============================================================
   12. DASHBOARD RENDERER
   ============================================================ */

async function syncUserDashboardMetrics(userId) {
    if (!supabase) return;
    
    // Check if the landing dashboard UI markers exist on this current viewport
    if (!document.getElementById('total-papers-counter')) return;

    const { data: stats, error } = await supabase.from('user_stats').select('*').eq('user_id', userId);
    if (error || !stats) return;

    const count = stats.length;
    document.getElementById('total-papers-counter').innerText = count;

    if (count > 0) {
        const totalAcc = stats.reduce((acc, row) => acc + (row.accuracy || 0), 0);
        const avgAcc   = Math.round(totalAcc / count);
        document.getElementById('average-accuracy-counter').innerText = `${avgAcc}%`;

        // Populate system records tracking panel
        const container = document.getElementById('recent-activity-feed');
        if (container) {
            container.innerHTML = stats.map(row => `
                <div class="activity-card">
                    <div style="font-weight:700; color:var(--accent-glow);">
                        ${row.subject.toUpperCase()} — MCQ ${row.year}
                    </div>
                    <div style="font-size:12px; opacity:0.7; margin-top:4px;">
                        Score: ${row.score}/${row.total} (${row.accuracy}%) | Time Taken: ${Math.floor(row.duration / 60)}m
                    </div>
                </div>
            `).join('');
        }
    }
}


/* ============================================================
   13. MISTAKE BANK PORTAL LAUNCHER
   ============================================================ */

async function initializeMistakePortalView() {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const displayGrid = document.getElementById('mistake-bank-display-grid');
    if (!displayGrid) return;

    displayGrid.innerHTML = `<div class="loading-spinner">Retrieving Vault Assets...</div>`;

    const { data: mistakes, error } = await supabase
        .from('mistake_bank')
        .select('*')
        .eq('user_id', session.user.id)
        .order('logged_at', { ascending: false });

    if (error || !mistakes || mistakes.length === 0) {
        displayGrid.innerHTML = `<div class="empty-notice">Your mistake vault is clear. Excellent profile history!</div>`;
        return;
    }

    displayGrid.innerHTML = mistakes.map(item => `
        <div class="mistake-item-card" id="mistake-card-${item.id}">
            <div class="card-meta">
                ${item.subject.toUpperCase()} ${item.year} — Q.${item.question_number}
            </div>
            ${item.image_url ? `<img src="${item.image_url}" class="mistake-img" onclick="openLightboxModal('${item.image_url}')">` : ''}
            <div class="answers-row">
                <span class="badge badge-wrong">Your Vector: Option ${item.user_answer}</span>
                <span class="badge badge-correct">Correct Vector: Option ${item.correct_answer}</span>
            </div>
            <button class="btn-clear-mistake" onclick="deleteMistakeFromVault(${item.id})">Acknowledge & Wipe</button>
        </div>
    `).join('');
}

async function deleteMistakeFromVault(id) {
    if (!supabase) return;
    const { error } = await supabase.from('mistake_bank').delete().eq('id', id);
    if (!error) {
        const card = document.getElementById(`mistake-card-${id}`);
        if (card) card.remove();
    }
}


/* ============================================================
   14. AUDIO & HAPTIC UTILITIES
   ============================================================ */

function playSynthBeep(freq, duration) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc      = audioCtx.createOscillator();
        const gain     = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.frequency.value = freq; osc.type = 'sine';
        gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
        osc.start(); osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
}

function triggerHapticPulse(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
}


/* ============================================================
   15. LIGHTBOX IMAGE VIEWER
   ============================================================ */

function openLightboxModal(imageSrc) {
    const lightboxImg = document.getElementById('lightbox-image-target');
    const lightboxModal = document.getElementById('global-lightbox');
    if (!lightboxImg || !lightboxModal) return;

    lightboxImg.src = imageSrc;
    lightboxModal.classList.add('active');
    resetLightboxZoom();
}

function closeLightboxModal() {
    const lightboxModal = document.getElementById('global-lightbox');
    if (lightboxModal) lightboxModal.classList.remove('active');
}

function adjustLightboxZoom(amount) {
    const lightboxImg = document.getElementById('lightbox-image-target');
    if (!lightboxImg) return;
    currentLightboxScale = Math.max(0.5, Math.min(4.0, currentLightboxScale + amount));
    lightboxImg.style.transform = `scale(${currentLightboxScale})`;
}

function resetLightboxZoom() {
    const lightboxImg = document.getElementById('lightbox-image-target');
    if (lightboxImg) lightboxImg.style.transform = 'scale(1)';
    currentLightboxScale = 1.0;
}


/* ============================================================
   16. PARTICLE CANVAS (Login Background Layout)
   ============================================================ */

let animId = null;
function startParticleCanvas() {
    const canvas = document.getElementById('science-network');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    let particles = [];

    function init() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        particles = [];
        const count = Math.min(60, Math.floor((width * height) / 25000));
        for (let i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 1.5,
                vy: (Math.random() - 0.5) * 1.5,
                radius: Math.random() * 2.5 + 1.5
            });
        }
    }

    function draw() {
        if (!document.getElementById('science-network')) {
            cancelAnimationFrame(animId);
            return;
        }
        
        ctx.clearRect(0, 0, width, height);
        const col = document.body.classList.contains('light-mode') ? '50,60,80' : '59,130,246';

        particles.forEach((p, i) => {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0 || p.x > width)  p.vx *= -1;
            if (p.y < 0 || p.y > height)  p.vy *= -1;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${col},0.9)`;
            ctx.fill();

            for (let j = i + 1; j < particles.length; j++) {
                const p2   = particles[j];
                const dx   = p.x - p2.x;
                const dy   = p.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 150) {
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.strokeStyle = `rgba(${col},${0.9 - dist / 150})`;
                    ctx.lineWidth   = 0.8;
                    ctx.stroke();
                }
            }
        });

        animId = requestAnimationFrame(draw);
    }

    window.addEventListener('resize', init);
    init();
    draw();
}