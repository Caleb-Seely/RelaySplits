/**
 * Collection of celebratory messages for race completion and achievements
 */

export const celebrationMessages = [
  // Classic hype
  '🎉 Celebration time!',
  '🎊 We did it!',
  '🏆 Amazing job team!',
  '🌟 Fantastic finish!',
  '🎯 Mission accomplished!',
  '💪 Incredible effort!',
  '🚀 Outstanding performance!',
  '⭐ Crushed it!',

  // Playful + fun
  '🍾 Pop the bubbly!',
  '🔥 That was fire!',
  '🙌 Big high fives all around!',
  '🎢 What a run!',
  '🥳 Party mode: ON!',
  '🎈 Balloons everywhere!',
  '💥 Boom!',
  '😂 Victory dance time!',

  // Epic / grand
  '🌌 Legendary effort!',
  '⚡ Unstoppable energy!',
  '🦾 Strength of champions!',
  '🔥  One for the history books!',
  '🌊 A tidal wave of victory!',
  '🎇 Fire performance!',

  // Heartfelt / genuine
  '🙏 Cheers to the team!',
  '💎 A gem of a performance!',
  '🤝 Teamwork made the dream work!',

  // Backhanded / cheeky (general)
  '🤔 Wow… that actually worked?',
  '🙃 Didn’t think we’d make it, but here we are.',
  '😅 More chaos than strategy, but it counts!',
  '🥴 Ugly win, still a win.',
  '🤷 Somehow… that’s a success.',
  '🍀 Pure luck, but we’ll take the credit.',
  '👀 Honestly shocked we pulled that off.',
  '🐢 Took forever, but hey, finished is finished.',
  'No style points, just results.',
  '😎 Even we didn’t believe in us.',
  '🚧 That was way messier than it should’ve been.',
  '🎲 Rolled the dice and got lucky!',
  '🙄 Well, the bar was low anyway.',
  '💤 Slow, painful, but successful.',
  '🙈 Don’t ask how, just clap.',
  '🥂 Here’s to lowering expectations!',
  '😂 A win’s a win, no matter how sloppy.',
  'Definitely not textbook, but we’ll claim it.',
  'Chaos is our strategy — and it worked!',

  // Hood to Coast specific (sarcastic + gritty)
  ' 200 miles later and we’re… still standing?',
  '🙃 Honestly shocked the van even made it.',
  '🤷 Zero sleep, questionable snacks, still champions.',
  '🍀 Survived on luck, caffeine, and vegan beef jerky.',
  '👀 Didn’t think we’d all still be friends… but here we are.',
  '🐢 Slow, steady, and somehow done.',
  'Smelled like a locker room, ran like legends.',
  'Navigation: questionable. Determination: undeniable.',
  '🎲 Rolled the dice on sleep… lost, but finished anyway.',
  '🙄 Not our smoothest relay, but still counts.',
  'Ran on fumes — literal and figurative.',
  ' Here’s to sore legs and bad coffee!',
  '😂 A win’s a win — even with double digit blisters.',
  'The real miracle: nobody quit mid-Leg 33.',
  '🌲 From Timberline to Seaside…  still alive!',
  'Limping but alive!',
  '🏖️ Sunburn, sweat, and sand — victory achieved.',
  '🥵 Hill repeats at 3AM? Who thought that was a good idea?',

  // Running + drinking crossover
  '🍺 Miles earned, beers deserved.',
  '🍻 Hydration strategy: beer.',
  '🏃‍♂️ Run fast, drink faster.',
  '🍹 Recovery plan? Margaritas.',
  '🍺 Powered by GU gels, finished with brew bells.',
  '🥂 Cheers to sore quads and cold pours!',
  '🍷 A vintage race deserves a vintage wine.',
  '🍺 Beer mile training finally paid off!',
  '🍸 Shaken, stirred, and severely dehydrated.',
  '🍾 Every step closer to popping bottles.',
  '🥃 Legs are toast, whiskey’s next.',
  '🍻 From relay legs to lager kegs.',
  'Blisters fade, pints are forever.',
  'The only split we’re tracking now is red vs white.',
  'Pacing ourselves… straight to happy hour.',
  '🥂 A toast to 200 miles of suffering.'
];


/**
 * Get a random celebration message
 * @returns A random celebration message from the collection
 */
export const getRandomCelebrationMessage = (): string => {
  return celebrationMessages[Math.floor(Math.random() * celebrationMessages.length)];
};

/**
 * Get a specific celebration message by index
 * @param index - The index of the message to retrieve
 * @returns The celebration message at the specified index, or a default message if index is out of bounds
 */
export const getCelebrationMessage = (index: number): string => {
  if (index >= 0 && index < celebrationMessages.length) {
    return celebrationMessages[index];
  }
  return celebrationMessages[0]; // Default fallback
};
