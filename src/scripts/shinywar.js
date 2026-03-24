import { db, ref, onValue } from "../lib/firebase.js";
import { escapeHTML } from "../lib/utils.js";
const warsRef = ref(db, 'wars');

// Caché global para transiciones instantáneas
let globalUsers = [];
let globalWars = {};
let isEscListenerAdded = false;

// 3. Conexión en tiempo real con Firebase
const usersRef = ref(db, 'users');
onValue(usersRef, (snap) => {
    const val = snap.val();
    globalUsers = val ? (Array.isArray(val) ? val : Object.values(val)) : [];
    // Si estamos viendo la ShinyWar, renderizamos
    if (document.getElementById('col-team-a') && globalWars.activeWarId) {
        initWar(globalUsers, globalWars);
    }
});

onValue(warsRef, (snap) => {
    const val = snap.val();
    globalWars = val || {};
    // Si estamos viendo la ShinyWar, renderizamos
    if (document.getElementById('col-team-a') && globalUsers.length > 0) {
        initWar(globalUsers, globalWars);
    }
});

// 4. EVENTO ASTRO: Se ejecuta al entrar en la página
document.addEventListener('astro:page-load', () => {
    // Si no estamos en la ShinyWar, abortamos
    const colA = document.getElementById('col-team-a');
    if (!colA) return;

    // Renderizar datos en caché instantáneamente
    if (globalUsers.length > 0 && Object.keys(globalWars).length > 0) {
        initWar(globalUsers, globalWars);
    }

    // Configurar Modal
    const closeModalBtn = document.getElementById('close-war-modal');
    const modalOverlay = document.getElementById('war-modal');

    if (closeModalBtn) closeModalBtn.onclick = closeModal;
    if (modalOverlay) {
        modalOverlay.onclick = (e) => {
            if (e.target.id === 'war-modal') closeModal();
        };
    }

    if (!isEscListenerAdded) {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });
        isEscListenerAdded = true;
    }
});

// --- LÓGICA PRINCIPAL ---

function initWar(mainData, warsData) {
    let warsList = [];
    if (warsData.wars && Array.isArray(warsData.wars)) {
        warsList = warsData.wars;
    } else if (warsData.wars) {
        warsList = Object.values(warsData.wars);
    }

    const activeWar = warsList.find(w => w.id === warsData.activeWarId);

    if (!activeWar) {
        console.warn("No hay guerra activa configurada en la base de datos.");
        return;
    }

    const containerA = document.getElementById('col-team-a');
    const containerB = document.getElementById('col-team-b');

    if (containerA) containerA.innerHTML = '';
    if (containerB) containerB.innerHTML = '';

    const processTeam = (teamList, teamLetter) => {
        let teamTotalScore = 0;

        const roster = teamList.map(memberEntry => {
            let trainerName = '';

            if (typeof memberEntry === 'object' && memberEntry !== null) {
                trainerName = memberEntry.nombre || 'Desconocido';
            } else {
                trainerName = String(memberEntry);
            }
            const profile = mainData.find(p =>
                p && p.nombre && p.nombre.toLowerCase() === trainerName.toLowerCase()
            );

            // RUTA ABSOLUTA ASTRO
            let avatar = '/icons/unown.png';
            if (profile) {
                // Función para arreglar rutas relativas guardadas en Firebase si las hubiera
                avatar = profile.avatar.startsWith('http') ? profile.avatar : profile.avatar.replace(/^(\.\.\/|\.\/)/, '/');
            } else {
                const guests = activeWar.guests || {};
                const guestKey = Object.keys(guests).find(k => k.toLowerCase() === trainerName.toLowerCase());

                if (guestKey) {
                    avatar = guests[guestKey];
                }
            }

            let allCaptures = [];
            if (activeWar.captures) {
                allCaptures = Array.isArray(activeWar.captures)
                    ? activeWar.captures
                    : Object.values(activeWar.captures);
            }

            const validCaptures = allCaptures.filter(c => {
                if (!c.trainer || !c.team) return false;
                const isTrainer = c.trainer.toLowerCase() === trainerName.toLowerCase();
                const isTeam = c.team === teamLetter;
                const isValidDate = c.date >= activeWar.startDate && c.date <= activeWar.endDate;
                return isTrainer && isTeam && isValidDate;
            });

            const score = validCaptures.reduce((total, capture) => {
                return total + (capture.points || 0);
            }, 0);

            teamTotalScore += score;

            return {
                nombre: trainerName,
                avatar,
                score,
                captures: validCaptures,
                team: teamLetter
            };
        });

        roster.sort((a, b) => b.score - a.score);

        roster.forEach(player => {
            const card = document.createElement('div');
            card.className = 'war-card';
            card.onclick = () => openModal(player);

            const avatarImg = document.createElement('img');
            avatarImg.src = player.avatar;
            avatarImg.className = 'war-avatar';
            avatarImg.alt = escapeHTML(player.nombre);
            avatarImg.onerror = () => { avatarImg.src = '/icons/unown.png'; };

            const infoDiv = document.createElement('div');
            infoDiv.className = 'war-info';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'war-name';
            nameSpan.textContent = player.nombre;

            const countSpan = document.createElement('span');
            countSpan.className = 'war-count';
            countSpan.textContent = 'Puntos: ';
            const strongScore = document.createElement('strong');
            strongScore.textContent = player.score;
            countSpan.appendChild(strongScore);

            infoDiv.appendChild(nameSpan);
            infoDiv.appendChild(countSpan);
            card.appendChild(avatarImg);
            card.appendChild(infoDiv);

            if (teamLetter === 'A' && containerA) containerA.appendChild(card);
            else if (teamLetter === 'B' && containerB) containerB.appendChild(card);
        });

        return teamTotalScore;
    };

    const scoreA = processTeam(activeWar.teams.A || [], 'A');
    const scoreB = processTeam(activeWar.teams.B || [], 'B');

    const scoreElA = document.getElementById('score-team-a');
    const scoreElB = document.getElementById('score-team-b');

    if (scoreElA) animateNumber(scoreElA, scoreA);
    if (scoreElB) animateNumber(scoreElB, scoreB);

    updateWarBar(scoreA, scoreB);
}

function updateWarBar(scoreA, scoreB) {
    const bar = document.getElementById('war-bar');
    if (!bar) return;

    const total = scoreA + scoreB;
    if (total === 0) {
        bar.style.width = '50%';
        return;
    }
    const percentA = (scoreA / total) * 100;
    bar.style.width = `${percentA}%`;
}

function animateNumber(element, finalValue) {
    const currentVal = parseInt(element.innerText) || 0;
    if (currentVal === finalValue) return;

    let startValue = currentVal;
    const duration = 1500;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);

        const current = Math.floor(startValue + (finalValue - startValue) * ease);
        element.innerText = current;

        if (progress < 1) requestAnimationFrame(update);
        else element.innerText = finalValue;
    }
    requestAnimationFrame(update);
}

function openModal(player) {
    const modal = document.getElementById('war-modal');
    if (!modal) return;

    const listContainer = document.getElementById('modal-list');
    const modalName = document.getElementById('modal-name');
    modalName.innerText = player.nombre;

    const modalAvatar = document.getElementById('modal-avatar');
    // RUTA ABSOLUTA ASTRO
    modalAvatar.src = player.avatar || '/icons/unown.png';
    modalAvatar.onerror = function () { this.src = '/icons/unown.png'; };

    const teamColor = player.team === 'A' ? '#2ed573' : '#ce5cff';
    modalName.style.color = teamColor;

    listContainer.innerHTML = '';

    if (!player.captures || player.captures.length === 0) {
        const emptyP = document.createElement('p');
        emptyP.style.cssText = 'text-align:center; color:#666; padding: 20px;';
        emptyP.textContent = 'Sin capturas registradas.';
        listContainer.appendChild(emptyP);
    } else {
        const sortedCaptures = [...player.captures].reverse();

        sortedCaptures.forEach(cap => {
            const row = document.createElement('div');
            row.className = 'capture-row';
            row.style.borderLeftColor = teamColor;

            const pokeName = cap.pokemon || 'unknown';
            const pokeIcon = `https://play.pokemonshowdown.com/sprites/gen5ani-shiny/${pokeName.toLowerCase()}.gif`;

            const iconImg = document.createElement('img');
            iconImg.src = pokeIcon;
            iconImg.className = 'cap-icon';
            iconImg.alt = escapeHTML(pokeName);
            iconImg.onerror = () => { iconImg.src = '/icons/unown.png'; };

            let details = `${cap.method || 'Single'} | ${cap.date}`;
            if (cap.bonuses) {
                if (cap.bonuses.secret) details += ' | ✨ Secret';
                if (cap.bonuses.newDex) details += ' | 🆕 New';
                if (cap.bonuses.dateBonus) details += ' | 📅 Bonus Día';
            }

            const infoDiv = document.createElement('div');
            infoDiv.className = 'cap-info';
            const pokeSpan = document.createElement('span');
            pokeSpan.className = 'cap-poke';
            pokeSpan.textContent = pokeName;
            const methodSpan = document.createElement('span');
            methodSpan.className = 'cap-method';
            methodSpan.textContent = details;
            infoDiv.appendChild(pokeSpan);
            infoDiv.appendChild(methodSpan);

            const pointsDiv = document.createElement('div');
            pointsDiv.className = 'cap-points';
            pointsDiv.style.color = teamColor;
            pointsDiv.style.background = 'rgba(255,255,255,0.05)';
            pointsDiv.textContent = `+${cap.points}`;

            row.appendChild(iconImg);
            row.appendChild(infoDiv);
            row.appendChild(pointsDiv);
            listContainer.appendChild(row);
        });
    }

    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('active'), 10);
}

function closeModal() {
    const modal = document.getElementById('war-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
}