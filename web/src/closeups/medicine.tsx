// Medicine close-ups. Shake and press are the Figma 06a / 07a vectors; the rest are drawn in the same style.
// Animated parts are wrapper <g>s with a `cu-*` class and no transform attribute (the CSS animation owns it).
import React from "react";
import { C, Face, Glow, ClockFace } from "./parts";

const o = (x: number, y: number) => ({ transformOrigin: `${x}px ${y}px` });

/** The Figma 06a hand + inhaler (fingers wrapped round the body, mouthpiece pointing left). */
function HandInhaler({ cap }: { cap?: "on" | "off" | "none" }) {
  return (
    <g>
      <path d="M209.383 298.043L256.409 269.19L334.095 365.445L321.62 424.134L255.106 409.996L209.383 298.043Z" fill={C.sleeve} />
      <path d="M209.383 298.043L256.409 269.19L270.69 288.583L223.247 319.392L209.383 298.043Z" fill={C.cuff} />
      <path d="M216.413 72.578L196.85 68.4197C190.368 67.0418 183.996 71.18 182.618 77.6626L167.648 148.089C166.27 154.572 170.408 160.944 176.891 162.322L196.454 166.48C202.936 167.858 209.309 163.72 210.687 157.237L225.656 86.8107C227.034 80.3281 222.896 73.9559 216.413 72.578Z" fill={C.metal} />
      <path d="M197.852 82.9455C198.312 80.7846 196.932 78.6606 194.771 78.2013C192.61 77.742 190.486 79.1214 190.027 81.2822L177.137 141.927C176.677 144.088 178.057 146.212 180.218 146.672C182.378 147.131 184.502 145.752 184.962 143.591L197.852 82.9455Z" fill={C.shine} />
      <path d="M206.188 139.924L178.8 134.102C169.076 132.035 159.518 138.243 157.451 147.966L133.749 259.475C131.682 269.199 137.889 278.757 147.613 280.824L175.001 286.646C184.725 288.713 194.283 282.505 196.35 272.782L220.052 161.273C222.119 151.549 215.912 141.991 206.188 139.924Z" fill={C.blue} />
      <path d="M142.651 236.831L101.569 228.099C96.167 226.951 90.8568 230.399 89.7085 235.801L85.1345 257.321C83.9862 262.723 87.4347 268.033 92.8368 269.181L133.919 277.914C139.321 279.062 144.631 275.613 145.78 270.211L150.354 248.692C151.502 243.29 148.053 237.98 142.651 236.831Z" fill={C.blueDark} />
      {cap === "none" || cap === undefined ? (
        <path d="M95.9933 235.093L94.037 234.677C91.8761 234.217 89.752 235.597 89.2927 237.758L85.5503 255.364C85.091 257.525 86.4704 259.649 88.6313 260.109L90.5876 260.524C92.7484 260.984 94.8725 259.604 95.3318 257.443L99.0742 239.837C99.5335 237.676 98.1541 235.552 95.9933 235.093Z" fill={C.blueDeep} />
      ) : null}
      <path d="M211.395 163.522C245.109 165.236 263.107 179.966 265.387 207.713L256.409 269.19C247.23 293.138 231.416 303.408 208.967 300L183.951 292.638L211.395 163.522Z" fill={C.skinDark} />
      <path d="M231.032 169.741L161.583 154.979C154.29 153.429 147.122 158.084 145.571 165.377C144.021 172.67 148.677 179.839 155.97 181.389L225.418 196.151C232.711 197.701 239.88 193.045 241.43 185.752C242.98 178.459 238.325 171.291 231.032 169.741Z" fill={C.skin} />
      <path d="M227.166 197.545L151.849 181.535C144.556 179.985 137.387 184.641 135.837 191.934C134.287 199.226 138.943 206.395 146.235 207.945L221.553 223.955C228.846 225.505 236.014 220.849 237.565 213.556C239.115 206.263 234.459 199.095 227.166 197.545Z" fill={C.skin} />
      <path d="M221.345 224.933L147.984 209.339C140.691 207.789 133.522 212.445 131.972 219.737C130.422 227.03 135.077 234.199 142.37 235.749L215.731 251.343C223.024 252.893 230.193 248.237 231.743 240.944C233.293 233.652 228.638 226.483 221.345 224.933Z" fill={C.skin} />
      <path d="M215.034 252.217L148.52 238.079C142.038 236.701 135.665 240.839 134.288 247.322C132.91 253.804 137.048 260.176 143.53 261.554L210.044 275.692C216.527 277.07 222.899 272.932 224.277 266.45C225.655 259.967 221.517 253.595 215.034 252.217Z" fill={C.skin} />
      <path d="M160.371 182.324L185.803 187.73M150.637 208.881L178.025 214.702M148.728 237.101L174.16 242.506" stroke={C.skinLine} strokeWidth="3" strokeLinecap="round" />
      <path d="M149.087 158.457C152.029 163.853 151.059 168.418 146.176 172.151M139.353 185.013C142.295 190.41 141.325 194.974 136.442 198.707M135.488 212.817C138.43 218.214 137.46 222.778 132.577 226.511" stroke={C.skinLine} strokeWidth="2.5" strokeLinecap="round" />
    </g>
  );
}

/** Cap for the 06a mouthpiece, in its own frame: (0,0) sits on the mouthpiece end, x runs along the mouthpiece. */
function Cap() {
  return (
    <g transform="translate(88 247) rotate(12)">
      <rect x="-14" y="-24" width="40" height="48" rx="10" fill={C.blueDeep} />
      <rect x="-14" y="-24" width="10" height="48" rx="5" fill="#16314B" />
    </g>
  );
}

/** Sage arrow along a direction (used to show which way a part moves). */
function Arrow({ d }: { d: string }) {
  return <path d={d} stroke={C.sageInk} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />;
}

export function InhalerShake() {
  return (
    <>
      <path d="M175 350C249.558 350 310 289.558 310 215C310 140.442 249.558 80 175 80C100.442 80 40 140.442 40 215C40 289.558 100.442 350 175 350Z" fill={C.glow} />
      <g className="cu-shake-left">
        <path d="M78 150C66 183.333 66 216.667 78 250" stroke={C.accent} strokeWidth="7" strokeLinecap="round" />
        <path opacity="0.6" d="M52 168C44 189.333 44 210.667 52 232" stroke={C.accent} strokeWidth="6" strokeLinecap="round" />
      </g>
      <g className="cu-shake-right" opacity="0.2">
        <path d="M282 150C294 183.333 294 216.667 282 250" stroke={C.accent} strokeWidth="7" strokeLinecap="round" />
        <path opacity="0.6" d="M308 168C316 189.333 316 210.667 308 232" stroke={C.accent} strokeWidth="6" strokeLinecap="round" />
      </g>
      <g className="cu-shake-rock" style={o(215, 300)}>
        <HandInhaler />
      </g>
    </>
  );
}

/** Figma 07a: mouth on the mouthpiece, finger on the canister, hand under the inhaler. */
function PressArt({ spacer = false }: { spacer?: boolean }) {
  return (
    <g transform="translate(0 24)">
      {spacer ? (
        <>
          <rect x="108" y="236" width="150" height="76" rx="34" fill="#E4EEF4" stroke={C.waterLine} strokeWidth="4" />
          <rect x="104" y="258" width="26" height="34" rx="8" fill={C.waterLine} />
          <g className="cu-spacer-mist" opacity="0">
            <circle cx="230" cy="270" r="9" fill="white" />
            <circle cx="210" cy="282" r="12" fill="white" />
            <circle cx="188" cy="268" r="8" fill="white" />
            <circle cx="170" cy="284" r="10" fill="white" />
          </g>
        </>
      ) : (
        <>
          <path d="M195 256H117C112.029 256 108 260.029 108 265V289C108 293.971 112.029 298 117 298H195C199.971 298 204 293.971 204 289V265C204 260.029 199.971 256 195 256Z" fill={C.blueDark} />
          <g className="cu-press-mist" opacity="0" style={o(160, 246)}>
            <circle cx="134" cy="250" r="7" fill="white" />
            <circle cx="150" cy="244" r="9" fill="white" />
            <circle cx="168" cy="250" r="6" fill="white" />
            <circle cx="182" cy="244" r="5" fill="white" />
          </g>
        </>
      )}
      <g transform={spacer ? "translate(56 0)" : undefined}>
        <path d="M238 150H212C202.059 150 194 158.059 194 168V292C194 301.941 202.059 310 212 310H238C247.941 310 256 301.941 256 292V168C256 158.059 247.941 150 238 150Z" fill={C.blue} />
        <g className="cu-press-push">
          <path d="M235 110H215C208.373 110 203 115.373 203 122V178C203 184.627 208.373 190 215 190H235C241.627 190 247 184.627 247 178V122C247 115.373 241.627 110 235 110Z" fill={C.metal} />
          <path d="M219 124C219 121.791 217.209 120 215 120C212.791 120 211 121.791 211 124V172C211 174.209 212.791 176 215 176C217.209 176 219 174.209 219 172V124Z" fill={C.shine} />
        </g>
      </g>
      <g transform={spacer ? "translate(30 0)" : undefined}>
        <path d="M286 300L358 270V400H250L286 300Z" fill={C.sleeve} />
        <path d="M256 170C285.333 163.333 306.667 176.667 320 210L330 300C310 326.667 285.333 333.333 256 320V170Z" fill={C.skinDark} />
        <path d="M300 322C266.667 331.333 238 330 214 318" stroke={C.skin} strokeWidth="26" strokeLinecap="round" />
      </g>
      <g transform={spacer ? "translate(30 0)" : undefined}>
        <g className="cu-press-push">
          <path d="M300 196C297.333 133.333 274.667 102.667 232 104" stroke={C.skin} strokeWidth="26" strokeLinecap="round" fill="none" />
          <path d="M222 98C218 102 218 106 222 110" stroke={C.skinLine} strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </g>
        <g className="cu-press-lines" opacity="0">
          <path d="M188 84L200 96M226 64L228 74M178 114H192" stroke={C.accent} strokeWidth="6" strokeLinecap="round" />
        </g>
      </g>
      <g className="cu-press-breath" opacity="0.35">
        <path d="M190 326H132" stroke={C.sageInk} strokeWidth="7" strokeLinecap="round" />
        <path d="M148 312L132 326L148 340" stroke={C.sageInk} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
    </g>
  );
}

export function InhalerPressBreatheIn() {
  return (
    <>
      <Face mouth="mouthpiece" />
      <PressArt />
    </>
  );
}

export function SpacerUse() {
  return (
    <>
      <Face mouth="mouthpiece" />
      <PressArt spacer />
    </>
  );
}

export function InhalerCapOff() {
  return (
    <>
      <Glow />
      <HandInhaler cap="off" />
      <g className="cu-cap-off" style={o(88, 247)}>
        <Cap />
      </g>
      <Arrow d="M60 210L24 202M38 190L24 202L36 216" />
    </>
  );
}

export function InhalerCapOn() {
  return (
    <>
      <Glow />
      <HandInhaler cap="on" />
      <g className="cu-cap-on">
        <Cap />
      </g>
      <Arrow d="M24 202L60 210M46 196L60 210L46 222" />
    </>
  );
}

export function InhalerBreatheOut() {
  return (
    <>
      <Face mouth="open" />
      <g className="cu-breath-out">
        <path d="M150 284C160 276 160 266 150 258M174 294C188 280 188 262 174 248M198 304C216 284 216 258 198 238" stroke={C.sageInk} strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.7" />
      </g>
      {/* inhaler held down and away from the mouth */}
      <g transform="translate(70 120)">
        <rect x="194" y="150" width="62" height="160" rx="18" fill={C.blue} />
        <rect x="203" y="110" width="44" height="80" rx="12" fill={C.metal} />
        <rect x="150" y="262" width="60" height="40" rx="9" fill={C.blueDark} />
        <path d="M216 300L288 270V400H180Z" fill={C.sleeve} />
        <path d="M256 170C285 163 300 180 310 210L300 300C280 320 260 320 240 312Z" fill={C.skinDark} />
        <path d="M246 196C230 200 214 204 200 208M246 226C230 230 214 234 200 238M246 256C230 260 214 262 200 266" stroke={C.skin} strokeWidth="24" strokeLinecap="round" />
      </g>
    </>
  );
}

export function InhalerHoldBreath() {
  return (
    <>
      <Face mouth="closed" />
      <g className="cu-puff" style={o(80, 290)}>
        <ellipse cx="80" cy="290" rx="38" ry="34" fill={C.skin} opacity="0.55" />
      </g>
      <g transform="translate(250 130)">
        <circle r="62" fill={C.paper} />
        <circle r="48" fill="none" stroke={C.sage} strokeWidth="14" />
        <circle className="cu-timer" r="48" fill="none" stroke={C.sageInk} strokeWidth="14" strokeLinecap="round"
          pathLength={100} strokeDasharray="100" strokeDashoffset="25" transform="rotate(-90)" />
        <rect x="-5" y="-78" width="10" height="16" rx="4" fill={C.muted} />
      </g>
    </>
  );
}

export function InhalerWait() {
  return (
    <>
      <Glow />
      <g transform="translate(-110 20) scale(0.9)">
        <rect x="194" y="150" width="62" height="160" rx="18" fill={C.blue} />
        <rect x="203" y="110" width="44" height="80" rx="12" fill={C.metal} />
        <rect x="211" y="122" width="8" height="54" rx="4" fill={C.shine} />
        <rect x="140" y="256" width="66" height="42" rx="9" fill={C.blueDark} />
      </g>
      <ClockFace cx={236} cy={196} r={84} />
      <g className="cu-hand-fast" style={o(236, 196)}>
        <line x1="236" y1="196" x2="236" y2="134" stroke={C.accent} strokeWidth="7" strokeLinecap="round" />
      </g>
      <circle cx="236" cy="196" r="8" fill={C.ink} />
    </>
  );
}

export function RinseMouth() {
  return (
    <>
      <Face mouth="closed" />
      <g className="cu-swish">
        <path d="M40 286C52 276 64 296 76 286C88 276 100 296 112 286" stroke="#5FA3D6" strokeWidth="6" strokeLinecap="round" fill="none" />
        <path d="M46 306C58 296 70 316 82 306C94 296 102 312 110 306" stroke="#5FA3D6" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.6" />
      </g>
      <g transform="translate(210 160)">
        <path d="M0 0H110L98 190H12Z" fill="#F4F8FB" stroke={C.waterLine} strokeWidth="4" strokeLinejoin="round" />
        <path d="M6 60H104L98 186H12Z" fill={C.water} />
      </g>
    </>
  );
}

export function TabletWithWater() {
  return (
    <>
      <Glow />
      {/* glass of water */}
      <g transform="translate(210 100)">
        <path d="M0 0H110L98 220H12Z" fill="#F4F8FB" stroke={C.waterLine} strokeWidth="4" strokeLinejoin="round" />
        <path d="M5 64H105L98 216H12Z" fill={C.water} />
        <g className="cu-wave">
          <path d="M5 64C22 56 38 72 55 64C72 56 88 72 105 64" stroke="#7FB0D3" strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
      </g>
      {/* open hand, palm up, with a tablet */}
      <path d="M-10 330L60 280L120 380H0Z" fill={C.sleeve} />
      <path d="M40 300C40 260 80 240 130 246C170 250 190 266 186 284C182 300 150 306 110 306C80 306 56 316 40 300Z" fill={C.skinDark} />
      <path d="M90 254C120 240 160 242 182 256" stroke={C.skin} strokeWidth="20" strokeLinecap="round" fill="none" />
      <g className="cu-tablet-hop">
        <rect x="100" y="222" width="56" height="26" rx="13" fill={C.paper} stroke={C.steel} strokeWidth="3" />
        <line x1="128" y1="224" x2="128" y2="246" stroke={C.steel} strokeWidth="3" />
      </g>
    </>
  );
}

export function EyeDrops() {
  return (
    <>
      <rect x="0" y="196" width="358" height="200" fill={C.skinDark} />
      <path d="M70 290Q179 200 288 290Q179 360 70 290Z" fill="white" />
      <circle cx="179" cy="288" r="40" fill="#6B4226" />
      <circle cx="179" cy="288" r="18" fill="#21160F" />
      <circle cx="192" cy="276" r="7" fill="white" />
      <path d="M62 290Q179 186 296 290" stroke={C.skinLine} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M90 318Q179 356 268 318" stroke={C.skinLine} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.6" />
      {/* drop bottle, nozzle down, squeezed by two fingers */}
      <path d="M152 40H206C212 40 216 44 216 50V112C216 120 204 126 192 128L186 156H172L166 128C154 126 142 120 142 112V50C142 44 146 40 152 40Z" fill={C.paper} stroke={C.steel} strokeWidth="3" />
      <rect x="150" y="18" width="58" height="26" rx="8" fill={C.orange} />
      <path d="M118 70L144 76M240 70L214 76" stroke={C.skin} strokeWidth="24" strokeLinecap="round" />
      <path d="M90 20L118 70M268 20L240 70" stroke={C.skinDark} strokeWidth="34" strokeLinecap="round" />
      <g className="cu-drop" style={o(179, 170)}>
        <path d="M179 160C179 160 168 174 168 181C168 187 173 192 179 192C185 192 190 187 190 181C190 174 179 160 179 160Z" fill="#5FA3D6" />
      </g>
    </>
  );
}

export function LiquidMeasureSpoon() {
  return (
    <>
      <Glow />
      {/* bottle tipped over the spoon */}
      <g transform="rotate(-120 120 110)">
        <rect x="70" y="60" width="100" height="120" rx="20" fill="#B5652A" />
        <rect x="100" y="30" width="40" height="36" rx="6" fill="#8F4C1E" />
        <rect x="82" y="96" width="76" height="46" rx="6" fill={C.paper} />
      </g>
      <g className="cu-pour">
        <rect x="154" y="148" width="10" height="92" rx="5" fill="#E07A3A" />
      </g>
      {/* spoon: bowl + handle to the right, held by a hand */}
      <ellipse cx="160" cy="262" rx="70" ry="30" fill={C.shine} stroke={C.steel} strokeWidth="4" />
      <g className="cu-fill" style={o(160, 262)}>
        <ellipse cx="160" cy="262" rx="54" ry="20" fill="#E07A3A" />
      </g>
      <rect x="226" y="252" width="110" height="18" rx="9" fill={C.steel} />
      <path d="M300 230C320 226 340 236 358 250V300C340 300 316 294 300 286Z" fill={C.skinDark} />
      <path d="M296 248C290 256 290 266 296 274" stroke={C.skin} strokeWidth="22" strokeLinecap="round" fill="none" />
    </>
  );
}

export function CreamApply() {
  return (
    <>
      {/* forearm across the card */}
      <path d="M-10 230C80 214 200 214 300 226L300 330C200 320 80 320 -10 336Z" fill={C.skinDark} />
      <path d="M292 220L368 214V346L292 336Z" fill={C.sleeve} />
      <g className="cu-smear">
        <ellipse cx="150" cy="262" rx="46" ry="16" fill="white" opacity="0.85" />
      </g>
      <g className="cu-rub" style={o(170, 250)}>
        <path d="M152 244L208 110" stroke={C.skin} strokeWidth="28" strokeLinecap="round" />
        <path d="M206 108L260 60L330 80" stroke={C.skinDark} strokeWidth="56" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M144 240C150 246 158 248 166 246" stroke={C.skinLine} strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <ellipse cx="150" cy="252" rx="14" ry="7" fill="white" />
      </g>
      {/* tube */}
      <g transform="rotate(-24 70 100)">
        <path d="M24 80H110L118 120H16Z" fill={C.paper} stroke={C.steel} strokeWidth="3" />
        <rect x="110" y="88" width="26" height="24" rx="5" fill={C.orange} />
      </g>
    </>
  );
}
