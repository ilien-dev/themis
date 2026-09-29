const form = document.getElementById('booking');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  fetch('/api/bookings', { method: 'POST', body: JSON.stringify(data) });
});
