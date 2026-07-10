// coming-soon.js

document.addEventListener('DOMContentLoaded', () => {
  // Archive Dropdown Functionality
  const dropdown = document.querySelector('.cs-dropdown');
  const trigger = document.querySelector('.cs-dropdown-trigger');
  
  if (trigger && dropdown) {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('active');
      const expanded = dropdown.classList.contains('active');
      trigger.setAttribute('aria-expanded', expanded);
    });

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('active');
        trigger.setAttribute('aria-expanded', 'false');
      }
    });

    // Close dropdown on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dropdown.classList.contains('active')) {
        dropdown.classList.remove('active');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.focus();
      }
    });
  }
});
