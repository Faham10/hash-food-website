let audioContext;

function getAudioContext() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) return null;
  if (!audioContext || audioContext.state === 'closed') audioContext = new AudioContextConstructor();
  return audioContext;
}

export function enableOrderNotificationSound() {
  let active = true;
  const unlock = () => {
    let context;
    try {
      context = getAudioContext();
      if (!context) return;
    } catch (error) {
      console.warn('Could not initialize order notification sound.', error);
      return;
    }
    const resume = context.state === 'suspended' ? context.resume() : Promise.resolve();
    resume.then(() => {
      if (active && context.state === 'running') {
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      }
    }).catch((error) => {
      console.warn('Could not enable order notification sound.', error);
    });
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  return () => {
    active = false;
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
}

export function playOrderNotificationSound() {
  if (!audioContext || audioContext.state !== 'running') return false;
  try {
    const start = audioContext.currentTime;
    [
      { frequency: 880, offset: 0, duration: 0.18 },
      { frequency: 1174.66, offset: 0.13, duration: 0.25 },
    ].forEach(({ frequency, offset, duration }) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const noteStart = start + offset;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, noteStart);
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.045, noteStart + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteStart + duration + 0.02);
    });
    return true;
  } catch (error) {
    console.warn('Could not play order notification sound.', error);
    return false;
  }
}
