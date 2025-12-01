import { motion } from 'framer-motion'
import type { SpiritProps } from './WindEagle'

export function BunnySpirit({ size = 80, className = "", animate = true }: SpiritProps) {
  const floatAnimation = animate
    ? {
        y: [-4, 4, -4],
        rotate: [-1.5, 1.5, -1.5],
        transition: {
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut' as const,
        },
      }
    : {}

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      animate={floatAnimation}
    >
      <defs>
        <radialGradient id="bunnyBody" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#FFE6F2" />
          <stop offset="100%" stopColor="#F5C2E7" />
        </radialGradient>
        <radialGradient id="bunnyLight" cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#FFE9F7" />
        </radialGradient>
        <radialGradient id="bunnyShadow" cx="50%" cy="55%" r="70%">
          <stop offset="0%" stopColor="#E599C2" />
          <stop offset="100%" stopColor="#C77DAD" />
        </radialGradient>
        <linearGradient id="bunnyEar" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFD1E8" />
          <stop offset="100%" stopColor="#F2A5CF" />
        </linearGradient>
        <linearGradient id="bunnyAccent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D8F3DC" />
          <stop offset="100%" stopColor="#B7E4C7" />
        </linearGradient>
      </defs>

      <ellipse cx="50" cy="90" rx="18" ry="4" fill="#00000020" />

      <g>
        <path
          d="M32 12 Q30 4 36 6 Q44 8 44 26 Q44 32 40 36 Q34 32 32 22 Z"
          fill="url(#bunnyEar)"
          stroke="#F2A5CF"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M68 12 Q70 4 64 6 Q56 8 56 26 Q56 32 60 36 Q66 32 68 22 Z"
          fill="url(#bunnyEar)"
          stroke="#F2A5CF"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>

      <ellipse cx="50" cy="50" rx="24" ry="26" fill="url(#bunnyBody)" />
      <ellipse cx="50" cy="52" rx="18" ry="20" fill="url(#bunnyLight)" />

      <ellipse cx="50" cy="34" rx="18" ry="16" fill="url(#bunnyBody)" />
      <ellipse cx="50" cy="36" rx="13" ry="12" fill="url(#bunnyLight)" />

      <ellipse cx="40" cy="36" rx="7.5" ry="7" fill="#FFFFFF" />
      <ellipse cx="60" cy="36" rx="7.5" ry="7" fill="#FFFFFF" />
      <ellipse cx="40" cy="36" rx="4.5" ry="4.5" fill="#F1B457" />
      <ellipse cx="60" cy="36" rx="4.5" ry="4.5" fill="#F1B457" />
      <ellipse cx="40" cy="36" rx="2.4" ry="2.8" fill="#1A1A2E" />
      <ellipse cx="60" cy="36" rx="2.4" ry="2.8" fill="#1A1A2E" />
      <circle cx="41" cy="34.5" r="1.2" fill="#FFFFFF" />
      <circle cx="61" cy="34.5" r="1.2" fill="#FFFFFF" />

      <path
        d="M36 32 Q40 33 44 32"
        fill="none"
        stroke="#C77DAD"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M64 32 Q60 33 56 32"
        fill="none"
        stroke="#C77DAD"
        strokeWidth="2"
        strokeLinecap="round"
      />

      <path
        d="M48 42 Q50 44 52 42"
        fill="none"
        stroke="#1A1A2E"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M46 44 Q50 48 54 44"
        fill="none"
        stroke="#E86FA8"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <ellipse cx="42" cy="44" rx="3.5" ry="2.3" fill="#FFB3C6" opacity="0.8" />
      <ellipse cx="58" cy="44" rx="3.5" ry="2.3" fill="#FFB3C6" opacity="0.8" />

      <path
        d="M40 58 Q50 62 60 58"
        fill="none"
        stroke="#E599C2"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M38 64 Q50 68 62 64"
        fill="none"
        stroke="#E599C2"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.6"
      />

      <path
        d="M43 72 L40 82 L46 78 L50 84 L54 78 L60 82 L57 72"
        fill="url(#bunnyShadow)"
      />

      <g opacity="0.9">
        <ellipse cx="50" cy="68" rx="8" ry="6" fill="url(#bunnyAccent)" />
        <path
          d="M46 68 Q50 70 54 68"
          fill="none"
          stroke="#8FB59B"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.6"
        />
      </g>

      <circle cx="24" cy="30" r="3" fill="#FFD6F3" opacity="0.8" />
      <circle cx="22" cy="35" r="2" fill="#FFD6F3" opacity="0.7" />
      <circle cx="78" cy="32" r="3" fill="#FFD6F3" opacity="0.8" />
      <circle cx="80" cy="37" r="2" fill="#FFD6F3" opacity="0.7" />

      <path
        d="M30 76 Q32 78 35 76"
        stroke="#F3B2D0"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M70 76 Q68 78 65 76"
        stroke="#F3B2D0"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.7"
      />
    </motion.svg>
  )
}

export default BunnySpirit
