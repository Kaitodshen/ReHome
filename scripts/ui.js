import { elements } from "./dom.js";

let toastTimer;

export function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  elements.toast.classList.add("is-visible");

  toastTimer = setTimeout(() => {
    elements.toast.classList.remove("is-visible");
    elements.toast.hidden = true;
  }, 2600);
}

export function setupScrollAnimations() {
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.15
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('section, article, .glass-panel').forEach((el, index) => {
    // Add fade-up class automatically to key sections
    if (!el.classList.contains('no-fade')) {
      el.classList.add('fade-up');
      el.style.transitionDelay = `${(index % 3) * 0.1}s`; // staggered effect
      observer.observe(el);
    }
  });
}
