# Planning Guide

A delightful endless vertical jumping game where players control a bouncing bunny navigating upward through platforms, collecting carrots, and chasing high scores.

**Experience Qualities**:
1. **Playful**: Bright, cheerful visuals with bouncy animations that make players smile and feel light-hearted.
2. **Responsive**: Instant feedback to every input with smooth physics that feels natural and satisfying.
3. **Progressively challenging**: Starts accessible but gradually increases difficulty through platform variety and spacing.

**Complexity Level**: Light Application (multiple features with basic state)
- Single-purpose arcade game with score tracking, multiple platform types, collectibles, and persistent high score storage.

## Essential Features

### Endless Vertical Jumping
- **Functionality**: Player-controlled bunny automatically jumps when landing on platforms, moving ever upward
- **Purpose**: Core gameplay loop that creates tension and excitement
- **Trigger**: Game starts immediately after clicking "Start Game"
- **Progression**: Player spawns on bottom platform → uses arrow keys to move left/right → lands on platforms to bounce higher → camera follows upward → continues until falling off screen
- **Success criteria**: Bunny responds to input within 16ms, physics feel natural, camera smoothly tracks player

### Platform Variety
- **Functionality**: Three platform types (static, moving, breakable) spawn dynamically as player ascends
- **Purpose**: Creates varied challenges and keeps gameplay interesting
- **Trigger**: Platforms continuously generate above visible area as old ones disappear below
- **Progression**: Static platforms dominate early game → moving platforms increase at mid-heights → breakable platforms appear at high altitudes → distribution adjusts based on altitude
- **Success criteria**: Platform types visually distinct, moving platforms behave predictably, breakable platforms have clear breaking animation

### Carrot Collection
- **Functionality**: Collectible carrots appear on some platforms, adding bonus points when touched
- **Purpose**: Rewards risk-taking and provides secondary scoring objective
- **Trigger**: Carrots spawn randomly on 30% of newly generated platforms
- **Progression**: Player sees carrot → navigates to platform with carrot → touches carrot → visual collection effect plays → score increases by 50
- **Success criteria**: Collision detection is pixel-accurate, collection feels satisfying, score updates immediately

### Score Tracking & Persistence
- **Functionality**: Real-time score display combining height + carrots, with persistent best score
- **Purpose**: Motivates replayability and provides sense of progression
- **Trigger**: Score starts at 0 and updates every frame during gameplay
- **Progression**: Player ascends → height score increases continuously → carrots add bonus → game ends → current vs best score comparison → best score persists between sessions
- **Success criteria**: Score calculation is accurate, best score survives page refresh, game over screen clearly shows both scores

### Game State Management
- **Functionality**: Clean transitions between menu, gameplay, and game over states
- **Purpose**: Professional game flow with clear structure
- **Trigger**: User clicks buttons to navigate states
- **Progression**: Menu screen → click Start → gameplay begins → fall off screen → game over screen → click Restart or Menu
- **Success criteria**: No jarring transitions, game state always clear, can restart unlimited times

## Edge Case Handling

- **Rapid key mashing**: Input smoothing prevents jittery movement when multiple keys pressed simultaneously
- **Falling through platforms**: Collision detection only triggers when bunny descends onto platform from above, preventing clipping
- **Screen edge wrapping**: Bunny blocked at screen edges to prevent disappearing off-canvas
- **Zero platforms visible**: Initial spawn ensures sufficient platform density for first 3-4 jumps
- **Best score corruption**: Validates localStorage data and falls back to 0 if invalid
- **Breakable platform timing**: Breaking animation delayed enough to register jump before platform disappears

## Design Direction

The design should feel joyful and energetic like a children's storybook illustration - soft rounded shapes, cheerful pastel colors, and gentle bouncy animations that emphasize the lighthearted arcade nature while maintaining excellent readability and clarity.

## Color Selection

Analogous color scheme using warm, inviting tones that create a cheerful spring meadow atmosphere.

- **Primary Color**: Soft Sky Blue (oklch(0.82 0.08 230)) - communicates open air and upward movement, used for background gradient
- **Secondary Colors**: 
  - Fresh Grass Green (oklch(0.75 0.15 145)) for static platforms - stability and nature
  - Lavender Purple (oklch(0.70 0.12 290)) for moving platforms - magical motion
  - Soft Coral (oklch(0.78 0.12 25)) for breakable platforms - gentle warning
- **Accent Color**: Vibrant Orange (oklch(0.72 0.18 45)) for carrots and UI highlights - draws attention and creates energy
- **Foreground/Background Pairings**:
  - Background (Sky Blue oklch(0.82 0.08 230)): Dark Text (oklch(0.25 0.02 260) #3a3d5c) - Ratio 9.2:1 ✓
  - Card/UI Panel (White oklch(0.98 0 0)): Dark Text (oklch(0.25 0.02 260)) - Ratio 14.1:1 ✓
  - Primary Button (Vibrant Orange oklch(0.72 0.18 45)): White (oklch(0.98 0 0)) - Ratio 5.1:1 ✓
  - Platform Green (oklch(0.75 0.15 145)): White outline for visibility - N/A (decorative)
  - Score Display (White oklch(0.98 0 0)): Dark shadow for legibility on any background - N/A (uses shadow)

## Font Selection

Typography should feel friendly and approachable with rounded letterforms that match the playful game aesthetic while remaining highly legible during fast-paced gameplay.

**Primary Font**: Fredoka (Google Fonts) - rounded sans-serif with playful personality perfect for game UI

- **Typographic Hierarchy**:
  - H1 (Game Title): Fredoka Bold/48px/tight tracking (-0.02em) - commanding presence on menu
  - H2 (Game Over/Score Labels): Fredoka SemiBold/32px/normal tracking - clear state communication  
  - Body (Score Numbers): Fredoka Medium/28px/wide tracking (0.05em) - excellent readability during play
  - Button Text: Fredoka SemiBold/20px/normal tracking - clear call-to-action
  - HUD Score: Fredoka Bold/24px/wide tracking with text shadow - always readable over gameplay

## Animations

Animations embrace the bouncy, playful nature of the bunny character - every movement should feel light and springy with subtle squash-and-stretch that reinforces the physics without distracting from gameplay precision.

- **Purposeful Meaning**: Bouncy ease-out curves on platform spawning and carrot collection create satisfaction, while the bunny's subtle rotation during jumps communicates direction and momentum
- **Hierarchy of Movement**: Bunny movement is primary with smooth interpolation, platform motion is secondary with predictable sinusoidal patterns, UI transitions are tertiary with quick snappy fades

## Component Selection

- **Components**: 
  - Button (Shadcn) for menu navigation with `size="lg"` and rounded corners
  - Card (Shadcn) for game over panel with subtle shadow
  - No complex forms needed - pure canvas-based gameplay with minimal UI overlay
  
- **Customizations**: 
  - Custom canvas game component handling all rendering and physics
  - Custom HUD overlay with semi-transparent background for score display
  - Pixel-art style sprites rendered programmatically or via simple shapes
  
- **States**: 
  - Buttons: Hover scales to 1.05, active scales to 0.95, uses primary accent color with white text
  - Game states: Menu (static UI), Playing (canvas active, minimal UI), GameOver (modal overlay)
  
- **Icon Selection**: 
  - Phosphor Play icon for start button
  - Phosphor ArrowsClockwise for restart
  - Phosphor House for return to menu
  - Carrot rendered as custom shape/sprite
  
- **Spacing**: 
  - Menu buttons: gap-4 (1rem) vertical spacing
  - Game over panel: p-8 (2rem) padding
  - HUD elements: fixed positioning with 4-unit spacing from edges
  
- **Mobile**: 
  - Canvas scales to fit viewport while maintaining aspect ratio
  - Touch controls: Left half of screen = move left, right half = move right
  - Buttons increase to minimum 44px touch targets
  - Game over panel uses full-width on mobile with responsive text sizing
