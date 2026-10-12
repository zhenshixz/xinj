(() => {
    const nav = document.querySelector('.xinj-tool-nav');
    if (!nav) return;
    const measure = () => document.documentElement.style.setProperty('--tool-nav-height', nav.offsetHeight + 'px');
    measure();
    new ResizeObserver(measure).observe(nav);
})();
