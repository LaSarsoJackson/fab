for (const guide of document.querySelectorAll('.walkthrough')) {
  const controls = guide.querySelector('.guide-controls');
  const slides = [...guide.querySelectorAll('.guide-slide')];
  const previous = controls.querySelector('[data-guide="previous"]');
  const next = controls.querySelector('[data-guide="next"]');
  const complete = guide.querySelector('.guide-complete');
  let index = 0;
  const render = () => {
    slides.forEach((slide, i) => { slide.hidden = i !== index; });
    controls.querySelector('[role="status"]').textContent = `Step ${index + 1} of ${slides.length}`;
    previous.disabled = index === 0;
    next.disabled = index === slides.length - 1;
    complete.hidden = index !== slides.length - 1;
  };
  const show = value => {
    index = value;
    render();
    controls.scrollIntoView({ block: 'start' });
  };
  const advance = () => show(Math.min(slides.length - 1, index + 1));
  previous.addEventListener('click', () => show(Math.max(0, index - 1)));
  next.addEventListener('click', advance);
  controls.querySelector('[data-guide="reset"]').addEventListener('click', () => show(0));
  const phone = matchMedia('(max-width:600px)');
  const updateImages = () => {
    for (const link of guide.querySelectorAll('.guide-full-image')) {
      link.href = phone.matches ? link.dataset.mobile : link.dataset.desktop;
    }
  };
  updateImages();
  phone.addEventListener('change', updateImages);
  guide.querySelector('.guide-intro').textContent = 'Use Back and Next to move through the steps. The outline shows the control to use.';
  controls.hidden = false;
  render();
}
