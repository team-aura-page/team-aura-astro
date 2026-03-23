import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";

// 1. Ciberseguridad: Claves protegidas (Astro las inyectará al compilar)
const firebaseConfig = {
    apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
    authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: "https://page-aura-default-rtdb.europe-west1.firebasedatabase.app", // Esta puede ser pública
    projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.PUBLIC_FIREBASE_APP_ID
};

const REPO_URL = "https://raw.githubusercontent.com/team-aura-page/TeamAura/main/";
const URL_SHINY = "https://play.pokemonshowdown.com/sprites/gen5ani-shiny/";

function fixPath(path) {
    if (!path) return REPO_URL + 'icons/unown.png';
    if (path.startsWith('http')) return path;
    const cleanPath = path.replace(/^(\.\.\/|\.\/)/, '');
    return REPO_URL + cleanPath;
}

const ICON_URLS = {
    "fossil": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/helix-fossil.png",
    "safari": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/safari-ball.png",
    "secret": fixPath("icons/secretshiny.png"),
    "alpha": fixPath("icons/alfa.png"),
    "egg": fixPath("icons/eggshiny.png"),
    "swarm": fixPath("icons/swarm.png")
};

// 2. Anti-Crash SPA: Inicializar Firebase solo si no está inicializado ya
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getDatabase(app);

// Mantener los datos en caché para no pedir a la base de datos al cambiar de pestaña
let allPlayersData = [];
const usersRef = ref(db, 'users');

onValue(usersRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    allPlayersData = Array.isArray(data) ? data : Object.values(data);

    // Si la tabla del showcase está en pantalla ahora mismo, la actualizamos
    if (document.getElementById('showcase-grid')) {
        renderShowcase(allPlayersData);
        setTimeout(() => preloadAllImages(allPlayersData), 500);
    }
});

// Evitar que el evento del teclado 'Escape' se acumule
let isEscListenerAdded = false;

// 3. EVENTO MÁGICO DE ASTRO: Se ejecuta cada vez que el usuario entra al Showcase
document.addEventListener('astro:page-load', () => {
    const grid = document.getElementById('showcase-grid');
    // Si estamos en la página de inicio, detenemos la ejecución de este bloque
    if (!grid) return;

    const searchInput = document.getElementById('search-input');
    const sortSelect = document.getElementById('sort-select');
    const modal = document.getElementById('modal-overlay');
    const closeBtn = document.getElementById('close-btn');

    // Si ya teníamos datos bajados de Firebase, pintamos inmediatamente
    if (allPlayersData.length > 0) {
        renderShowcase(allPlayersData);
    }

    // Reconectar eventos
    if (searchInput) searchInput.addEventListener('input', handleFilters);
    if (sortSelect) sortSelect.addEventListener('change', handleFilters);

    function handleFilters() {
        const searchText = searchInput?.value.toLowerCase() || '';
        const sortValue = sortSelect?.value || 'default';
        let filteredList = [...allPlayersData];

        if (searchText) {
            filteredList = filteredList.filter(jugador =>
                (jugador.nombre || '').toLowerCase().includes(searchText)
            );
        }

        if (sortValue !== 'default') {
            filteredList.sort((a, b) => {
                const equipoA = a.equipo || [];
                const equipoB = b.equipo || [];
                const pointsA = equipoA.filter(p => p.safari !== 'flee' && p.live !== 'no').length;
                const pointsB = equipoB.filter(p => p.safari !== 'flee' && p.live !== 'no').length;
                return sortValue === 'desc' ? pointsB - pointsA : pointsA - pointsB;
            });
        }
        renderShowcase(filteredList);
    }

    // Lógica del Modal atada a la vista actual
    window.openModal = function (jugador) {
        if (!modal) return;
        document.getElementById('modal-name').innerText = jugador.nombre;
        document.getElementById('modal-avatar').src = fixPath(jugador.avatar);

        const teamGrid = document.getElementById('modal-team');
        teamGrid.innerHTML = '';

        const equipo = jugador.equipo || [];
        const equipoVisible = equipo.filter(poke => poke.live !== 'no');
        const fragment = document.createDocumentFragment();

        equipoVisible.forEach(poke => {
            const container = document.createElement('div');
            container.className = 'poke-overlay-container';

            const imgPoke = document.createElement('img');
            const nameClean = (poke.pokemon || 'unknown').toLowerCase().trim();
            imgPoke.src = `${URL_SHINY}${nameClean}.gif`;
            imgPoke.alt = nameClean;
            imgPoke.className = 'poke-base-sprite';

            if (poke.safari === "flee") {
                imgPoke.classList.add('poke-fled');
            }

            const imgSparkle = document.createElement('img');
            imgSparkle.src = fixPath('icons/sparkle.gif');
            imgSparkle.className = 'poke-sparkle-effect';

            container.onmouseenter = () => { imgSparkle.src = fixPath('icons/sparkle.gif'); };

            container.appendChild(imgPoke);
            container.appendChild(imgSparkle);

            if (poke.icono && ICON_URLS[poke.icono]) {
                const imgIcon = document.createElement('img');
                imgIcon.src = ICON_URLS[poke.icono];
                imgIcon.className = 'poke-legend-icon';
                container.appendChild(imgIcon);
            }
            fragment.appendChild(container);
        });

        teamGrid.appendChild(fragment);
        document.body.classList.add('no-scroll');
        modal.classList.remove('hidden');
        setTimeout(() => { modal.classList.add('active'); }, 10);
    };

    window.closeModalAction = function () {
        document.body.classList.remove('no-scroll');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => { modal.classList.add('hidden'); }, 300);
        }
    };

    if (closeBtn) closeBtn.addEventListener('click', window.closeModalAction);
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) window.closeModalAction();
        });
    }
    if (!isEscListenerAdded) {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && window.closeModalAction) window.closeModalAction();
        });
        isEscListenerAdded = true;
    }
});

// Función pura de renderizado
function renderShowcase(jugadores) {
    const grid = document.getElementById('showcase-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (jugadores.length === 0) {
        grid.innerHTML = '<p style="color: #666; font-size: 1.2rem; grid-column: 1/-1;">No se encontraron entrenadores.</p>';
        return;
    }

    const todosLosPuntosGlobales = allPlayersData.map(jugador => {
        const eq = jugador.equipo || [];
        return eq.filter(poke => poke.safari !== 'flee' && poke.live !== 'no').length;
    });
    const puntosUnicos = [...new Set(todosLosPuntosGlobales)].sort((a, b) => b - a);
    const scoreGold = puntosUnicos[0] || 0;
    const scoreSilver = puntosUnicos[1] || 0;
    const scoreBronze = puntosUnicos[2] || 0;

    const fragment = document.createDocumentFragment();

    jugadores.forEach(jugador => {
        const equipo = jugador.equipo || [];
        const cantidadShinys = equipo.filter(poke => poke.safari !== 'flee' && poke.live !== 'no').length;

        let rankClass = '';
        if (cantidadShinys > 0) {
            if (cantidadShinys === scoreGold) rankClass = 'rank-gold';
            else if (cantidadShinys === scoreSilver) rankClass = 'rank-silver';
            else if (cantidadShinys === scoreBronze) rankClass = 'rank-bronze';
        }

        const card = document.createElement('div');
        card.className = 'staff-card';

        const avatarUrl = fixPath(jugador.avatar);

        card.innerHTML = `
            <div class="staff-avatar-container">
                <img src="${avatarUrl}" alt="${jugador.nombre}">
            </div>
            <h3>${jugador.nombre}</h3>
            <p class="shiny-counter ${rankClass}">${cantidadShinys} shinies</p>
        `;

        card.onclick = () => window.openModal(jugador);
        fragment.appendChild(card);
    });

    grid.appendChild(fragment);
}

function preloadAllImages(jugadores) {
    if (!Array.isArray(jugadores)) return;
    const imagesToLoad = new Set();
    imagesToLoad.add(fixPath('icons/sparkle.gif'));

    jugadores.forEach(jugador => {
        if (jugador.avatar) imagesToLoad.add(fixPath(jugador.avatar));
        const equipo = jugador.equipo || [];
        equipo.forEach(poke => {
            if (poke.live === 'no') return;
            const nameClean = (poke.pokemon || 'unknown').toLowerCase().trim();
            imagesToLoad.add(`${URL_SHINY}${nameClean}.gif`);
            if (poke.icono && ICON_URLS[poke.icono]) {
                imagesToLoad.add(ICON_URLS[poke.icono]);
            }
        });
    });

    setTimeout(() => {
        imagesToLoad.forEach(url => {
            const img = new Image();
            img.src = url;
        });
    }, 1000);
}