import { db, ref, onValue } from "../lib/firebase.js";
import { escapeHTML } from "../lib/utils.js";

// --- 1. RUTAS LOCALES ---
const ICON_URLS = {
    "fossil": "/icons/fossil.png", // Asumo que guardaste estos también en tu carpeta icons
    "safari": "/icons/safari.png",
    "secret": "/icons/secretshiny.png",
    "alpha": "/icons/alfa.png",
    "egg": "/icons/eggshiny.png",
    "swarm": "/icons/swarm.png"
};

// Funciones limpias para obtener las rutas locales
function getAvatarPath(avatarStr) {
    if (!avatarStr) return '/icons/unown.png';

    const fileName = avatarStr.split('/').pop();

    // Si detectamos que es el Unown, forzamos la ruta a la carpeta icons
    if (fileName === 'unown.png') {
        return '/icons/unown.png';
    }

    return `/entrenadores/${fileName}`;
}

function getPokemonPath(pokeName) {
    const nameClean = (pokeName || 'unknown').toLowerCase().trim();
    // Asume que bajaste los sprites animados en formato .gif
    return `/shinys/${nameClean}.gif`;
}

// Precargamos el sparkle compartido una sola vez
new Image().src = '/icons/sparkle.gif';
const preloadedPlayers = new Set();

// Mantener los datos en caché
let allPlayersData = [];
const usersRef = ref(db, 'users');

onValue(usersRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    allPlayersData = Array.isArray(data) ? data : Object.values(data);

    if (document.getElementById('showcase-grid')) {
        renderShowcase(allPlayersData);
    }
});

let isEscListenerAdded = false;
let openModal = null;
let closeModalAction = null;

// EVENTO MÁGICO DE ASTRO
document.addEventListener('astro:page-load', () => {
    const grid = document.getElementById('showcase-grid');
    if (!grid) return;

    const searchInput = document.getElementById('search-input');
    const sortSelect = document.getElementById('sort-select');
    const modal = document.getElementById('modal-overlay');
    const closeBtn = document.getElementById('close-btn');

    if (allPlayersData.length > 0) {
        renderShowcase(allPlayersData);
    }

    if (searchInput) {
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);
        newSearchInput.addEventListener('input', handleFilters);
    }
    if (sortSelect) {
        const newSortSelect = sortSelect.cloneNode(true);
        sortSelect.parentNode.replaceChild(newSortSelect, sortSelect);
        newSortSelect.addEventListener('change', handleFilters);
    }

    function handleFilters() {
        const currentSearchInput = document.getElementById('search-input');
        const currentSortSelect = document.getElementById('sort-select');
        const searchText = currentSearchInput?.value.toLowerCase() || '';
        const sortValue = currentSortSelect?.value || 'default';
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

    openModal = function (jugador) {
        if (!modal) return;

        const nav = document.querySelector('.main-nav');
        if (nav) nav.style.zIndex = '0';


        document.getElementById('modal-name').textContent = escapeHTML(jugador.nombre);
        // Usamos la nueva función para el avatar
        document.getElementById('modal-avatar').src = getAvatarPath(jugador.avatar);

        const teamGrid = document.getElementById('modal-team');
        teamGrid.innerHTML = '';

        const equipo = jugador.equipo || [];
        const equipoVisible = equipo.filter(poke => poke.live !== 'no');
        const fragment = document.createDocumentFragment();

        equipoVisible.forEach(poke => {
            const container = document.createElement('div');
            container.className = 'poke-overlay-container';

            const imgPoke = document.createElement('img');
            // Usamos la nueva función para el Pokémon
            imgPoke.src = getPokemonPath(poke.pokemon);
            imgPoke.loading = 'lazy';
            imgPoke.alt = (poke.pokemon || 'unknown').toLowerCase().trim();
            imgPoke.className = 'poke-base-sprite';
            imgPoke.onerror = () => { imgPoke.style.opacity = '0.3'; };

            if (poke.safari === "flee") {
                imgPoke.classList.add('poke-fled');
            }

            const imgSparkle = document.createElement('img');
            imgSparkle.src = '/icons/sparkle.gif'; // Ruta local
            imgSparkle.loading = 'lazy';
            imgSparkle.className = 'poke-sparkle-effect';

            container.onmouseenter = () => { imgSparkle.src = '/icons/sparkle.gif'; };

            container.appendChild(imgPoke);
            container.appendChild(imgSparkle);

            if (poke.icono && ICON_URLS[poke.icono]) {
                const imgIcon = document.createElement('img');
                imgIcon.src = ICON_URLS[poke.icono]; // Ruta local desde el diccionario
                imgIcon.loading = 'lazy';
                imgIcon.className = 'poke-legend-icon';
                container.appendChild(imgIcon);
            }
            fragment.appendChild(container);
        });

        teamGrid.appendChild(fragment);
        document.documentElement.classList.add('no-scroll');
        document.body.classList.add('no-scroll');
        modal.classList.remove('hidden');
        setTimeout(() => { modal.classList.add('active'); }, 10);
    };

    closeModalAction = function () {

        const nav = document.querySelector('.main-nav');
        if (nav) nav.style.zIndex = '';
        document.documentElement.classList.remove('no-scroll');
        document.body.classList.remove('no-scroll');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => { modal.classList.add('hidden'); }, 300);
        }
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModalAction);
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModalAction();
        });
    }
    if (!isEscListenerAdded) {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && closeModalAction) closeModalAction();
        });
        isEscListenerAdded = true;
    }
});

function renderShowcase(jugadores) {
    const grid = document.getElementById('showcase-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (jugadores.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.textContent = 'No se encontraron entrenadores.';
        emptyMsg.style.cssText = 'color: #666; font-size: 1.2rem; grid-column: 1/-1;';
        grid.appendChild(emptyMsg);
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

        // Usamos la nueva función para el avatar de la tarjeta
        const avatarUrl = getAvatarPath(jugador.avatar);

        const avatarContainer = document.createElement('div');
        avatarContainer.className = 'staff-avatar-container';
        const avatarImg = document.createElement('img');
        avatarImg.src = avatarUrl;
        avatarImg.loading = 'lazy';
        avatarImg.alt = escapeHTML(jugador.nombre);
        // Fallback local por si el entrenador no tiene imagen
        avatarImg.onerror = () => { avatarImg.src = '/icons/unown.png'; };
        avatarContainer.appendChild(avatarImg);

        const nameH3 = document.createElement('h3');
        nameH3.textContent = jugador.nombre;

        const counterP = document.createElement('p');
        counterP.className = `shiny-counter ${rankClass}`;
        counterP.textContent = `${cantidadShinys} shinies`;

        card.appendChild(avatarContainer);
        card.appendChild(nameH3);
        card.appendChild(counterP);

        card.onmouseenter = () => {
            if (preloadedPlayers.has(jugador.nombre)) return;
            preloadedPlayers.add(jugador.nombre);
            (jugador.equipo || []).forEach(poke => {
                if (poke.live === 'no') return;
                const img = new Image();
                // Precarga usando la ruta local
                img.src = getPokemonPath(poke.pokemon);
            });
        };
        card.onclick = () => openModal(jugador);
        fragment.appendChild(card);
    });

    grid.appendChild(fragment);
}