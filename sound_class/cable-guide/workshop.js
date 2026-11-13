(() => {
  const frames = [...document.querySelectorAll('.video-frame')];
  const posters = new Map(frames.map(frame => [frame, frame.innerHTML]));
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-video]');
    if (!button) return;
    const target = button.closest('.video-frame');
    // Keep both views visible, with only one soundtrack playing at a time.
    frames.forEach(frame => {
      if (frame !== target && frame.querySelector('iframe')) frame.innerHTML = posters.get(frame);
    });
    const player = document.createElement('iframe');
    const url = new URL(`https://www.youtube-nocookie.com/embed/${button.dataset.video}`);
    url.searchParams.set('autoplay', '1');
    url.searchParams.set('rel', '0');
    if (button.dataset.start) url.searchParams.set('start', button.dataset.start);
    player.src = url.href;
    player.title = button.dataset.title;
    player.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    player.allowFullscreen = true;
    player.referrerPolicy = 'strict-origin-when-cross-origin';
    target.replaceChildren(player);
    player.focus();
  });
  const viewer = document.getElementById('image-viewer');
  const image = document.getElementById('viewer-image');
  const title = document.getElementById('image-viewer-title');
  const original = document.getElementById('viewer-original');
  let trigger = null;
  document.addEventListener('click', event => {
    const link = event.target.closest('a[data-zoom]');
    if (!link || !viewer.showModal || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    trigger = link;
    const description = link.querySelector('img').alt;
    image.src = link.href;
    image.alt = description;
    title.textContent = description;
    original.href = link.href;
    viewer.showModal();
    document.body.classList.add('image-open');
  });
  document.getElementById('close-viewer').addEventListener('click', () => viewer.close());
  viewer.addEventListener('click', event => { if (event.target === viewer) viewer.close(); });
  viewer.addEventListener('close', () => {
    document.body.classList.remove('image-open');
    trigger?.focus({ preventScroll: true });
  });
})();
