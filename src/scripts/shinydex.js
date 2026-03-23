import { db, ref, onValue } from "../lib/firebase.js";
import { GEN1_5_POKEMON } from "../data/pokemon-gen1-5.js";

const URL_SHINY = "https://play.pokemonshowdown.com/sprites/gen5ani-shiny/";

const GENERATIONS = [
    { label: "Generación 1", short: "01", min: 1, max: 151 },
    { label: "Generación 2", short: "02", min: 152, max: 251 },
    { label: "Generación 3", short: "03", min: 252, max: 386 },
    { label: "Generación 4", short: "04", min: 387, max: 493 },
    { label: "Generación 5", short: "05", min: 494, max: 649 }
];

// Estado global en caché
let globalDexData = new Map();
let globalCaptured = 0;
let generationBlocks = [];
let tooltipElement = null;

// Referencias a observers para poder desconectarlos (#9)
let revealObserver = null;
let scrollSpyObserver = null;

// Escuchamos a Firebase
const usersRef = ref(db, 'users');
onValue(usersRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    const playersData = Array.isArray(data) ? data : Object.values(data);
    globalDexData.clear(); // Limpiamos antes de actualizar

    playersData.forEach(jugador => {
        const equipo = jugador.equipo || [];

        equipo.forEach(poke => {
            if (poke.safari === 'flee') return;

            const name = (poke.pokemon || 'unknown').toLowerCase().trim();

            if (!globalDexData.has(name)) {
                globalDexData.set(name, { status: null, owners: [] });
            }

            const entry = globalDexData.get(name);

            if (!entry.owners.includes(jugador.nombre)) {
                entry.owners.push(jugador.nombre);
            }

            if (poke.live === 'no') {
                if (entry.status !== 'normal') entry.status = 'non-live';
            } else {
                entry.status = 'normal';
            }
        });
    });

    // Si estamos en la ShinyDex ahora mismo, repintamos
    if (document.getElementById("shinydex-main")) {
        createGlobalTooltip();
        initShinyDex(globalDexData);
    }
});


// EVENTO ASTRO: Se ejecuta cada vez que entramos a la pestaña ShinyDex
document.addEventListener('astro:page-load', () => {

    // Buscamos los elementos del DOM frescos
    const main = document.getElementById("shinydex-main");
    const searchInput = document.getElementById("search");

    // Si no estamos en la ShinyDex, abortamos
    if (!main) return;

    // 1. Tooltip
    createGlobalTooltip();

    // 2. Si ya hay datos en caché, renderizamos inmediatamente
    if (globalDexData.size > 0) {
        initShinyDex(globalDexData);
    }

    // 3. Conectamos el buscador
    if (searchInput) {
        let searchDebounce = null;

        // Removemos eventos previos para que no se dupliquen al cambiar de pestaña
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);

        newSearchInput.addEventListener("input", (e) => {
            clearTimeout(searchDebounce);
            searchDebounce = setTimeout(() => {
                const searchValue = e.target.value.toLowerCase().trim();

                generationBlocks.forEach(g => {
                    let visible = 0;
                    g.block.querySelectorAll(".shiny-card").forEach(card => {
                        const matchPoke = card.dataset.searchKey ? card.dataset.searchKey.includes(searchValue) : card.textContent.toLowerCase().includes(searchValue);

                        let matchTrainer = false;
                        if (card.dataset.owners) {
                            try {
                                const owners = JSON.parse(card.dataset.owners);
                                matchTrainer = owners.some(o => o.toLowerCase().includes(searchValue));
                            } catch (err) {
                                matchTrainer = false;
                            }
                        }

                        const match = matchPoke || matchTrainer;
                        card.style.display = match ? "flex" : "none";
                        if (match) visible++;
                    });
                    g.block.style.display = visible > 0 ? "block" : "none";
                });
            }, 100);
        });
    }
});


// --- FUNCIONES PURAS ---

function formatName(name) {
    const fixes = {
        nidoranf: "Nidoran♀", nidoranm: "Nidoran♂",
        mrmime: "Mr. Mime", farfetchd: "Farfetch'd",
        hooh: "Ho-Oh", porygonz: "Porygon-Z"
    };
    return fixes[name] || name.charAt(0).toUpperCase() + name.slice(1);
}

function getColorByPercentage(percent) {
    const hue = (percent * 1.2);
    const saturation = percent;
    const lightness = 60 - (percent * 0.1);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function animateValue(element, start, end, duration, isGlobal = false, currentObtained = 0, total = 0) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const currentPercent = Math.floor(progress * (end - start) + start);
        const currentColor = getColorByPercentage(currentPercent);

        if (isGlobal) {
            element.style.color = currentColor;
            element.innerHTML = `${currentObtained} / ${total} <span class="percentage-text" style="color: ${currentColor}">${currentPercent}%</span>`;
        } else {
            const wrapper = element.querySelector('.count-wrapper');
            const percSpan = element.querySelector('.percentage-text');
            if (wrapper) wrapper.style.color = currentColor;
            if (percSpan) percSpan.textContent = `${currentPercent}%`;
        }

        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}

function createGlobalTooltip() {
    if (document.getElementById('global-tooltip')) return;
    tooltipElement = document.createElement('div');
    tooltipElement.id = 'global-tooltip';
    document.body.appendChild(tooltipElement);
}

function showTooltip(e) {
    const ownersData = e.currentTarget.dataset.owners;
    if (!ownersData || !tooltipElement) return;

    const owners = JSON.parse(ownersData);

    // Construir tooltip de forma segura contra XSS
    tooltipElement.innerHTML = '';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'tooltip-title';
    titleSpan.textContent = `Capturado por (${owners.length})`;

    const scrollMask = document.createElement('div');
    scrollMask.className = 'tooltip-scroll-mask';

    const ul = document.createElement('ul');
    ul.className = 'tooltip-names';

    owners.forEach(o => {
        const li = document.createElement('li');
        li.textContent = o;
        ul.appendChild(li);
    });

    if (owners.length > 3) {
        ul.classList.add('scrolling');
        const duration = 2 + (owners.length * 0.8);
        ul.style.animationDuration = `${duration}s`;
    }

    scrollMask.appendChild(ul);
    tooltipElement.appendChild(titleSpan);
    tooltipElement.appendChild(scrollMask);

    tooltipElement.classList.add('visible');
    moveTooltip(e);
}

function moveTooltip(e) {
    if (!tooltipElement) return;
    const x = e.clientX + 15;
    const y = e.clientY + 15;
    tooltipElement.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}

function hideTooltip() {
    if (tooltipElement) tooltipElement.classList.remove('visible');
}

function initShinyDex(dexData) {
    const main = document.getElementById("shinydex-main");
    const index = document.getElementById("shinydex-index");
    const counterGlobal = document.getElementById("shiny-counter");

    if (!main || !index || !counterGlobal) return;

    // Desconectar observers anteriores para evitar memory leaks (#9)
    if (revealObserver) { revealObserver.disconnect(); revealObserver = null; }
    if (scrollSpyObserver) { scrollSpyObserver.disconnect(); scrollSpyObserver = null; }

    globalCaptured = 0;
    generationBlocks = [];
    main.innerHTML = "";
    index.innerHTML = "";

    GENERATIONS.forEach((gen, gIndex) => {
        const genPokemonList = GEN1_5_POKEMON.filter(p => p.id >= gen.min && p.id <= gen.max);
        let genCaptured = 0;

        const block = document.createElement("section");
        block.className = "gen-block";
        block.id = `gen-${gIndex}`;

        const grid = document.createElement("div");
        grid.className = "shinydex-grid";

        genPokemonList.forEach((pokeObj) => {
            const dataEntry = dexData.get(pokeObj.name);
            const status = dataEntry ? dataEntry.status : undefined;
            const owners = dataEntry ? dataEntry.owners : [];

            if (status !== undefined) { genCaptured++; globalCaptured++; }

            let statusClass = "missing";
            if (status === 'normal') statusClass = "captured";
            else if (status === 'non-live') statusClass = "captured-live-no";

            const card = document.createElement("div");
            card.className = `shiny-card ${statusClass}`;
            card.dataset.searchKey = `${formatName(pokeObj.name).toLowerCase()} #${String(pokeObj.id).padStart(3, "0")}`;

            card.innerHTML = `
                <span class="poke-number">#${String(pokeObj.id).padStart(3, "0")}</span>
                <div class="sprite-wrapper">
                    <img src="${URL_SHINY}${pokeObj.name}.gif" loading="lazy" alt="${pokeObj.name}">
                </div>
                <span class="poke-name">${formatName(pokeObj.name)}</span>
            `;

            if (owners.length > 0 && status === 'normal') {
                card.dataset.owners = JSON.stringify(owners);
                card.addEventListener('mouseenter', showTooltip);
                card.addEventListener('mousemove', moveTooltip);
                card.addEventListener('mouseleave', hideTooltip);
            }

            grid.appendChild(card);
        });

        const title = document.createElement("h3");
        title.className = "gen-title";
        const percentGen = Math.round((genCaptured / genPokemonList.length) * 100);
        title.innerHTML = `${gen.label} <span class="count-wrapper">
            <span class="gen-count-badge">(${genCaptured} / ${genPokemonList.length})</span>
            <span class="percentage-text">0%</span></span>`;

        block.appendChild(title);
        block.appendChild(grid);
        main.appendChild(block);
        generationBlocks.push({ block, gen, title, percentGen });

        const link = document.createElement("a");
        link.href = `#gen-${gIndex}`;
        link.textContent = gen.short;
        index.appendChild(link);
    });

    setTimeout(() => {
        const totalPokes = GEN1_5_POKEMON.length;
        animateValue(counterGlobal, 0, Math.round((globalCaptured / totalPokes) * 100), 1500, true, globalCaptured, totalPokes);
        generationBlocks.forEach(g => animateValue(g.title, 0, g.percentGen, 1500));
        index.querySelectorAll('a').forEach((l, idx) => setTimeout(() => l.classList.add('reveal'), idx * 100));

        initCardsReveal();
    }, 300);

    initScrollSpy();
}

function initCardsReveal() {
    revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

    document.querySelectorAll('.shiny-card').forEach(card => revealObserver.observe(card));
}

function initScrollSpy() {
    scrollSpyObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                document.querySelectorAll('.shinydex-index a').forEach(a => a.classList.remove('active'));
                const activeLink = document.querySelector(`.shinydex-index a[href="#${entry.target.id}"]`);
                if (activeLink) activeLink.classList.add('active');
            }
        });
    }, { rootMargin: '-20% 0px -70% 0px' });
    document.querySelectorAll('.gen-block').forEach(section => scrollSpyObserver.observe(section));
}