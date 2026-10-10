for (const guide of document.querySelectorAll('.walkthrough')) {
  const phone = matchMedia('(max-width:600px)');
  const updateImages = () => {
    for (const link of guide.querySelectorAll('.guide-full-image')) {
      link.href = phone.matches ? link.dataset.mobile : link.dataset.desktop;
    }
  };
  updateImages();
  phone.addEventListener('change', updateImages);
}
