/**
 * AI Commentary Generator Module
 * 
 * Generates intelligent, context-aware cricket commentary for ball events.
 * Uses template-based logic with randomization for natural variation.
 * 
 * Features:
 * - 8-12 alternate commentary sentences per event
 * - Tone control (normal/excited/matchTurning)
 * - Context-aware descriptions (boundaries, wickets, extras)
 * - Future ML-ready placeholder for expansion
 * 
 * @module aiCommentary
 */

export type CommentaryInput = {
  runs: number
  ballType?: 'normal' | 'wide' | 'no-ball' | 'leg-bye' | 'bye'
  wicketType?: 'Bowled' | 'Caught' | 'Caught & Bowled' | 'LBW' | 'Run Out' | 'Stumped' | 'Hit Wicket' | null
  batsman?: string
  bowler?: string
  shotType?: 'drive' | 'cut' | 'pull' | 'sweep' | 'loft' | 'defensive' | 'glance' | null
  isBoundary?: boolean
  isFour?: boolean
  isSix?: boolean
  over?: string
  ball?: number
  style?: 'tv' | 'simple'
  matchContext?: {
    currentScore?: number
    wickets?: number
    requiredRuns?: number
    oversRemaining?: number
    isChase?: boolean;
    isSuperOver?: boolean;
  };
  nonStriker?: string;
}

export type ToneControl = 'normal' | 'excited' | 'matchTurning'

export interface CommentaryResult {
  text: string
  tone: ToneControl
  isHighlight: boolean
  alternatives?: string[]
}

// Template pools for different scenarios
const BOUNDARY_TEMPLATES = {
  four: {
    normal: [
      '{batsman} drives it beautifully through covers for FOUR!',
      'Excellent timing from {batsman}! FOUR runs through the gap!',
      '{batsman} finds the gap between point and cover perfectly. FOUR!',
      'Crisp shot from {batsman} races to the boundary. FOUR!',
      '{batsman} plays a delightful cover drive for FOUR! Pure class!',
      'Well placed by {batsman}! Pulled away into the gap for FOUR!',
      '{batsman} times it sweetly through the off side. FOUR!',
      'Classy flick from {batsman}! FOUR runs added to the tally!',
      'Shot! {batsman} leans into the drive and finds the boundary!',
      'Punched off the back foot, {batsman} beats the dive! FOUR!',
      'In the gap! {batsman} steers it past point for FOUR!',
    ],
    excited: [
      'WHAT A SHOT! {batsman} smashes a glorious cover drive for FOUR!',
      'BRILLIANT! {batsman} dispatches it to the mid-wicket boundary!',
      'MAGNIFICENT! {batsman} with a stunning pull shot for FOUR!',
      'OUTSTANDING! {batsman} finds the fence with absolute authority!',
      'SUPERB TIMING! {batsman} sends it racing past the fielder for FOUR!',
      'EXCELLENT! {batsman} plays a picture-perfect straight drive! FOUR!',
      'SHOT OF THE DAY! {batsman} hammers it through the off-side gap!',
      'GORGEOUS! {batsman} flick it off the pads, no chance for the fine leg!',
    ],
    matchTurning: [
      'CRUCIAL BOUNDARY! {batsman} keeps the scoreboard ticking!',
      'IMPORTANT FOUR! {batsman} maintains the pressure on the bowler!',
      'VITAL RUNS! {batsman} with a much-needed boundary through covers!',
      'KEY MOMENT! {batsman} finds the boundary when his team needs it most!',
      'PRESSURE SHIFT! That boundary from {batsman} changes the vibe!',
    ],
  },
  six: {
    normal: [
      '{batsman} launches it over the long-on boundary for SIX!',
      'HUGE! {batsman} clears the ropes with absolute ease!',
      '{batsman} sends it sailing deep into the stands! SIX!',
      'Maximum! {batsman} with a clean strike over cow-corner!',
      '{batsman} goes big and clears the boundary! Smashed for SIX!',
      'Powerful pull shot from {batsman}! SIX runs!',
      '{batsman} connects beautifully! That\'s a monster SIX!',
      'Clean hit from {batsman}! The ball disappears over the fielder!',
      'In the slot and {batsman} has deposited that for SIX!',
      'A massive heave from {batsman} and it goes all the way!',
    ],
    excited: [
      'MASSIVE! {batsman} SMASHES IT OVER THE LONG-OFF FOR SIX!',
      'INCREDIBLE! {batsman} SENDS IT INTO THE CROWD WITH A PULL!',
      'HUGE HIT! {batsman} CLEARS THE ROPES BY A MILE!',
      'SPECTACULAR! {batsman} WITH A MONSTER SIX OVER MID-WICKET!',
      'OUTRAGEOUS! {batsman} DISPATCHES IT INTO THE SECOND TIER!',
      'PHENOMENAL! {batsman} GOES ALL THE WAY! SIX RUNS!',
      'BLASTED! {batsman} stands and delivers! CRACKING SIX!',
      'THAT IS HUGE! {batsman} has hit that out of the park!',
    ],
    matchTurning: [
      'GAME CHANGER! {batsman} with a crucial SIX in the death overs!',
      'MOMENTUM SHIFTER! {batsman} clears the ropes under pressure!',
      'MASSIVE MOMENT! {batsman} with a huge SIX to shift the balance!',
      'PRESSURE RELIEVER! {batsman} sends it sailing! A vital SIX!',
      'BIG STRIKE! {batsman} is taking charge now! SIX!',
    ],
  },
}

const WICKET_TEMPLATES = {
  Bowled: {
    normal: [
      'Clean bowled! {batsman} is out!',
      'The stumps are shattered! {batsman} is bowled by {bowler}!',
      '{bowler} castles {batsman}! Clean bowled by a beauty!',
      'Timber! {batsman} is bowled by a searing yorker from {bowler}!',
      '{bowler} beats {batsman} for pace and hits the stumps!',
      'The bails fly! {batsman} is bowled! Error in judgement!',
      'Through the gate! {bowler} has cleaned him up!',
      'Nothing {batsman} could do there! A perfect delivery!',
    ],
    excited: [
      'BOWLED HIM! {bowler} SHATTERS THE STUMPS WITH A YORKER!',
      'TIMBER! {batsman} IS CASTLED BY {bowler}! ABSOLUTE SEED!',
      'CLEAN BOWLED! {bowler} WITH A MAGIC DELIVERY!',
      'STUMPS FLYING! {batsman} IS OUT! {bowler} IS PUMPED!',
      'WHACK! The off-stump is knocked out of the ground!',
    ],
  },
  Caught: {
    normal: [
      '{batsman} is caught! A simple catch in the end.',
      'Caught! {batsman} departs after finding the fielder!',
      '{batsman} holes out to the man at long-on!',
      'That\'s a catch! {batsman} is out! Well taken by the fielder.',
      '{batsman} finds the fielder at deep mid-wicket!',
      'Safe hands! {batsman} is caught at cover.',
      '{batsman} tries to go big but finds the man on the boundary!',
      'Outside edge and taken by the keeper! {batsman} is gone!',
    ],
    excited: [
      'CAUGHT! {batsman} IS OUT! BRILLIANT GRAB IN THE DEEP!',
      'STUNNING CATCH! The fielder dives to his left and takes it!',
      'TAKEN! {batsman} IS CAUGHT AT WIDE LONG-OFF!',
      'WHAT A TAKE! A sliding catch in the gap to dismiss {batsman}!',
      'CLUTCH! Taken at point! {batsman} cannot believe it!',
    ],
  },
  'Caught & Bowled': {
    normal: [
      'Caught and bowled! {bowler} takes it himself with ease!',
      '{bowler} with a sharp return catch! {batsman} is out!',
      'Excellent reflexes from {bowler}! Caught and bowled!',
      'A soft return catch to {bowler}! {batsman} is shaking his head.',
    ],
    excited: [
      'CAUGHT AND BOWLED! {bowler} WITH A STUNNER OFF HIS OWN BOWLING!',
      'SHARP CATCH! {bowler} TAKES IT HIMSELF! THAT WAS FLYING!',
      'REFLEXES OF A CAT! {bowler} plucked that out of thin air!',
    ],
  },
  LBW: {
    normal: [
      'LBW! {batsman} is out! The umpire didn\'t hesitate.',
      'Plumb! {batsman} is given out LBW! Trapped in front!',
      '{bowler} appeals and it\'s given! LBW! Right in the line!',
      'Trapped in front! {batsman} is out LBW! Missing your stumps there.',
    ],
    excited: [
      'LBW! {batsman} IS OUT! {bowler} GOT HIS MAN!',
      'PLUMB! GIVEN OUT LBW! HE WAS TRAPPED LIKE A BIRD!',
      'DEAD PLUMB! The loudest appeal you will hear today!',
    ],
  },
  'Run Out': {
    normal: [
      'Run out! {batsman} is short of the crease by an inch!',
      'Direct hit! {batsman} is run out! Unbelievable effort!',
      'Brilliant fielding! {batsman} is run out by a sharp throw!',
      '{batsman} is caught short! Run out! Mix-up in the middle!',
    ],
    excited: [
      'RUN OUT! BRILLIANT FIELDING SHUTS DOWN {batsman}!',
      'DIRECT HIT! {batsman} IS OUT! THE STUMPS ARE GONE!',
      'LIT UP! The bails are off and {batsman} is well short!',
    ],
  },
  Stumped: {
    normal: [
      'Stumped! {batsman} is out! He was miles out of the crease.',
      'Quick work from the keeper! {batsman} is stumped!',
      '{batsman} is stumped by the wicket-keeper! Beaten in the air.',
      'Left his crease and paid the price! {batsman} is stumped!',
    ],
    excited: [
      'STUMPED! LIGHTNING QUICK FROM THE KEEPER! HE IS GONE!',
      'OUT! {batsman} IS STUMPED! A CLASSIC PIECE OF KEEPING!',
    ],
  },
  'Hit Wicket': {
    normal: [
      'Hit wicket! {batsman} is out! Unfortunate way to go.',
      '{batsman} hits his own stumps while playing the shot! Out!',
      'Unfortunate! {batsman} is out hit wicket! Total disaster!',
    ],
  },
}

const RUN_TEMPLATES = {
  0: {
    normal: [
      '{bowler} bowls a dot ball. No run.',
      '{batsman} defends {bowler}\'s delivery back to the bowler.',
      '{bowler} keeps it tight. Good fielding keeps it to a dot.',
      'No run from {bowler}\'s delivery.',
      '{batsman} blocks {bowler}\'s ball safely.',
      'Dot ball from {bowler}.',
      '{bowler} to {batsman}, no run.',
      '{batsman} plays {bowler}\'s delivery defensively. Dot ball.',
    ],
  },
  1: {
    normal: [
      '{batsman} takes a single off {bowler}. Good running.',
      '{batsman} picks up a quick single from {bowler}.',
      'One run added from {bowler}\'s delivery.',
      'Smart running from {batsman} against {bowler}.',
      '{batsman} rotates the strike with a single off {bowler}.',
      '{bowler} to {batsman}, single taken.',
    ],
  },
  2: {
    normal: [
      '{batsman} picks up two runs off {bowler}! Good running between the wickets.',
      '{batsman} takes a couple from {bowler}.',
      'Well run two from {bowler}\'s delivery!',
      '{batsman} finds the gap for two runs against {bowler}.',
      '{bowler} to {batsman}, two runs added.',
    ],
  },
  3: {
    normal: [
      '{batsman} with three runs off {bowler}! Excellent running!',
      '{batsman} takes a well-run three from {bowler}.',
      'Great effort! Three runs from {bowler}\'s delivery!',
      '{batsman} pushes {bowler} for three runs.',
      '{bowler} to {batsman}, three runs!',
    ],
  },
}

const EXTRA_TEMPLATES = {
  wide: {
    normal: [
      'Wide ball! One run added.',
      'That\'s a wide from {bowler}.',
      'Wide called. Extra run.',
      '{bowler} bowls a wide.',
    ],
  },
  'no-ball': {
    normal: [
      'No ball! Free hit coming up!',
      'No ball from {bowler}!',
      'That\'s a no-ball!',
      '{bowler} oversteps! No ball!',
    ],
    excited: [
      'NO BALL! FREE HIT NEXT BALL!',
      'NO BALL! {bowler} OVERSTEPS!',
    ],
  },
  'leg-bye': {
    normal: [
      'Leg bye! {runs} run{runsSuffix} added.',
      'Off the pads! {runs} leg bye{runsSuffix}.',
      'Leg bye for {runs} run{runsSuffix}.',
    ],
  },
  bye: {
    normal: [
      'Bye! {runs} run{runsSuffix} added.',
      'Missed by the keeper! {runs} bye{runsSuffix}.',
      '{runs} bye{runsSuffix} taken.',
    ],
  },
}

/**
 * Generate commentary for a ball event
 */
export function generateCommentary(
  input: CommentaryInput,
  toneControl: ToneControl = 'normal'
): CommentaryResult {
  const {
    runs,
    ballType = 'normal',
    wicketType,
    batsman = 'Batter',
    bowler = 'Bowler',
    isBoundary = false,
    isFour = false,
    isSix = false,
    matchContext,
    style = 'tv',
  } = input

  // Determine if this is a highlight moment
  const isHighlight = isBoundary || Boolean(wicketType) || runs >= 4

  // Adjust tone based on match context
  let effectiveTone: ToneControl = toneControl
  if (matchContext) {
    const { requiredRuns, oversRemaining, isChase } = matchContext
    if (isChase && requiredRuns && oversRemaining) {
      const requiredRR = requiredRuns / (oversRemaining / 6)
      const currentRR = (matchContext.currentScore || 0) / ((matchContext.oversRemaining || 0) / 6)
      if (Math.abs(requiredRR - currentRR) < 2 && (isBoundary || wicketType)) {
        effectiveTone = 'matchTurning'
      }
    }
  }

  let text = ''
  let alternatives: string[] = []

  // Normalize wicketType for template lookup
  let normalizedWicketType = wicketType;
  if (wicketType) {
    const wt = wicketType.toLowerCase();
    if (wt === 'runout' || wt === 'run out') normalizedWicketType = 'Run Out';
    else if (wt === 'caught') normalizedWicketType = 'Caught';
    else if (wt === 'bowled') normalizedWicketType = 'Bowled';
    else if (wt === 'lbw') normalizedWicketType = 'LBW';
    else if (wt === 'stumped') normalizedWicketType = 'Stumped';
    else if (wt === 'hitwicket' || wt === 'hit wicket') normalizedWicketType = 'Hit Wicket';
    else if (wt.includes('& bowled') || wt.includes('and bowled') || wt === 'c&b') normalizedWicketType = 'Caught & Bowled';
  }

  // Wicket commentary (highest priority)
  if (normalizedWicketType && normalizedWicketType in WICKET_TEMPLATES) {
    const templates = WICKET_TEMPLATES[normalizedWicketType as keyof typeof WICKET_TEMPLATES] as any;
    const toneTemplates = (templates[effectiveTone] || templates.normal || []) as string[];
    const allTemplates = [...toneTemplates, ...(templates.normal || [])];

    // Select random template
    const selected = allTemplates[Math.floor(Math.random() * allTemplates.length)];
    text = selected
      .replace(/{batsman}/g, batsman)
      .replace(/{bowler}/g, bowler);

    // Add info about runs if completed (e.g. Run Out)
    if (runs > 0) {
      text += ` ${runs} run${runs > 1 ? 's' : ''} completed before the dismissal.`;
    }

    // Generate 8-12 alternatives
    alternatives = allTemplates
      .filter((t: string) => t !== selected)
      .slice(0, 11)
      .map((t: string) => {
        let alt = t.replace(/{batsman}/g, batsman).replace(/{bowler}/g, bowler);
        if (runs > 0) alt += ` ${runs} run${runs > 1 ? 's' : ''} taken.`;
        return alt;
      });

    if (style === 'tv') {
      text = addTvContext(text, input, effectiveTone);
    }
    return { text, tone: effectiveTone, isHighlight: true, alternatives };
  }

  // Boundary commentary
  if (isSix) {
    const templates = ((BOUNDARY_TEMPLATES.six as any)[effectiveTone] || BOUNDARY_TEMPLATES.six.normal) as string[];
    const selected = templates[Math.floor(Math.random() * templates.length)];
    text = selected.replace(/{batsman}/g, batsman);
    alternatives = templates
      .filter((t: string) => t !== selected)
      .slice(0, 11)
      .map((t: string) => t.replace(/{batsman}/g, batsman));
    if (style === 'tv') {
      text = addTvContext(text, input, effectiveTone);
    }
    return { text, tone: effectiveTone, isHighlight: true, alternatives };
  }

  if (isFour) {
    const templates = ((BOUNDARY_TEMPLATES.four as any)[effectiveTone] || BOUNDARY_TEMPLATES.four.normal) as string[];
    const selected = templates[Math.floor(Math.random() * templates.length)];
    text = selected.replace(/{batsman}/g, batsman);
    alternatives = templates
      .filter((t: string) => t !== selected)
      .slice(0, 11)
      .map((t: string) => t.replace(/{batsman}/g, batsman));
    if (style === 'tv') {
      text = addTvContext(text, input, effectiveTone);
    }
    return { text, tone: effectiveTone, isHighlight: true, alternatives };
  }

  // Extra commentary
  if (ballType !== 'normal' && ballType in EXTRA_TEMPLATES) {
    const templates = EXTRA_TEMPLATES[ballType as keyof typeof EXTRA_TEMPLATES] as any;
    const toneTemplates = (templates[effectiveTone] || templates.normal || []) as string[];
    const selected = toneTemplates[Math.floor(Math.random() * toneTemplates.length)];
    const runsSuffix = runs !== 1 ? 's' : '';
    text = selected
      .replace(/{bowler}/g, bowler)
      .replace(/{runs}/g, runs.toString())
      .replace(/{runsSuffix}/g, runsSuffix);
    alternatives = toneTemplates
      .filter((t: string) => t !== selected)
      .slice(0, 11)
      .map((t: string) =>
        t.replace(/{bowler}/g, bowler)
          .replace(/{runs}/g, runs.toString())
          .replace(/{runsSuffix}/g, runsSuffix)
      );
    if (style === 'tv') {
      text = addTvContext(text, input, effectiveTone);
    }
    return { text, tone: effectiveTone, isHighlight: runs > 0, alternatives };
  }

  // Regular runs commentary
  if (runs >= 0 && runs <= 3 && runs in RUN_TEMPLATES) {
    const templates = RUN_TEMPLATES[runs as keyof typeof RUN_TEMPLATES] as any;
    const toneTemplates = (templates[effectiveTone] || templates.normal || []) as string[];
    const selected = toneTemplates[Math.floor(Math.random() * toneTemplates.length)];
    text = selected.replace(/{batsman}/g, batsman).replace(/{bowler}/g, bowler);
    alternatives = toneTemplates
      .filter((t: string) => t !== selected)
      .slice(0, 11)
      .map((t: string) => t.replace(/{batsman}/g, batsman).replace(/{bowler}/g, bowler));
    if (style === 'tv') {
      text = addTvContext(text, input, effectiveTone);
    }
    return { text, tone: effectiveTone, isHighlight: isHighlight, alternatives };
  }

  // Fallback for other runs (4+ runs that aren't boundaries)
  if (runs > 3) {
    text = `${batsman} picks up ${runs} runs off ${bowler}!`;
    alternatives = [
      `${runs} runs added from ${bowler}\'s delivery!`,
      `Well run ${runs} runs against ${bowler}!`,
      `Good running! ${runs} runs from ${bowler}!`,
      `${batsman} with ${runs} runs off ${bowler}!`,
      `${bowler} to ${batsman}, ${runs} runs!`,
    ];
    if (style === 'tv') {
      text = addTvContext(text, input, effectiveTone);
    }
    return { text, tone: effectiveTone, isHighlight: isHighlight, alternatives };
  }

  // Ultimate fallback
  text = `${bowler} to ${batsman}.`;
  alternatives = [
    `${batsman} faces ${bowler}.`,
    `${batsman} on strike against ${bowler}.`,
    `${bowler} bowls to ${batsman}.`,
  ];

  if (style === 'tv') {
    text = addTvContext(text, input, effectiveTone);
  }
  return { text, tone: effectiveTone, isHighlight: isHighlight, alternatives };
}

function addTvContext(base: string, input: CommentaryInput, tone: ToneControl): string {
  const over = input.over || '0.0'
  const score = input.matchContext?.currentScore
  const wkts = input.matchContext?.wickets
  const rr = (() => {
    const required = input.matchContext?.requiredRuns
    const ballsRem = input.matchContext?.oversRemaining
    if (!required || !ballsRem) return null
    const overs = ballsRem / 6
    if (overs <= 0) return null
    return required / overs
  })()

  const contextBits: string[] = []
  if (typeof score === 'number' && typeof wkts === 'number') contextBits.push(`Score: ${score}/${wkts}`)
  contextBits.push(`Over ${over}`)
  if (rr && input.matchContext?.isChase) contextBits.push(`RRR ${rr.toFixed(2)}`)

  const secondSentencePool =
    tone === 'excited'
      ? [
        `The crowd loves it — ${contextBits.join(' • ')}.`,
        `That lifts the energy in the ground — ${contextBits.join(' • ')}.`,
        `Big moment in this spell — ${contextBits.join(' • ')}.`,
      ]
      : tone === 'matchTurning'
        ? [
          `This could be a turning point — ${contextBits.join(' • ')}.`,
          `Pressure swings again — ${contextBits.join(' • ')}.`,
          `That changes the equation — ${contextBits.join(' • ')}.`,
        ]
        : [
          `Keeping the game moving — ${contextBits.join(' • ')}.`,
          `Neat and tidy cricket — ${contextBits.join(' • ')}.`,
          `Steady progress — ${contextBits.join(' • ')}.`,
        ]

  const second = secondSentencePool[Math.floor(Math.random() * secondSentencePool.length)]
  // Avoid double punctuation
  const trimmed = base.trim().replace(/[.!\s]+$/, (m) => (m.includes('!') ? '!' : '.'))
  return `${trimmed} ${second}`
}

/**
 * Generate multiple commentary variations (for ML training or selection)
 * 
 * @param input - Commentary input
 * @param count - Number of variations to generate (default: 10)
 * @returns Array of commentary results
 */
export function generateCommentaryVariations(
  input: CommentaryInput,
  count: number = 10
): CommentaryResult[] {
  const results: CommentaryResult[] = []
  const tones: ToneControl[] = ['normal', 'excited', 'matchTurning']

  for (let i = 0; i < count; i++) {
    const tone = tones[i % tones.length]
    const result = generateCommentary(input, tone)
    results.push(result)
  }

  return results
}

/**
 * ML-ready placeholder function for future expansion
 * This can be replaced with actual ML model inference
 */
export async function generateMLCommentary(
  input: CommentaryInput,
  modelVersion: string = 'v1'
): Promise<CommentaryResult> {
  // Placeholder for future ML integration
  // Example: Call to OpenAI, GPT, or custom trained model
  // For now, falls back to template-based generation

  console.log(`[ML Placeholder] Generating commentary with model ${modelVersion}`)
  return generateCommentary(input, 'normal')
}

