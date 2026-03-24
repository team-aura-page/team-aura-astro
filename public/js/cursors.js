const TOTAL_CURSORS = 701;

function getCurrentCursorNumber() {
    let n = sessionStorage.getItem('nextPokemonCursor');
    if (!n) {
        n = Math.floor(Math.random() * TOTAL_CURSORS) + 1;
        sessionStorage.setItem('nextPokemonCursor', n);
    }
    return n;
}

function applyCursor(root, cursorNumber) {
    const cursorPath = `/cursor/${cursorNumber}.png`;
    root.style.setProperty('--cursor-random', `url('${cursorPath}')`);
}

function prepareNextCursor() {
    const next = Math.floor(Math.random() * TOTAL_CURSORS) + 1;
    sessionStorage.setItem('nextPokemonCursor', next);
    const img = new Image();
    img.src = `/cursor/${next}.png`;
}

function isCursorEnabled() {
    const pref = localStorage.getItem('pokemonCursorEnabled');
    return pref === null ? true : pref === 'true';
}
if (isCursorEnabled()) {
    applyCursor(document.documentElement, getCurrentCursorNumber());
}

document.addEventListener('astro:before-swap', (e) => {
    if (isCursorEnabled()) {
        const cursorNumber = getCurrentCursorNumber();
        applyCursor(e.newDocument.documentElement, cursorNumber);
        e.newDocument.body.classList.remove('system-mode');
    } else {
        e.newDocument.documentElement.style.removeProperty('--cursor-random');
        e.newDocument.body.classList.add('system-mode');
    }
});

document.addEventListener("astro:page-load", () => {
    const secretTrigger = document.getElementById('secret-trigger');

    if (isCursorEnabled()) {
        applyCursor(document.documentElement, getCurrentCursorNumber());
        document.body.classList.remove('system-mode');
        prepareNextCursor();
    } else {
        document.documentElement.style.removeProperty('--cursor-random');
        document.body.classList.add('system-mode');
    }

    if (secretTrigger) {
        secretTrigger.style.cursor = "help";

        secretTrigger.addEventListener('click', () => {
            const nowEnabled = !isCursorEnabled();
            localStorage.setItem('pokemonCursorEnabled', nowEnabled);

            if (nowEnabled) {
                const n = Math.floor(Math.random() * TOTAL_CURSORS) + 1;
                sessionStorage.setItem('nextPokemonCursor', n);
                applyCursor(document.documentElement, n);
                document.body.classList.remove('system-mode');
                prepareNextCursor();
            } else {
                document.documentElement.style.removeProperty('--cursor-random');
                document.body.classList.add('system-mode');
            }
        });
    }
});