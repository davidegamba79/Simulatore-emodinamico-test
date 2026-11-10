/* Legacy UI compatibility: preserve waveform ordering and capnography selector.
   This module intentionally runs once, after the monitor markup is available. */
(() => {
  const monitor = document.querySelector('.monitor');
  if (monitor) {
    const hemodynamics = monitor.querySelector('.card.hemo-wrap');
    for (const key of ['ecg', 'pleth', 'capno', 'art']) {
      const waveform = monitor.querySelector('.wave[data-key="' + key + '"]');
      if (waveform && hemodynamics) {
        monitor.insertBefore(waveform, hemodynamics);
      }
    }

    const plethLabel = monitor.querySelector('.wave[data-key="pleth"] .wlabel');
    if (plethLabel) plethLabel.textContent = 'SpO₂ — pleth';
  }

  const capnography = [...document.querySelectorAll('section.card')]
    .find(section => section.querySelector('h2')?.textContent.trim() === 'Capnografia');

  if (capnography && !document.getElementById('capnoPattern')) {
    const label = document.createElement('label');
    label.style.marginTop = '8px';
    label.textContent = 'Morfologia';

    const selector = document.createElement('select');
    selector.id = 'capnoPattern';
    for (const name of [
      'Normale',
      'Broncospasmo / shark-fin',
      'Rebreathing',
      'Oscillazioni cardiogene',
      'Disconnessione / apnea'
    ]) {
      const option = document.createElement('option');
      option.textContent = name;
      selector.appendChild(option);
    }

    label.appendChild(selector);
    capnography.appendChild(label);
  }
})();
