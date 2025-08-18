// Utility for handling canvas-confetti imports
let confetti: any = null;

export const initConfetti = async () => {
  if (confetti) return confetti;

  try {
    // Try static import first
    const confettiModule = await import('canvas-confetti');
    confetti = confettiModule.default || confettiModule;
    
    if (typeof confetti === 'function') {
      console.log('Confetti loaded successfully');
      return confetti;
    }
  } catch (error) {
    console.warn('Failed to load confetti:', error);
  }

  return null;
};

export const triggerConfetti = async (options: any = {}) => {
  const confettiFn = await initConfetti();
  if (confettiFn) {
    try {
      confettiFn({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        ...options
      });
    } catch (error) {
      console.warn('Failed to trigger confetti:', error);
    }
  }
};

export const getConfetti = () => confetti;
