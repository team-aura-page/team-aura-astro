import { db, ref, onValue } from "../lib/firebase.js";

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

// Función de escape HTML para prevenir XSS (#3)
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

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

// Funciones del modal como closures en vez de window globals (#13)
let openModal = null;
let closeModalAction = null;

// EVENTO MÁGICO DE ASTRO: Se ejecuta cada vez que el usuario entra al Showcase
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

    // Reconectar eventos sin duplicarlos (#14) — clonar nodos para limpiar listeners previos
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

    // Lógica del Modal (#13: no más window.openModal)
    openModal = function (jugador) {
        if (!modal) return;
        document.getElementById('modal-name').textContent = escapeHTML(jugador.nombre);
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
            // Fallback para imágenes externas (#19)
            imgPoke.onerror = () => { imgPoke.style.opacity = '0.3'; };

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

    closeModalAction = function () {
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

// Función pura de renderizado
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

        const avatarUrl = fixPath(jugador.avatar);

        // Construimos el contenido de la tarjeta de forma segura (#3: sin innerHTML con datos de usuario)
        const avatarContainer = document.createElement('div');
        avatarContainer.className = 'staff-avatar-container';
        const avatarImg = document.createElement('img');
        avatarImg.src = avatarUrl;
        avatarImg.alt = escapeHTML(jugador.nombre);
        avatarImg.onerror = () => { avatarImg.src = fixPath(null); }; // Fallback (#19)
        avatarContainer.appendChild(avatarImg);

        const nameH3 = document.createElement('h3');
        nameH3.textContent = jugador.nombre; // textContent = seguro contra XSS

        const counterP = document.createElement('p');
        counterP.className = `shiny-counter ${rankClass}`;
        counterP.textContent = `${cantidadShinys} shinies`;

        card.appendChild(avatarContainer);
        card.appendChild(nameH3);
        card.appendChild(counterP);

        card.onclick = () => openModal(jugador);
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