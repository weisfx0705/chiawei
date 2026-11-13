(() => {
  const cards = [...document.querySelectorAll('.step-panel')];
  const buttons = [...document.querySelectorAll('[data-step]')];
  const previous = document.getElementById('previous');
  const next = document.getElementById('next');
  const count = document.getElementById('step-count');
  let active = 0;
  function showStep(index, moveFocus = false) {
    active = Math.max(0, Math.min(cards.length - 1, index));
    cards.forEach((card, i) => { card.hidden = i !== active; });
    buttons.forEach((button, i) => {
      if (i === active) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    previous.disabled = active === 0;
    next.disabled = active === cards.length - 1;
    count.textContent = `步驟 ${active + 1} / ${cards.length} · ${cards[active].querySelector('h3').textContent}`;
    if (moveFocus) {
      const heading = cards[active].querySelector('h3');
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      cards[active].scrollIntoView({ block: 'start', behavior: 'auto' });
    }
  }
  document.getElementById('step-nav').hidden = false;
  document.getElementById('step-controls').hidden = false;
  buttons.forEach(button => button.addEventListener('click', () => showStep(Number(button.dataset.step))));
  previous.addEventListener('click', () => showStep(active - 1, true));
  next.addEventListener('click', () => showStep(active + 1, true));
  function openLinkedStep() {
    const match = location.hash.match(/^#step-([1-8])$/);
    if (match) showStep(Number(match[1]) - 1);
    return Boolean(match);
  }
  if (!openLinkedStep()) showStep(0);
  window.addEventListener('hashchange', openLinkedStep);
  document.querySelectorAll('[data-video]').forEach(button => {
    button.addEventListener('click', () => {
      const frame = document.createElement('iframe');
      const url = new URL(`https://www.youtube-nocookie.com/embed/${button.dataset.video}`);
      url.searchParams.set('autoplay', '1');
      url.searchParams.set('rel', '0');
      if (button.dataset.start) url.searchParams.set('start', button.dataset.start);
      frame.src = url.href;
      frame.title = button.dataset.title;
      frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      frame.allowFullscreen = true;
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      button.closest('.video-frame').replaceChildren(frame);
      frame.focus();
    });
  });
})();
