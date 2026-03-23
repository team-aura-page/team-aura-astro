import { db, ref, get, update, auth, signInWithEmailAndPassword, onAuthStateChanged } from "../lib/firebase.js";

// Función de escape HTML para prevenir XSS
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Estado Global en Caché (Sobrevive a los cambios de pestaña)
let globalUsersData = {};
let displayedCaptures = [];
let isAdmin = false;
let currentTrackerDate = new Date();
let firstCaptureDates = {};
let dataLoaded = false;

// 3. Listener de Sesión Global
onAuthStateChanged(auth, (user) => {
    if (user) {
        isAdmin = true;
        console.log("🔓 MODO ADMIN ACTIVADO (Usuario Autenticado)");
        // Si el usuario está viendo el tracker ahora mismo, le mostramos el botón
        const adminBtn = document.getElementById('adminSaveBtn');
        if (adminBtn) adminBtn.style.display = 'block';
        updateMonthUI();
    } else {
        isAdmin = false;
    }
});


// 4. EVENTO ASTRO: Se ejecuta al entrar a la página Tracker
document.addEventListener('astro:page-load', () => {
    const normalGrid = document.getElementById('trackerGrid');
    if (!normalGrid) return; // Si no estamos en el Tracker, abortamos

    const prevBtn = document.getElementById('prevMonthBtn');
    const nextBtn = document.getElementById('nextMonthBtn');
    const adminBtn = document.getElementById('adminSaveBtn');

    // Mantenemos el botón de admin visible si ya había iniciado sesión
    if (isAdmin && adminBtn) adminBtn.style.display = 'block';

    // Comprobar Login por URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('admin') === 'true' && !auth.currentUser) {
        setTimeout(() => {
            const email = prompt("📧 ZONA ADMIN\nIntroduce tu CORREO de administrador:");
            if (email) {
                const password = prompt("🔒 ZONA ADMIN\nIntroduce tu CONTRASEÑA:");
                if (password) {
                    signInWithEmailAndPassword(auth, email, password)
                        .then(() => { alert("✅ Acceso concedido. Conectado a la base de datos."); })
                        .catch((error) => {
                            console.error("Error Auth:", error);
                            alert("❌ Error: Correo o contraseña incorrectos.");
                        });
                }
            }
        }, 500);
    }

    // Botones de navegación de mes
    if (prevBtn) {
        // Usamos onclick en lugar de addEventListener para evitar duplicados al entrar y salir
        prevBtn.onclick = () => {
            currentTrackerDate.setMonth(currentTrackerDate.getMonth() - 1);
            updateMonthUI();
        };
    }
    if (nextBtn) {
        nextBtn.onclick = () => {
            currentTrackerDate.setMonth(currentTrackerDate.getMonth() + 1);
            updateMonthUI();
        };
    }

    // Guardado de Admin
    if (adminBtn) {
        adminBtn.onclick = async () => {
            try {
                adminBtn.innerText = "⏳ Guardando...";
                adminBtn.style.background = "#9e9e9e";

                const updates = {};
                displayedCaptures.forEach(cap => {
                    const rarityValue = cap.rarity === 'rare' ? 'rare' : null;
                    updates[`${cap.refPath}/rarity`] = rarityValue;
                    const newShinydexValue = cap.newShinydex ? true : null;
                    updates[`${cap.refPath}/newShinydex`] = newShinydexValue;
                });

                await update(ref(db), updates);

                adminBtn.innerText = "✅ CAMBIOS GUARDADOS";
                adminBtn.style.background = "#4caf50";

                setTimeout(() => {
                    adminBtn.innerText = "💾 GUARDAR CAMBIOS";
                    adminBtn.style.background = "#e91e63";
                }, 2000);

            } catch (error) {
                console.error("Error guardando:", error);
                alert("❌ Error: No tienes permiso de escritura. ¿Estás logueado como Admin?");
                adminBtn.innerText = "❌ ERROR PERMISO";
                adminBtn.style.background = "#f44336";
            }
        };
    }

    // Arrancamos datos si es la primera vez, si no, solo repintamos
    if (!dataLoaded) {
        loadData();
    } else {
        updateMonthUI();
    }
});


// --- LÓGICA PURA ---

function updateMonthUI() {
    const monthDisplay = document.getElementById('currentMonthDisplay');
    const prevBtn = document.getElementById('prevMonthBtn');
    const nextBtn = document.getElementById('nextMonthBtn');

    if (!monthDisplay) return; // Protección anti-errores

    const monthName = currentTrackerDate.toLocaleDateString('es-ES', { month: 'long' });
    const monthCapitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    const year = currentTrackerDate.getFullYear();

    monthDisplay.innerHTML = `${monthCapitalized} <span style="margin-left: 10px;">${year}</span>`;

    const isStartLimit = (year === 2026 && currentTrackerDate.getMonth() === 0);

    if (prevBtn) {
        if (isStartLimit) {
            prevBtn.style.opacity = "0.2";
            prevBtn.style.pointerEvents = "none";
        } else {
            prevBtn.style.opacity = "1";
            prevBtn.style.pointerEvents = "auto";
        }
    }

    const realDate = new Date();
    const isFutureLimit = (
        year === realDate.getFullYear() &&
        currentTrackerDate.getMonth() === realDate.getMonth()
    );

    if (nextBtn) {
        if (isFutureLimit) {
            nextBtn.style.opacity = "0.2";
            nextBtn.style.pointerEvents = "none";
        } else {
            nextBtn.style.opacity = "1";
            nextBtn.style.pointerEvents = "auto";
        }
    }

    const monthNum = String(currentTrackerDate.getMonth() + 1).padStart(2, '0');
    const formattedDateKey = `${year}-${monthNum}`;

    if (displayedCaptures.length > 0 || Object.keys(globalUsersData).length > 0) {
        if (displayedCaptures.length !== 0 || Object.keys(globalUsersData).length !== 0) {
            renderMonth(formattedDateKey);
        }
    }
}

async function loadData() {
    try {
        console.log("📡 Cargando datos...");
        const snapshot = await get(ref(db, 'users'));
        const data = snapshot.val();

        if (!data) return;

        globalUsersData = data;
        displayedCaptures = [];

        Object.keys(data).forEach(userKey => {
            const user = data[userKey];
            if (user && user.equipo) {
                Object.keys(user.equipo).forEach(pokeKey => {
                    const poke = user.equipo[pokeKey];
                    if (poke) {
                        const captureData = {
                            ...poke,
                            trainer: user.nombre || 'Anónimo',
                            refPath: `users/${userKey}/equipo/${pokeKey}`
                        };

                        if (!captureData.date) {
                            captureData.date = "2024-01-01";
                            captureData.isLegacy = true;
                        }
                        displayedCaptures.push(captureData);
                    }
                });
            }
        });

        firstCaptureDates = {};

        displayedCaptures.forEach(cap => {
            const species = (cap.pokemon || 'unown').toLowerCase().trim();
            const capDate = new Date(cap.date);

            if (!firstCaptureDates[species]) {
                firstCaptureDates[species] = capDate;
            } else {
                if (capDate < firstCaptureDates[species]) {
                    firstCaptureDates[species] = capDate;
                }
            }
        });

        dataLoaded = true;
        updateMonthUI();

    } catch (error) {
        console.error("Error cargando:", error);
        const normalGrid = document.getElementById('trackerGrid');
        if (normalGrid) normalGrid.innerHTML = '<p>Error cargando datos.</p>';
    }
}

function renderMonth(selectedMonth) {
    const normalGrid = document.getElementById('trackerGrid');
    const rareGrid = document.getElementById('rareGrid');
    const rareZone = document.getElementById('rareZone');
    const normalTitle = document.getElementById('normalTitle');
    const statsContainer = document.getElementById('statsContainer');
    const totalCount = document.getElementById('totalCount');
    const leaderboardDiv = document.getElementById('leaderboard');
    const adminBtn = document.getElementById('adminSaveBtn');

    if (!normalGrid) return; // Solo pintamos si estamos en la vista Tracker

    const filtered = displayedCaptures.filter(c => c.date && c.date.startsWith(selectedMonth));
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (totalCount) totalCount.innerText = filtered.length;
    if (statsContainer) statsContainer.style.display = 'flex';

    if (normalGrid) normalGrid.innerHTML = '';
    if (rareGrid) rareGrid.innerHTML = '';
    if (leaderboardDiv) leaderboardDiv.innerHTML = '';

    if (filtered.length === 0) {
        if (rareZone) rareZone.style.display = 'none';
        if (normalTitle) normalTitle.style.display = 'none';

        if (normalGrid) {
            normalGrid.innerHTML = '';
            const emptyDiv = document.createElement('div');
            emptyDiv.style.cssText = 'grid-column: 1/-1; text-align: center; padding: 60px; opacity: 0.6; color: #ccc;';
            const emptyImg = document.createElement('img');
            emptyImg.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/201-question.png';
            emptyImg.style.cssText = 'width:100px; margin-bottom: 20px;';
            emptyImg.alt = 'Sin datos';
            const emptyP = document.createElement('p');
            emptyP.style.fontSize = '1.2rem';
            emptyP.textContent = 'Ningún shiny registrado en este mes... ';
            emptyDiv.appendChild(emptyImg);
            emptyDiv.appendChild(emptyP);
            normalGrid.appendChild(emptyDiv);
        }
        return;
    }

    if (leaderboardDiv) {
        // RUTAS ABSOLUTAS (Astro public folder)
        const MEDAL_IMAGES = [
            "/icons/primer-puesto.png",
            "/icons/segundo-puesto.png",
            "/icons/tercer-puesto.png"
        ];

        const counts = {};
        filtered.forEach(cap => {
            const trainer = cap.trainer || "Anónimo";
            counts[trainer] = (counts[trainer] || 0) + 1;
        });

        const sortedRanking = Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 3);

        const fragment = document.createDocumentFragment();

        sortedRanking.forEach((item, index) => {
            let rankClass = '';
            let medalIndex = -1;

            if (index === 0) { rankClass = 'rank-1'; medalIndex = 0; }
            else if (index === 1) { rankClass = 'rank-2'; medalIndex = 1; }
            else if (index === 2) { rankClass = 'rank-3'; medalIndex = 2; }

            const rankDiv = document.createElement('div');
            rankDiv.className = `leaderboard-item ${rankClass}`;

            const leftDiv = document.createElement('div');
            leftDiv.style.cssText = 'display: flex; align-items: center; gap: 10px;';

            if (medalIndex >= 0) {
                const medalImg = document.createElement('img');
                medalImg.src = MEDAL_IMAGES[medalIndex];
                medalImg.className = 'custom-medal';
                medalImg.alt = `${index + 1}º`;
                leftDiv.appendChild(medalImg);
            }

            const nameSpan = document.createElement('span');
            nameSpan.style.fontWeight = 'bold';
            nameSpan.textContent = item.name;
            leftDiv.appendChild(nameSpan);

            const countSpan = document.createElement('span');
            countSpan.className = 'rank-count';
            countSpan.textContent = item.count;

            rankDiv.appendChild(leftDiv);
            rankDiv.appendChild(countSpan);
            fragment.appendChild(rankDiv);
        });
        leaderboardDiv.appendChild(fragment);
    }

    let hasRares = false;

    filtered.forEach(capture => {
        const isRare = capture.rarity === 'rare';
        if (isRare) hasRares = true;

        const card = createCard(capture);

        if (isRare) {
            card.classList.add('is-rare');
            card.style.border = "2px solid #ffd700";
        } else {
            card.style.border = "1px solid #333";
        }

        if (isAdmin) {
            card.title = "ADMIN: Clic Izd = Rareza | Clic Der = Shinydex Nuevo";
            card.style.cursor = "pointer";
            card.onclick = () => {
                capture.rarity = (capture.rarity === 'rare') ? null : 'rare';
                if (adminBtn) {
                    adminBtn.innerText = "💾 HAY CAMBIOS SIN GUARDAR";
                    adminBtn.style.background = "#ff9800";
                }
                renderMonth(selectedMonth);
            };
            card.oncontextmenu = (e) => {
                e.preventDefault();
                capture.newShinydex = (capture.newShinydex) ? null : true;
                if (adminBtn) {
                    adminBtn.innerText = "💾 HAY CAMBIOS SIN GUARDAR";
                    adminBtn.style.background = "#ff9800";
                }
                renderMonth(selectedMonth);
            };
        }

        if (isRare) {
            if (rareGrid) rareGrid.appendChild(card);
        } else {
            if (normalGrid) normalGrid.appendChild(card);
        }
    });

    if (hasRares || isAdmin) {
        if (rareZone) rareZone.style.display = 'block';
        if (normalTitle) normalTitle.style.display = 'block';
    } else {
        if (rareZone) rareZone.style.display = 'none';
        if (normalTitle) normalTitle.style.display = 'none';
    }
}

function createCard(capture) {
    const card = document.createElement('div');
    card.className = 'tracker-poke-card';

    const pokeName = (capture.pokemon || 'unown').toLowerCase();
    const spriteUrl = `https://play.pokemonshowdown.com/sprites/gen5ani-shiny/${pokeName}.gif`;

    // RUTAS ABSOLUTAS (Astro public folder)
    const SPECIAL_ICONS = {
        'secret': '/icons/secretshiny.png',
        'alpha': '/icons/alfa.png',
        'fossil': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/helix-fossil.png',
        'safari': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/safari-ball.png',
        'egg': '/icons/eggshiny.png'
    };

    // Iconos especiales (DOM seguro)
    if (capture.icono && SPECIAL_ICONS[capture.icono]) {
        const iconImg = document.createElement('img');
        iconImg.src = SPECIAL_ICONS[capture.icono];
        iconImg.className = 'tracker-special-icon';
        iconImg.alt = escapeHTML(capture.icono);
        iconImg.title = `Shiny Especial: ${escapeHTML(capture.icono)}`;
        card.appendChild(iconImg);
    }

    const species = (capture.pokemon || 'unown').toLowerCase().trim();
    const isAutoNew = firstCaptureDates &&
        firstCaptureDates[species] &&
        capture.date &&
        (new Date(capture.date).getTime() === firstCaptureDates[species].getTime());

    if (capture.newShinydex === true || (isAutoNew && capture.newShinydex !== false)) {
        const newImg = document.createElement('img');
        newImg.src = '/icons/new.png';
        newImg.className = 'new-shinydex-icon';
        newImg.alt = 'Nuevo Shinydex';
        newImg.title = '¡Nuevo en la Shinydex!';
        card.appendChild(newImg);
    }

    if (capture.safari === 'flee') {
        const deadImg = document.createElement('img');
        deadImg.src = '/icons/dead.png';
        deadImg.className = 'tracker-special-icon';
        deadImg.alt = 'Flee';
        deadImg.title = '¡Huyó en el Safari!';
        card.appendChild(deadImg);
    }

    // Sprite principal
    const spriteImg = document.createElement('img');
    spriteImg.src = spriteUrl;
    spriteImg.alt = pokeName;
    spriteImg.className = 'tracker-poke-sprite';
    if (capture.safari === 'flee') {
        spriteImg.style.filter = 'grayscale(100%)';
        spriteImg.style.opacity = '0.7';
    }
    spriteImg.onerror = () => { spriteImg.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png'; };
    card.appendChild(spriteImg);

    // Nombre del Pokémon
    const nameH3 = document.createElement('h3');
    nameH3.style.cssText = 'text-transform: capitalize; margin: 0; color: white; font-size: 1.2rem;';
    nameH3.textContent = pokeName;
    card.appendChild(nameH3);

    // Nombre del entrenador (textContent = seguro contra XSS)
    const trainerDiv = document.createElement('div');
    trainerDiv.className = 'tracker-trainer-text';
    trainerDiv.textContent = capture.trainer;
    card.appendChild(trainerDiv);

    // Fecha
    let fechaBonita = '??/??';
    if (capture.date && capture.date.includes('-')) {
        const parts = capture.date.split('-');
        fechaBonita = `${parts[2]}/${parts[1]}`;
    }
    const dateDiv = document.createElement('div');
    dateDiv.className = 'tracker-date-badge';
    dateDiv.textContent = `📅 ${fechaBonita}`;
    card.appendChild(dateDiv);

    return card;
}