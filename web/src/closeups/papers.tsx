// Letters, bills, forms and how-to close-ups. The highlight style follows Figma 11a-c / 30a-b:
// orange border, soft orange fill, sage-ink check marks. No words or digits anywhere.
import React from "react";
import { C, Glow, PenHand, PointHand, Bar, HANDSET, ClockFace } from "./parts";

const o = (x: number, y: number) => ({ transformOrigin: `${x}px ${y}px` });

/** A form sheet with a filled field above and a highlighted empty field. */
function FormSheet({ target }: { target: "box" | "line" }) {
  return (
    <>
      <rect x="40" y="36" width="278" height="330" rx="12" fill={C.paper} stroke={C.border} strokeWidth="3" />
      <circle cx="70" cy="66" r="12" fill={C.sage} />
      <Bar x={92} y={60} w={120} h={12} fill={C.muted} />
      <Bar x={62} y={98} w={90} />
      <rect x="62" y="114" width="232" height="46" rx="8" fill="white" stroke={C.border} strokeWidth="3" />
      <path d="M76 142c6-14 10-14 10-2s4 10 10-2 8-12 10 0 6 8 12-4M134 140c4-8 8-8 10 0s6 4 10-6" stroke={C.pen} strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <Bar x={62} y={182} w={110} />
      {target === "box" ? (
        <rect className="cu-glow-box" x="62" y="198" width="232" height="56" rx="8" fill={C.softOrange} stroke={C.accent} strokeWidth="5" />
      ) : (
        <>
          <rect className="cu-glow-box" x="62" y="198" width="232" height="64" rx="8" fill={C.softOrange} stroke={C.accent} strokeWidth="5" />
          <path d="M76 246L92 230M76 230L92 246" stroke={C.muted} strokeWidth="4" strokeLinecap="round" />
          <line x1="100" y1="248" x2="278" y2="248" stroke={C.muted} strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      <Bar x={62} y={290} w={70} />
      <rect x="62" y="306" width="232" height="40" rx="8" fill="white" stroke={C.border} strokeWidth="3" />
    </>
  );
}

export function WriteInBox() {
  // Handwriting is a wordless loop pattern; the pen moves along with it.
  return (
    <>
      <FormSheet target="box" />
      <path className="cu-ink" pathLength={100} strokeDasharray="100" d="M80 236c6-18 12-18 12-4s4 14 12-2 10-16 12 0 6 12 12-2 8-16 12-2 6 10 12-2 8-14 12 0 6 8 12-4 8-10 12 2 6 6 14-4"
        stroke={C.pen} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <g className="cu-pen-write">
        <g transform="translate(214 230)">
          <PenHand />
        </g>
      </g>
    </>
  );
}

export function SignHere() {
  return (
    <>
      <FormSheet target="line" />
      <path className="cu-ink" pathLength={100} strokeDasharray="100" d="M104 244c10-30 22-34 18-10s-6 20 6 4 18-30 16-8-2 16 10 4 14-20 18-6 8 6 20-6c10-10 20-12 34-8"
        stroke={C.pen} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <g className="cu-pen-write">
        <g transform="translate(238 236)">
          <PenHand />
        </g>
      </g>
      <g className="cu-nudge">
        <path d="M352 232H312M324 218L310 232L324 246" stroke={C.accent} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
    </>
  );
}

export function TickBox() {
  const rows = [86, 166, 246];
  return (
    <>
      <rect x="48" y="40" width="262" height="310" rx="12" fill={C.paper} stroke={C.border} strokeWidth="3" />
      {rows.map((y, i) => (
        <g key={y}>
          <rect className={i === 1 ? "cu-glow-box" : undefined} x="74" y={y} width="52" height="52" rx="8"
            fill={i === 1 ? C.softOrange : "white"} stroke={i === 1 ? C.accent : C.muted} strokeWidth={i === 1 ? 5 : 3} />
          <Bar x={146} y={y + 14} w={i === 1 ? 120 : 100} h={12} />
          <Bar x={146} y={y + 32} w={70} />
        </g>
      ))}
      <path className="cu-ink" pathLength={100} strokeDasharray="100" d="M84 192L96 206L118 176" stroke={C.sageInk} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <g className="cu-pen-tick">
        <g transform="translate(118 178)">
          <PenHand />
        </g>
      </g>
    </>
  );
}

export function PayCard() {
  return (
    <>
      <Glow />
      {/* card reader */}
      <rect x="56" y="96" width="132" height="236" rx="22" fill="#4A5560" />
      <rect x="72" y="114" width="100" height="78" rx="10" fill={C.sage} />
      <rect className="cu-amount" x="86" y="132" width="72" height="14" rx="7" fill={C.sageInk} opacity="0.5" />
      <path className="cu-paid" pathLength={100} strokeDasharray="100" d="M100 166L114 178L144 152" stroke={C.sageInk} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => <circle key={`${r}${c}`} cx={92 + c * 30} cy={222 + r * 30} r="10" fill="#6B7884" />),
      )}
      <g className="cu-waves" opacity="0.8">
        <path d="M200 120C210 130 210 146 200 156M214 110C230 126 230 150 214 166" stroke={C.accent} strokeWidth="6" strokeLinecap="round" fill="none" />
      </g>
      {/* card in a hand, tapping the reader */}
      <g className="cu-card-tap">
        <g transform="rotate(-14 270 170)">
          <rect x="196" y="110" width="150" height="96" rx="12" fill={C.blue} />
          <rect x="212" y="134" width="30" height="22" rx="4" fill="#E3B85C" />
          <rect x="196" y="176" width="150" height="10" fill={C.blueDark} />
          <Bar x={256} y={140} w={60} h={8} fill="#7FA6CF" />
        </g>
        <path d="M300 200L370 170V300L320 320Z" fill={C.sleeve} />
        <path d="M262 178C280 168 312 168 330 186L336 236C320 256 290 256 272 240Z" fill={C.skinDark} />
        <path d="M250 182L284 196" stroke={C.skin} strokeWidth="22" strokeLinecap="round" />
      </g>
    </>
  );
}

export function PayBank() {
  return (
    <>
      <Glow />
      {/* phone on the left */}
      <rect x="40" y="150" width="88" height="170" rx="18" fill={C.ink} />
      <rect x="48" y="164" width="72" height="140" rx="10" fill={C.paper} />
      <Bar x={58} y={180} w={52} h={10} fill={C.bar} />
      <rect x="58" y="270" width="52" height="22" rx="8" fill={C.orange} />
      {/* bank building on the right */}
      <path d="M210 150L280 112L350 150Z" fill={C.muted} />
      <rect x="214" y="150" width="132" height="12" fill={C.muted} />
      {[226, 260, 294, 328].map((x) => <rect key={x} x={x - 6} y="168" width="16" height="104" rx="4" fill={C.bar} />)}
      <rect x="206" y="276" width="148" height="18" rx="4" fill={C.muted} />
      {/* dashed path and a coin travelling along it */}
      <path d="M128 230C160 196 186 196 206 214" stroke={C.sageInk} strokeWidth="5" strokeDasharray="4 12" strokeLinecap="round" fill="none" />
      <g className="cu-coin">
        <circle cx="128" cy="230" r="18" fill="#E3B85C" stroke="#C99A3A" strokeWidth="4" />
      </g>
    </>
  );
}

export function PhoneCall() {
  return (
    <>
      <Glow />
      <g className="cu-ring-l">
        <path d="M100 120C84 140 84 170 100 190M76 104C52 134 52 176 76 206" stroke={C.accent} strokeWidth="7" strokeLinecap="round" fill="none" />
      </g>
      <g className="cu-ring-r">
        <path d="M258 120C274 140 274 170 258 190M282 104C306 134 306 176 282 206" stroke={C.accent} strokeWidth="7" strokeLinecap="round" fill="none" />
      </g>
      <g className="cu-buzz" style={o(179, 250)}>
        <rect x="124" y="62" width="110" height="224" rx="22" fill={C.ink} />
        <rect x="132" y="78" width="94" height="190" rx="14" fill={C.sage} />
        <circle cx="179" cy="132" r="24" fill="#A8C4B0" />
        <path d="M147 186C152 166 206 166 211 186Z" fill="#A8C4B0" />
        <circle cx="179" cy="236" r="20" fill={C.green} />
        <path d={HANDSET} fill="white" transform="translate(167 224)" />
      </g>
      {/* hand holding the phone from below */}
      <path d="M200 380L250 300L330 340L300 400Z" fill={C.sleeve} />
      <path d="M118 262C130 250 230 248 244 266L254 330C230 356 160 360 128 336Z" fill={C.skinDark} />
      <path d="M120 270L136 238" stroke={C.skin} strokeWidth="22" strokeLinecap="round" />
      <path d="M240 280L230 240M248 310L236 286" stroke={C.skin} strokeWidth="20" strokeLinecap="round" />
    </>
  );
}

export function GoOnline() {
  return (
    <>
      <Glow />
      <rect x="104" y="40" width="150" height="300" rx="26" fill={C.ink} />
      <rect x="114" y="58" width="130" height="262" rx="16" fill={C.paper} />
      <rect x="124" y="70" width="110" height="22" rx="11" fill={C.border} />
      <circle cx="136" cy="81" r="6" fill={C.muted} />
      <rect x="124" y="104" width="110" height="64" rx="8" fill={C.sage} />
      <circle cx="152" cy="130" r="12" fill="#A8C4B0" />
      <path d="M130 162L162 138L186 156L208 140L228 162Z" fill="#A8C4B0" />
      <Bar x={124} y={180} w={100} />
      <Bar x={124} y={198} w={80} />
      <Bar x={124} y={216} w={92} />
      <rect className="cu-glow-box" x="124" y="244" width="110" height="34" rx="10" fill={C.orange} />
      <g className="cu-ripple" opacity="0">
        <circle cx="200" cy="262" r="22" fill="none" stroke={C.accent} strokeWidth="5" />
      </g>
      <g className="cu-tap">
        <g transform="translate(200 266)">
          <PointHand />
        </g>
      </g>
    </>
  );
}

export function CalendarDate() {
  const cols = [86, 124, 162, 200, 238];
  const rows = [146, 182, 218, 254];
  return (
    <>
      <Glow />
      <rect x="66" y="64" width="226" height="250" rx="18" fill={C.paper} stroke={C.border} strokeWidth="3" />
      <path d="M66 82C66 72 74 64 84 64H274C284 64 292 72 292 82V116H66Z" fill={C.orange} />
      <rect x="112" y="44" width="14" height="40" rx="7" fill={C.muted} />
      <rect x="232" y="44" width="14" height="40" rx="7" fill={C.muted} />
      <Bar x={140} y={86} w={78} h={12} fill="#FBD2A6" />
      {rows.map((y, r) =>
        cols.map((x, c) => {
          const hit = r === 2 && c === 3;
          const past = r === 0 || (r === 1 && c < 4);
          return <rect key={`${r}${c}`} x={x} y={y} width="30" height="26" rx="6" fill={hit ? C.softOrange : past ? C.sage : C.border} />;
        }),
      )}
      <circle className="cu-ring-draw" cx="215" cy="231" r="27" fill="none" stroke={C.accent} strokeWidth="6" strokeLinecap="round"
        pathLength={100} strokeDasharray="100" transform="rotate(-80 215 231)" />
      <g className="cu-pulse" style={o(215, 231)}>
        <circle cx="215" cy="231" r="36" fill="none" stroke={C.accent} strokeWidth="3" opacity="0" />
      </g>
    </>
  );
}

export function PostLetter() {
  return (
    <>
      <Glow />
      <path d="M118 140C118 96 146 76 179 76C212 76 240 96 240 140Z" fill={C.red} />
      <rect x="110" y="132" width="138" height="20" rx="6" fill={C.redDark} />
      <rect x="124" y="152" width="110" height="240" fill={C.red} />
      <rect x="146" y="174" width="66" height="12" rx="6" fill={C.ink} />
      <rect x="150" y="214" width="58" height="40" rx="6" fill={C.redDark} opacity="0.5" />
      <rect x="110" y="356" width="138" height="24" fill={C.redDark} />
      <defs>
        <clipPath id="cu-post-clip">
          <rect x="0" y="0" width="358" height="180" />
        </clipPath>
      </defs>
      <g clipPath="url(#cu-post-clip)">
      <g className="cu-post">
        <g>
          <rect x="150" y="84" width="58" height="44" rx="5" fill={C.paper} stroke={C.border} strokeWidth="3" />
          <path d="M152 86L179 108L206 86" stroke={C.bar} strokeWidth="3" fill="none" strokeLinejoin="round" />
          <rect x="190" y="92" width="12" height="13" rx="2" fill={C.orange} />
        </g>
      </g>
      </g>
      <path d="M146 180H212" stroke={C.ink} strokeWidth="12" strokeLinecap="round" />
    </>
  );
}

export function BringDocument() {
  return (
    <>
      <Glow />
      <g className="cu-present" style={o(190, 300)}>
        <rect x="70" y="70" width="190" height="230" rx="10" fill={C.paper} stroke={C.border} strokeWidth="3" transform="rotate(-6 165 185)" />
        <g transform="rotate(4 200 190)">
          <rect x="110" y="132" width="200" height="126" rx="14" fill="white" stroke={C.border} strokeWidth="4" />
          <rect x="110" y="132" width="200" height="24" rx="12" fill={C.sage} />
          <rect x="124" y="170" width="60" height="74" rx="8" fill={C.sage} />
          <circle cx="154" cy="196" r="14" fill="#A8C4B0" />
          <path d="M132 244C134 222 174 222 176 244Z" fill="#A8C4B0" />
          <Bar x={198} y={176} w={92} h={10} />
          <Bar x={198} y={196} w={70} h={10} />
          <Bar x={198} y={216} w={84} h={10} />
        </g>
        <path d="M250 300L320 260L370 330L300 380Z" fill={C.sleeve} />
        <path d="M230 236C252 226 284 236 300 256L310 300C290 320 260 320 240 306Z" fill={C.skinDark} />
        <path d="M232 244L206 232" stroke={C.skin} strokeWidth="22" strokeLinecap="round" />
      </g>
    </>
  );
}

export function KeepSafe() {
  return (
    <>
      <Glow />
      <path d="M60 150H140L156 132H200V320H60Z" fill="#E08A2E" />
      <path d="M60 150H140L156 132H300V320H60Z" fill="#E08A2E" />
      <g className="cu-file">
        <rect x="96" y="70" width="166" height="200" rx="8" fill={C.paper} stroke={C.border} strokeWidth="3" />
        <Bar x={114} y={92} w={110} />
        <Bar x={114} y={112} w={130} />
        <Bar x={114} y={132} w={90} />
      </g>
      <path d="M48 196H310L296 330H62Z" fill={C.orange} />
      <rect x="150" y="240" width="60" height="16" rx="8" fill="#FBD2A6" />
    </>
  );
}

export function ClockWait() {
  return (
    <>
      <Glow />
      <ClockFace cx={179} cy={200} r={118} />
      <g className="cu-hand-slow" style={o(179, 200)}>
        <line x1="179" y1="200" x2="179" y2="140" stroke={C.ink} strokeWidth="10" strokeLinecap="round" />
      </g>
      <g className="cu-hand-fast" style={o(179, 200)}>
        <line x1="179" y1="200" x2="179" y2="110" stroke={C.accent} strokeWidth="7" strokeLinecap="round" />
      </g>
      <circle cx="179" cy="200" r="10" fill={C.ink} />
    </>
  );
}

export function ScrewdriverTurn() {
  return (
    <>
      <Glow />
      <rect x="20" y="290" width="318" height="60" rx="6" fill="#D9A877" />
      <path d="M40 310H140M200 326H320M60 336H120" stroke="#C08A57" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="179" cy="290" rx="20" ry="7" fill={C.steel} />
      <rect x="173" y="170" width="12" height="118" rx="3" fill={C.steel} />
      <defs>
        <clipPath id="cu-handle-clip">
          <rect x="152" y="58" width="54" height="120" rx="22" />
        </clipPath>
      </defs>
      <rect x="152" y="58" width="54" height="120" rx="22" fill={C.orange} />
      <g clipPath="url(#cu-handle-clip)">
        <g className="cu-grip">
          {[-36, -18, 0, 18, 36, 54, 72].map((x) => <rect key={x} x={152 + x} y="58" width="7" height="120" fill="#D97A22" />)}
        </g>
      </g>
      {/* hand gripping the handle from the right */}
      <path d="M230 40L330 0L358 90L260 120Z" fill={C.sleeve} />
      <path d="M200 76C230 60 262 70 270 100L262 150C240 166 214 160 202 146Z" fill={C.skinDark} />
      <path d="M210 92H156M210 118H156M210 144H160" stroke={C.skin} strokeWidth="20" strokeLinecap="round" />
      <g className="cu-turn-arrow">
        <path d="M112 196C112 218 246 218 246 196" stroke={C.sageInk} strokeWidth="6" strokeLinecap="round" fill="none" />
        <path d="M232 186L248 196L238 212" stroke={C.sageInk} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
    </>
  );
}

export function PlugIn() {
  return (
    <>
      <g className="cu-plug">
        <path d="M-10 230C40 230 60 210 90 200" stroke={C.ink} strokeWidth="14" fill="none" strokeLinecap="round" />
        <rect x="140" y="155" width="40" height="12" rx="2" fill={C.steel} />
        <rect x="140" y="206" width="40" height="12" rx="2" fill={C.steel} />
        <rect x="70" y="130" width="76" height="104" rx="16" fill={C.ink} />
        <path d="M40 330L90 280L150 340L110 390Z" fill={C.sleeve} />
        <path d="M70 230C90 220 130 222 146 240L140 290C120 306 90 304 76 290Z" fill={C.skinDark} />
        <path d="M84 238L84 206M108 236L110 208M130 240L132 214" stroke={C.skin} strokeWidth="18" strokeLinecap="round" />
      </g>
      <rect x="236" y="0" width="122" height="380" fill="#F3E6D4" />
      <rect x="246" y="118" width="100" height="140" rx="16" fill={C.paper} stroke={C.bar} strokeWidth="4" />
      <rect x="290" y="146" width="12" height="28" rx="2" fill={C.ink} />
      <rect x="262" y="206" width="26" height="12" rx="2" fill={C.ink} />
      <rect x="304" y="206" width="26" height="12" rx="2" fill={C.ink} />
    </>
  );
}
