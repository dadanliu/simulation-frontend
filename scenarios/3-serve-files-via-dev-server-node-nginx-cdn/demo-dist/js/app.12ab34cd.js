const button = document.getElementById('ping-button');
const status = document.getElementById('status');

if (button && status) {
  button.addEventListener('click', async () => {
    const response = await fetch('/images/logo.77aa33ff.svg');
    const bytes = (await response.text()).length;
    status.textContent = `requested logo.svg bytes: ${bytes}`;
  });
}
