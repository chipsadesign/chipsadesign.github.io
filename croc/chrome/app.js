/**
 * Chrome only (performance-wise)
 */
const textElement = document.querySelector('.js-text-block');
const maskedElement = document.querySelector('.masked');
const lightElement = document.querySelector('.lightsource');

function setCursorPosition(x) {
    textElement.style.setProperty('--x', x);
}

function onMousemove(event) {
    setCursorPosition(event.clientX);
}

maskedElement.style.setProperty('--window-width', window.innerWidth);
document.addEventListener('mousemove', onMousemove);
