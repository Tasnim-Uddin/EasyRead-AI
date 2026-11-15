// Everyday-paper close-ups (letters, bills, forms, appointments, benefits, fines, how-to), in the same flat style:
// sand card, cream glow, warm brown hands with a sage sleeve, no faces, no words or digits.
// Animated parts are wrapper <g>s with a `cu-*` class (styles in everyday.css); the markup itself is the still frame.
import React from "react";
import { C, Glow, Bar, PointHand, ClockFace } from "./parts";
import "./everyday.css";

const o = (x: number, y: number) => ({ transformOrigin: `${x}px ${y}px` });
const GOLD = "#E3B85C";
const GOLD_EDGE = "#C99A3A";
const WOOD = "#D9A877";
const WOOD_DARK = "#C08A57";

function Coin({ cx, cy, r = 18 }: { cx: number; cy: number; r?: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={GOLD} stroke={GOLD_EDGE} strokeWidth={r * 0.22} />
      <circle cx={cx} cy={cy} r={r * 0.5} fill="none" stroke={GOLD_EDGE} strokeWidth={r * 0.12} opacity="0.6" />
    </g>
  );
}

/** A magnifying glass; the lens centre is at (0, 0). */
function Magnifier({ r = 52 }: { r?: number }) {
  return (
    <g>
      <path d={`M${r * 0.7} ${r * 0.7}L${r * 1.9} ${r * 1.9}`} stroke={C.ink} strokeWidth="18" strokeLinecap="round" />
      <path d={`M${r * 1.2} ${r * 1.2}L${r * 1.9} ${r * 1.9}`} stroke={C.muted} strokeWidth="22" strokeLinecap="round" />
      <circle r={r} fill="white" fillOpacity="0.35" stroke={C.ink} strokeWidth="11" />
      <path d={`M${-r * 0.55} ${-r * 0.2}A${r * 0.6} ${r * 0.6} 0 0 1 ${-r * 0.15} ${-r * 0.58}`} stroke="white" strokeWidth="6" strokeLinecap="round" fill="none" />
    </g>
  );
}

/** A hand gripping something from below-left; mirror it for the right side. */
function GripHand({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-70 60L-14 18L44 96L-18 150Z" fill={C.sleeve} />
      <path d="M-44 44L-14 18L4 42L-26 68Z" fill={C.cuff} />
      <ellipse cx="6" cy="10" rx="34" ry="40" fill={C.skinDark} transform="rotate(-24 6 10)" />
      <path d="M10 -14L32 -32" stroke={C.skin} strokeWidth="20" strokeLinecap="round" />
    </g>
  );
}

function Tick({ x, y, s = 1, color = C.sageInk }: { x: number; y: number; s?: number; color?: string }) {
  return <path d={`M${x - 12 * s} ${y}L${x - 3 * s} ${y + 10 * s}L${x + 14 * s} ${y - 10 * s}`} stroke={color} strokeWidth={7 * s} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
}

function Bank({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-56 0L0 -34L56 0Z" fill={C.muted} />
      <rect x="-52" y="0" width="104" height="10" fill={C.muted} />
      {[-36, -12, 12, 36].map((cx) => <rect key={cx} x={cx - 6} y="16" width="12" height="62" rx="3" fill={C.bar} />)}
      <rect x="-60" y="80" width="120" height="14" rx="4" fill={C.muted} />
    </g>
  );
}

export function LetterOpen() {
  return (
    <>
      <Glow />
      <defs>
        <clipPath id="cu-env-clip"><rect x="0" y="0" width="358" height="326" /></clipPath>
      </defs>
      <rect x="69" y="182" width="220" height="146" rx="10" fill="#EBD3B3" />
      <g className="cu-flap-open" style={o(179, 182)}>
        <path d="M69 184L179 104L289 184Z" fill="#F3DCBC" />
      </g>
      <g clipPath="url(#cu-env-clip)">
        <g className="cu-letter-out">
          <rect x="96" y="98" width="166" height="190" rx="8" fill={C.paper} stroke={C.border} strokeWidth="3" />
          <circle cx="120" cy="124" r="10" fill={C.sage} />
          <Bar x={138} y={118} w={70} h={10} fill={C.muted} />
          <Bar x={114} y={150} w={128} />
          <Bar x={114} y={170} w={110} />
          <Bar x={114} y={190} w={122} />
        </g>
      </g>
      <path d="M69 196L179 262L289 196V318C289 324 285 328 279 328H79C73 328 69 324 69 318Z" fill="#FFF0DC" stroke={C.border} strokeWidth="3" strokeLinejoin="round" />
      <rect x="236" y="286" width="34" height="26" rx="4" fill={C.orange} />
      <g className="cu-flap-shut" opacity="0">
        <path d="M69 184L179 262L289 184Z" fill="#F3DCBC" stroke={C.border} strokeWidth="3" strokeLinejoin="round" />
      </g>
    </>
  );
}

export function ReadLetter() {
  const rows = [112, 140, 168, 196, 224, 252];
  return (
    <>
      <Glow />
      <g transform="rotate(-2 179 200)">
        <rect x="66" y="44" width="226" height="300" rx="10" fill={C.paper} stroke={C.border} strokeWidth="3" />
        <circle cx="94" cy="76" r="12" fill={C.sage} />
        <Bar x={114} y={70} w={90} h={12} fill={C.muted} />
        <g className="cu-scan">
          <rect x="80" y={rows[0] - 8} width="198" height="26" rx="8" fill={C.softOrange} />
          <rect x="80" y={rows[0] - 8} width="6" height="26" rx="3" fill={C.orange} />
        </g>
        {rows.map((y, i) => <Bar key={y} x={94} y={y} w={[170, 150, 176, 132, 164, 110][i]} />)}
        <Bar x={94} y={292} w={80} fill={C.muted} />
      </g>
      <GripHand x={78} y={318} />
      <g transform="translate(358 0) scale(-1 1)">
        <GripHand x={78} y={318} />
      </g>
    </>
  );
}

/** Paper with a money line; the magnifier slides over it and the line lights up. */
export function CheckAmount() {
  return (
    <>
      <Glow />
      <rect x="52" y="48" width="254" height="290" rx="12" fill={C.paper} stroke={C.border} strokeWidth="3" />
      <Bar x={76} y={76} w={110} h={12} fill={C.muted} />
      <Bar x={76} y={106} w={190} />
      <Bar x={76} y={126} w={160} />
      <g className="cu-hit">
        <rect x="68" y="160" width="222" height="58" rx="10" fill={C.softOrange} stroke={C.accent} strokeWidth="4" />
      </g>
      <Coin cx={100} cy={189} r={17} />
      <Bar x={128} y={182} w={130} h={14} fill={C.ink} />
      <Bar x={76} y={246} w={180} />
      <Bar x={76} y={266} w={140} />
      <Bar x={76} y={286} w={170} />
      <g className="cu-magnify">
        <g transform="translate(200 190)">
          <Magnifier />
        </g>
      </g>
    </>
  );
}

/** A calendar page flips to the marked day while a clock hand runs. */
export function DeadlineClock() {
  const cells = (hit: boolean) =>
    [0, 1, 2].map((r) =>
      [0, 1, 2, 3].map((c) => {
        const on = hit && r === 1 && c === 2;
        return <rect key={`${r}${c}`} x={56 + c * 32} y={150 + r * 30} width="24" height="22" rx="5" fill={on ? C.accent : C.border} />;
      }),
    );
  return (
    <>
      <Glow />
      <rect x="40" y="90" width="164" height="190" rx="14" fill={C.paper} stroke={C.border} strokeWidth="3" />
      {cells(true)}
      <g className="cu-page-flip" style={o(122, 132)} opacity="0">
        <rect x="40" y="132" width="164" height="148" rx="14" fill={C.paper} stroke={C.border} strokeWidth="3" />
        {cells(false)}
      </g>
      <path d="M40 104C40 96 46 90 54 90H190C198 90 204 96 204 104V134H40Z" fill={C.orange} />
      <rect x="76" y="74" width="12" height="32" rx="6" fill={C.muted} />
      <rect x="156" y="74" width="12" height="32" rx="6" fill={C.muted} />
      <ClockFace cx={244} cy={244} r={78} />
      <g className="cu-hand-fast" style={o(244, 244)}>
        <line x1="244" y1="244" x2="244" y2="184" stroke={C.accent} strokeWidth="7" strokeLinecap="round" />
      </g>
      <line x1="244" y1="244" x2="282" y2="244" stroke={C.ink} strokeWidth="9" strokeLinecap="round" />
      <circle cx="244" cy="244" r="8" fill={C.ink} />
    </>
  );
}

/** A map: the route draws from home to the place, and the pin bounces. */
export function AppointmentGo() {
  return (
    <>
      <rect x="22" y="36" width="314" height="310" rx="24" fill={C.sage} />
      <path d="M22 140H336M22 262H336M120 36V346M250 36V346" stroke={C.paper} strokeWidth="18" />
      <rect x="140" y="58" width="90" height="62" rx="8" fill="#C7DCCB" />
      <rect x="40" y="160" width="62" height="84" rx="8" fill="#C7DCCB" />
      <rect x="270" y="160" width="48" height="84" rx="8" fill="#C7DCCB" />
      <rect x="140" y="282" width="90" height="46" rx="8" fill="#C7DCCB" />
      <path className="cu-route" pathLength={100} strokeDasharray="100" d="M76 300C76 262 120 262 150 262C190 262 250 262 250 210C250 170 270 140 290 132"
        stroke={C.accent} strokeWidth="9" strokeLinecap="round" fill="none" />
      <circle cx="76" cy="304" r="14" fill={C.sageInk} />
      <circle cx="76" cy="304" r="6" fill="white" />
      <ellipse className="cu-pin-shadow" cx="290" cy="136" rx="16" ry="6" fill={C.sageInk} opacity="0.3" style={o(290, 136)} />
      <g className="cu-pin">
        <path d="M290 134C268 108 258 92 258 76C258 58 272 44 290 44C308 44 322 58 322 76C322 92 312 108 290 134Z" fill={C.accent} />
        <circle cx="290" cy="76" r="12" fill="white" />
      </g>
    </>
  );
}

/** A building whose door swings open onto a warm light. */
export function BuildingVisit() {
  return (
    <>
      <Glow />
      <path d="M60 120L179 60L298 120Z" fill={C.muted} />
      <rect x="70" y="120" width="218" height="214" fill={C.paper} stroke={C.border} strokeWidth="3" />
      {[90, 150, 238].map((x) => [140, 196].map((y) => <rect key={`${x}${y}`} x={x} y={y} width="34" height="34" rx="5" fill={C.sage} />))}
      <rect x="154" y="250" width="50" height="84" rx="4" fill={C.orange} />
      <rect x="154" y="250" width="50" height="84" rx="4" fill="#FFD9A8" className="cu-light" opacity="0.6" />
      <g className="cu-door" style={o(154, 292)}>
        <rect x="154" y="250" width="50" height="84" rx="4" fill={WOOD_DARK} />
        <circle cx="194" cy="294" r="4" fill={GOLD} />
      </g>
      <rect x="140" y="334" width="78" height="10" rx="3" fill={C.bar} />
      <rect x="128" y="344" width="102" height="10" rx="3" fill={C.border} />
      <g className="cu-nudge-down">
        <path d="M179 214V236M168 226L179 238L190 226" stroke={C.accent} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
    </>
  );
}

/** An ID card and a letter drop into a bag. */
export function BringId() {
  return (
    <>
      <Glow />
      <defs>
        <clipPath id="cu-bag-clip"><rect x="0" y="0" width="358" height="226" /></clipPath>
      </defs>
      <path d="M128 222C128 170 230 170 230 222" stroke={C.cuff} strokeWidth="12" fill="none" />
      <g clipPath="url(#cu-bag-clip)">
        <g className="cu-drop-a">
          <g transform="rotate(-8 160 150)">
            <rect x="110" y="70" width="110" height="146" rx="6" fill={C.paper} stroke={C.border} strokeWidth="3" />
            <Bar x={126} y={94} w={70} />
            <Bar x={126} y={114} w={80} />
          </g>
        </g>
        <g className="cu-drop-b">
          <g transform="rotate(10 210 160)">
            <rect x="160" y="110" width="118" height="76" rx="10" fill="white" stroke={C.border} strokeWidth="3" />
            <rect x="160" y="110" width="118" height="16" rx="8" fill={C.sage} />
            <rect x="172" y="134" width="30" height="40" rx="5" fill={C.sage} />
            <circle cx="187" cy="148" r="8" fill="#A8C4B0" />
            <Bar x={212} y={140} w={52} h={8} />
            <Bar x={212} y={156} w={40} h={8} />
          </g>
        </g>
      </g>
      <path d="M92 222H266L250 346H108Z" fill={C.orange} />
      <path d="M92 222H266L262 246H96Z" fill="#E08A2E" />
    </>
  );
}

/** An envelope flies out of a phone. */
export function EmailSend() {
  return (
    <>
      <Glow />
      <g className="cu-trail" opacity="0.6">
        <path d="M150 160C180 120 220 96 262 88" stroke={C.accent} strokeWidth="5" strokeDasharray="4 14" strokeLinecap="round" fill="none" />
      </g>
      <rect x="66" y="132" width="122" height="236" rx="22" fill={C.ink} />
      <rect x="76" y="150" width="102" height="198" rx="14" fill={C.paper} />
      <rect x="92" y="176" width="70" height="48" rx="6" fill={C.softOrange} />
      <path d="M94 178L127 204L160 178" stroke={C.orange} strokeWidth="4" fill="none" strokeLinejoin="round" />
      <Bar x={92} y={240} w={70} />
      <Bar x={92} y={258} w={56} />
      <rect className="cu-glow-box" x="92" y="296" width="70" height="28" rx="10" fill={C.orange} stroke={C.accent} strokeWidth="3" />
      <g className="cu-fly">
        <g transform="translate(262 88)">
          <rect x="-42" y="-28" width="84" height="56" rx="7" fill="white" stroke={C.border} strokeWidth="3" />
          <path d="M-40 -26L0 6L40 -26" stroke={C.bar} strokeWidth="4" fill="none" strokeLinejoin="round" />
        </g>
      </g>
      <path d="M150 380L200 320L280 360L250 400Z" fill={C.sleeve} />
      <path d="M150 300C170 290 210 296 220 316L214 360C190 376 160 372 148 352Z" fill={C.skinDark} />
      <path d="M190 300L190 270" stroke={C.skin} strokeWidth="18" strokeLinecap="round" />
    </>
  );
}

/** A form on a phone: the fields fill in one by one, then a tick. */
export function OnlineForm() {
  const ys = [118, 172, 226];
  return (
    <>
      <Glow />
      <rect x="104" y="36" width="150" height="308" rx="26" fill={C.ink} />
      <rect x="114" y="54" width="130" height="272" rx="16" fill={C.paper} />
      <rect x="124" y="66" width="110" height="20" rx="10" fill={C.border} />
      {ys.map((y, i) => (
        <g key={y}>
          <Bar x={126} y={y - 16} w={50} h={8} />
          <rect x="124" y={y} width="110" height="30" rx="7" fill="white" stroke={C.bar} strokeWidth="3" />
          <g className={`cu-field cu-field-${i + 1}`} style={o(132, y + 15)}>
            <Bar x={132} y={y + 10} w={[80, 64, 72][i]} h={10} fill={C.pen} />
          </g>
        </g>
      ))}
      <rect x="124" y="276" width="110" height="34" rx="10" fill={C.orange} />
      <g className="cu-done" style={o(250, 280)}>
        <circle cx="250" cy="280" r="30" fill={C.green} />
        <Tick x={250} y={280} color="white" />
      </g>
    </>
  );
}

/** Coins travel from one bank to another. */
export function BankTransfer() {
  return (
    <>
      <Glow />
      <Bank x={84} y={226} s={0.9} />
      <Bank x={274} y={226} s={0.9} />
      <path d="M100 176C130 110 228 110 258 176" stroke={C.sageInk} strokeWidth="5" strokeDasharray="4 12" strokeLinecap="round" fill="none" />
      <path d="M244 164L260 180L266 158" stroke={C.sageInk} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {[1, 2, 3].map((i) => (
        <g key={i} className={`cu-hop cu-hop-${i}`}>
          <Coin cx={100} cy={170} r={16} />
        </g>
      ))}
    </>
  );
}

/** Equal coin stacks appear one after another: paying in parts. */
export function Instalments() {
  const xs = [82, 146, 210, 274];
  return (
    <>
      <Glow />
      <rect x="42" y="292" width="274" height="12" rx="6" fill={C.muted} />
      {xs.map((x, i) => (
        <g key={x}>
          <rect x={x - 24} y="314" width="48" height="30" rx="6" fill={i === 0 ? C.softOrange : C.border} />
          <rect x={x - 24} y="314" width="48" height="10" rx="5" fill={i === 0 ? C.orange : C.bar} />
          <g className={`cu-stack cu-stack-${i + 1}`}>
            {[0, 1, 2, 3].map((k) => (
              <g key={k}>
                <ellipse cx={x} cy={278 - k * 20} rx="26" ry="10" fill={GOLD_EDGE} />
                <rect x={x - 26} y={268 - k * 20} width="52" height="10" fill={GOLD_EDGE} />
                <ellipse cx={x} cy={268 - k * 20} rx="26" ry="10" fill={GOLD} />
              </g>
            ))}
          </g>
        </g>
      ))}
    </>
  );
}

/** Two choices; a finger picks one and it gets a tick. */
export function Decide() {
  return (
    <>
      <Glow />
      <rect x="30" y="86" width="138" height="190" rx="18" fill={C.paper} stroke={C.border} strokeWidth="4" />
      <circle cx="99" cy="140" r="30" fill={C.sage} />
      <Bar x={56} y={190} w={86} />
      <Bar x={56} y={210} w={66} />
      <g className="cu-pick" style={o(259, 181)}>
        <rect x="190" y="86" width="138" height="190" rx="18" fill={C.paper} stroke={C.border} strokeWidth="4" />
        <rect className="cu-pick-ring" x="190" y="86" width="138" height="190" rx="18" fill="none" stroke={C.accent} strokeWidth="6" />
        <rect x="229" y="110" width="60" height="60" rx="12" fill={C.softOrange} />
        <Bar x={216} y={190} w={86} />
        <Bar x={216} y={210} w={66} />
        <g className="cu-pick-tick">
          <circle cx="318" cy="92" r="24" fill={C.green} />
          <Tick x={318} y={92} s={0.8} color="white" />
        </g>
      </g>
      <g className="cu-choose">
        <g transform="translate(250 246)">
          <PointHand />
        </g>
      </g>
    </>
  );
}

/** Two speech bubbles take turns: talk to someone, ask for help. */
export function AskHelp() {
  return (
    <>
      <Glow />
      <g className="cu-say-a" style={o(70, 190)}>
        <path d="M40 80H206C220 80 230 90 230 104V164C230 178 220 188 206 188H96L64 214L70 188H40C26 188 16 178 16 164V104C16 90 26 80 40 80Z" fill={C.sage} />
        {[84, 124, 164].map((x, i) => <circle key={x} className={`cu-dot cu-dot-${i + 1}`} cx={x} cy="134" r="12" fill={C.sageInk} />)}
      </g>
      <g className="cu-say-b" style={o(300, 330)}>
        <path d="M152 216H318C332 216 342 226 342 240V290C342 304 332 314 318 314H292L298 340L262 314H152C138 314 128 304 128 290V240C128 226 138 216 152 216Z" fill={C.softOrange} />
        <Bar x={152} y={244} w={150} h={12} fill={C.orange} />
        <Bar x={152} y={270} w={110} h={12} fill={C.orange} />
      </g>
    </>
  );
}

/** A calm, softly pulsing attention sign. */
export function WarningAttention() {
  return (
    <>
      <Glow />
      <g className="cu-calm-ring" style={o(179, 200)}>
        <circle cx="179" cy="200" r="104" fill="none" stroke="#E8673F" strokeWidth="6" opacity="0.5" />
      </g>
      <circle cx="179" cy="200" r="96" fill="#FCE6DC" />
      <g className="cu-calm-breathe" style={o(179, 200)}>
        <circle cx="179" cy="200" r="74" fill="#F8D2C2" />
        <rect x="167" y="138" width="24" height="80" rx="12" fill="#A3391F" />
        <circle cx="179" cy="248" r="14" fill="#A3391F" />
      </g>
    </>
  );
}

/** A card with a reference number row; the magnifier finds it. */
export function IdNumberFind() {
  return (
    <>
      <Glow />
      <g transform="rotate(-4 179 200)">
        <rect x="34" y="96" width="290" height="190" rx="20" fill="white" stroke={C.border} strokeWidth="4" />
        <rect x="34" y="96" width="290" height="36" rx="18" fill={C.sage} />
        <rect x="34" y="114" width="290" height="18" fill={C.sage} />
        <rect x="56" y="150" width="72" height="92" rx="10" fill={C.sage} />
        <circle cx="92" cy="182" r="18" fill="#A8C4B0" />
        <path d="M64 242C66 214 118 214 120 242Z" fill="#A8C4B0" />
        <Bar x={146} y={156} w={120} h={10} />
        <Bar x={146} y={176} w={90} h={10} />
        <g className="cu-hit">
          <rect x="138" y="200" width="170" height="48" rx="10" fill={C.softOrange} stroke={C.accent} strokeWidth="4" />
        </g>
        {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={150 + i * 25} y="214" width="18" height="20" rx="4" fill={C.ink} opacity="0.75" />)}
      </g>
      <g className="cu-magnify">
        <g transform="translate(222 222)">
          <Magnifier r={48} />
        </g>
      </g>
    </>
  );
}

/** A meter: the reading wheels roll, the dial turns, and a phone takes the reading. */
export function MeterReading() {
  return (
    <>
      <Glow />
      <rect x="44" y="60" width="210" height="250" rx="22" fill="#D8DDE2" />
      <rect x="62" y="80" width="174" height="66" rx="10" fill={C.ink} />
      <defs>
        <clipPath id="cu-meter-clip"><rect x="72" y="90" width="154" height="46" rx="6" /></clipPath>
      </defs>
      <g clipPath="url(#cu-meter-clip)">
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <rect x={76 + i * 30} y="90" width="26" height="46" rx="4" fill={C.paper} />
            <g className={`cu-roll cu-roll-${i % 3}`}>
              {[-1, 0, 1].map((k) => <rect key={k} x={83 + i * 30} y={106 + k * 30} width="12" height="14" rx="3" fill={C.muted} />)}
            </g>
          </g>
        ))}
      </g>
      <circle cx="149" cy="226" r="54" fill={C.paper} stroke={C.steel} strokeWidth="6" />
      <g className="cu-hand-fast" style={o(149, 226)}>
        <line x1="149" y1="226" x2="149" y2="186" stroke={C.accent} strokeWidth="7" strokeLinecap="round" />
      </g>
      <circle cx="149" cy="226" r="8" fill={C.ink} />
      <rect x="70" y="290" width="22" height="40" rx="6" fill={C.steel} />
      <rect x="206" y="290" width="22" height="40" rx="6" fill={C.steel} />
      <g className="cu-flash" opacity="0">
        <circle cx="236" cy="160" r="60" fill="white" opacity="0.7" />
      </g>
      <g transform="rotate(12 290 250)">
        <rect x="244" y="160" width="96" height="176" rx="18" fill={C.ink} />
        <rect x="252" y="174" width="80" height="140" rx="10" fill={C.sage} />
        <rect x="264" y="200" width="56" height="34" rx="6" fill={C.ink} opacity="0.75" />
        <circle cx="292" cy="290" r="12" fill="white" />
      </g>
      <path d="M300 390L330 320L380 340L370 400Z" fill={C.sleeve} />
      <path d="M262 300C282 290 320 296 330 316L326 356C304 372 274 368 262 350Z" fill={C.skinDark} />
    </>
  );
}

/** Parts laid out; each gets a tick as it is checked. */
export function PartsCheck() {
  const ticks: [number, number][] = [[128, 92], [300, 120], [240, 190], [284, 276]];
  return (
    <>
      <rect x="20" y="40" width="318" height="300" rx="20" fill="#F3E2CC" />
      <rect x="44" y="70" width="70" height="200" rx="6" fill={WOOD} />
      <rect x="44" y="70" width="70" height="10" fill={WOOD_DARK} />
      <rect x="140" y="82" width="140" height="44" rx="6" fill={WOOD} />
      <rect x="140" y="116" width="140" height="10" fill={WOOD_DARK} />
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${152 + i * 34} 186)`}>
          <rect x="-4" y="0" width="8" height="34" rx="3" fill={C.steel} />
          <rect x="-11" y="-6" width="22" height="9" rx="4" fill={C.muted} />
        </g>
      ))}
      <path d="M190 280H262V300" stroke={C.ink} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {ticks.map(([x, y], i) => (
        <g key={i} className={`cu-check cu-check-${i + 1}`} style={o(x, y)}>
          <circle cx={x} cy={y} r="20" fill={C.green} />
          <Tick x={x} y={y} s={0.7} color="white" />
        </g>
      ))}
    </>
  );
}

/** A letter comes through the letterbox and lands on the mat. */
export function LetterArrive() {
  return (
    <>
      <rect x="0" y="0" width="358" height="380" fill={C.bg} />
      <rect x="54" y="0" width="250" height="330" fill={WOOD} />
      <rect x="78" y="24" width="202" height="100" rx="6" fill={WOOD_DARK} opacity="0.5" />
      <rect x="78" y="220" width="202" height="90" rx="6" fill={WOOD_DARK} opacity="0.5" />
      <rect x="114" y="150" width="130" height="36" rx="8" fill={C.steel} />
      <rect x="124" y="160" width="110" height="14" rx="4" fill={C.ink} />
      <rect x="0" y="330" width="358" height="50" fill={C.border} />
      <rect x="84" y="334" width="190" height="28" rx="8" fill={C.sage} />
      <defs>
        <clipPath id="cu-slot-clip"><rect x="0" y="167" width="358" height="213" /></clipPath>
      </defs>
      <g clipPath="url(#cu-slot-clip)">
        <g className="cu-arrive" style={o(179, 240)}>
          <rect x="134" y="168" width="90" height="62" rx="6" fill="white" stroke={C.border} strokeWidth="3" />
          <path d="M136 170L179 202L222 170" stroke={C.bar} strokeWidth="4" fill="none" strokeLinejoin="round" />
          <rect x="200" y="178" width="14" height="14" rx="2" fill={C.orange} />
        </g>
      </g>
    </>
  );
}

