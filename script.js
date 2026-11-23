// ============================================================
// COREINVADERS — Frontend JavaScript (GitHub Pages Edition)
// ============================================================

/**
 * CONFIGURACIÓN DE CONEXIÓN CON GOOGLE APPS SCRIPT
 * -------------------------------------------------------------
 * URL de tu aplicación web de Google Apps Script:
 */
const GOOGLE_SCRIPT_API_URL = "https://script.google.com/macros/s/AKfycbz4PPN-SJGuzwzVLr7iShBe3jZyXp1V--Ws0P-XRJStjwC2hLLmtz0z70l9-dpyxtaA/exec";

// ---- ADAPTADOR / POLYFILL PARA GOOGLE.SCRIPT.RUN ----
if (typeof window.google === 'undefined') {
    window.google = {};
}
if (!window.google.script) {
    window.google.script = {};
}

window.google.script.run = new Proxy({}, {
    get(target, prop) {
        let onSuccess = () => { };
        let onFailure = (err) => {
            console.error('[API Error]', err);
            if (typeof showToast === 'function') {
                showToast(err.message || 'Error de conexión', 'error');
            }
        };

        const runner = {
            withSuccessHandler(fn) {
                onSuccess = fn;
                return runner;
            },
            withFailureHandler(fn) {
                onFailure = fn;
                return runner;
            }
        };

        return new Proxy(runner, {
            get(runnerTarget, funcName) {
                if (funcName in runnerTarget) {
                    return runnerTarget[funcName];
                }
                return function (...args) {
                    if (!GOOGLE_SCRIPT_API_URL || GOOGLE_SCRIPT_API_URL.includes("PEGA_AQUI")) {
                        console.warn('[CoreInvaders] GOOGLE_SCRIPT_API_URL no está configurada para llamar a: ' + funcName);
                        return;
                    }

                    // Se envía mediante GET con parámetros URL para evitar el error 411 / CORS en la redirección de Google Apps Script
                    const params = new URLSearchParams();
                    params.append('action', funcName);
                    params.append('args', JSON.stringify(args));

                    fetch(GOOGLE_SCRIPT_API_URL + '?' + params.toString(), {
                        method: 'GET',
                        mode: 'cors'
                    })
                        .then(response => {
                            if (!response.ok) {
                                throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                            }
                            return response.json();
                        })
                        .then(data => {
                            if (data && data.error) {
                                onFailure(new Error(data.error));
                            } else {
                                onSuccess(data);
                            }
                        })
                        .catch(err => {
                            onFailure(err);
                        });
                };
            }
        });
    }
});

// ============================================================
// COREINVADERS — Frontend JavaScript
// ============================================================

let isAdmin = false;
let adminInfo = null;
let currentSection = 'inicio';
let previousSection = 'historial';
let countdownIntervals = [];
let chatRefreshInterval = null;
let torneoAutoRefreshInterval = null;

// ---- INICIALIZACIÓN INMEDIATA ----
function initApp() {
    try {
        createParticles();
    } catch (e) {
        console.warn('Particles error:', e);
    }

    // Scroll navbar
    window.addEventListener('scroll', () => {
        const navbar = document.getElementById('navbar');
        if (navbar) {
            if (window.scrollY > 40) navbar.classList.add('scrolled');
            else navbar.classList.remove('scrolled');
        }
    });

    // Carga inicial completa
    loadInitialData();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// ---- PARTICULAS DE FONDO ----
function createParticles() {
    const container = document.getElementById('particles-bg');
    if (!container) return;
    const colors = ['#00e5ff', '#6c3baa', '#ffab00', '#00b4ff'];
    for (let i = 0; i < 40; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random() * 100 + '%';
        p.style.animationDuration = (6 + Math.random() * 8) + 's';
        p.style.animationDelay = (Math.random() * 6) + 's';
        const size = (2 + Math.random() * 2.5) + 'px';
        p.style.width = size;
        p.style.height = size;
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        container.appendChild(p);
    }
}

// ---- TOASTS ----
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span class="toast-text">${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.transition = 'opacity 0.3s';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ---- NAVEGACIÓN ENTRE SECCIONES ----
function showSection(section) {
    currentSection = section;

    // Limpiar auto-refresh del torneo si salimos de la sección
    if (section !== 'torneo-detalle' && torneoAutoRefreshInterval) {
        clearInterval(torneoAutoRefreshInterval);
        torneoAutoRefreshInterval = null;
    }

    // Ocultar todas las secciones
    document.querySelectorAll('[id^="sec-"]').forEach(el => {
        el.classList.add('section-hidden');
    });

    // Mostrar la sección seleccionada
    const target = document.getElementById('sec-' + section);
    if (target) {
        target.classList.remove('section-hidden');
    }

    // Actualizar botones de navegación
    document.querySelectorAll('.nav-link-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-section') === section) {
            btn.classList.add('active');
        }
    });

    // Cerrar menú móvil
    const navLinks = document.getElementById('navLinks');
    if (navLinks) navLinks.classList.remove('open');
    const hamburger = document.getElementById('hamburger');
    if (hamburger) hamburger.classList.remove('active');

    // Subir el scroll
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Cargas específicas por sección
    try {
        if (section === 'chat') loadChat();
        else if (section === 'historial') loadHistorial();
        else if (section === 'noticias') loadNoticias();
        else if (section === 'torneo') loadTorneoRegistro();
        else if (section === 'torneo-detalle') { /* loaded via openTorneoDetalle */ }
        else if (section === 'admin' && isAdmin) loadAdminData();
    } catch (err) {
        console.error('Error al cargar sección:', err);
    }
}

function toggleMenu() {
    const nav = document.getElementById('navLinks');
    const btn = document.getElementById('hamburger');
    if (nav) nav.classList.toggle('open');
    if (btn) btn.classList.toggle('active');
}

// ---- DATOS INICIALES Y SINCRONIZACIÓN DE TORNEO ----
function loadInitialData() {
    if (typeof google === 'undefined' || !google.script || !google.script.run) {
        return;
    }

    // Cargar configuración
    google.script.run
        .withSuccessHandler(config => {
            if (!config) return;
            if (config.bannerURL) {
                const img = document.getElementById('heroBannerImg');
                if (img) img.src = config.bannerURL;
            }
            if (config.acercaDe) {
                const txt = document.getElementById('acercaTexto');
                if (txt) txt.textContent = config.acercaDe;
            }
        })
        .withFailureHandler(err => console.warn('Config warning:', err))
        .getAllConfig();

    // Cargar y sincronizar torneos (Menú, Portada, Estado)
    google.script.run
        .withSuccessHandler(torneos => {
            syncTournamentUI(torneos || []);
        })
        .withFailureHandler(err => console.warn('Torneos sync warning:', err))
        .getTorneos();

    // Noticias en Inicio
    google.script.run
        .withSuccessHandler(noticias => {
            if (Array.isArray(noticias)) renderNewsPreview(noticias.slice(0, 3));
        })
        .withFailureHandler(err => console.warn('Noticias preview warning:', err))
        .getNoticias();

    // Banners adicionales
    google.script.run
        .withSuccessHandler(banners => {
            if (Array.isArray(banners)) renderExtraBanners(banners);
        })
        .withFailureHandler(err => console.warn('Banners warning:', err))
        .getBanners();
}

// ---- SINCRONIZAR UI DE TORNEOS (NAVBAR + INICIO) ----
function syncTournamentUI(torneos) {
    const navTorneo = document.getElementById('navTorneo');
    const navBadge = document.getElementById('navTorneoBadge');
    const heroBtn = document.getElementById('heroTorneoBtn');
    const homeSec = document.getElementById('sec-home-torneo');
    const homeCard = document.getElementById('homeTorneoCard');

    const activos = torneos.filter(t => t.estado === 'activo' || t.estado === 'proximamente' || t.estado === 'en curso');

    if (activos.length === 0) {
        // Si no hay torneos habilitados por el admin, se oculta del menú y de inicio
        if (navTorneo) navTorneo.style.display = 'none';
        if (heroBtn) heroBtn.style.display = 'none';
        if (homeSec) homeSec.style.display = 'none';
        return;
    }

    // Habilitar en el Menú desplegable
    if (navTorneo) navTorneo.style.display = '';
    if (heroBtn) heroBtn.style.display = 'inline-flex';

    const tieneActivo = activos.some(t => t.estado === 'activo');
    if (navBadge) {
        navBadge.style.display = 'inline-block';
        navBadge.textContent = tieneActivo ? 'ABIERTO' : 'PRÓXIMO';
    }

    // Mostrar tarjeta destacada en la Página de Inicio
    if (homeSec && homeCard) {
        homeSec.style.display = 'block';
        const mainTorneo = activos[0];
        const tipoLabel = mainTorneo.tipo === '1v1' ? '⚔️ 1 vs 1 (Individual)' :
            mainTorneo.tipo === '3v3' ? '👥 3 vs 3 (Equipos)' : '🏟️ 5 vs 5 (Equipos)';

        if (mainTorneo.estado === 'en curso') {
            homeCard.innerHTML = `
        <div class="card tournament-card animate-in" style="border-left:5px solid var(--blue-neon);padding:25px;cursor:pointer;" onclick="openTorneoDetalle('${mainTorneo.id}')">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
            <span class="tournament-type">${tipoLabel}</span>
            <span class="tournament-status status-encurso">⚔️ ¡EN CURSO!</span>
          </div>
          <h3 style="font-family:'Orbitron';font-size:1.6rem;color:#fff;margin:15px 0 8px;">${escapeHtml(mainTorneo.nombre)}</h3>
          <p style="color:var(--text-secondary);font-size:1.05rem;margin-bottom:20px;">
            ¡El torneo está en curso! Haz click para ver los enfrentamientos y el bracket en vivo.
          </p>
          <button type="button" class="btn btn-primary" style="font-size:1.1rem;padding:14px 30px;" onclick="event.stopPropagation();openTorneoDetalle('${mainTorneo.id}')">
            🏆 VER BRACKET EN VIVO
          </button>
        </div>
      `;
        } else if (mainTorneo.estado === 'activo') {
            homeCard.innerHTML = `
        <div class="card tournament-card animate-in" style="border-left:5px solid var(--green-neon);padding:25px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
            <span class="tournament-type">${tipoLabel}</span>
            <span class="tournament-status status-activo">✅ ¡REGISTROS ABIERTOS! (MÁXIMO 8 CUPOS)</span>
          </div>
          <h3 style="font-family:'Orbitron';font-size:1.6rem;color:#fff;margin:15px 0 8px;">${escapeHtml(mainTorneo.nombre)}</h3>
          <p style="color:var(--text-secondary);font-size:1.05rem;margin-bottom:20px;">
            ¡El torneo ha sido habilitado por los administradores! Inscribe tu nick o escuadra antes de que se agoten los 8 cupos disponibles.
          </p>
          <button type="button" class="btn btn-gold" style="font-size:1.1rem;padding:14px 30px;" onclick="showSection('torneo')">
            ⚡ ¡IR AL FORMULARIO DE REGISTRO!
          </button>
        </div>
      `;
        } else {
            homeCard.innerHTML = `
        <div class="card tournament-card animate-in" style="border-left:5px solid var(--gold);padding:25px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
            <span class="tournament-type">${tipoLabel}</span>
            <span class="tournament-status status-proximamente">🕐 PRÓXIMAMENTE</span>
          </div>
          <h3 style="font-family:'Orbitron';font-size:1.6rem;color:#fff;margin:15px 0 8px;">${escapeHtml(mainTorneo.nombre)}</h3>
          <p class="text-center text-gold mt-20" style="font-size:1.15rem;font-weight:700;">
            📅 El registro se apertura el día <strong>${mainTorneo.fechaApertura || 'Por definir'}</strong> a las <strong>${mainTorneo.horaApertura || 'Por definir'}</strong>
          </p>
          <div class="countdown" id="homeCountdown"></div>
          <div style="text-align:center;margin-top:20px;">
            <button type="button" class="btn btn-outline" onclick="showSection('torneo')">
              🎮 Ver Detalles del Torneo
            </button>
          </div>
        </div>
      `;
            if (mainTorneo.fechaApertura) {
                startCountdown('homeCountdown', mainTorneo.fechaApertura, mainTorneo.horaApertura);
            }
        }
    }
}

// ---- NOTICIAS ----
function renderNewsPreview(noticias) {
    const container = document.getElementById('newsPreview');
    if (!container) return;
    if (!noticias || noticias.length === 0) {
        container.innerHTML = '<p class="text-center text-muted">No hay noticias publicadas por ahora.</p>';
        return;
    }
    // Cache for modal
    noticias.forEach(n => {
        if (!_allNewsCache.find(x => x.id === n.id)) _allNewsCache.push(n);
    });
    container.innerHTML = noticias.map(n => renderNewsCard(n)).join('');
}

function loadNoticias() {
    if (typeof google === 'undefined') return;
    google.script.run
        .withSuccessHandler(noticias => {
            const container = document.getElementById('newsFull');
            const noMsg = document.getElementById('noNewsMsg');
            if (!noticias || noticias.length === 0) {
                if (container) container.innerHTML = '';
                if (noMsg) noMsg.style.display = '';
                return;
            }
            if (noMsg) noMsg.style.display = 'none';
            // Cache for modal
            _allNewsCache = noticias;
            if (container) container.innerHTML = noticias.map(n => renderNewsCard(n)).join('');
        })
        .withFailureHandler(e => showToast('Error al cargar noticias', 'error'))
        .getNoticias();
}

// ---- GLOBAL NEWS STORE (for modal) ----
let _allNewsCache = [];

function renderNewsCard(n) {
    let media = '';
    if (n.imagenURL) {
        media = `<img src="${escapeHtml(n.imagenURL)}" alt="${escapeHtml(n.titulo)}" onerror="this.style.display='none'">`;
    }
    if (n.videoURL) {
        const videoId = extractYouTubeId(n.videoURL);
        if (videoId) {
            media += `<div class="video-embed"><iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe></div>`;
        }
    }
    return `
    <div class="card news-card" onclick="openNewsModal('${escapeHtml(n.id || '')}')">
      ${media}
      <h3>${escapeHtml(n.titulo)}</h3>
      <div class="news-date">📅 ${n.fecha || ''} ${n.autor ? '• Por ' + escapeHtml(n.autor) : ''}</div>
      <p>${escapeHtml(n.contenido)}</p>
      <div class="news-card-footer">📖 Leer más →</div>
    </div>
  `;
}

// ---- NEWS DETAIL MODAL ----
function openNewsModal(newsId) {
    const n = _allNewsCache.find(x => x.id === newsId);
    if (!n) return;

    const modal = document.getElementById('newsModal');
    const content = document.getElementById('newsModalContent');
    if (!modal || !content) return;

    let imageHtml = '';
    if (n.imagenURL) {
        imageHtml = `<img class="news-modal-image" src="${escapeHtml(n.imagenURL)}" alt="${escapeHtml(n.titulo)}" onerror="this.style.display='none'">`;
    }

    let videoHtml = '';
    if (n.videoURL) {
        const videoId = extractYouTubeId(n.videoURL);
        if (videoId) {
            videoHtml = `<div class="news-modal-video"><iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe></div>`;
        }
    }

    content.innerHTML = `
            ${imageHtml}
            <div class="news-modal-body">
                <h2>${escapeHtml(n.titulo)}</h2>
                <div class="news-modal-meta">📅 ${n.fecha || ''} ${n.autor ? '• Por ' + escapeHtml(n.autor) : ''}</div>
                <div class="news-modal-content">${escapeHtml(n.contenido)}</div>
                ${videoHtml}
            </div>
        `;

    modal.classList.add('active');
}

function closeNewsModal() {
    const modal = document.getElementById('newsModal');
    if (modal) modal.classList.remove('active');
}

function extractYouTubeId(url) {
    if (!url) return null;
    const regex = /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// ---- BANNERS ----
function renderExtraBanners(banners) {
    const container = document.getElementById('bannersExtra');
    if (!container) return;
    const activeBanners = banners.filter(b => b.activo);
    if (activeBanners.length === 0) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = activeBanners.map(b => `
    <div class="banner-carousel" style="margin-bottom:15px;">
      <img src="${escapeHtml(b.imagenURL)}" alt="${escapeHtml(b.titulo)}" onerror="this.parentElement.style.display='none'">
      ${b.titulo ? `<div class="banner-title-overlay">${escapeHtml(b.titulo)}</div>` : ''}
    </div>
  `).join('');
}

// ---- REGISTRO AL CLAN ----
function registrarClan() {
    const nombre = document.getElementById('clanNombre').value.trim();
    const nick = document.getElementById('clanNick').value.trim();
    const gameId = document.getElementById('clanGameId').value.trim();
    const rol = document.getElementById('clanRol').value;

    if (!nombre || !nick || !gameId || !rol) {
        showToast('Por favor completa todos los campos del clan', 'error');
        return;
    }

    google.script.run
        .withSuccessHandler(r => {
            if (r && r.success) {
                showToast('¡Solicitud enviada con éxito! Un admin la revisará pronto.', 'success');
                document.getElementById('clanNombre').value = '';
                document.getElementById('clanNick').value = '';
                document.getElementById('clanGameId').value = '';
                document.getElementById('clanRol').value = '';
            } else {
                showToast('Error al enviar la solicitud', 'error');
            }
        })
        .withFailureHandler(e => showToast('Error: ' + e.message, 'error'))
        .registrarClan(nombre, nick, gameId, rol);
}

// ---- HISTORIAL DE TORNEOS ----
function loadHistorial() {
    if (typeof google === 'undefined') return;
    google.script.run
        .withSuccessHandler(torneos => {
            const container = document.getElementById('historialGrid');
            const noMsg = document.getElementById('noHistoryMsg');
            if (!torneos || torneos.length === 0) {
                if (container) container.innerHTML = '';
                if (noMsg) noMsg.style.display = '';
                return;
            }
            if (noMsg) noMsg.style.display = 'none';
            if (container) {
                container.innerHTML = torneos.map(t => {
                    const statusClass = t.estado === 'activo' ? 'status-activo' :
                        t.estado === 'proximamente' ? 'status-proximamente' :
                            t.estado === 'en curso' ? 'status-encurso' :
                                t.estado === 'finalizado' ? 'status-finalizado' : 'status-cerrado';
                    const statusLabel = t.estado === 'activo' ? '✅ Registros Abiertos' :
                        t.estado === 'proximamente' ? '🕐 Próximamente' :
                            t.estado === 'en curso' ? '⚔️ En Curso' :
                                t.estado === 'finalizado' ? '🏆 Finalizado' : '❌ Cerrado';
                    const tipoLabel = t.tipo === '1v1' ? '⚔️ 1 vs 1' : t.tipo === '3v3' ? '👥 3 vs 3' : '🏟️ 5 vs 5';

                    // Users can click to see detail if torneo is en curso OR if admin
                    const canViewDetail = (t.estado === 'en curso' || t.estado === 'activo' || isAdmin);
                    const clickAction = canViewDetail ? `onclick="openTorneoDetalle('${t.id}')"` : '';
                    const clickStyle = canViewDetail ? 'cursor:pointer;' : '';

                    return `
            <div class="card tournament-card" style="${clickStyle}" ${clickAction}>
              <span class="tournament-type">${tipoLabel}</span>
              <span class="tournament-status ${statusClass}">${statusLabel}</span>
              <h3 class="tournament-name">${escapeHtml(t.nombre)}</h3>
              <div class="tournament-info">
                📅 Creado: ${t.fechaCreacion || '-'} &nbsp;|&nbsp; 👥 Inscritos: ${t.participantes || 0}/8
                ${t.fechaApertura ? '&nbsp;|&nbsp; 🗓️ Apertura: ' + t.fechaApertura + (t.horaApertura ? ' ' + t.horaApertura : '') : ''}
              </div>
              ${t.estado === 'activo' ? `<button type="button" class="btn btn-sm btn-gold mt-20" onclick="event.stopPropagation();showSection('torneo')">⚡ Inscribirse</button>` : ''}
              ${canViewDetail ? '<p class="text-muted" style="font-size:0.8rem;margin-top:8px;">👁️ Click para ver detalle</p>' : ''}
            </div>
          `;
                }).join('');
            }
        })
        .withFailureHandler(e => showToast('Error al cargar historial', 'error'))
        .getHistorialTorneos();
}

// ---- REGISTRO A TORNEO (SECCIÓN COMPLETA) ----
function loadTorneoRegistro() {
    if (typeof google === 'undefined') return;
    google.script.run
        .withSuccessHandler(torneos => {
            const container = document.getElementById('torneoContent');
            if (!container) return;

            countdownIntervals.forEach(id => clearInterval(id));
            countdownIntervals = [];

            const activeTorneos = (torneos || []).filter(t => t.estado === 'activo' || t.estado === 'proximamente' || t.estado === 'en curso');

            if (activeTorneos.length === 0) {
                container.innerHTML = `
          <div class="card text-center" style="padding:40px 20px;">
            <div class="proximamente-badge" style="justify-content:center;margin:0 auto 15px;">
              🕐 PRÓXIMAMENTE
            </div>
            <h3 style="font-family:'Orbitron';color:#fff;margin-bottom:10px;">No hay torneos habilitados actualmente</h3>
            <p class="text-muted">El administrador activará la convocatoria muy pronto. ¡Mantente atento al chat y a las noticias!</p>
          </div>
        `;
                return;
            }

            container.innerHTML = activeTorneos.map((t, idx) => {
                const tipoLabel = t.tipo === '1v1' ? '⚔️ 1 vs 1 (Individual - Máx 8 participantes)' :
                    t.tipo === '3v3' ? '👥 3 vs 3 (Equipos de 3 - Máx 8 equipos)' : '🏟️ 5 vs 5 (Equipos de 5 - Máx 8 equipos)';

                if (t.estado === 'en curso') {
                    return `
            <div class="card tournament-card mb-20" style="border-left:5px solid var(--blue-neon);cursor:pointer;" onclick="openTorneoDetalle('${t.id}')">
              <span class="tournament-type">${tipoLabel}</span>
              <span class="tournament-status status-encurso">⚔️ En Curso</span>
              <h3 class="tournament-name">${escapeHtml(t.nombre)}</h3>
              <p class="text-center text-cyan mt-20" style="font-size:1.1rem;font-weight:700;">
                ¡Este torneo está en curso! Haz click para ver el bracket de enfrentamientos.
              </p>
              <div style="text-align:center;margin-top:15px;">
                <button type="button" class="btn btn-primary" onclick="event.stopPropagation();openTorneoDetalle('${t.id}')">🏆 Ver Bracket</button>
              </div>
            </div>
          `;
                }

                if (t.estado === 'proximamente') {
                    return `
            <div class="card tournament-card mb-20">
              <span class="tournament-type">${tipoLabel}</span>
              <span class="tournament-status status-proximamente">🕐 Próximamente</span>
              <h3 class="tournament-name">${escapeHtml(t.nombre)}</h3>
              <p class="text-center text-gold mt-20" style="font-size:1.15rem;font-weight:700;">
                📅 El registro se apertura el día <strong>${t.fechaApertura || 'TBD'}</strong> a las <strong>${t.horaApertura || 'TBD'}</strong>
              </p>
              <div class="countdown" id="regCountdown-${idx}"></div>
            </div>
          `;
                }

                return `
          <div class="card tournament-card mb-20">
            <span class="tournament-type">${tipoLabel}</span>
            <span class="tournament-status status-activo">✅ Registros Abiertos (Máximo 8 cupos)</span>
            <h3 class="tournament-name">${escapeHtml(t.nombre)}</h3>
            <div id="regForm-${t.id}">
              ${renderTorneoForm(t)}
            </div>
          </div>
        `;
            }).join('');

            // Activar cuentas regresivas
            activeTorneos.forEach((t, idx) => {
                if (t.estado === 'proximamente' && t.fechaApertura) {
                    startCountdown(`regCountdown-${idx}`, t.fechaApertura, t.horaApertura);
                }
            });
        })
        .withFailureHandler(e => showToast('Error al cargar torneos', 'error'))
        .getTorneos();
}

function renderTorneoForm(torneo) {
    const tipo = torneo.tipo;

    if (tipo === '1v1') {
        return `
      <div class="mt-20">
        <div class="form-group">
          <label>Nombre del Participante</label>
          <input type="text" class="form-control" id="reg-nombre-${torneo.id}" placeholder="Tu nombre real">
        </div>
        <div class="form-group">
          <label>Nick del Juego (In-Game Name)</label>
          <input type="text" class="form-control" id="reg-nick-${torneo.id}" placeholder="Tu nick en Mobile Legends">
        </div>
        <div class="form-group">
          <label>ID del Juego</label>
          <input type="text" class="form-control" id="reg-gameid-${torneo.id}" placeholder="Ej: 123456789 (1234)">
        </div>
        <div class="form-group">
          <label>📱 Número de Teléfono / WhatsApp de Contacto</label>
          <input type="tel" class="form-control" id="reg-tel-${torneo.id}" placeholder="Ej: +51 987654321 (con WhatsApp activo)">
        </div>
        <button type="button" class="btn btn-gold" style="width:100%;font-size:1.05rem;" onclick="submitRegistro1v1('${torneo.id}')">
          ⚡ COMPLETAR REGISTRO INDIVIDUAL (1 vs 1)
        </button>
      </div>
    `;
    }

    const memberCount = tipo === '3v3' ? 3 : 5;
    let membersHtml = '';
    for (let i = 1; i <= memberCount; i++) {
        const label = i === 1 ? 'Líder del Equipo (Tú)' : `Integrante #${i}`;
        membersHtml += `
      <div class="member-fields">
        <h4>👤 ${label}</h4>
        <div class="form-group">
          <label>Nombre del Participante</label>
          <input type="text" class="form-control" id="reg-mn-${torneo.id}-${i}" placeholder="Nombre real del jugador">
        </div>
        <div class="form-group">
          <label>Nick del Juego</label>
          <input type="text" class="form-control" id="reg-mk-${torneo.id}-${i}" placeholder="Nick en Mobile Legends">
        </div>
        <div class="form-group">
          <label>ID del Juego</label>
          <input type="text" class="form-control" id="reg-mi-${torneo.id}-${i}" placeholder="Ej: 123456789 (1234)">
        </div>
      </div>
    `;
    }

    return `
    <div class="mt-20">
      <div class="form-group">
        <label>Nombre del Equipo</label>
        <input type="text" class="form-control" id="reg-team-${torneo.id}" placeholder="Nombre oficial de tu equipo / escuadra">
      </div>
      <div class="form-group">
        <label>📱 Número de Teléfono / WhatsApp de Contacto (Líder del Equipo)</label>
        <input type="tel" class="form-control" id="reg-tel-${torneo.id}" placeholder="Ej: +51 987654321 (con WhatsApp para coordinar partidas)">
      </div>
      ${membersHtml}
      <button type="button" class="btn btn-gold" style="width:100%;font-size:1.05rem;" onclick="submitRegistroTeam('${torneo.id}', '${tipo}')">
        ⚡ REGISTRAR EQUIPO (${tipo})
      </button>
    </div>
  `;
}

function submitRegistro1v1(torneoId) {
    const nombre = document.getElementById(`reg-nombre-${torneoId}`).value.trim();
    const nick = document.getElementById(`reg-nick-${torneoId}`).value.trim();
    const gameId = document.getElementById(`reg-gameid-${torneoId}`).value.trim();
    const telEl = document.getElementById(`reg-tel-${torneoId}`);
    const telefono = telEl ? telEl.value.trim() : '';

    if (!nombre || !nick || !gameId) {
        showToast('Completa tu nombre, nick e ID del juego', 'error');
        return;
    }

    if (!telefono) {
        showToast('Ingresa un número de teléfono / WhatsApp de contacto', 'error');
        return;
    }

    showToast('Validando registro y cupo...', 'info');

    const lider = { nombre, nick, gameId, telefono };
    google.script.run
        .withSuccessHandler(r => {
            if (r && r.success) {
                showToast(`¡Registro exitoso! Cupos restantes: ${r.cuposRestantes}`, 'success');
                loadTorneoRegistro();
                loadHistorial();
            } else {
                showToast((r && r.message) || 'No se pudo registrar', 'error');
            }
        })
        .withFailureHandler(e => showToast('Error: ' + e.message, 'error'))
        .registrarEnTorneo(torneoId, '', '1v1', lider, [lider], telefono);
}

function submitRegistroTeam(torneoId, tipo) {
    const teamName = document.getElementById(`reg-team-${torneoId}`).value.trim();
    const telEl = document.getElementById(`reg-tel-${torneoId}`);
    const telefono = telEl ? telEl.value.trim() : '';

    if (!teamName) {
        showToast('Por favor escribe el nombre de tu equipo', 'error');
        return;
    }

    if (!telefono) {
        showToast('Ingresa el número de WhatsApp de contacto del líder', 'error');
        return;
    }

    const memberCount = tipo === '3v3' ? 3 : 5;
    const miembros = [];
    const seenGids = new Set();
    const seenNicks = new Set();

    for (let i = 1; i <= memberCount; i++) {
        const nombre = document.getElementById(`reg-mn-${torneoId}-${i}`).value.trim();
        const nick = document.getElementById(`reg-mk-${torneoId}-${i}`).value.trim();
        const gameId = document.getElementById(`reg-mi-${torneoId}-${i}`).value.trim();

        if (!nombre || !nick || !gameId) {
            showToast(`Faltan datos del ${i === 1 ? 'Líder' : 'Integrante #' + i}`, 'error');
            return;
        }

        const cleanG = gameId.toLowerCase();
        const cleanN = nick.toLowerCase();

        if (seenGids.has(cleanG)) {
            showToast(`El Game ID "${gameId}" está repetido en el integrante #${i}. Cada jugador debe tener su propio ID.`, 'error');
            return;
        }
        if (seenNicks.has(cleanN)) {
            showToast(`El Nick "${nick}" está repetido en el integrante #${i}.`, 'error');
            return;
        }

        seenGids.add(cleanG);
        seenNicks.add(cleanN);
        miembros.push({ nombre, nick, gameId });
    }

    showToast('Validando jugadores y enviando inscripción...', 'info');

    const lider = miembros[0];
    lider.telefono = telefono;

    google.script.run
        .withSuccessHandler(r => {
            if (r && r.success) {
                showToast(`¡Equipo ${teamName} registrado con éxito! Cupos restantes: ${r.cuposRestantes}`, 'success');
                loadTorneoRegistro();
                loadHistorial();
            } else {
                showToast((r && r.message) || 'No se pudo registrar al equipo', 'error');
            }
        })
        .withFailureHandler(e => showToast('Error: ' + e.message, 'error'))
        .registrarEnTorneo(torneoId, teamName, tipo, lider, miembros, telefono);
}

// ---- CUENTA REGRESIVA UNIVERSAL Y SEGURA ----
function startCountdown(elementId, fecha, hora) {
    const container = document.getElementById(elementId);
    if (!container) return;

    let targetDate;
    if (fecha && hora) {
        targetDate = new Date(`${fecha}T${hora}:00`);
    } else if (fecha) {
        targetDate = new Date(`${fecha}T00:00:00`);
    } else {
        container.innerHTML = '<p class="text-gold">Fecha y hora por definir</p>';
        return;
    }

    function update() {
        const now = new Date();
        const diff = targetDate.getTime() - now.getTime();

        if (isNaN(diff)) {
            container.innerHTML = '<p class="text-gold">Fecha por definir</p>';
            return;
        }

        if (diff <= 0) {
            container.innerHTML = `
        <div style="text-align:center;">
          <p class="text-cyan" style="font-size:1.25rem;font-weight:800;margin-bottom:10px;">🎮 ¡LOS REGISTROS YA ESTÁN ABIERTOS!</p>
          <button type="button" class="btn btn-gold" onclick="loadTorneoRegistro();showSection('torneo');">⚡ INSCRIBIRSE AHORA</button>
        </div>
      `;
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);

        container.innerHTML = `
      <div class="countdown-item"><span class="countdown-number">${String(days).padStart(2, '0')}</span><span class="countdown-label">Días</span></div>
      <div class="countdown-item"><span class="countdown-number">${String(hours).padStart(2, '0')}</span><span class="countdown-label">Horas</span></div>
      <div class="countdown-item"><span class="countdown-number">${String(mins).padStart(2, '0')}</span><span class="countdown-label">Min</span></div>
      <div class="countdown-item"><span class="countdown-number">${String(secs).padStart(2, '0')}</span><span class="countdown-label">Seg</span></div>
    `;
    }

    update();
    const id = setInterval(update, 1000);
    countdownIntervals.push(id);
}

// ---- CHAT GLOBAL ----
function loadChat() {
    if (typeof google === 'undefined') return;
    google.script.run
        .withSuccessHandler(messages => {
            const chatBox = document.getElementById('chatBox');
            if (!chatBox) return;
            if (!messages || messages.length === 0) {
                chatBox.innerHTML = '<p class="text-center text-muted" style="margin-top:190px;">No hay mensajes aún. ¡Sé el primero en saludar al clan!</p>';
                return;
            }
            chatBox.innerHTML = messages.map(m => `
        <div class="chat-message">
          <div class="chat-avatar">${m.avatar || '⚔️'}</div>
          <div class="chat-bubble">
            <div class="chat-user">${escapeHtml(m.usuario)}</div>
            <div class="chat-text">${escapeHtml(m.mensaje)}</div>
            <div class="chat-time">${m.fecha ? new Date(m.fecha).toLocaleDateString('es-ES') + ' ' + new Date(m.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
          </div>
        </div>
      `).join('');
            chatBox.scrollTop = chatBox.scrollHeight;
        })
        .withFailureHandler(e => console.warn('Chat error:', e))
        .getChatMessages(60);

    if (chatRefreshInterval) clearInterval(chatRefreshInterval);
    chatRefreshInterval = setInterval(() => {
        if (currentSection === 'chat') loadChat();
    }, 10000);
}

function sendChat() {
    const nickname = document.getElementById('chatNickname').value.trim();
    const message = document.getElementById('chatInput').value.trim();

    if (!nickname) {
        showToast('Ingresa tu nickname arriba del chat', 'error');
        document.getElementById('chatNickname').focus();
        return;
    }
    if (!message) {
        showToast('Escribe un mensaje para enviar', 'error');
        return;
    }

    const avatars = ['⚔️', '🛡️', '🗡️', '🔮', '🏹', '💚', '🎮', '👾', '🐉', '⭐'];
    const avatar = avatars[Math.floor(Math.random() * avatars.length)];

    google.script.run
        .withSuccessHandler(() => {
            document.getElementById('chatInput').value = '';
            loadChat();
        })
        .withFailureHandler(e => showToast('Error al enviar mensaje: ' + e.message, 'error'))
        .sendChatMessage(nickname, message, avatar);
}

// ---- ADMIN LOGIN / LOGOUT ----
function openLoginModal() {
    if (isAdmin) {
        showSection('admin');
        return;
    }
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.add('active');
}

function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.remove('active');
}

function loginAdmin() {
    const email = document.getElementById('adminUser').value.trim();
    const password = document.getElementById('adminPass').value.trim();

    if (!email || !password) {
        showToast('Ingresa usuario y contraseña', 'error');
        return;
    }

    google.script.run
        .withSuccessHandler(r => {
            if (r && r.success) {
                isAdmin = true;
                adminInfo = r;
                closeLoginModal();
                showToast(`¡Bienvenido Administrador ${r.nombre}!`, 'success');
                showSection('admin');
                loadAdminData();
            } else {
                showToast((r && r.message) || 'Usuario o contraseña incorrectos', 'error');
            }
        })
        .withFailureHandler(e => showToast('Error de autenticación: ' + e.message, 'error'))
        .loginAdmin(email, password);
}

function logoutAdmin() {
    isAdmin = false;
    adminInfo = null;
    showToast('Has cerrado sesión', 'info');
    showSection('inicio');
}

// ---- ADMIN TABS ----
function showAdminTab(tabId, btn) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-nav-item').forEach(b => b.classList.remove('active'));
    const target = document.getElementById(tabId);
    if (target) target.classList.add('active');
    if (btn) btn.classList.add('active');

    if (tabId === 'admin-torneos') loadAdminTorneos();
    else if (tabId === 'admin-noticias') loadAdminNoticias();
    else if (tabId === 'admin-banners') loadAdminBanners();
    else if (tabId === 'admin-clan') loadAdminClan();
    else if (tabId === 'admin-config') loadAdminConfig();
}

function loadAdminData() {
    loadAdminTorneos();
}

// ---- ADMIN: GESTIÓN DE TORNEOS ----
function crearTorneo() {
    const nombre = document.getElementById('torneoNombre').value.trim();
    const tipo = document.getElementById('torneoTipo').value;
    const estado = document.getElementById('torneoEstado').value;
    const fecha = document.getElementById('torneoFecha').value;
    const hora = document.getElementById('torneoHora').value;

    if (!nombre) {
        showToast('Escribe el nombre del torneo', 'error');
        return;
    }

    showToast('Guardando torneo en base de datos...', 'info');

    google.script.run
        .withSuccessHandler(r => {
            if (r && r.success) {
                showToast('¡Torneo creado y publicado con éxito!', 'success');
                document.getElementById('torneoNombre').value = '';
                document.getElementById('torneoFecha').value = '';
                document.getElementById('torneoHora').value = '';

                // Actualizar vistas inmediatamente
                loadAdminTorneos();
                loadInitialData();
                loadHistorial();
                loadTorneoRegistro();
            } else {
                showToast((r && r.message) || 'Error al guardar torneo', 'error');
            }
        })
        .withFailureHandler(e => showToast('Error: ' + e.message, 'error'))
        .crearTorneo(nombre, tipo, estado, fecha, hora);
}

function cambiarEstado(id, nuevoEstado) {
    showToast('Actualizando estado...', 'info');
    google.script.run
        .withSuccessHandler(r => {
            if (r && r.success) {
                showToast(`Estado cambiado a: ${nuevoEstado}`, 'success');
                loadAdminTorneos();
                loadInitialData();
                loadTorneoRegistro();
            } else {
                showToast('Error al cambiar estado', 'error');
            }
        })
        .withFailureHandler(e => showToast('Error: ' + e.message, 'error'))
        .cambiarEstadoTorneo(id, nuevoEstado);
}

function loadAdminTorneos() {
    google.script.run
        .withSuccessHandler(torneos => {
            const container = document.getElementById('adminTorneosList');
            if (!container) return;
            if (!torneos || torneos.length === 0) {
                container.innerHTML = '<p class="text-muted">No hay torneos registrados en la base de datos.</p>';
                return;
            }
            container.innerHTML = `
        <table class="admin-table">
          <thead>
            <tr><th>Nombre</th><th>Tipo</th><th>Estado</th><th>Apertura</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            ${torneos.map(t => {
                const statusClass = t.estado === 'activo' ? 'status-activo' :
                    t.estado === 'proximamente' ? 'status-proximamente' :
                        t.estado === 'en curso' ? 'status-encurso' :
                            t.estado === 'finalizado' ? 'status-finalizado' : 'status-cerrado';
                return `
                <tr>
                  <td style="color:var(--text-primary);font-weight:700;">${escapeHtml(t.nombre)}</td>
                  <td><span class="badge badge-cyan">${t.tipo}</span></td>
                  <td><span class="tournament-status ${statusClass}">${t.estado}</span></td>
                  <td>${t.fechaApertura || '-'} ${t.horaApertura || ''}</td>
                  <td>
                    <div style="display:flex;gap:4px;flex-wrap:wrap;">
                      <button type="button" class="btn btn-sm btn-outline" title="Ver Detalle" onclick="openTorneoDetalle('${t.id}')">👁️ Detalle</button>
                      ${t.estado !== 'activo' && t.estado !== 'en curso' && t.estado !== 'finalizado' ? `<button type="button" class="btn btn-sm" style="background:#00e676;color:#000;font-weight:700;" onclick="cambiarEstado('${t.id}', 'activo')">✅ Activar</button>` : ''}
                      ${t.estado !== 'proximamente' && t.estado !== 'en curso' && t.estado !== 'finalizado' ? `<button type="button" class="btn btn-sm" style="background:#ffab00;color:#000;font-weight:700;" onclick="cambiarEstado('${t.id}', 'proximamente')">🕐 Próximo</button>` : ''}
                      ${t.estado === 'activo' ? `<button type="button" class="btn btn-sm" style="background:#555;color:#fff;" onclick="cambiarEstado('${t.id}', 'cerrado')">🔒 Cerrar</button>` : ''}
                      ${t.estado !== 'en curso' && t.estado !== 'finalizado' ? `<button type="button" class="btn btn-sm btn-danger" onclick="eliminarTorneo('${t.id}')">🗑️</button>` : ''}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
        })
        .withFailureHandler(e => showToast('Error al cargar torneos: ' + e.message, 'error'))
        .getTorneos();
}

function eliminarTorneo(id) {
    if (!confirm('¿Estás seguro de eliminar este torneo? Se borrarán sus registros.')) return;
    google.script.run
        .withSuccessHandler(r => {
            if (r && r.success) {
                showToast('Torneo eliminado', 'success');
                loadAdminTorneos();
                loadInitialData();
                loadHistorial();
                loadTorneoRegistro();
            }
        })
        .withFailureHandler(e => showToast('Error: ' + e.message, 'error'))
        .eliminarTorneo(id);
}

function verRegistros(torneoId, nombre) {
    google.script.run
        .withSuccessHandler(registros => {
            let html = `<div class="card mb-20" style="margin-top:20px;border-left:4px solid var(--gold);padding:18px;">
        <h3 style="color:var(--gold);font-family:'Orbitron';font-size:1rem;margin-bottom:12px;">📋 Participantes Inscritos: ${escapeHtml(nombre)} (${registros.length}/8 Cupos)</h3>`;
            if (!registros || registros.length === 0) {
                html += '<p class="text-muted">Aún no hay ningún participante inscrito en este torneo.</p>';
            } else {
                html += registros.map((r, i) => {
                    const telClean = (r.telefono || '').replace(/\D/g, '');
                    const telBadge = r.telefono ? `
                          <a href="https://wa.me/${telClean}" target="_blank" class="badge badge-gold" style="text-decoration:none;display:inline-flex;align-items:center;gap:4px;margin-left:8px;font-size:0.75rem;">
                            💬 WhatsApp: ${escapeHtml(r.telefono)}
                          </a>
                        ` : '';

                    const miembros = (r.miembros || []).map(m =>
                        `<span class="badge badge-cyan" style="margin:3px 2px;">👤 ${escapeHtml(m.nick)} (ID: ${escapeHtml(m.gameId)}) - ${escapeHtml(m.nombre)}</span>`
                    ).join(' ');
                    return `
            <div style="background:rgba(0,0,0,0.3);padding:12px;border-radius:8px;margin-bottom:8px;border:1px solid rgba(0,229,255,0.1);">
              <div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;">
                <strong class="text-cyan">#${i + 1} ${r.nombreEquipo ? 'Equipo: ' + escapeHtml(r.nombreEquipo) : 'Participante Individual'}</strong>
                ${telBadge}
              </div>
              <div class="mt-20">${miembros}</div>
            </div>
          `;
                }).join('');
            }
            html += '</div>';
            const list = document.getElementById('adminTorneosList');
            if (list) list.innerHTML += html;
        })
        .withFailureHandler(e => showToast('Error: ' + e.message, 'error'))
        .getRegistrosTorneo(torneoId);
}

// ---- ADMIN NOTICIAS ----
function crearNoticia() {
    const titulo = document.getElementById('noticiaTitulo').value.trim();
    const contenido = document.getElementById('noticiaContenido').value.trim();
    const imagenURL = document.getElementById('noticiaImagen').value.trim();
    const videoURL = document.getElementById('noticiaVideo').value.trim();

    if (!titulo || !contenido) {
        showToast('Título y contenido son requeridos', 'error');
        return;
    }

    const autor = adminInfo ? adminInfo.nombre : 'Admin';

    google.script.run
        .withSuccessHandler(r => {
            if (r && r.success) {
                showToast('¡Noticia publicada con éxito!', 'success');
                document.getElementById('noticiaTitulo').value = '';
                document.getElementById('noticiaContenido').value = '';
                document.getElementById('noticiaImagen').value = '';
                document.getElementById('noticiaVideo').value = '';
                loadAdminNoticias();
                loadInitialData();
            }
        })
        .withFailureHandler(e => showToast('Error: ' + e.message, 'error'))
        .crearNoticia(titulo, contenido, imagenURL, videoURL, autor);
}

function loadAdminNoticias() {
    google.script.run
        .withSuccessHandler(noticias => {
            const container = document.getElementById('adminNoticiasList');
            if (!container) return;
            if (!noticias || noticias.length === 0) {
                container.innerHTML = '<p class="text-muted">No hay noticias publicadas.</p>';
                return;
            }
            container.innerHTML = noticias.map(n => `
        <div class="card mb-20" style="border-left:3px solid var(--cyan-neon);padding:14px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <strong class="text-cyan">${escapeHtml(n.titulo)}</strong>
              <div class="text-muted" style="font-size:0.8rem;">📅 ${n.fecha || ''}</div>
            </div>
            <button type="button" class="btn btn-sm btn-danger" onclick="eliminarNoticia('${n.id}')">🗑️</button>
          </div>
          <p class="text-muted mt-20" style="font-size:0.88rem;">${escapeHtml(n.contenido).substring(0, 140)}...</p>
        </div>
      `).join('');
        })
        .withFailureHandler(e => showToast('Error: ' + e.message, 'error'))
        .getNoticias();
}

function eliminarNoticia(id) {
    if (!confirm('¿Eliminar esta noticia?')) return;
    google.script.run
        .withSuccessHandler(r => {
            if (r && r.success) {
                showToast('Noticia eliminada', 'success');
                loadAdminNoticias();
                loadInitialData();
            }
        })
        .withFailureHandler(e => showToast('Error: ' + e.message, 'error'))
        .eliminarNoticia(id);
}

// ---- ADMIN BANNERS ----
function agregarBanner() {
    const url = document.getElementById('bannerURL').value.trim();
    const titulo = document.getElementById('bannerTitulo').value.trim();

    if (!url) {
        showToast('Ingresa la URL de la imagen del banner', 'error');
        return;
    }

    google.script.run
        .withSuccessHandler(r => {
            if (r && r.success) {
                showToast('Banner agregado con éxito', 'success');
                document.getElementById('bannerURL').value = '';
                document.getElementById('bannerTitulo').value = '';
                loadAdminBanners();
                loadInitialData();
            }
        })
        .withFailureHandler(e => showToast('Error: ' + e.message, 'error'))
        .addBanner(url, titulo);
}

function loadAdminBanners() {
    google.script.run
        .withSuccessHandler(banners => {
            const container = document.getElementById('adminBannersList');
            if (!container) return;
            if (!banners || banners.length === 0) {
                container.innerHTML = '<p class="text-muted">No hay banners configurados.</p>';
                return;
            }
            container.innerHTML = banners.map(b => `
        <div class="card mb-20" style="display:flex;gap:15px;align-items:center;flex-wrap:wrap;border-left:3px solid ${b.activo ? 'var(--green-neon)' : 'var(--red-neon)'};padding:14px;">
          <img src="${escapeHtml(b.imagenURL)}" style="width:110px;height:65px;object-fit:cover;border-radius:8px;" onerror="this.src='https://placehold.co/110x65?text=Error'">
          <div style="flex:1;min-width:140px;">
            <strong class="text-cyan">${escapeHtml(b.titulo || 'Banner sin título')}</strong>
            <div class="text-muted" style="font-size:0.8rem;">${b.activo ? '🟢 Activo' : '🔴 Inactivo'}</div>
          </div>
          <div style="display:flex;gap:6px;">
            <button type="button" class="btn btn-sm btn-outline" onclick="toggleBanner('${b.id}')">${b.activo ? '⏸️ Pausar' : '▶️ Activar'}</button>
            <button type="button" class="btn btn-sm btn-danger" onclick="eliminarBanner('${b.id}')">🗑️</button>
          </div>
        </div>
      `).join('');
        })
        .withFailureHandler(e => showToast('Error: ' + e.message, 'error'))
        .getBanners();
}

function toggleBanner(id) {
    google.script.run
        .withSuccessHandler(r => {
            if (r && r.success) {
                showToast(r.activo ? 'Banner activado' : 'Banner desactivado', 'success');
                loadAdminBanners();
                loadInitialData();
            }
        })
        .withFailureHandler(e => showToast('Error: ' + e.message, 'error'))
        .toggleBanner(id);
}

function eliminarBanner(id) {
    if (!confirm('¿Eliminar este banner?')) return;
    google.script.run
        .withSuccessHandler(r => {
            if (r && r.success) {
                showToast('Banner eliminado', 'success');
                loadAdminBanners();
                loadInitialData();
            }
        })
        .withFailureHandler(e => showToast('Error: ' + e.message, 'error'))
        .deleteBanner(id);
}

// ---- ADMIN CLAN ----
function loadAdminClan() {
    google.script.run
        .withSuccessHandler(registros => {
            const container = document.getElementById('adminClanList');
            if (!container) return;
            if (!registros || registros.length === 0) {
                container.innerHTML = '<p class="text-muted">No hay solicitudes de registro al clan.</p>';
                return;
            }
            container.innerHTML = `
        <table class="admin-table">
          <thead>
            <tr><th>Nombre</th><th>Nick</th><th>Game ID</th><th>Rol</th><th>Fecha</th></tr>
          </thead>
          <tbody>
            ${registros.map(r => `
              <tr>
                <td style="color:var(--text-primary);font-weight:600;">${escapeHtml(r.nombre)}</td>
                <td><span class="badge badge-cyan">${escapeHtml(r.nick)}</span></td>
                <td>${escapeHtml(r.gameId)}</td>
                <td>${escapeHtml(r.rol)}</td>
                <td class="text-muted">${r.fecha || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
        })
        .withFailureHandler(e => showToast('Error: ' + e.message, 'error'))
        .getClanRegistros();
}

// ---- ADMIN CONFIG ----
function loadAdminConfig() {
    google.script.run
        .withSuccessHandler(config => {
            if (!config) return;
            const sn = document.getElementById('configSiteName');
            const bu = document.getElementById('configBannerURL');
            const ad = document.getElementById('configAcercaDe');
            if (sn) sn.value = config.siteName || 'CoreInvaders';
            if (bu) bu.value = config.bannerURL || '';
            if (ad) ad.value = config.acercaDe || '';
        })
        .withFailureHandler(e => showToast('Error: ' + e.message, 'error'))
        .getAllConfig();
}

function guardarConfig() {
    const siteName = document.getElementById('configSiteName').value.trim();
    const bannerURL = document.getElementById('configBannerURL').value.trim();
    const acercaDe = document.getElementById('configAcercaDe').value.trim();

    let saved = 0;
    function checkDone() {
        saved++;
        if (saved >= 3) {
            showToast('Configuración guardada correctamente', 'success');
            loadInitialData();
        }
    }

    google.script.run.withSuccessHandler(checkDone).setConfig('siteName', siteName);
    google.script.run.withSuccessHandler(checkDone).setConfig('bannerURL', bannerURL);
    google.script.run.withSuccessHandler(checkDone).setConfig('acercaDe', acercaDe);
}

// ---- UTILIDAD ESCAPE HTML ----
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ---- TORNEO DETALLE (PARTICIPANTES + BRACKET) ----
window.currentTorneoFixture = [];
window.currentTorneoData = null;

function openTorneoDetalle(torneoId) {
    previousSection = currentSection;
    showSection('torneo-detalle');

    if (torneoAutoRefreshInterval) {
        clearInterval(torneoAutoRefreshInterval);
        torneoAutoRefreshInterval = null;
    }

    const titleEl = document.getElementById('detalleTorneoTitulo');
    const infoEl = document.getElementById('detalleTorneoInfo');
    const partEl = document.getElementById('detalleTorneoParticipantes');
    const bracketEl = document.getElementById('detalleTorneoBracket');

    if (titleEl) titleEl.textContent = '⏳ Cargando...';
    if (infoEl) infoEl.innerHTML = '';
    if (partEl) partEl.innerHTML = '';
    if (bracketEl) bracketEl.innerHTML = '';

    _fetchAndRenderTorneoDetalle(torneoId);

    // Auto-refresh en tiempo real cada 15 segundos
    torneoAutoRefreshInterval = setInterval(() => {
        if (currentSection === 'torneo-detalle') {
            _silentRefreshBracket(torneoId);
        }
    }, 15000);
}

function _fetchAndRenderTorneoDetalle(torneoId) {
    google.script.run
        .withSuccessHandler(torneo => {
            if (!torneo) {
                const titleEl = document.getElementById('detalleTorneoTitulo');
                if (titleEl) titleEl.textContent = '❌ Torneo no encontrado';
                return;
            }

            window.currentTorneoData = torneo;
            const titleEl = document.getElementById('detalleTorneoTitulo');
            const infoEl = document.getElementById('detalleTorneoInfo');
            if (titleEl) titleEl.textContent = '🏆 ' + torneo.nombre;

            const tipoLabel = torneo.tipo === '1v1' ? '⚔️ 1 vs 1 (Individual)' :
                torneo.tipo === '3v3' ? '👥 3 vs 3 (Equipos)' : '🏟️ 5 vs 5 (Equipos)';
            const statusClass = torneo.estado === 'activo' ? 'status-activo' :
                torneo.estado === 'en curso' ? 'status-encurso' :
                    torneo.estado === 'finalizado' ? 'status-finalizado' :
                        torneo.estado === 'proximamente' ? 'status-proximamente' : 'status-cerrado';
            const statusLabel = torneo.estado === 'activo' ? '✅ Inscripciones Abiertas' :
                torneo.estado === 'en curso' ? '⚔️ En Curso' :
                    torneo.estado === 'finalizado' ? '🏆 Finalizado' :
                        torneo.estado === 'proximamente' ? '🕐 Próximamente' : '❌ Cerrado';

            if (infoEl) {
                infoEl.innerHTML = `
                        <div class="card mb-20" style="border-left:4px solid var(--gold);padding:20px;">
                            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                                <span class="tournament-type">${tipoLabel}</span>
                                <span class="tournament-status ${statusClass}">${statusLabel}</span>
                            </div>
                            <div class="tournament-info mt-20" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                                <div>
                                    📅 Creado: ${torneo.fechaCreacion || '-'}
                                    ${torneo.fechaApertura ? ' &nbsp;|&nbsp; 🗓️ Apertura: ' + torneo.fechaApertura + (torneo.horaApertura ? ' ' + torneo.horaApertura : '') : ''}
                                </div>
                                <span class="text-cyan" style="font-size:0.8rem;">⚡ Actualización en tiempo real activa (15s)</span>
                            </div>
                        </div>
                    `;
            }

            _loadDetalleParticipantes(torneoId, torneo);
            _loadDetalleBracket(torneoId, torneo);
        })
        .withFailureHandler(e => {
            const titleEl = document.getElementById('detalleTorneoTitulo');
            if (titleEl) titleEl.textContent = '❌ Error al cargar torneo';
        })
        .getTorneoById(torneoId);
}

function _silentRefreshBracket(torneoId) {
    google.script.run
        .withSuccessHandler(fixture => {
            if (!fixture) return;
            window.currentTorneoFixture = fixture;
            if (window.currentTorneoData) {
                _renderBracketContent(torneoId, window.currentTorneoData, fixture);
            }
        })
        .getFixture(torneoId);
}

function volverDeDetalleTorneo() {
    if (torneoAutoRefreshInterval) {
        clearInterval(torneoAutoRefreshInterval);
        torneoAutoRefreshInterval = null;
    }
    showSection(previousSection || 'historial');
}

function _loadDetalleParticipantes(torneoId, torneo) {
    google.script.run
        .withSuccessHandler(registros => {
            const partEl = document.getElementById('detalleTorneoParticipantes');
            if (!partEl) return;

            let html = `<div class="card mb-20" style="border-left:4px solid var(--cyan-neon);padding:20px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:15px;">
                        <h3 style="color:var(--cyan-neon);font-family:'Orbitron';font-size:1rem;margin:0;">
                            📋 PARTICIPANTES REGISTRADOS (${registros.length}/8)
                        </h3>
                        ${registros.length === 8 ? '<span class="badge badge-gold">CUPO COMPLETO (8/8)</span>' : ''}
                    </div>`;

            if (!registros || registros.length === 0) {
                html += '<p class="text-muted">Aún no hay participantes inscritos.</p>';
            } else {
                html += '<div class="participants-grid">';
                registros.forEach((r, i) => {
                    const miembros = (r.miembros || []).map(m =>
                        `<span class="badge badge-cyan" style="margin:3px 2px;">👤 ${escapeHtml(m.nick || m.nombre || '')} (ID: ${escapeHtml(m.gameId || '')})</span>`
                    ).join(' ');

                    const telClean = (r.telefono || '').replace(/\D/g, '');
                    const telBadge = r.telefono ? `
                            <a href="https://wa.me/${telClean}?text=${encodeURIComponent('Hola! Te contacto desde CoreInvaders por el torneo ' + torneo.nombre)}" target="_blank" class="badge badge-gold" style="text-decoration:none;display:inline-flex;align-items:center;gap:4px;font-size:0.75rem;">
                                💬 WhatsApp: ${escapeHtml(r.telefono)}
                            </a>
                        ` : '';

                    html += `
                        <div class="participant-item">
                            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                                <span class="participant-number">#${i + 1}</span>
                                <strong class="text-cyan">${r.nombreEquipo ? escapeHtml(r.nombreEquipo) : 'Participante Individual'}</strong>
                                ${telBadge}
                            </div>
                            <div style="margin-top:6px;">${miembros}</div>
                        </div>`;
                });
                html += '</div>';
            }

            // Admin: sorteo button
            if (isAdmin && (torneo.estado === 'cerrado' || torneo.estado === 'activo') && registros.length >= 2) {
                html += `
                    <div style="margin-top:20px;text-align:center;">
                        <button type="button" class="btn btn-gold" onclick="realizarSorteo('${torneoId}')">
                            🎲 CERRAR INSCRIPCIONES Y REALIZAR SORTEO DE ENCUENTROS
                        </button>
                    </div>`;
            }

            html += '</div>';
            partEl.innerHTML = html;
        })
        .withFailureHandler(e => showToast('Error al cargar participantes', 'error'))
        .getRegistrosTorneo(torneoId);
}

function _loadDetalleBracket(torneoId, torneo) {
    google.script.run
        .withSuccessHandler(fixture => {
            window.currentTorneoFixture = fixture || [];
            _renderBracketContent(torneoId, torneo, fixture || []);
        })
        .withFailureHandler(e => showToast('Error al cargar bracket', 'error'))
        .getFixture(torneoId);
}

function _renderBracketContent(torneoId, torneo, fixture) {
    const bracketEl = document.getElementById('detalleTorneoBracket');
    if (!bracketEl) return;

    if (!fixture || fixture.length === 0) {
        if (torneo.estado === 'en curso' || torneo.estado === 'finalizado') {
            bracketEl.innerHTML = '<p class="text-muted text-center mt-20">No se han generado enfrentamientos aún.</p>';
        } else {
            bracketEl.innerHTML = '';
        }
        return;
    }

    // Group matches by round preserving order
    const roundOrder = [];
    const rounds = {};
    fixture.forEach(m => {
        if (!rounds[m.ronda]) {
            rounds[m.ronda] = [];
            roundOrder.push(m.ronda);
        }
        rounds[m.ronda].push(m);
    });

    let html = `<div class="card mb-20" style="border-left:4px solid var(--gold);padding:20px;overflow-x:auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:15px;">
                <h3 style="color:var(--gold);font-family:'Orbitron';font-size:1rem;margin:0;">
                    🏆 FIXTURE RAMIFICADO — ENFRENTAMIENTOS
                </h3>
                <span class="text-muted" style="font-size:0.8rem;">💡 Haz clic en cualquier partida para ver la sala, Game IDs y contacto</span>
            </div>
            <div class="bracket-tree-container">`;

    roundOrder.forEach((roundName, rIdx) => {
        const matches = rounds[roundName];
        const isLastRound = (rIdx === roundOrder.length - 1);

        html += `<div class="bracket-round-col" data-round="${escapeHtml(roundName)}">
                <div class="bracket-round-title">
                    ${escapeHtml(roundName)}
                </div>
                <div class="bracket-matches-col">`;

        // Group into pairs of 2 for tree lines
        for (let p = 0; p < matches.length; p += 2) {
            const m1 = matches[p];
            const m2 = matches[p + 1];

            html += `<div class="bracket-pair ${isLastRound ? 'is-final' : ''}">`;
            html += _renderMatchCard(torneoId, m1, torneo);
            if (m2) {
                html += _renderMatchCard(torneoId, m2, torneo);
            }
            html += `</div>`; // bracket-pair
        }

        html += `</div></div>`; // bracket-matches-col, bracket-round-col
    });

    html += `</div>`; // bracket-tree-container

    // Admin: reset button
    if (isAdmin && (torneo.estado === 'en curso')) {
        html += `
            <div style="margin-top:15px;text-align:right;">
                <button type="button" class="btn btn-sm btn-danger" onclick="eliminarFixtureAdmin('${torneoId}')">
                    🗑️ Eliminar Fixture y Reiniciar Sorteo
                </button>
            </div>`;
    }

    // Champion banner if final has winner
    const finalMatch = fixture[fixture.length - 1];
    if (finalMatch && finalMatch.ganador && finalMatch.ganador !== 'Por definir' && finalMatch.ganador !== '') {
        html += `
            <div class="champion-banner">
                <div class="champion-icon">🏆</div>
                <div class="champion-text">¡CAMPEÓN DEL TORNEO!</div>
                <div class="champion-name">${escapeHtml(finalMatch.ganador)}</div>
            </div>`;
    }

    html += `</div>`; // card
    bracketEl.innerHTML = html;
}

function _renderMatchCard(torneoId, match, torneo) {
    const e1Winner = (match.ganador === match.equipo1 && match.ganador !== '');
    const e2Winner = (match.ganador === match.equipo2 && match.ganador !== '');
    const e1Loser = (match.perdedor === match.equipo1 && match.perdedor !== '');
    const e2Loser = (match.perdedor === match.equipo2 && match.perdedor !== '');

    const e1Class = e1Winner ? 'bracket-winner' : (e1Loser ? 'bracket-loser' : '');
    const e2Class = e2Winner ? 'bracket-winner' : (e2Loser ? 'bracket-loser' : '');

    const boBadge = `<span class="badge badge-cyan" style="font-size:0.7rem;padding:2px 6px;">${escapeHtml(match.boFormat || 'Bo1')}</span>`;
    const evidenceBadge = match.evidenciaURL ? `
            <a href="${escapeHtml(match.evidenciaURL)}" target="_blank" class="badge badge-gold" style="text-decoration:none;font-size:0.68rem;padding:2px 5px;" onclick="event.stopPropagation()">
                📸 Captura
            </a>
        ` : '';

    return `
        <div class="bracket-match-node" onclick="openMatchModal('${torneoId}', '${escapeHtml(match.ronda)}', ${match.partido})">
            <div class="bracket-match-topbar">
                <div style="display:flex;align-items:center;gap:4px;">
                    ${boBadge}
                    <span style="font-size:0.7rem;color:var(--text-muted);font-weight:700;">#${match.partido}</span>
                </div>
                ${evidenceBadge}
            </div>
            
            <div class="bracket-team-row ${e1Class}">
                <span class="team-label">${match.equipo1 === 'BYE' ? '<span class="text-muted">BYE</span>' : escapeHtml(match.equipo1)}</span>
                ${e1Winner ? '🏆' : ''}
            </div>

            <div class="bracket-mid-vs">
                <span class="vs-pill">${match.marcador ? escapeHtml(match.marcador) : 'VS'}</span>
            </div>

            <div class="bracket-team-row ${e2Class}">
                <span class="team-label">${match.equipo2 === 'BYE' ? '<span class="text-muted">BYE</span>' : escapeHtml(match.equipo2)}</span>
                ${e2Winner ? '🏆' : ''}
            </div>

            <div class="bracket-node-cta">
                <span>🎮 Sala de Partida</span>
            </div>
        </div>`;
}

// ---- MATCH / SALA DE PARTIDA MODAL ----
function openMatchModal(torneoId, ronda, partido) {
    const fixture = window.currentTorneoFixture || [];
    const match = fixture.find(m => m.ronda === ronda && Number(m.partido) === Number(partido));
    if (!match) {
        showToast('Información de partida no disponible', 'error');
        return;
    }

    const modal = document.getElementById('matchModal');
    const content = document.getElementById('matchModalContent');
    if (!modal || !content) return;

    const torneo = window.currentTorneoData || {};
    const isReady = (match.equipo1 !== 'Por definir' && match.equipo2 !== 'Por definir' && match.equipo1 !== 'BYE' && match.equipo2 !== 'BYE');

    // Equipo 1 Render
    const eq1Info = match.equipo1Info;
    const eq1MembersHtml = _renderTeamRosterForModal(eq1Info, match.equipo1);
    const eq1Tel = eq1Info && eq1Info.telefono ? eq1Info.telefono : '';
    const eq1TelClean = eq1Tel.replace(/\D/g, '');

    // Equipo 2 Render
    const eq2Info = match.equipo2Info;
    const eq2MembersHtml = _renderTeamRosterForModal(eq2Info, match.equipo2);
    const eq2Tel = eq2Info && eq2Info.telefono ? eq2Info.telefono : '';
    const eq2TelClean = eq2Tel.replace(/\D/g, '');

    const statusLabel = match.ganador ? '🏁 PARTIDA FINALIZADA' : (isReady ? '⚔️ SALA LISTA / EN JUEGO' : '⏳ ESPERANDO RIVAL');
    const statusColor = match.ganador ? 'var(--gold)' : (isReady ? 'var(--green-neon)' : 'var(--text-muted)');

    let html = `
            <div style="text-align:center;margin-bottom:20px;">
                <span class="badge badge-cyan" style="font-size:0.8rem;padding:4px 10px;margin-bottom:8px;">${escapeHtml(match.ronda)} • Partido #${match.partido}</span>
                <span class="badge badge-gold" style="font-size:0.8rem;padding:4px 10px;margin-bottom:8px;margin-left:4px;">${escapeHtml(match.boFormat || 'Bo1')}</span>
                <h2 style="font-family:'Orbitron';color:#fff;font-size:1.3rem;margin-top:6px;">🎮 SALA DE ENFRENTAMIENTO</h2>
                <div style="color:${statusColor};font-weight:700;font-size:0.85rem;letter-spacing:1px;margin-top:4px;">${statusLabel}</div>
            </div>

            <div class="match-room-teams-grid">
                <!-- EQUIPO 1 -->
                <div class="match-room-team-card ${match.ganador === match.equipo1 && match.ganador ? 'is-winner' : ''}">
                    <div class="match-room-team-header">
                        <strong class="text-cyan" style="font-size:1.15rem;">${escapeHtml(match.equipo1)}</strong>
                        ${match.ganador === match.equipo1 && match.ganador ? '<span class="badge badge-gold">🏆 GANADOR</span>' : ''}
                    </div>
                    ${eq1Tel ? `
                        <a href="https://wa.me/${eq1TelClean}?text=${encodeURIComponent('Hola capitán de ' + match.equipo1 + '! Te escribo de CoreInvaders para coordinar la sala en Mobile Legends del torneo: ' + match.ronda + ' Partido #' + match.partido)}" target="_blank" class="btn btn-sm btn-gold mt-20" style="width:100%;text-decoration:none;gap:6px;">
                            💬 WhatsApp Capitán (${escapeHtml(eq1Tel)})
                        </a>
                    ` : ''}
                    <div style="margin-top:14px;">
                        <span style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;font-weight:700;">Integrantes & Game IDs:</span>
                        ${eq1MembersHtml}
                    </div>
                </div>

                <!-- VS / MARCADOR -->
                <div class="match-room-vs-box">
                    <span style="font-family:'Orbitron';font-size:1.4rem;color:var(--gold);font-weight:800;">
                        ${match.marcador ? escapeHtml(match.marcador) : 'VS'}
                    </span>
                    <span style="font-size:0.75rem;color:var(--text-muted);">${escapeHtml(match.boFormat || 'Bo1')}</span>
                </div>

                <!-- EQUIPO 2 -->
                <div class="match-room-team-card ${match.ganador === match.equipo2 && match.ganador ? 'is-winner' : ''}">
                    <div class="match-room-team-header">
                        <strong class="text-cyan" style="font-size:1.15rem;">${escapeHtml(match.equipo2)}</strong>
                        ${match.ganador === match.equipo2 && match.ganador ? '<span class="badge badge-gold">🏆 GANADOR</span>' : ''}
                    </div>
                    ${eq2Tel ? `
                        <a href="https://wa.me/${eq2TelClean}?text=${encodeURIComponent('Hola capitán de ' + match.equipo2 + '! Te escribo de CoreInvaders para coordinar la sala en Mobile Legends del torneo: ' + match.ronda + ' Partido #' + match.partido)}" target="_blank" class="btn btn-sm btn-gold mt-20" style="width:100%;text-decoration:none;gap:6px;">
                            💬 WhatsApp Capitán (${escapeHtml(eq2Tel)})
                        </a>
                    ` : ''}
                    <div style="margin-top:14px;">
                        <span style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;font-weight:700;">Integrantes & Game IDs:</span>
                        ${eq2MembersHtml}
                    </div>
                </div>
            </div>`;

    // Evidencia si ya existe
    if (match.evidenciaURL) {
        html += `
            <div class="card mt-20" style="text-align:center;padding:15px;border-left:3px solid var(--green-neon);">
                <span class="text-cyan" style="font-weight:700;">📸 Captura / Comprobante de Victoria Registrado:</span>
                <div style="margin-top:8px;">
                    <a href="${escapeHtml(match.evidenciaURL)}" target="_blank" class="btn btn-sm btn-outline">
                        🖼️ Abrir Captura de Pantalla
                    </a>
                </div>
            </div>`;
    }

    // PANEL DE ADMINISTRADOR: MARCAR RESULTADO, MARCADOR Y CAPTURA
    if (isAdmin && isReady && (!match.ganador || torneo.estado === 'en curso')) {
        const bo = match.boFormat || 'Bo1';
        const presets = bo === 'Bo5' ? ['3-0', '3-1', '3-2', '2-3', '1-3', '0-3'] :
            bo === 'Bo3' ? ['2-0', '2-1', '1-2', '0-2'] :
                ['1-0', '0-1'];

        html += `
            <div class="card mt-20 admin-match-console" style="border:1px solid var(--gold);padding:20px;">
                <h4 style="color:var(--gold);font-family:'Orbitron';font-size:0.95rem;margin-bottom:12px;">
                    🔐 PANEL DE RESULTADOS (${bo})
                </h4>

                <div class="form-group">
                    <label>Seleccionar Ganador del Encuentro</label>
                    <div style="display:flex;gap:10px;margin-top:6px;">
                        <button type="button" class="btn btn-sm" id="btnWin1" style="flex:1;background:rgba(0,229,255,0.2);border:1px solid var(--cyan-neon);color:#fff;" onclick="_selectWinnerCandidate('${escapeHtml(match.equipo1)}', '${escapeHtml(match.equipo2)}')">
                            👑 ${escapeHtml(match.equipo1)}
                        </button>
                        <button type="button" class="btn btn-sm" id="btnWin2" style="flex:1;background:rgba(0,229,255,0.2);border:1px solid var(--cyan-neon);color:#fff;" onclick="_selectWinnerCandidate('${escapeHtml(match.equipo2)}', '${escapeHtml(match.equipo1)}')">
                            👑 ${escapeHtml(match.equipo2)}
                        </button>
                    </div>
                    <input type="hidden" id="modalWinnerInput" value="${escapeHtml(match.ganador || '')}">
                    <input type="hidden" id="modalLoserInput" value="${escapeHtml(match.perdedor || '')}">
                </div>

                <div class="form-group">
                    <label>Marcador de la Serie (${bo})</label>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
                        ${presets.map(p => `
                            <button type="button" class="btn btn-sm btn-outline" style="padding:4px 8px;font-size:0.75rem;" onclick="document.getElementById('modalMarcadorInput').value='${p}'">
                                ${p}
                            </button>
                        `).join('')}
                    </div>
                    <input type="text" class="form-control" id="modalMarcadorInput" placeholder="Ej: 2 - 1" value="${escapeHtml(match.marcador || '')}">
                </div>

                <div class="form-group">
                    <label>URL de Captura de Victoria (Opcional - Imgur, Discord, Drive)</label>
                    <input type="url" class="form-control" id="modalEvidenciaInput" placeholder="https://i.imgur.com/..." value="${escapeHtml(match.evidenciaURL || '')}">
                </div>

                <button type="button" class="btn btn-gold" style="width:100%;margin-top:10px;" onclick="submitMatchResultFromModal('${torneoId}', '${escapeHtml(match.ronda)}', ${match.partido})">
                    ⚡ CONFIRMAR Y AVANZAR GANADOR
                </button>
            </div>`;
    }

    content.innerHTML = html;
    modal.classList.add('active');
}

function _renderTeamRosterForModal(teamInfo, teamName) {
    if (!teamInfo || !teamInfo.miembros || teamInfo.miembros.length === 0) {
        return `<div class="text-muted" style="font-size:0.85rem;margin-top:6px;">${escapeHtml(teamName)}</div>`;
    }
    return teamInfo.miembros.map(m => {
        const gid = m.gameId || '';
        return `
            <div class="modal-roster-row">
                <div>
                    <strong>👤 ${escapeHtml(m.nick || m.nombre || 'Jugador')}</strong>
                    <div class="text-muted" style="font-size:0.75rem;">ID: ${escapeHtml(gid)}</div>
                </div>
                ${gid ? `
                    <button type="button" class="btn btn-sm btn-outline" style="padding:3px 7px;font-size:0.7rem;" onclick="copyGameId('${escapeHtml(gid)}')">
                        📋 Copiar ID
                    </button>
                ` : ''}
            </div>`;
    }).join('');
}

function _selectWinnerCandidate(winner, loser) {
    document.getElementById('modalWinnerInput').value = winner;
    document.getElementById('modalLoserInput').value = loser;
    const btn1 = document.getElementById('btnWin1');
    const btn2 = document.getElementById('btnWin2');
    if (btn1 && btn2) {
        btn1.style.background = (btn1.textContent.indexOf(winner) !== -1) ? 'var(--green-neon)' : 'rgba(0,229,255,0.2)';
        btn1.style.color = (btn1.textContent.indexOf(winner) !== -1) ? '#000' : '#fff';
        btn2.style.background = (btn2.textContent.indexOf(winner) !== -1) ? 'var(--green-neon)' : 'rgba(0,229,255,0.2)';
        btn2.style.color = (btn2.textContent.indexOf(winner) !== -1) ? '#000' : '#fff';
    }
    showToast('Ganador seleccionado: ' + winner, 'info');
}

function closeMatchModal() {
    const modal = document.getElementById('matchModal');
    if (modal) modal.classList.remove('active');
}

function copyGameId(gameId) {
    if (!gameId) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(gameId)
            .then(() => showToast('¡Game ID copiado al portapapeles: ' + gameId, 'success'))
            .catch(() => showToast('Game ID: ' + gameId, 'info'));
    } else {
        showToast('Game ID: ' + gameId, 'info');
    }
}

function submitMatchResultFromModal(torneoId, ronda, partido) {
    const ganador = document.getElementById('modalWinnerInput').value.trim();
    const perdedor = document.getElementById('modalLoserInput').value.trim();
    const marcador = document.getElementById('modalMarcadorInput').value.trim();
    const evidencia = document.getElementById('modalEvidenciaInput').value.trim();

    if (!ganador) {
        showToast('Por favor selecciona cuál de los dos equipos es el ganador', 'error');
        return;
    }

    if (!confirm(`¿Confirmar que ${ganador} GANA el encuentro con marcador "${marcador || 'Victoria'}"?`)) return;

    showToast('Guardando resultado...', 'info');
    closeMatchModal();

    google.script.run
        .withSuccessHandler(r => {
            if (r && r.success) {
                showToast(`¡${ganador} avanza en el bracket!`, 'success');
                _fetchAndRenderTorneoDetalle(torneoId);
            } else {
                showToast((r && r.message) || 'Error al guardar resultado', 'error');
            }
        })
        .withFailureHandler(e => showToast('Error: ' + e.message, 'error'))
        .setMatchResult(torneoId, ronda, partido, ganador, perdedor, marcador, evidencia);
}

function realizarSorteo(torneoId) {
    if (!confirm('¿Realizar el sorteo? Esto cerrará las inscripciones y generará el fixture ramificado con sus salas de partida.')) return;
    showToast('Realizando sorteo de enfrentamientos...', 'info');

    google.script.run
        .withSuccessHandler(r => {
            if (r && r.success) {
                showToast(r.message || '¡Sorteo realizado con éxito!', 'success');
                openTorneoDetalle(torneoId);
                loadInitialData();
            } else {
                showToast((r && r.message) || 'Error al realizar sorteo', 'error');
            }
        })
        .withFailureHandler(e => showToast('Error: ' + e.message, 'error'))
        .realizarSorteo(torneoId);
}

function eliminarFixtureAdmin(torneoId) {
    if (!confirm('¿Eliminar todo el fixture de este torneo? Los enfrentamientos y resultados se borrarán.')) return;

    google.script.run
        .withSuccessHandler(r => {
            if (r && r.success) {
                showToast('Fixture eliminado. Puede volver a realizar el sorteo.', 'success');
                google.script.run
                    .withSuccessHandler(() => openTorneoDetalle(torneoId))
                    .cambiarEstadoTorneo(torneoId, 'cerrado');
            }
        })
        .withFailureHandler(e => showToast('Error: ' + e.message, 'error'))
        .eliminarFixture(torneoId);
}
