document.addEventListener("DOMContentLoaded", () => {
    // Only apply to pages that are not shinywar
    if (document.body.classList.contains('page-shinywar')) {
        return;
    }

    const starsContainer = document.createElement('div');
    starsContainer.id = 'stars-container';
    document.body.prepend(starsContainer);

    const numStars = 150; // Adjust for more or less stars

    for (let i = 0; i < numStars; i++) {
        const star = document.createElement('div');
        
        // Randomize size
        const sizeClass = Math.random() < 0.5 ? 'small' : (Math.random() < 0.8 ? 'medium' : 'large');
        star.classList.add('star', sizeClass);
        
        // Randomize position
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 100}%`;
        
        // Randomize animation duration and delay
        const duration = Math.random() * 3 + 2; // 2s to 5s
        const delay = Math.random() * 5; // 0s to 5s
        
        star.style.animationDuration = `${duration}s`;
        star.style.animationDelay = `${delay}s`;
        
        starsContainer.appendChild(star);
    }
});
