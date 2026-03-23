document.addEventListener("astro:page-load", () => {
    const secretTrigger = document.getElementById('secret-trigger');
    const TOTAL_CURSORS = 701; 
    
    function activatePokemonCursor() {
        const randomNumber = Math.floor(Math.random() * TOTAL_CURSORS) + 1;
        const cursorPath = `/cursor/${randomNumber}.png`; 
        
        document.documentElement.style.setProperty('--cursor-random', `url('${cursorPath}')`);
        document.body.classList.remove('system-mode');
    }

    function disablePokemonCursor() {
        document.body.classList.add('system-mode');
    }
    
    const storedPreference = localStorage.getItem('pokemonCursorEnabled');
    
    let isEnabled = storedPreference === null ? true : (storedPreference === 'true');

    if (isEnabled) {
        activatePokemonCursor();
    } else {
        disablePokemonCursor();
    }

    if (secretTrigger) {
        secretTrigger.style.cursor = "help";

        secretTrigger.addEventListener('click', () => {
            isEnabled = !isEnabled;

            if (isEnabled) {
                activatePokemonCursor();
            } else {
                disablePokemonCursor();
            }

            localStorage.setItem('pokemonCursorEnabled', isEnabled);
        });
    }
});